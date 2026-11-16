package org.bragi.nativeapp.playback

import org.bragi.nativeapp.library.Track
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class QueueCodecTest {
    private val tracks = listOf(
        Track("device:17", "content://media/external/audio/media/17", "Björk — Jóga", "Björk", "Homogenic", 305_000),
        Track("device:18", "content://media/external/audio/media/18", "Night \"Walk\"", "坂本龍一", "1996", 270_000,
            "content://media/external/audio/albumart/2"),
    )

    @Test fun `restoring a paused session preserves ordered songs metadata and seek position`() {
        val before = SavedQueue(tracks, index = 1, positionMs = 123_456, shuffle = true)
        assertEquals(before, QueueCodec.decode(QueueCodec.encode(before)))
    }

    @Test fun `stale index and negative position do not prevent recovering a queue`() {
        val json = QueueCodec.encode(SavedQueue(tracks, index = 400, positionMs = -12))
        val restored = QueueCodec.decode(json)!!
        assertEquals(1, restored.index)
        assertEquals(0L, restored.positionMs)
        assertEquals(tracks, restored.tracks)
    }

    @Test fun `truncated or unsupported saved data cannot crash startup`() {
        assertNull(QueueCodec.decode("{\"tracks\":"))
        assertNull(QueueCodec.decode(JSONObject(QueueCodec.encode(SavedQueue(tracks, 0, 0)))
            .put("version", 99).toString()))
        assertNull(QueueCodec.decode(QueueCodec.encode(SavedQueue(emptyList(), 0, 0))))
    }

    @Test fun `missing track URI rejects the snapshot rather than restoring unplayable items`() {
        val json = JSONObject(QueueCodec.encode(SavedQueue(tracks, 0, 0)))
        json.getJSONArray("tracks").getJSONObject(0).remove("uri")
        assertNull(QueueCodec.decode(json.toString()))
    }

    @Test fun `older queues with repeat mode still restore`() {
        val json = JSONObject(QueueCodec.encode(SavedQueue(tracks, 0, 0))).put("repeatMode", 2)
        assertEquals(SavedQueue(tracks, 0, 0), QueueCodec.decode(json.toString()))
    }
}
