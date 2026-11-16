package org.bragi.nativeapp.library

data class LyricLine(val text: String, val startMs: Long? = null)
data class Recommendation(val title: String, val artist: String, val recordingId: String?, val artwork: String?, val libraryId: String?)
data class Recommendations(val linked: Boolean, val user: String = "", val tracks: List<Recommendation> = emptyList(), val partialError: Boolean = false)

data class Track(
    val id: String,
    val uri: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val artworkUri: String? = null,
    val genre: String? = null,
    val genres: List<String> = emptyList(),
    val moods: List<String> = emptyList(),
    val starred: Boolean = false,
    val playCount: Long = 0,
    val added: String = "",
    val artistId: String = "",
    val albumId: String = "",
    val albumArtist: String = "",
    val discNumber: Int = 0,
    val trackNumber: Int = 0,
    val lastPlayedMs: Long = 0,
    val artistArtworkUri: String? = null,
    val contentType: String? = null,
    val castUri: String? = null,
    val castArtworkUri: String? = null,
    val castContentType: String? = null,
)

fun List<Track>.matching(query: String): List<Track> {
    val terms = query.trim().split(Regex("\\s+")).filter(String::isNotEmpty)
    if (terms.isEmpty()) return this
    return filter { track ->
        terms.all { term ->
            track.title.contains(term, ignoreCase = true) ||
                track.artist.contains(term, ignoreCase = true) ||
                track.album.contains(term, ignoreCase = true)
        }
    }
}

fun List<Track>.filterSongs(query: String, tag: String?, filter: String, favoritesOnly: Boolean = false): List<Track> {
    var result = matching(query)
    if (tag != null) result = result.filter { it.genre.equals(tag, true) || (it.genres + it.moods).any { value -> value.equals(tag, true) } }
    if (favoritesOnly) result = result.filter { it.starred }
    return when (filter) {
        "Favorites" -> result.filter { it.starred }
        "Recently added" -> result.sortedByDescending { it.added }
        "Most played" -> result.sortedByDescending { it.playCount }
        "Recently played" -> result.filter { it.lastPlayedMs > 0 }.sortedByDescending { it.lastPlayedMs }
        else -> result
    }
}


data class LibraryArtist(val key: String, val name: String, val tracks: List<Track>)
data class LibraryAlbum(val key: String, val name: String, val artist: String, val tracks: List<Track>)
private fun Track.artistKey() = artistId.ifBlank { artist.trim().lowercase() }
private fun Track.albumKey() = albumId.ifBlank { "${album.trim().lowercase()}|${albumArtist.ifBlank { artist }.trim().lowercase()}" }
fun List<Track>.artists(): List<LibraryArtist> = groupBy { it.artistKey() }.map { (key, songs) ->
    LibraryArtist(key, songs.first().artist, songs)
}.sortedWith(compareByDescending<LibraryArtist> { it.tracks.size }.thenBy { it.name.lowercase() })
fun List<Track>.albums(): List<LibraryAlbum> = groupBy { it.albumKey() }.map { (key, songs) ->
    val first = songs.first()
    LibraryAlbum(key, first.album, first.albumArtist.ifBlank { first.artist },
        songs.sortedWith(compareBy<Track> { if (it.discNumber > 0) it.discNumber else 1 }
            .thenBy { if (it.trackNumber > 0) it.trackNumber else Int.MAX_VALUE }.thenBy { it.title.lowercase() }))
}.sortedWith(compareBy<LibraryAlbum> { it.name.lowercase() }.thenBy { it.artist.lowercase() })
