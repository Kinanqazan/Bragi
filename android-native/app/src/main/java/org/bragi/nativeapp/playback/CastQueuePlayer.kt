package org.bragi.nativeapp.playback

import androidx.media3.common.DeviceInfo
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi

/** Apply the same bounded loading when a new library queue is selected while casting. */
@androidx.annotation.OptIn(UnstableApi::class)
class CastQueuePlayer(player: Player, private val transfer: CastQueueTransfer) : ForwardingPlayer(player) {
    override fun setMediaItems(mediaItems: List<MediaItem>, startIndex: Int, startPositionMs: Long) {
        if (deviceInfo.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE && mediaItems.isNotEmpty()) {
            transfer.load(mediaItems, startIndex.coerceAtLeast(0), startPositionMs, playWhenReady, repeatMode, shuffleModeEnabled)
        } else super.setMediaItems(mediaItems, startIndex, startPositionMs)
    }
}
