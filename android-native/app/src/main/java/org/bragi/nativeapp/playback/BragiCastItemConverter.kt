package org.bragi.nativeapp.playback

import androidx.media3.cast.DefaultMediaItemConverter
import androidx.media3.cast.MediaItemConverter
import androidx.media3.common.MediaItem
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.util.UnstableApi
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaQueueItem

@androidx.annotation.OptIn(UnstableApi::class)
class BragiCastItemConverter : MediaItemConverter {
    private val delegate = DefaultMediaItemConverter()

    override fun toMediaQueueItem(mediaItem: MediaItem): MediaQueueItem {
        val art = mediaItem.mediaMetadata.extras?.getString("bragi.castArtworkUri")
        val itemForCast = if (art != null) mediaItem.buildUpon().setMediaMetadata(
            mediaItem.mediaMetadata.buildUpon().setArtworkUri(Uri.parse(art)).build()).build() else mediaItem
        val original = delegate.toMediaQueueItem(itemForCast).media!!
        val url = mediaItem.mediaMetadata.extras?.getString("bragi.castUri")
            ?: requireNotNull(mediaItem.localConfiguration).uri.toString()
        val custom = original.customData
        mediaItem.mediaMetadata.extras?.let {
            custom?.put("bragiCastUri", it.getString("bragi.castUri"))
            custom?.put("bragiCastArtworkUri", it.getString("bragi.castArtworkUri"))
            custom?.put("bragiCastContentType", it.getString("bragi.castContentType"))
            custom?.put("bragiDurationMs", it.getLong("bragi.durationMs"))
        }
        val infoBuilder = MediaInfo.Builder(url)
            .setContentType(mediaItem.mediaMetadata.extras?.getString("bragi.castContentType") ?: original.contentType ?: "audio/mpeg")
            .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
            .setMetadata(original.metadata)
            .setCustomData(custom)
        val duration = mediaItem.mediaMetadata.extras?.getLong("bragi.durationMs") ?: 0
        if (duration > 0) infoBuilder.setStreamDuration(duration)
        return MediaQueueItem.Builder(infoBuilder.build()).setAutoplay(true).build()
    }

    override fun toMediaItem(mediaQueueItem: MediaQueueItem): MediaItem {
        val item = delegate.toMediaItem(mediaQueueItem)
        val data = mediaQueueItem.media?.customData ?: return item
        val extras = Bundle().apply {
            putString("bragi.castUri", data.optString("bragiCastUri").takeIf { it.isNotBlank() })
            putString("bragi.castArtworkUri", data.optString("bragiCastArtworkUri").takeIf { it.isNotBlank() })
            putString("bragi.castContentType", data.optString("bragiCastContentType").takeIf { it.isNotBlank() })
            putLong("bragi.durationMs", data.optLong("bragiDurationMs"))
        }
        return item.buildUpon().setMediaMetadata(item.mediaMetadata.buildUpon().setExtras(extras).build()).build()
    }
}
