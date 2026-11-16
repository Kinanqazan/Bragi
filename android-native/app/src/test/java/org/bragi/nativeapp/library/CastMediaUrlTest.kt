package org.bragi.nativeapp.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CastMediaUrlTest {
    @Test fun rewritesServerPathAndPreservesEncodedQuery() {
        assertEquals("http://192.168.1.5:4533/music/rest/stream?id=a%2Fb&t=x%2By",
            castMediaUrl("https://example.test/base/rest/stream?id=a%2Fb&t=x%2By", "https://example.test/base", "http://192.168.1.5:4533/music"))
    }

    @Test fun refusesUnrelatedOrigins() {
        assertNull(castMediaUrl("https://other.test/rest/stream?id=1", "https://example.test", "http://192.168.1.5"))
    }

    @Test fun selectsNativeFormatsAndTranscodesUnknownAudio() {
        assertEquals("audio/ogg", castAudioType("opus", "audio/opus"))
        assertEquals("audio/flac", castAudioType("flac", "application/octet-stream"))
        assertNull(castAudioType("wma", "audio/x-ms-wma"))
    }
}
