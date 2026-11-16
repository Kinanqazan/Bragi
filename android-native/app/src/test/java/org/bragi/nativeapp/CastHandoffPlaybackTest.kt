package org.bragi.nativeapp

import org.bragi.nativeapp.library.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CastHandoffPlaybackTest {
    private val track = Track("server:1", "https://example.test/1", "Song", "Artist", "Album", 90_000)
    private val previous = PlaybackState(connected = true, track = track, queue = listOf(track), queueIndex = 0,
        positionMs = 2_000, durationMs = 90_000, canSeek = true)

    @Test fun keepsTrackWhileReceiverHasNoMedia() {
        val state = keepPlayerDuringTransition(previous, PlaybackState(connected = true, remote = true), true)
        assertEquals(track, state.track)
        assertEquals(previous.queue, state.queue)
        assertEquals(2_000L, state.positionMs)
        assertTrue(state.buffering)
        assertFalse(state.canSeek)
    }

    @Test fun usesReceiverTrackOrClearsAfterFailure() {
        val receiver = PlaybackState(connected = true, remote = true, track = track.copy(title = "Receiver"))
        assertEquals(receiver, keepPlayerDuringTransition(previous, receiver, true))
        assertNull(keepPlayerDuringTransition(previous, PlaybackState(remote = true), false).track)
    }

    @Test fun keepsNewSelectionVisibleUntilPlayerReportsIt() {
        val selected = track.copy(id = "server:2", title = "Next song")
        val during = keepPlayerDuringTransition(previous, previous.copy(remote = true, track = null), false, selected)
        assertEquals(selected, during.track)
        assertTrue(during.buffering)
        val loaded = previous.copy(remote = true, track = selected)
        assertEquals(loaded, keepPlayerDuringTransition(previous, loaded, false, selected))
    }

    @Test fun optimisticSelectionDoesNotEndProtectionBeforeReceiverIsReady() {
        val selected = track.copy(id = "server:2")
        val optimistic = PlaybackState(remote = true, track = selected, buffering = true)
        assertFalse(selectionIsReady(selected, optimistic, false))
        val empty = PlaybackState(remote = true)
        assertEquals(selected, keepPlayerDuringTransition(optimistic, empty, false, selected).track)
        assertTrue(selectionIsReady(selected, optimistic.copy(buffering = false), true))
    }
}
