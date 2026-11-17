package org.bragi.nativeapp.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.bragi.nativeapp.MusicViewModel
import org.bragi.nativeapp.library.Track
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

private val timestamp = Regex("\\[(\\d{1,3}):(\\d{2})(?:\\.(\\d{1,3}))?\\]")

internal fun shiftLyricTiming(content: String, offset: Long): String = timestamp.replace(content) { match ->
    val (minutes, seconds, fraction) = match.destructured
    if (seconds.toInt() > 59) match.value else {
        val millis = (minutes.toLong() * 60000 + seconds.toLong() * 1000 + fraction.padEnd(3, '0').toLong() + offset).coerceAtLeast(0)
        String.format(Locale.ROOT, "[%02d:%02d.%03d]", millis / 60000, millis / 1000 % 60, millis % 1000)
    }
}

@Composable
internal fun LyricsEditor(track: Track, model: MusicViewModel) {
    val scope = rememberCoroutineScope()
    var files by remember(track.id) { mutableStateOf<JSONObject?>(null) }
    var destination by remember(track.id) { mutableStateOf("embedded") }
    var draft by remember(track.id) { mutableStateOf("") }
    var busy by remember(track.id) { mutableStateOf(false) }
    var error by remember(track.id) { mutableStateOf<String?>(null) }
    var showSearch by remember(track.id) { mutableStateOf(false) }
    var deleting by remember(track.id) { mutableStateOf(false) }
    var switching by remember(track.id) { mutableStateOf<String?>(null) }
    fun file(key: String): JSONObject = files?.optJSONObject(key) ?: JSONObject()
    fun select(key: String) { destination = key; draft = file(key).optString("content") }
    fun run(action: suspend () -> Unit) {
        scope.launch {
            busy = true; error = null
            try { action() } catch (e: CancellationException) { throw e }
            catch (e: Exception) { error = e.message ?: "Couldn’t update lyrics." }
            finally { busy = false }
        }
    }
    LaunchedEffect(track.id) {
        busy = true
        try {
            val loaded = JSONObject(model.lyricsRequest(track)); files = loaded
            val key = when { loaded.optJSONObject("lrc")?.optBoolean("exists") == true -> "lrc"; loaded.optJSONObject("txt")?.optBoolean("exists") == true -> "txt"; else -> "embedded" }
            destination = key; draft = loaded.optJSONObject(key)?.optString("content").orEmpty()
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { error = e.message ?: "Couldn’t load lyrics." }
        finally { busy = false }
    }
    Spacer(Modifier.height(32.dp))
    Text("Lyrics", Modifier.fillMaxWidth(), style = MaterialTheme.typography.titleLarge)
    if (files != null) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            listOf("embedded" to "Embedded", "lrc" to "LRC", "txt" to "TXT").forEach { (key, label) ->
                FilterChip(selected = destination == key, onClick = {
                    if (draft != file(destination).optString("content")) switching = key else select(key)
                }, enabled = !busy, label = { Text(label, style = MaterialTheme.typography.labelSmall) })
            }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { showSearch = true }, enabled = !busy, modifier = Modifier.size(40.dp)) {
                Icon(BragiIcon.Search.vector, contentDescription = "Search lyrics")
            }
        }
        if (destination == "embedded" && (file("lrc").optBoolean("exists") || file("txt").optBoolean("exists"))) {
            Text("Separate lyrics files take priority in the player.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        OutlinedTextField(value = draft, onValueChange = { draft = it }, label = { Text("Lyrics") }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp).heightIn(min = 150.dp, max = 300.dp), enabled = !busy)
        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            TextButton(onClick = { draft = shiftLyricTiming(draft, -1000) }, enabled = !busy && timestamp.containsMatchIn(draft), modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp)) { Text("−1s") }
            TextButton(onClick = { draft = shiftLyricTiming(draft, 1000) }, enabled = !busy && timestamp.containsMatchIn(draft), modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp)) { Text("+1s") }
            IconButton(onClick = { draft = file(destination).optString("content"); error = null }, enabled = !busy && draft != file(destination).optString("content"), modifier = Modifier.weight(1f)) { Icon(BragiIcon.Close.vector, "Discard lyrics changes") }
            IconButton(onClick = { deleting = true }, enabled = !busy && if (destination == "embedded") file("embedded").optBoolean("exists") else (file("lrc").optBoolean("exists") || file("txt").optBoolean("exists")), modifier = Modifier.weight(1f)) { Icon(BragiIcon.Delete.vector, "Delete lyrics") }
            IconButton(onClick = { run {
                val body = JSONObject().put("content", draft).put("expectedVersion", file(destination).optString("version"))
                if (destination != "embedded") body.put("extension", ".$destination")
                val updated = JSONObject(model.lyricsRequest(track, if (destination == "embedded") "embedded" else "", "PUT", body))
                files = updated; draft = updated.optJSONObject(destination)?.optString("content").orEmpty()
                if (updated.optBoolean("refreshRequired")) error = updated.optString("refreshError").ifBlank { "Saved, but the library refresh did not finish." }
            } }, enabled = !busy && draft != file(destination).optString("content"), modifier = Modifier.weight(1f)) { Icon(BragiIcon.Save.vector, "Save lyrics") }
        }
    }
    if (showSearch) LyricsSearchDialog(track, model, onDismiss = { showSearch = false }) { synced, plain ->
        if (destination != "embedded") destination = if (synced.isNotBlank()) "lrc" else "txt"
        draft = synced.ifBlank { plain }
    }
    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    error?.let { Text(it, Modifier.fillMaxWidth().padding(top = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
    if (switching != null) BragiDialog(onDismissRequest = { switching = null }, title = { Text("Discard unsaved lyrics?") }, text = { Text("Changing the destination will discard your current lyrics edits.") }, confirmButton = { TextButton(onClick = { switching?.let { select(it) }; switching = null }) { Text("Discard") } }, dismissButton = { TextButton(onClick = { switching = null }) { Text("Cancel") } })
    if (deleting) BragiDialog(onDismissRequest = { deleting = false }, title = { Text("Delete lyrics?") }, text = { Text(if (destination == "embedded") "Remove the embedded lyrics from this song? Separate files will remain." else "Delete both separate TXT and LRC lyrics files? Embedded lyrics will remain.") }, confirmButton = {
        TextButton(onClick = { deleting = false; run {
            val body = if (destination == "embedded") JSONObject().put("content", "").put("expectedVersion", file("embedded").optString("version")) else JSONObject().put("txtVersion", file("txt").optString("version")).put("lrcVersion", file("lrc").optString("version"))
            val updated = JSONObject(model.lyricsRequest(track, if (destination == "embedded") "embedded" else "", if (destination == "embedded") "PUT" else "DELETE", body))
            files = updated; draft = updated.optJSONObject(destination)?.optString("content").orEmpty()
            if (updated.optBoolean("refreshRequired")) error = updated.optString("refreshError").ifBlank { "Deleted, but the library refresh did not finish." }
        } }) { Text("Delete") }
    }, dismissButton = { TextButton(onClick = { deleting = false }) { Text("Cancel") } })
}

@Composable
internal fun LyricsSearchDialog(track: Track, model: MusicViewModel, onDismiss: () -> Unit,
    onSelect: suspend (synced: String, plain: String) -> Unit) {
    val scope = rememberCoroutineScope()
    var query by remember(track.id) { mutableStateOf("${track.artist} ${track.title}") }
    var results by remember(track.id) { mutableStateOf<JSONArray?>(null) }
    var busy by remember(track.id) { mutableStateOf(false) }
    var error by remember(track.id) { mutableStateOf<String?>(null) }
    fun run(action: suspend () -> Unit) {
        scope.launch {
            busy = true; error = null
            try { action() } catch (e: CancellationException) { throw e }
            catch (e: Exception) { error = e.message ?: "Couldn’t update lyrics." }
            finally { busy = false }
        }
    }
    BragiDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Search lyrics") },
        text = {
            Column(Modifier.fillMaxWidth()) {
                OutlinedTextField(value = query, onValueChange = { query = it }, singleLine = true, label = { Text("Song or artist") }, modifier = Modifier.fillMaxWidth(), enabled = !busy)
                FilledTonalButton(onClick = { run { val response = model.lyricsRequest(track, "search", query = query.trim()); results = if (response.trim() == "null") JSONArray() else JSONArray(response) } }, enabled = !busy && query.isNotBlank(), modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 8.dp).heightIn(min = 48.dp)) { Text("Search", style = MaterialTheme.typography.labelLarge) }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Column(Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState())) {
                    results?.let { matches ->
                        if (matches.length() == 0) Text("No lyrics found.", style = MaterialTheme.typography.bodySmall)
                        for (index in 0 until matches.length()) {
                            val result = matches.optJSONObject(index) ?: continue
                            val synced = result.optString("syncedLyrics")
                            val plain = result.optString("plainLyrics")
                            if (synced.isNotBlank() || plain.isNotBlank()) {
                                Surface(onClick = { run { onSelect(synced, plain); onDismiss() } }, enabled = !busy, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
                                    Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                                        Text(result.optString("trackName"), style = MaterialTheme.typography.bodyLarge)
                                        Text(result.optString("artistName") + if (synced.isNotBlank()) " · Synced" else "", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Close") } },
    )
}
