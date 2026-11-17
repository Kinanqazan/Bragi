package org.bragi.nativeapp

import org.bragi.nativeapp.library.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SelectedQueueTest {
    private val songs = listOf(
        Track("one", "uri:one", "First", "Artist", "Album", 1000),
        Track("two", "uri:two", "Second", "Artist", "Album", 2000),
        Track("three", "uri:three", "Third", "Artist", "Album", 3000),
    )

    @Test fun sparseCastTimelineReusesSelectedSongs() {
        assertEquals(songs, matchingSelectedQueue(songs, listOf("one", "", "three")))
    }

    @Test fun changedOrUnidentifiedQueueDoesNotReuseWrongSongs() {
        assertNull(matchingSelectedQueue(songs, listOf("one", "", "other")))
        assertNull(matchingSelectedQueue(songs, listOf("", "", "")))
        assertNull(matchingSelectedQueue(songs + songs, listOf("one", "two")))
    }

    @Test fun partialCastQueueReusesKnownSongsWhenItsPositionIsUnambiguous() {
        assertEquals(songs.subList(1, 3), matchingSelectedQueue(songs, listOf("two", "")))
    }
}
