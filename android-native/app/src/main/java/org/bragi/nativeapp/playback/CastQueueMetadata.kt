package org.bragi.nativeapp.playback

import android.content.Context
import androidx.media3.common.DeviceInfo
import androidx.media3.common.Player
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.media.MediaQueue
import org.bragi.nativeapp.library.Track

/** Loads Cast's lazy queue metadata without changing the receiver's playback queue. */
class CastQueueMetadata(private val context: Context) {
    private var castQueue: MediaQueue? = null
    private val tracks = mutableMapOf<Int, Track>()
    private var cursor = 0
    private val converter = BragiCastItemConverter()

    private fun receiverQueue(): MediaQueue? = runCatching {
        CastContext.getSharedInstance(context).sessionManager.currentCastSession
            ?.remoteMediaClient?.mediaQueue
    }.getOrNull()

    fun receiverIds(): List<Int>? = receiverQueue()?.itemIds?.toList()

    fun read(player: Player): List<Track?>? {
        if (player.deviceInfo.playbackType != DeviceInfo.PLAYBACK_TYPE_REMOTE) {
            castQueue = null
            tracks.clear()
            return null
        }
        val remote = receiverQueue() ?: return null
        if (remote !== castQueue) {
            castQueue = remote
            tracks.clear()
            cursor = player.currentMediaItemIndex.coerceAtLeast(0)
        }
        val ids = remote.itemIds
        if (ids.size != player.mediaItemCount || ids.isEmpty()) return null
        tracks.keys.retainAll(ids.toSet())
        ids.forEachIndexed { index, id ->
            val item = remote.getItemAtIndex(index, false)
            if (item?.media != null) {
                val track = runCatching { converter.toMediaItem(item).toTrack() }.getOrNull()
                if (track != null && track.id.isNotBlank()) tracks[id] = track
            }
        }
        // Avoid pairing a new receiver queue with an older controller timeline.
        var matched = false
        var mismatch = false
        ids.indices.forEach { index ->
            val timelineId = player.getMediaItemAt(index).mediaId
            val castId = tracks[ids[index]]?.id
            if (timelineId.isNotBlank() && castId != null) {
                matched = true
                if (timelineId != castId) mismatch = true
            }
        }
        val result = if (matched && !mismatch) ids.map { tracks[it] } else null
        // Cast limits outstanding item requests, so fetch a small rotating batch.
        var requested = 0
        var scanned = 0
        while (requested < 8 && scanned < ids.size) {
            val index = cursor % ids.size
            cursor = (index + 1) % ids.size
            scanned++
            if (ids[index] !in tracks) {
                remote.getItemAtIndex(index, true)
                requested++
            }
        }
        return result
    }
}
