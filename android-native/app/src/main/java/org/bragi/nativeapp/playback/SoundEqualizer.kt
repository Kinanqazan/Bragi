package org.bragi.nativeapp.playback

import android.content.Context
import android.media.audiofx.Equalizer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class EqualizerBand(val frequency: Int, val level: Int)
data class EqualizerState(
    val available: Boolean = false,
    val enabled: Boolean = false,
    val bands: List<EqualizerBand> = emptyList(),
    val minimum: Int = -1500,
    val maximum: Int = 1500,
    val presets: List<String> = emptyList(),
)

class SoundEqualizer(context: Context) {
    private val preferences = context.getSharedPreferences("equalizer", Context.MODE_PRIVATE)
    private var effect: Equalizer? = null
    private val mutableState = MutableStateFlow(EqualizerState())
    val state = mutableState.asStateFlow()

    fun attach(sessionId: Int) {
        detach()
        if (sessionId == 0) return
        try {
            val eq = Equalizer(0, sessionId)
            effect = eq
            for (i in 0 until eq.numberOfBands.toInt()) {
                val band = i.toShort()
                val key = "band_${eq.getCenterFreq(band)}"
                val level = preferences.getInt(key, 0).coerceIn(eq.bandLevelRange[0].toInt(), eq.bandLevelRange[1].toInt())
                eq.setBandLevel(band, level.toShort())
            }
            eq.enabled = preferences.getBoolean("enabled", false)
            publish(eq)
        } catch (_: RuntimeException) {
            detach()
        }
    }

    fun setEnabled(enabled: Boolean) = change { eq ->
        eq.enabled = enabled
        preferences.edit().putBoolean("enabled", enabled).apply()
    }

    fun setBands(indices: List<Int>, level: Int) = change { eq ->
        val clamped = level.coerceIn(eq.bandLevelRange[0].toInt(), eq.bandLevelRange[1].toInt()).toShort()
        indices.forEach { eq.setBandLevel(it.toShort(), clamped) }
        saveBands(eq)
    }

    fun preset(index: Int) = change { eq -> eq.usePreset(index.toShort()); saveBands(eq) }
    fun reset() = change { eq ->
        for (i in 0 until eq.numberOfBands.toInt()) eq.setBandLevel(i.toShort(), 0.toShort())
        saveBands(eq)
    }

    private fun change(action: (Equalizer) -> Unit) {
        val eq = effect ?: return
        try { action(eq); publish(eq) } catch (_: RuntimeException) { detach() }
    }

    private fun saveBands(eq: Equalizer) {
        val editor = preferences.edit()
        for (i in 0 until eq.numberOfBands.toInt()) {
            val band = i.toShort()
            editor.putInt("band_${eq.getCenterFreq(band)}", eq.getBandLevel(band).toInt())
        }
        editor.apply()
    }

    private fun publish(eq: Equalizer) {
        mutableState.value = EqualizerState(true, eq.enabled,
            (0 until eq.numberOfBands.toInt()).map { EqualizerBand(eq.getCenterFreq(it.toShort()), eq.getBandLevel(it.toShort()).toInt()) },
            eq.bandLevelRange[0].toInt(), eq.bandLevelRange[1].toInt(),
            (0 until eq.numberOfPresets.toInt()).map { eq.getPresetName(it.toShort()) })
    }

    fun detach() {
        runCatching { effect?.release() }
        effect = null
        mutableState.value = EqualizerState()
    }
}
