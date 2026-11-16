package org.bragi.nativeapp.library

import java.net.URI

/** Rewrite only this server's paths, preserving the already-encoded authentication query. */
fun castMediaUrl(url: String, serverBase: String, receiverBase: String): String? = runCatching {
    val source = URI(url)
    val server = URI(serverBase)
    val receiver = URI(receiverBase)
    require(receiver.scheme in listOf("http", "https") && receiver.host != null && receiver.rawUserInfo == null && receiver.rawQuery == null && receiver.rawFragment == null)
    require(source.scheme == server.scheme && source.rawAuthority == server.rawAuthority)
    val serverPath = (server.rawPath ?: "").trimEnd('/')
    val path = source.rawPath ?: "/"
    require(serverPath.isEmpty() || path == serverPath || path.startsWith("$serverPath/"))
    val relative = path.removePrefix(serverPath).ifEmpty { "/" }
    val castPath = (receiver.rawPath ?: "").trimEnd('/') + relative
    URI("${receiver.scheme}://${receiver.rawAuthority}$castPath${source.rawQuery?.let { "?$it" } ?: ""}").toASCIIString()
}.getOrNull()

/** Match the formats supported by Bragi's existing Cast sender; null requests MP3 transcoding. */
fun castAudioType(suffix: String, contentType: String): String? {
    val types = mapOf("mp3" to "audio/mpeg", "flac" to "audio/flac", "m4a" to "audio/mp4",
        "mp4" to "audio/mp4", "aac" to "audio/aac", "opus" to "audio/ogg", "ogg" to "audio/ogg",
        "oga" to "audio/ogg", "wav" to "audio/wav", "webm" to "audio/webm")
    types[suffix.trim().trimStart('.').lowercase()]?.let { return it }
    return when (contentType.lowercase().substringBefore(';').trim()) {
        "audio/mpeg", "audio/mp3" -> "audio/mpeg"
        "audio/flac" -> "audio/flac"
        "audio/mp4", "audio/x-m4a" -> "audio/mp4"
        "audio/aac" -> "audio/aac"
        "audio/ogg", "audio/opus" -> "audio/ogg"
        "audio/wav", "audio/x-wav" -> "audio/wav"
        "audio/webm" -> "audio/webm"
        else -> null
    }
}
