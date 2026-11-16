package org.bragi.nativeapp.library

import android.content.ContentUris
import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.os.Build
import android.provider.MediaStore
import androidx.core.net.toUri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext

/** Android indexes the files; we query that index instead of walking shared storage. */
class DeviceLibrary(context: Context) {
    private val resolver = context.applicationContext.contentResolver
    private val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

    fun changes(): Flow<Unit> = callbackFlow {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { trySend(Unit) }
        }
        resolver.registerContentObserver(collection, true, observer)
        trySend(Unit)
        awaitClose { resolver.unregisterContentObserver(observer) }
    }

    suspend fun tracks(folder: String = ""): List<Track> = withContext(Dispatchers.IO) {
        val projection = mutableListOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.ARTIST_ID,
            MediaStore.Audio.Media.TRACK,
        )
        if (Build.VERSION.SDK_INT >= 30) projection.add("genre")
        if (folder.isNotEmpty()) projection.add(if (Build.VERSION.SDK_INT >= 29) MediaStore.Audio.Media.RELATIVE_PATH else MediaStore.Audio.Media.DATA)
        if (folder.isNotEmpty() && Build.VERSION.SDK_INT >= 29) projection.add(MediaStore.Audio.Media.VOLUME_NAME)
        buildList {
            resolver.query(
                collection,
                projection.toTypedArray(),
                "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} > 0",
                null,
                "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC, ${MediaStore.Audio.Media._ID} ASC",
            )?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val albumIdColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                val genreColumn = cursor.getColumnIndex("genre")
                val artistIdColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST_ID)
                val trackColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
                val addedColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
                val pathColumn = if (folder.isNotEmpty()) cursor.getColumnIndexOrThrow(if (Build.VERSION.SDK_INT >= 29) MediaStore.Audio.Media.RELATIVE_PATH else MediaStore.Audio.Media.DATA) else -1
                while (cursor.moveToNext()) {
                    if (folder.isNotEmpty() && Build.VERSION.SDK_INT >= 29 && cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.VOLUME_NAME)) != "external_primary") continue
                    if (pathColumn >= 0) {
                        val path = cursor.getString(pathColumn).orEmpty()
                        val relative = if (Build.VERSION.SDK_INT >= 29) path else path.substringAfter("/storage/emulated/0/", "")
                        if (!relative.startsWith(folder.trimEnd('/') + "/", ignoreCase = true)) continue
                    }
                    val id = cursor.getLong(idColumn)
                    val albumId = cursor.getLong(albumIdColumn)
                    add(Track(
                        id = "device:$id",
                        uri = ContentUris.withAppendedId(collection, id).toString(),
                        title = cursor.getString(titleColumn).clean() ?: cursor.getString(nameColumn) ?: "Untitled",
                        artist = cursor.getString(artistColumn).clean() ?: "Unknown artist",
                        album = cursor.getString(albumColumn).clean() ?: "Unknown album",
                        durationMs = cursor.getLong(durationColumn).coerceAtLeast(0),
                        artworkUri = if (albumId > 0) ContentUris.withAppendedId(
                            "content://media/external/audio/albumart".toUri(), albumId,
                        ).toString() else null,
                        genre = if (genreColumn >= 0) cursor.getString(genreColumn).clean() else null,
                        added = cursor.getLong(addedColumn).toString().padStart(20, '0'),
                        artistId = cursor.getLong(artistIdColumn).takeIf { it > 0 }?.toString().orEmpty(),
                        albumId = albumId.takeIf { it > 0 }?.toString().orEmpty(),
                        discNumber = cursor.getInt(trackColumn) / 1000,
                        trackNumber = cursor.getInt(trackColumn) % 1000,
                    ))
                }
            }
        }
    }

    private fun String?.clean() = this?.trim()?.takeUnless { it.isBlank() || it == "<unknown>" }
}
