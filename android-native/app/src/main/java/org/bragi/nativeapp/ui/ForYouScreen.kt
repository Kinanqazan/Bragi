package org.bragi.nativeapp.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.bragi.nativeapp.MusicViewModel
import org.bragi.nativeapp.library.Recommendations
import org.bragi.nativeapp.library.Track

@Composable
fun ForYouScreen(model: MusicViewModel, source: String, library: List<Track>, topSpace: Dp) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var revision by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var result by remember { mutableStateOf<Recommendations?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var showLink by remember { mutableStateOf(false) }
    var token by remember { mutableStateOf("") }
    var linking by remember { mutableStateOf(false) }
    val links = remember { mutableMapOf<String, String>() }
    fun message(text: String) = Toast.makeText(context, text, Toast.LENGTH_LONG).show()
    fun open(url: String) {
        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: android.content.ActivityNotFoundException) { message("No app available to open this link.") }
    }
    LaunchedEffect(source, revision) {
        result = null; error = null
        if (source != "Server") { loading = false; return@LaunchedEffect }
        loading = true
        try { result = model.recommendations() }
        catch (e: CancellationException) { throw e }
        catch (_: Exception) { error = "Could not load recommendations from ListenBrainz." }
        finally { loading = false }
    }
    if (showLink) AlertDialog(onDismissRequest = { if (!linking) showLink = false }, title = { Text("Connect ListenBrainz") },
        text = { OutlinedTextField(token, { token = it }, label = { Text("ListenBrainz user token") }, singleLine = true) },
        confirmButton = { TextButton(enabled = token.isNotBlank() && !linking, onClick = {
            scope.launch {
                linking = true
                try { model.linkListenBrainz(token.trim()); token = ""; showLink = false; revision++ }
                catch (e: CancellationException) { throw e }
                catch (_: Exception) { message("Could not connect ListenBrainz. Check your token and try again.") }
                finally { linking = false }
            }
        }) { Text(if (linking) "Connecting…" else "Connect") } },
        dismissButton = { TextButton(onClick = { showLink = false }, enabled = !linking) { Text("Cancel") } })

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = topSpace + 16.dp, bottom = 24.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text("For You", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                result?.user?.takeIf { it.isNotBlank() }?.let { user ->
                    TextButton(onClick = { open("https://listenbrainz.org/user/${Uri.encode(user)}/stats/") }) { Text("Open stats") }
                }
            }
            Spacer(Modifier.height(16.dp))
            when {
                source != "Server" -> Text("Connect to your Bragi server to see your ListenBrainz recommendations.")
                loading -> CircularProgressIndicator()
                error != null -> { Text(error!!); TextButton(onClick = { revision++ }) { Text("Try again") }; TextButton(onClick = { showLink = true }) { Text("Connect ListenBrainz") } }
                result?.linked == false -> { Text("Connect ListenBrainz to see your recommendations here."); Button(onClick = { showLink = true }) { Text("Connect ListenBrainz") } }
                result?.partialError == true -> { Text("Some recommendations could not be loaded."); TextButton(onClick = { revision++ }) { Text("Try again") } }
                result?.tracks?.isEmpty() == true -> Text("No recommendations are available yet. ListenBrainz generates them from your listening history.")
            }
        }
        itemsIndexed(result?.tracks.orEmpty()) { _, track ->
            Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f).clickable {
                    scope.launch {
                        try {
                            val direct = track.recordingId?.let { id -> links[id] ?: model.recommendationLink(id).also { links[id] = it } }.orEmpty()
                            val search = "https://music.youtube.com/search?q=${Uri.encode(listOf(track.artist, track.title).filter { it.isNotBlank() }.joinToString(" "))}"
                            open(direct.ifBlank { search })
                            if (direct.isBlank()) message("No direct link was found. Opened YouTube Music search.")
                        } catch (e: CancellationException) { throw e } catch (_: Exception) { message("Could not look up the song link. Try again.") }
                    }
                }, verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(56.dp).clip(RoundedCornerShape(6.dp)).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
                        if (track.artwork != null) AsyncImage(track.artwork, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        else Icon(BragiIcon.Music.vector, null)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column { Text(track.title, fontWeight = FontWeight.SemiBold); Text(track.artist, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                val local = library.firstOrNull { it.id == "server:${track.libraryId}" && track.libraryId != null }
                if (local != null) IconButton(onClick = { model.play(listOf(local)) }) { Icon(BragiIcon.Play.vector, "Play ${track.title} in Bragi") }
                IconButton(onClick = {
                    scope.launch {
                        try {
                            val direct = track.recordingId?.let { id -> links[id] ?: model.recommendationLink(id).also { links[id] = it } }.orEmpty()
                            if (direct.isBlank()) message("No direct song link was found for this recording.")
                            else { (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Song link", direct)); message("Song link copied") }
                        } catch (e: CancellationException) { throw e } catch (_: Exception) { message("Could not look up the song link. Try again.") }
                    }
                }) { Icon(BragiIcon.Link.vector, "Copy link for ${track.title}") }
            }
        }
    }
}
