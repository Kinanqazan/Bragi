package org.bragi.nativeapp.library

import org.junit.Assert.*
import org.junit.Test

class ArtworkCacheKeyTest {
    @Test fun serverArtworkIsStableAcrossAuthenticationTokens() {
        val base = "https://server.example/music/rest/getCoverArt?u=listener&v=1.16.1&id=cover-1&size=300"
        assertEquals(artworkCacheKey("$base&t=first&s=one"), artworkCacheKey("$base&t=second&s=two"))
        assertNotEquals(artworkCacheKey("$base&t=first&s=one"), artworkCacheKey("${base.replace("cover-1", "cover-2")}&t=first&s=one"))
        assertNotEquals(artworkCacheKey("$base&t=first&s=one"), artworkCacheKey("${base.replace("listener", "other")}&t=first&s=one"))
    }
    @Test fun unrelatedUrisAreNotChanged() {
        val uri = "https://example.test/image?t=one&s=two"
        assertEquals(uri, artworkCacheKey(uri))
    }
}
