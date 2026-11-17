package org.bragi.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.CancellationException
import org.bragi.nativeapp.MusicViewModel
import org.bragi.nativeapp.library.Track
import org.json.JSONArray
import org.json.JSONObject

private data class StatTrack(val id: String, val title: String, val artist: String, val plays: Long)
private data class StatArtist(val id: String, val name: String, val plays: Long)
private fun JSONArray?.objects(): List<JSONObject> = (0 until (this?.length() ?: 0)).mapNotNull { this?.optJSONObject(it) }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatisticsScreen(model: MusicViewModel, source: String, library: List<Track>, topSpace: Dp, onArtist: (String) -> Unit) {
    val periods = listOf("30d" to "Last 30 days", "90d" to "Last 90 days", "1y" to "Last year", "all" to "All time")
    var period by remember { mutableStateOf("30d") }
    var expanded by remember { mutableStateOf(false) }
    var revision by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var data by remember { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(source, period, revision) {
        data = null; error = null
        if (source != "Server") { loading = false; return@LaunchedEffect }
        loading = true
        try { data = model.listeningStats(period) }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { error = e.message?.takeIf { it.startsWith("Update and restart") } ?: "Listening statistics could not be loaded." }
        finally { loading = false }
    }
    val tracks = data?.optJSONArray("topTracks").objects().map { StatTrack(it.optString("id"), it.optString("title"), it.optString("artist"), it.optLong("plays")) }
    val unplayed = data?.optJSONArray("unplayedTrackList").objects().map { StatTrack(it.optString("id"), it.optString("title"), it.optString("artist"), 0) }
    val artists = data?.optJSONArray("topArtists").objects().map { StatArtist(it.optString("id"), it.optString("name"), it.optLong("plays")) }
    val byId = remember(library) { library.associateBy { it.id.removePrefix("server:") } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = topSpace + 16.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Statistics", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Box {
                    TextButton(onClick = { expanded = true }) { Text(periods.first { it.first == period }.second + " ▾") }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        periods.forEach { (value, label) -> DropdownMenuItem(text = { Text(label) }, onClick = { expanded = false; period = value }) }
                    }
                }
            }
        }
        when {
            source != "Server" -> item { Text("Connect to your Bragi server to see your listening statistics.") }
            loading -> item { CircularProgressIndicator() }
            error != null -> item { Text(error!!); TextButton(onClick = { revision++ }) { Text("Try again") } }
            data != null -> {
                if (data!!.has("historyEnabled") && !data!!.optBoolean("historyEnabled")) item {
                    Text("Listening history is disabled on the server. New plays will not appear in these statistics.", color = MaterialTheme.colorScheme.error)
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatMetric("Plays", data!!.optLong("plays"), Modifier.weight(1f))
                        StatMetric("Unique tracks", data!!.optLong("uniqueTracks"), Modifier.weight(1f))
                        StatMetric("Unplayed", data!!.optLong("unplayedTrackCount"), Modifier.weight(1f))
                    }
                }
                item { Text("Top tracks", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                if (tracks.isEmpty()) item { Text("Your most played tracks will appear here.") }
                else item { StatTrackRow(tracks, byId) { songs, index -> model.play(songs, index) } }
                item { Text("Top artists", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                if (artists.isEmpty()) item { Text("Artists you listen to will appear here.") }
                else item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(artists, key = { it.id }) { artist ->
                            val image = library.firstOrNull { it.artistId == artist.id }?.artistArtworkUri
                            Column(Modifier.width(120.dp).clickable { onArtist(artist.id) }) {
                                StatArtwork(image, circle = true, plays = artist.plays)
                                Spacer(Modifier.height(6.dp))
                                Text(artist.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
                item { Text("Unplayed tracks", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                if (unplayed.isEmpty()) item { Text("No unplayed tracks found.") }
                else item { StatTrackRow(unplayed, byId, showPlays = false) { songs, index -> model.play(songs, index) } }
            }
        }
    }
}

@Composable
private fun StatMetric(label: String, value: Long, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(12.dp)) {
        Text("%,d".format(value), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun StatArtwork(url: String?, circle: Boolean = false, plays: Long? = null) {
    Box(Modifier.size(120.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxSize().clip(if (circle) CircleShape else RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
            Icon(BragiIcon.Music.vector, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            if (url != null) AsyncImage(url, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        if (plays != null) Text("%,d plays".format(plays),
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = if (circle) 12.dp else 7.dp)
                .clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.78f)).padding(horizontal = 9.dp, vertical = 4.dp),
            color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold,
            maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun StatTrackRow(tracks: List<StatTrack>, byId: Map<String, Track>, showPlays: Boolean = true, onPlay: (List<Track>, Int) -> Unit) {
    val playable = tracks.mapNotNull { byId[it.id] }
    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(tracks, key = { it.id }) { track ->
            val song = byId[track.id]
            Column(Modifier.width(120.dp).clickable(enabled = song != null) { song?.let { onPlay(playable, playable.indexOf(it)) } }) {
                StatArtwork(song?.artworkUri, plays = track.plays.takeIf { showPlays })
                Spacer(Modifier.height(6.dp))
                Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                Text(track.artist, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
