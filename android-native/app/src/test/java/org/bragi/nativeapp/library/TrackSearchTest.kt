package org.bragi.nativeapp.library

import org.junit.Assert.assertEquals
import org.junit.Test

class TrackSearchTest {
    private val tracks = listOf(
        Track("1", "content://songs/1", "Jóga", "Björk", "Homogenic", 1),
        Track("2", "content://songs/2", "All Is Full of Love", "Björk", "Homogenic", 1),
        Track("3", "content://songs/3", "Blue in Green", "Miles Davis", "Kind of Blue", 1),
    )

    @Test fun `search terms can match across title artist and album`() {
        assertEquals(listOf(tracks[2]), tracks.matching("  MILES   blue  "))
        assertEquals(listOf(tracks[0]), tracks.matching("Björk Jóga"))
    }

    @Test fun `all terms must match and search leaves original queue order intact`() {
        assertEquals(tracks.take(2), tracks.matching("HOMOGENIC"))
        assertEquals(emptyList<Track>(), tracks.matching("Miles Homogenic"))
        assertEquals(tracks, tracks.matching("   "))
    }

    @Test fun `metadata facets favorites and listening orders combine with search`() {
        val songs = listOf(
            tracks[0].copy(moods = listOf("Relax"), starred = true, playCount = 2, added = "2024"),
            tracks[1].copy(genres = listOf("Jazz"), playCount = 9, added = "2025"),
            tracks[2].copy(genres = listOf("Jazz"), starred = true, playCount = 4, added = "2023"),
        )
        assertEquals(listOf(songs[0]), songs.filterSongs("björk", "relax", "Favorites"))
        assertEquals(listOf(songs[1], songs[2]), songs.filterSongs("", "jazz", "Most played"))
        assertEquals(listOf(songs[0], songs[2]), songs.filterSongs("", null, "Favorites"))
        assertEquals(listOf(songs[1], songs[0], songs[2]), songs.filterSongs("", null, "Recently added"))
        assertEquals(listOf(songs[2], songs[0]), songs.filterSongs("", null, "Most played", favoritesOnly = true))
    }

    @Test fun `same named mood and genre filter independently`() {
        val songs = listOf(tracks[0].copy(moods = listOf("Chill")), tracks[1].copy(genres = listOf("Chill")))
        assertEquals(listOf(songs[0]), songs.filterSongs("", "chill", "All", mood = true))
        assertEquals(listOf(songs[1]), songs.filterSongs("", "chill", "All", mood = false))
    }

    @Test fun `recently played excludes unplayed tracks and combines with favorites and search`() {
        val songs = listOf(tracks[0].copy(lastPlayedMs = 10, starred = true),
            tracks[1].copy(lastPlayedMs = 30), tracks[2].copy(lastPlayedMs = 20, starred = true))
        assertEquals(listOf(songs[1], songs[2], songs[0]), (songs + tracks[0]).filterSongs("", null, "Recently played"))
        assertEquals(listOf(songs[2], songs[0]), songs.filterSongs("", null, "Recently played", favoritesOnly = true))
        assertEquals(listOf(songs[1], songs[0]), songs.filterSongs("Björk", null, "Recently played"))
    }
}
