package org.bragi.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.google.android.gms.cast.MediaInfo
import org.bragi.nativeapp.library.Track
import org.bragi.nativeapp.playback.BragiCastItemConverter
import org.bragi.nativeapp.playback.toMediaItem
import org.bragi.nativeapp.playback.toTrack
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CastMediaItemTest {
    @Test fun incompletePlaybackMetadataUsesOnlyTheMatchingKnownTrack() {
        val known = Track("server:1", "https://server.test/1", "Known title", "Known artist", "Known album", 120000,
            artworkUri = "https://server.test/cover")
        val partial = MediaItem.Builder().setMediaId(known.id).build()
        val restored = partial.toTrack(known = known)
        assertEquals(known.title, restored.title)
        assertEquals(known.artist, restored.artist)
        assertEquals(known.artworkUri, restored.artworkUri)

        val wrongTrack = partial.toTrack(known = known.copy(id = "server:2"))
        assertEquals("Untitled", wrongTrack.title)
        val titled = partial.buildUpon().setMediaMetadata(MediaMetadata.Builder().setTitle("Untitled").build()).build()
        assertEquals("Untitled", titled.toTrack(known = known).title)
    }

    @Test fun receiverGetsReachableUrlAndPhoneCanRecoverOriginal() {
        val track = Track("server:1", "https://server.test/rest/stream?id=1", "Title", "Artist", "Album", 120000,
            contentType = "audio/flac", castUri = "http://192.168.1.5/rest/stream?id=1",
            castContentType = "audio/flac")
        val converter = BragiCastItemConverter()
        val queueItem = converter.toMediaQueueItem(track.toMediaItem())
        val info = queueItem.media!!
        assertEquals(track.castUri, info.contentId)
        assertEquals("audio/flac", info.contentType)
        assertEquals(MediaInfo.STREAM_TYPE_BUFFERED, info.streamType)
        val restored = converter.toMediaItem(queueItem).toTrack()
        assertEquals(track.id, restored.id)
        assertEquals(track.uri, restored.uri)
        assertEquals(track.castUri, restored.castUri)
    }
}
