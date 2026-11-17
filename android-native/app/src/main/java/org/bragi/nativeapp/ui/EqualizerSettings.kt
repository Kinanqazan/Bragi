package org.bragi.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.bragi.nativeapp.BragiApplication

@Composable
fun EqualizerSettings(modifier: Modifier = Modifier) {
    val equalizer = (LocalContext.current.applicationContext as BragiApplication).equalizer
    val state by equalizer.state.collectAsStateWithLifecycle()
    var open by remember { mutableStateOf(false) }
    var choosePreset by remember { mutableStateOf(false) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("EQUALIZER", style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Box(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(enabled = state.available, role = Role.Button, onClick = { open = true }),
            contentAlignment = Alignment.Center) {
            Text(if (!state.available) "Unavailable" else if (state.enabled) "On" else "Off",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = if (state.available) 1f else 0.38f))
        }
    }

    if (open) BragiDialog(
        onDismissRequest = { open = false; choosePreset = false },
        title = {
            if (choosePreset) Text("Presets") else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Equalizer", modifier = Modifier.weight(1f))
                Switch(checked = state.enabled, onCheckedChange = equalizer::setEnabled, enabled = state.available)
            }
        },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(2.dp)) {
                if (choosePreset) {
                    state.presets.forEachIndexed { index, name ->
                        TextButton(onClick = { equalizer.preset(index); choosePreset = false },
                            modifier = Modifier.fillMaxWidth()) { Text(name) }
                    }
                } else {
                    if (state.enabled && state.available) {
                        listOf(
                            "Bass", "Mids", "Treble",
                        ).forEachIndexed { group, label ->
                            val indices = state.bands.indices.filter { index ->
                                val frequency = state.bands[index].frequency
                                when (group) { 0 -> frequency < 250_000; 1 -> frequency in 250_000 until 4_000_000; else -> frequency >= 4_000_000 }
                            }
                            if (indices.isNotEmpty()) {
                                val level = indices.map { state.bands[it].level }.average().toFloat()
                                Column {
                                    Text(label, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurface)
                                    Slider(value = level.coerceIn(state.minimum.toFloat(), state.maximum.toFloat()),
                                        onValueChange = { value -> equalizer.setBands(indices, value.toInt()) },
                                        valueRange = state.minimum.toFloat()..state.maximum.toFloat())
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (state.presets.isNotEmpty()) OutlinedButton(onClick = { choosePreset = true }) { Text("Presets") }
                            TextButton(onClick = equalizer::reset) { Text("Reset") }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { if (choosePreset) choosePreset = false else open = false }) {
            Text(if (choosePreset) "Back" else "Done")
        } },
    )
}
