package org.bragi.nativeapp.playback

import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.cast.CastPlayer
import androidx.media3.cast.RemoteCastPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.bragi.nativeapp.BragiApplication
import org.bragi.nativeapp.MainActivity
import org.bragi.nativeapp.library.ServerLibrary
import org.bragi.nativeapp.library.ServerSettings
import android.os.SystemClock

@androidx.annotation.OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val saves = Channel<SavedQueue>(Channel.CONFLATED)
    private lateinit var player: Player
    private var session: MediaSession? = null
    private var restoring = false
    private var timelineChanged = false
    private var cachedTracks = emptyList<org.bragi.nativeapp.library.Track>()
    private var reportingId: String? = null
    private var reportingServer: ServerLibrary? = null
    private var listeningMs = 0L
    private var lastTick = 0L
    private var reported = false
    private var reportingDuration = 0L

    private fun startReporting(item: androidx.media3.common.MediaItem?) {
        reportingId = item?.mediaId?.takeIf { it.startsWith("server:") }
        val saved = if (reportingId != null) runCatching { ServerSettings(this).loadServer() }.getOrNull() else null
        reportingServer = saved?.let { ServerLibrary(it.address, it.username, it.password, pinnedFingerprint = it.fingerprint) }
        listeningMs = 0; reported = false; reportingDuration = 0
        lastTick = if (player.isPlaying) SystemClock.elapsedRealtime() else 0
    }

    private fun accumulateListening() {
        if (lastTick == 0L) return
        val now = SystemClock.elapsedRealtime()
        listeningMs += (now - lastTick).coerceAtLeast(0)
        lastTick = now
    }

    private fun reportIfEligible(completed: Boolean = false) {
        val id = reportingId ?: return
        val server = reportingServer ?: return
        if (reported) return
        val shortFinished = completed && reportingDuration in 1 until 30_000 && listeningMs >= (reportingDuration - 1500).coerceAtLeast(1)
        if (listeningMs < 30_000 && !shortFinished) return
        reported = true
        val duration = if (shortFinished) reportingDuration else listeningMs
        CoroutineScope(Dispatchers.IO).launch {
            try { server.reportPlay(id, duration) }
            catch (error: Exception) { Log.w("BragiPlayback", "Could not report a server play", error) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        val store = (application as BragiApplication).queueStore
        val localPlayer = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(), true)
            setHandleAudioBecomingNoisy(true)
            setWakeMode(C.WAKE_MODE_LOCAL)
        }
        player = try {
            val remotePlayer = RemoteCastPlayer.Builder(this).setMediaItemConverter(BragiCastItemConverter()).build()
            val app = application as BragiApplication
            val transfer = CastQueueTransfer(this, scope, { app.castHandoff.value = it }) { appError -> app.castError.value = appError }
            val castPlayer = CastPlayer.Builder(this).setLocalPlayer(localPlayer).setRemotePlayer(remotePlayer)
                .setTransferCallback(transfer).build()
            CastQueuePlayer(castPlayer, transfer)
        } catch (error: Exception) {
            Log.w("BragiPlayback", "Cast is unavailable; using phone playback", error)
            localPlayer
        }
        val openApp = PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        session = MediaSession.Builder(this, player)
            .setSessionActivity(openApp)
            .setCallback(object : MediaSession.Callback {
                override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult =
                    if (controller.packageName == packageName || controller.isTrusted) {
                        super.onConnect(session, controller)
                    } else MediaSession.ConnectionResult.reject()
            })
            .build()

        scope.launch {
            for (snapshot in saves) {
                try { store.write(snapshot) } catch (error: Exception) {
                    Log.e("BragiPlayback", "Could not save playback state", error)
                }
            }
        }
        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
                if ((application as BragiApplication).castHandoff.value) return
                accumulateListening()
                reportIfEligible(completed = reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO)
                startReporting(mediaItem)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                accumulateListening()
                lastTick = if (isPlaying) SystemClock.elapsedRealtime() else 0
            }

            override fun onEvents(player: Player, events: Player.Events) {
                if (player.duration > 0) reportingDuration = player.duration
                if (player.playbackState == Player.STATE_ENDED) {
                    accumulateListening()
                    reportIfEligible(completed = true)
                }
                if (events.contains(Player.EVENT_TIMELINE_CHANGED)) {
                    timelineChanged = true
                    cachedTracks = (0 until player.mediaItemCount).map { player.getMediaItemAt(it).toTrack() }
                }
                if (!restoring && (
                    events.contains(Player.EVENT_TIMELINE_CHANGED) ||
                    events.contains(Player.EVENT_MEDIA_ITEM_TRANSITION) ||
                    events.contains(Player.EVENT_PLAY_WHEN_READY_CHANGED) ||
                    events.contains(Player.EVENT_POSITION_DISCONTINUITY) ||
                    events.contains(Player.EVENT_SHUFFLE_MODE_ENABLED_CHANGED)
                )) save()
            }
        })
        scope.launch {
            val saved = store.read()
            // A user command received while reading disk always wins over restoration.
            if (saved != null && !timelineChanged && player.mediaItemCount == 0) {
                restoring = true
                player.setMediaItems(saved.tracks.map { it.toMediaItem() }, saved.index, saved.positionMs)
                player.shuffleModeEnabled = saved.shuffle
                // Restore paused. Starting playback is always an explicit user action.
                restoring = false
            }
        }
        scope.launch {
            while (true) {
                delay(1_000)
                accumulateListening()
                if (player.isPlaying && SystemClock.elapsedRealtime() / 1000 % 5 == 0L) save()
            }
        }
    }

    private fun save() {
        if (timelineChanged) {
            // Server stream URLs contain authentication tokens. Do not write them to disk.
            val safeTracks = if (cachedTracks.any { it.uri.startsWith("http://") || it.uri.startsWith("https://") }) emptyList() else cachedTracks
            saves.trySend(SavedQueue(safeTracks, player.currentMediaItemIndex.coerceAtLeast(0),
                player.currentPosition.coerceAtLeast(0), player.shuffleModeEnabled))
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onDestroy() {
        accumulateListening()
        reportIfEligible(completed = player.playbackState == Player.STATE_ENDED)
        // Frequent snapshots and pause/seek snapshots avoid doing blocking disk I/O here.
        session?.release()
        (application as BragiApplication).castHandoff.value = false
        player.release()
        saves.close()
        scope.cancel()
        super.onDestroy()
    }
}
