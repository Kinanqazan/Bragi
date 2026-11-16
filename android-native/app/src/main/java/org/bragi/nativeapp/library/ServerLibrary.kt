package org.bragi.nativeapp.library

import android.net.Uri
import android.util.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONTokener
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom

class ServerLibrary(address: String, private val username: String, private val password: String, private val allowUntrusted: Boolean = false, private val pinnedFingerprint: String? = null) {
    var trustedFingerprint: String? = null
        private set
    private val base = Uri.parse(address.trim().trimEnd('/').removeSuffix("/app")).also {
        require(it.scheme in listOf("http", "https") && !it.host.isNullOrBlank() && it.userInfo == null && it.query == null && it.fragment == null) { "Enter a valid server address starting with http:// or https://" }
    }
    private val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
    private val token = MessageDigest.getInstance("MD5").digest((password + salt).toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    private inline fun <T> diagnoseLoad(stage: String, block: () -> T): T = try {
        block()
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        val types = generateSequence(error as Throwable?) { it.cause?.takeIf { cause -> cause !== it } }
            .take(5).joinToString(" -> ") { it.javaClass.name }
        Log.w("BragiServerDiag", "[DEBUG-server-load] stage=$stage exception=$types")
        throw error
    }

    private fun url(endpoint: String, params: Map<String, String> = emptyMap()): String {
        val uri = base.buildUpon().appendPath("rest").appendPath(endpoint)
            .appendQueryParameter("u", username).appendQueryParameter("t", token)
            .appendQueryParameter("s", salt).appendQueryParameter("v", "1.16.1")
            .appendQueryParameter("c", "BragiNative").appendQueryParameter("f", "json")
        params.forEach { (key, value) -> uri.appendQueryParameter(key, value) }
        return uri.build().toString()
    }

    private fun request(endpoint: String, params: Map<String, String> = emptyMap()): JSONObject {
        val connection = URL(url(endpoint, params)).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            val root = JSONObject(connection.inputStream.bufferedReader().use { it.readText() }).getJSONObject("subsonic-response")
            if (root.optString("status") != "ok") throw IllegalStateException(root.optJSONObject("error")?.optString("message") ?: "Server request failed")
            return root
        } finally { connection.disconnect() }
    }

    suspend fun load(): Pair<List<Track>, List<String>> = withContext(Dispatchers.IO) {
        if ((allowUntrusted || pinnedFingerprint != null || trustedFingerprint != null) && base.scheme == "https") {
            trustedFingerprint = diagnoseLoad("tls") { ServerTls.trustServerCertificate(base.host!!, if (base.port == -1) 443 else base.port) }
        }
        diagnoseLoad("ping") { request("ping") }
        val castBase = runCatching {
            val indexUrl = base.buildUpon().appendPath("app").appendPath("").build().toString()
            val connection = URL(indexUrl).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 6000; connection.readTimeout = 6000
                val html = connection.inputStream.bufferedReader().use { it.readText() }
                val marker = html.indexOf("window.__APP_CONFIG__")
                if (marker < 0) null else {
                    val equals = html.indexOf('=', marker)
                    val value = JSONTokener(html.substring(equals + 1)).nextValue()
                    val config = if (value is JSONObject) value else JSONObject(value as String)
                    config.optString("castMediaBaseURL").takeIf { it.isNotBlank() }
                }
            } finally { connection.disconnect() }
        }.getOrNull()
        val tracks = mutableListOf<Track>()
        var offset = 0
        do {
            val results = diagnoseLoad("library") { request("search3", mapOf("query" to "", "artistCount" to "0", "albumCount" to "0", "songCount" to "500", "songOffset" to offset.toString())) }
                .optJSONObject("searchResult3")?.optJSONArray("song")
            val count = results?.length() ?: 0
            for (i in 0 until count) {
                val song = results!!.getJSONObject(i)
                val id = song.getString("id")
                val allGenres = song.optJSONArray("genres")
                val streamUrl = url("stream", mapOf("id" to id))
                val artworkUrl = song.optString("coverArt").takeIf { it.isNotEmpty() }?.let { url("getCoverArt", mapOf("id" to it, "size" to "300")) }
                val castType = castAudioType(song.optString("suffix"), song.optString("contentType"))
                val castStream = if (castType == null) url("stream", mapOf("id" to id, "format" to "mp3", "maxBitRate" to "320")) else streamUrl
                tracks.add(Track("server:$id", streamUrl, song.optString("title", "Untitled"),
                    song.optString("artist", "Unknown artist"), song.optString("album", "Unknown album"),
                    song.optLong("duration") * 1000, artworkUrl,
                    if (song.isNull("genre")) null else song.optString("genre").takeIf { it.isNotBlank() },
                    (0 until (allGenres?.length() ?: 0)).mapNotNull { allGenres?.optJSONObject(it)?.optString("name")?.takeIf(String::isNotBlank) },
                    song.optJSONArray("moods")?.let { moods -> (0 until moods.length()).mapNotNull { if (moods.isNull(it)) null else moods.optString(it).takeIf(String::isNotBlank) } } ?: emptyList(),
                    !song.isNull("starred") && song.optString("starred").isNotBlank(), song.optLong("playCount"), song.optString("created"),
                    artistId = song.optString("artistId"), albumId = song.optString("albumId"),
                    albumArtist = song.optString("albumArtist"), discNumber = song.optInt("discNumber"), trackNumber = song.optInt("track"),
                    lastPlayedMs = runCatching { java.time.Instant.parse(song.optString("played")).toEpochMilli() }.getOrDefault(0),
                    artistArtworkUri = song.optString("artistId").takeIf { it.isNotBlank() }?.let { url("getCoverArt", mapOf("id" to "ar-$it", "size" to "300")) },
                    contentType = song.optString("contentType").takeIf { it.startsWith("audio/") },
                    castUri = castBase?.let { castMediaUrl(castStream, base.toString(), it) } ?: castStream,
                    castContentType = castType ?: "audio/mpeg",
                    castArtworkUri = artworkUrl?.let { art -> castBase?.let { castMediaUrl(art, base.toString(), it) } }))
            }
            offset += count
        } while (count == 500)
        val genres = tracks.flatMap { listOfNotNull(it.genre) + it.genres + it.moods }.distinctBy { it.lowercase(java.util.Locale.ROOT) }.sortedBy { it.lowercase(java.util.Locale.ROOT) }
        tracks to genres
    }

    suspend fun lyrics(id: String): List<LyricLine> = withContext(Dispatchers.IO) {
        val entries = request("getLyricsBySongId", mapOf("id" to id.removePrefix("server:")))
            .optJSONObject("lyricsList")?.optJSONArray("structuredLyrics") ?: return@withContext emptyList()
        val selected = (0 until entries.length()).mapNotNull { entries.optJSONObject(it) }
            .let { lyrics -> lyrics.firstOrNull { it.optString("kind") == "main" } ?: lyrics.firstOrNull() }
            ?: return@withContext emptyList()
        val lines = selected.optJSONArray("line") ?: return@withContext emptyList()
        val synced = selected.optBoolean("synced")
        (0 until lines.length()).mapNotNull { index ->
            val line = lines.optJSONObject(index) ?: return@mapNotNull null
            val value = line.optString("value").trim()
            if (value.isEmpty()) null else LyricLine(value,
                if (synced && !line.isNull("start")) line.optLong("start") else null)
        }
    }

    suspend fun updateMetadata(id: String, changes: JSONObject): String? = withContext(Dispatchers.IO) {
        fun send(path: List<String>, method: String, body: JSONObject, token: String? = null): JSONObject {
            val builder = base.buildUpon()
            path.forEach { builder.appendPath(it) }
            val connection = URL(builder.build().toString()).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 15000
                connection.readTimeout = 30000
                connection.requestMethod = method
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                if (token != null) connection.setRequestProperty("X-ND-Authorization", "Bearer $token")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status !in 200..299) throw IllegalStateException(response.trim().ifEmpty { "Server request failed ($status)" })
                return JSONObject(response)
            } finally { connection.disconnect() }
        }
        val token = send(listOf("auth", "login"), "POST", JSONObject().put("username", username).put("password", password)).getString("token")
        val result = send(listOf("api", "song", id.removePrefix("server:"), "metadata"), "PUT", changes, token)
        if (result.optBoolean("refreshRequired")) result.optString("refreshError").ifBlank { "Saved, but the library index needs refreshing." } else null
    }

    suspend fun lyricsRequest(id: String, suffix: String = "", method: String = "GET", body: JSONObject? = null, query: String? = null): String = withContext(Dispatchers.IO) {
        fun call(path: List<String>, verb: String, data: JSONObject?, auth: String? = null, search: String? = null): String {
            val builder = base.buildUpon()
            path.forEach { builder.appendPath(it) }
            if (search != null) builder.appendQueryParameter("q", search)
            val connection = URL(builder.build().toString()).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 15000; connection.readTimeout = 30000; connection.requestMethod = verb
                if (auth != null) connection.setRequestProperty("X-ND-Authorization", "Bearer $auth")
                if (data != null) {
                    connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(data.toString().toByteArray(Charsets.UTF_8)) }
                }
                val status = connection.responseCode
                val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status !in 200..299) throw IllegalStateException(response.trim().ifEmpty { "Server request failed ($status)" })
                return response
            } finally { connection.disconnect() }
        }
        val token = JSONObject(call(listOf("auth", "login"), "POST", JSONObject().put("username", username).put("password", password))).getString("token")
        val path = listOf("api", "song", id.removePrefix("server:"), "lyrics") + listOfNotNull(suffix.takeIf { it.isNotEmpty() })
        call(path, method, body, token, query)
    }

    private fun apiCall(path: List<String>, method: String = "GET", body: JSONObject? = null, auth: String? = null, query: Map<String, String> = emptyMap()): JSONObject {
        val builder = base.buildUpon()
        path.forEach { builder.appendPath(it) }
        query.forEach { (key, value) -> builder.appendQueryParameter(key, value) }
        val connection = URL(builder.build().toString()).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15000; connection.readTimeout = 30000; connection.requestMethod = method
            if (auth != null) connection.setRequestProperty("X-ND-Authorization", "Bearer $auth")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("Server request failed ($status)")
            return JSONObject(response)
        } finally { connection.disconnect() }
    }

    private fun apiToken() = apiCall(listOf("auth", "login"), "POST", JSONObject().put("username", username).put("password", password)).getString("token")

    suspend fun listeningStats(period: String): JSONObject = withContext(Dispatchers.IO) {
        val result = apiCall(listOf("api", "listening-stats"), auth = apiToken(), query = mapOf("period" to period))
        if (period != "30d" && result.optString("period") != period)
            throw IllegalStateException("Update and restart your Bragi server to use this period.")
        result
    }

    suspend fun reportPlay(id: String, listenedMs: Long) = withContext(Dispatchers.IO) {
        request("reportPlayback", mapOf("mediaId" to id.removePrefix("server:"), "mediaType" to "song", "state" to "stopped", "positionMs" to listenedMs.toString()))
        Unit
    }

    suspend fun uploadArtwork(id: String, resolver: android.content.ContentResolver, image: Uri): Pair<String, String?> = withContext(Dispatchers.IO) {
        val auth = apiToken()
        val endpoint = base.buildUpon().appendPath("api").appendPath("song").appendPath(id.removePrefix("server:")).appendPath("artwork").build()
        val connection = URL(endpoint.toString()).openConnection() as HttpURLConnection
        val boundary = "bragi-${java.util.UUID.randomUUID()}"
        try {
            connection.connectTimeout = 15000; connection.readTimeout = 60000
            connection.requestMethod = "PUT"; connection.doOutput = true
            connection.setChunkedStreamingMode(8192)
            connection.setRequestProperty("X-ND-Authorization", "Bearer $auth")
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            connection.outputStream.use { out ->
                out.write("--$boundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"artwork\"\r\nContent-Type: application/octet-stream\r\n\r\n".toByteArray())
                (resolver.openInputStream(image) ?: throw IllegalStateException("Couldn’t open the selected image.")).use { it.copyTo(out) }
                out.write("\r\n--$boundary--\r\n".toByteArray())
            }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException(response.trim().ifEmpty { "Artwork upload failed ($status)" })
            val result = JSONObject(response)
            val warning = if (result.optBoolean("refreshRequired")) result.optString("refreshError").ifBlank { "Saved, but the library index needs refreshing." } else null
            val artwork = Uri.parse(url("getCoverArt", mapOf("id" to "mf-${id.removePrefix("server:")}", "size" to "300"))).buildUpon().appendQueryParameter("updated", System.currentTimeMillis().toString()).build().toString()
            artwork to warning
        } finally { connection.disconnect() }
    }

    suspend fun recommendations(): Recommendations = withContext(Dispatchers.IO) {
        val token = apiToken()
        val root = apiCall(listOf("api", "listenbrainz", "recommendations"), auth = token)
        if (!root.optBoolean("linked")) return@withContext Recommendations(false)
        val playlists = root.optJSONArray("playlists")
        val ids = (0 until (playlists?.length() ?: 0)).mapNotNull { i ->
            playlists?.optJSONObject(i)?.optJSONObject("playlist")?.optString("identifier")?.substringAfterLast('/')?.takeIf { it.isNotBlank() }
        }.distinct()
        var partialError = false
        val tracks = mutableListOf<Recommendation>()
        val seen = mutableSetOf<String>()
        val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        for (id in ids) {
            try {
                val entries = apiCall(listOf("api", "listenbrainz", "recommendations", id), auth = token).optJSONObject("playlist")?.optJSONArray("track")
                for (i in 0 until (entries?.length() ?: 0)) {
                    val item = entries?.optJSONObject(i) ?: continue
                    val identifier = item.optJSONArray("identifier")?.optString(0).orEmpty()
                    if (identifier.isNotEmpty() && !seen.add(identifier)) continue
                    val release = item.optJSONObject("extension")?.optJSONObject("https://musicbrainz.org/doc/jspf#track")?.optJSONObject("additional_metadata")?.optString("caa_release_mbid").orEmpty()
                    tracks.add(Recommendation(item.optString("title").ifBlank { "Unknown track" }, item.optString("creator"), identifier.substringAfterLast('/').takeIf { uuid.matches(it) },
                        release.takeIf { uuid.matches(it) }?.let { "https://coverartarchive.org/release/$it/front-250" }, item.optJSONObject("library")?.optString("id")?.takeIf { it.isNotBlank() }))
                }
            } catch (error: CancellationException) { throw error } catch (_: Exception) { partialError = true }
        }
        Recommendations(true, root.optString("user"), tracks, partialError)
    }

    suspend fun linkListenBrainz(token: String) = withContext(Dispatchers.IO) {
        apiCall(listOf("api", "listenbrainz", "link"), "PUT", JSONObject().put("token", token), apiToken())
        Unit
    }

    suspend fun recommendationLink(id: String): String = withContext(Dispatchers.IO) {
        apiCall(listOf("api", "listenbrainz", "recording", id, "youtube"), auth = apiToken()).optString("url")
    }

    suspend fun startScan(full: Boolean) = withContext(Dispatchers.IO) {
        request("startScan", mapOf("fullScan" to full.toString()))
    }

    suspend fun setFavorite(id: String, favorite: Boolean) = withContext(Dispatchers.IO) {
        request(if (favorite) "star" else "unstar", mapOf("id" to id.removePrefix("server:")))
    }
}
