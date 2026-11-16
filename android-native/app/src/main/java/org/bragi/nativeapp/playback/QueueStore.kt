package org.bragi.nativeapp.playback

import android.content.Context
import android.util.AtomicFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.bragi.nativeapp.library.Track
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class SavedQueue(
    val tracks: List<Track>,
    val index: Int,
    val positionMs: Long,
    val shuffle: Boolean = false,
)

/** Versioned and deliberately independent of Android/Media3 objects for migration and tests. */
object QueueCodec {
    fun encode(queue: SavedQueue): String = JSONObject().apply {
        put("version", 1)
        put("index", queue.index)
        put("positionMs", queue.positionMs)
        put("shuffle", queue.shuffle)
        put("tracks", JSONArray().apply {
            queue.tracks.forEach { track ->
                put(JSONObject().apply {
                    put("id", track.id)
                    put("uri", track.uri)
                    put("title", track.title)
                    put("artist", track.artist)
                    put("album", track.album)
                    put("durationMs", track.durationMs)
                    put("artworkUri", track.artworkUri ?: JSONObject.NULL)
                })
            }
        })
    }.toString()

    fun decode(json: String): SavedQueue? = runCatching {
        val root = JSONObject(json)
        require(root.getInt("version") == 1)
        val items = root.getJSONArray("tracks")
        val tracks = (0 until items.length()).map { index ->
            val item = items.getJSONObject(index)
            Track(
                id = item.getString("id").also { require(it.isNotBlank()) },
                uri = item.getString("uri").also { require(it.isNotBlank()) },
                title = item.getString("title"),
                artist = item.getString("artist"),
                album = item.getString("album"),
                durationMs = item.optLong("durationMs", 0).coerceAtLeast(0),
                artworkUri = if (item.isNull("artworkUri")) null else item.getString("artworkUri"),
            )
        }
        if (tracks.isEmpty()) null else SavedQueue(
            tracks,
            root.optInt("index", 0).coerceIn(tracks.indices),
            root.optLong("positionMs", 0).coerceAtLeast(0),
            root.optBoolean("shuffle", false),
        )
    }.getOrNull()
}

class QueueStore(context: Context) {
    private val file = AtomicFile(File(context.filesDir, "playback-queue.json"))
    private val mutex = Mutex()

    suspend fun read(): SavedQueue? = withContext(Dispatchers.IO) {
        mutex.withLock {
            runCatching { QueueCodec.decode(file.openRead().bufferedReader().use { it.readText() }) }.getOrNull()
        }
    }

    suspend fun write(queue: SavedQueue) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val bytes = QueueCodec.encode(queue).toByteArray(Charsets.UTF_8)
            val stream = file.startWrite()
            try {
                stream.write(bytes)
                file.finishWrite(stream)
            } catch (failure: Exception) {
                file.failWrite(stream)
                throw failure
            }
        }
    }
}
