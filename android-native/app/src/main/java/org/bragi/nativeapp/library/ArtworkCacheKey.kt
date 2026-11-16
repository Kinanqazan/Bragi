package org.bragi.nativeapp.library

internal fun artworkCacheKey(uri: String): String {
    val parsed = runCatching { java.net.URI(uri) }.getOrNull() ?: return uri
    if (parsed.scheme !in listOf("http", "https") || parsed.path?.endsWith("/rest/getCoverArt") != true) return uri
    val query = parsed.rawQuery ?: return uri
    val stableQuery = query.split('&').filterNot { it.substringBefore('=') in setOf("t", "s") }.joinToString("&")
    return "${parsed.scheme}://${parsed.rawAuthority}${parsed.rawPath}?$stableQuery"
}
