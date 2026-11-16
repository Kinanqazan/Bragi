package org.bragi.nativeapp.playback

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.cast.CastPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaQueueData
import com.google.android.gms.cast.MediaQueueItem
import com.google.android.gms.cast.MediaStatus
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Load a bounded first batch, then insert the rest in order, as the WebView client does. */
@androidx.annotation.OptIn(UnstableApi::class)
class CastQueueTransfer(private val context: Context, private val scope: CoroutineScope, private val onHandoff: (Boolean) -> Unit,
    private val onError: (String?) -> Unit) : CastPlayer.TransferCallback {
    private val converter = BragiCastItemConverter()
    private val handler = Handler(Looper.getMainLooper())
    private var generation = 0
    private var preparation: Job? = null

    override fun transferState(sourcePlayer: Player, targetPlayer: Player) {
        if (targetPlayer.deviceInfo.playbackType != androidx.media3.common.DeviceInfo.PLAYBACK_TYPE_REMOTE) {
            generation++
            preparation?.cancel()
            onHandoff(false)
            onError(null)
            CastPlayer.TransferCallback.DEFAULT.transferState(sourcePlayer, targetPlayer)
            return
        }
        val items = (0 until sourcePlayer.mediaItemCount).map(sourcePlayer::getMediaItemAt)
        if (items.isNotEmpty()) {
            onHandoff(true)
            val operation = generation + 1
            handler.postDelayed({
                if (operation == generation && targetPlayer.currentMediaItem == null) {
                    onHandoff(false)
                    onError("The Cast device did not load the song. Please try again.")
                }
            }, 15_000)
            load(items, sourcePlayer.currentMediaItemIndex, sourcePlayer.currentPosition,
                sourcePlayer.playWhenReady, sourcePlayer.repeatMode, sourcePlayer.shuffleModeEnabled)
        }
    }

    fun load(items: List<MediaItem>, index: Int, position: Long, autoplay: Boolean, repeat: Int, shuffle: Boolean) {
        val operation = ++generation
        preparation?.cancel()
        onError(null)
        try {
            val session = CastContext.getSharedInstance(context).sessionManager.currentCastSession
            val client = session?.remoteMediaClient
            if (session == null || client == null || index !in items.indices) {
                generation++
                onHandoff(false)
                onError("Couldn’t connect to the Cast player. Please try again.")
                return
            }
            preparation = scope.launch {
                try {
                    val prepared = withContext(Dispatchers.Default) {
                        val batches = mutableListOf<MutableList<MediaQueueItem>>()
                        var batch = mutableListOf<MediaQueueItem>()
                        batches.add(batch)
                        var bytes = 0
                        var selectedBatch = 0
                        var selectedIndex = 0
                        items.forEachIndexed { i, item ->
                            coroutineContext.ensureActive()
                            val castItem = converter.toMediaQueueItem(item)
                            val size = castItem.toJson().toString().toByteArray(Charsets.UTF_8).size
                            require(size <= 48_000) { "Cast item exceeds message size" }
                            if (batch.isNotEmpty() && (batch.size >= 20 || bytes + size > 48_000)) {
                                batch = mutableListOf(); batches.add(batch); bytes = 0
                            }
                            if (i == index) { selectedBatch = batches.lastIndex; selectedIndex = batch.size }
                            batch.add(castItem); bytes += size
                        }
                        PreparedQueue(batches, selectedBatch, selectedIndex)
                    }
                    if (!current(operation, session)) return@launch
                    val repeatMode = when {
                        repeat == Player.REPEAT_MODE_ONE -> MediaStatus.REPEAT_MODE_REPEAT_SINGLE
                        shuffle -> MediaStatus.REPEAT_MODE_REPEAT_ALL_AND_SHUFFLE
                        repeat == Player.REPEAT_MODE_ALL -> MediaStatus.REPEAT_MODE_REPEAT_ALL
                        else -> MediaStatus.REPEAT_MODE_REPEAT_OFF
                    }
                    val data = MediaQueueData.Builder().setItems(prepared.batches[prepared.selectedBatch])
                        .setStartIndex(prepared.selectedIndex).setRepeatMode(repeatMode).build()
                    val request = MediaLoadRequestData.Builder().setQueueData(data).setAutoplay(autoplay)
                        .setCurrentTime(position.coerceAtLeast(0)).build()
                    client.load(request).setResultCallback { result ->
                        if (!current(operation, session)) return@setResultCallback
                        if (!result.status.isSuccess) {
                            generation++
                            Log.e("BragiPlayback", "Cast queue load failed: ${result.status.statusCode}")
                            onHandoff(false)
                            onError("Couldn’t load the song on the Cast device. Check that it can reach the music server.")
                        } else if (prepared.batches.size > 1) awaitIds(client, session, operation, prepared.batches, prepared.selectedBatch, 0)
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    if (operation != generation) return@launch
                    generation++
                    Log.e("BragiPlayback", "Could not prepare Cast queue", error)
                    onHandoff(false)
                    onError("Couldn’t prepare the Cast queue. Please try again.")
                }
            }
        } catch (error: Exception) {
            generation++
            Log.e("BragiPlayback", "Could not prepare Cast queue", error)
            onHandoff(false)
            onError("Couldn’t prepare the Cast queue. Please try again.")
        }
    }

    private data class PreparedQueue(val batches: List<List<MediaQueueItem>>, val selectedBatch: Int, val selectedIndex: Int)

    private fun current(operation: Int, session: CastSession): Boolean = operation == generation &&
        CastContext.getSharedInstance(context).sessionManager.currentCastSession === session

    private fun awaitIds(client: RemoteMediaClient, session: CastSession, operation: Int,
        batches: List<List<MediaQueueItem>>, first: Int, attempt: Int) {
        if (!current(operation, session)) return
        val firstId = client.mediaQueue.itemIds.firstOrNull() ?: client.mediaStatus?.queueItems?.firstOrNull()?.itemId ?: 0
        if (firstId != 0) insert(client, session, operation, batches, first, 0, firstId)
        else if (attempt < 30) handler.postDelayed({ awaitIds(client, session, operation, batches, first, attempt + 1) }, 100)
        else {
            Log.e("BragiPlayback", "Cast queue item IDs did not arrive")
            onError("The speaker loaded the song, but the rest of the queue could not be sent.")
        }
    }

    private fun insert(client: RemoteMediaClient, session: CastSession, operation: Int,
        batches: List<List<MediaQueueItem>>, first: Int, index: Int, firstId: Int) {
        if (!current(operation, session) || index >= batches.size) return
        if (index == first) { insert(client, session, operation, batches, first, index + 1, firstId); return }
        client.queueInsertItems(batches[index].toTypedArray(), if (index < first) firstId else 0, null)
            .setResultCallback { result ->
                if (!current(operation, session)) return@setResultCallback
                if (result.status.isSuccess) insert(client, session, operation, batches, first, index + 1, firstId)
                else {
                    Log.e("BragiPlayback", "Cast queue insert failed: ${result.status.statusCode}")
                    onError("The speaker loaded the song, but the rest of the queue could not be sent.")
                }
            }
    }
}
