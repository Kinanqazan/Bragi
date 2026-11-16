package org.bragi.nativeapp.playback

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.bragi.nativeapp.library.Track

fun Track.toMediaItem(): MediaItem = MediaItem.Builder()
    .setMediaId(id)
    .setUri(uri)
    .setMimeType(contentType)
    .setMediaMetadata(MediaMetadata.Builder()
        .setTitle(title)
        .setArtist(artist)
        .setAlbumTitle(album)
        .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        .setExtras(Bundle().apply {
            putLong("bragi.durationMs", durationMs)
            putString("bragi.castUri", castUri)
            putString("bragi.castArtworkUri", castArtworkUri)
            putString("bragi.castContentType", castContentType)
        })
        .setArtworkUri(artworkUri?.let(Uri::parse))
        .build())
    .build()

fun MediaItem.toTrack(durationMs: Long? = null, known: Track? = null): Track {
    val fallback = known?.takeIf { it.id == mediaId }
    return Track(
    id = mediaId,
    uri = localConfiguration?.uri?.toString().orEmpty(),
    title = mediaMetadata.title?.toString()?.takeIf { it.isNotBlank() } ?: fallback?.title ?: "Untitled",
    artist = mediaMetadata.artist?.toString()?.takeIf { it.isNotBlank() } ?: fallback?.artist ?: "Unknown artist",
    album = mediaMetadata.albumTitle?.toString()?.takeIf { it.isNotBlank() } ?: fallback?.album ?: "Unknown album",
    durationMs = (durationMs ?: mediaMetadata.extras?.getLong("bragi.durationMs") ?: fallback?.durationMs ?: 0).coerceAtLeast(0),
    artworkUri = mediaMetadata.artworkUri?.toString() ?: fallback?.artworkUri,
    contentType = localConfiguration?.mimeType,
    castUri = mediaMetadata.extras?.getString("bragi.castUri"),
    castArtworkUri = mediaMetadata.extras?.getString("bragi.castArtworkUri"),
    castContentType = mediaMetadata.extras?.getString("bragi.castContentType"),
)
}
