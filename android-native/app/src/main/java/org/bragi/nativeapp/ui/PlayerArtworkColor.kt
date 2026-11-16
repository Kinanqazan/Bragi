package org.bragi.nativeapp.ui

/** A dark, opaque artwork tint that remains readable behind the player's light text. */
internal fun playerArtworkColor(pixels: IntArray): Int {
    var red = 0.0
    var green = 0.0
    var blue = 0.0
    var weight = 0.0
    for (pixel in pixels) {
        if (pixel ushr 24 < 128) continue
        val r = pixel shr 16 and 255
        val g = pixel shr 8 and 255
        val b = pixel and 255
        val brightest = maxOf(r, g, b)
        if (brightest < 32) continue
        val saturation = (brightest - minOf(r, g, b)) / 255.0
        val importance = 0.25 + saturation
        red += r * importance
        green += g * importance
        blue += b * importance
        weight += importance
    }
    if (weight == 0.0) return 0xFF202321.toInt()
    val peak = maxOf(red, green, blue)
    fun channel(value: Double) = (10.0 + 28.0 * value / peak).toInt().coerceIn(10, 38)
    return (0xFF shl 24) or (channel(red) shl 16) or (channel(green) shl 8) or channel(blue)
}
