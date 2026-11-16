package org.bragi.nativeapp.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerArtworkColorTest {
    @Test fun `bright artwork produces a dark tint retaining its dominant hue`() {
        val tint = playerArtworkColor(intArrayOf(0xFFFFC0A0.toInt(), 0xFFFF0000.toInt()))
        val red = tint shr 16 and 255
        val green = tint shr 8 and 255
        val blue = tint and 255
        assertTrue(red > green && red > blue)
        assertTrue(maxOf(red, green, blue) <= 38)
        assertEquals(255, tint ushr 24)
    }

    @Test fun `missing or dark artwork uses the default background`() {
        assertEquals(0xFF202321.toInt(), playerArtworkColor(intArrayOf(0, 0xFF101010.toInt())))
    }
}
