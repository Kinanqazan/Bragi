package org.bragi.nativeapp.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.provider.Settings
import android.provider.DocumentsContract
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import org.bragi.nativeapp.R
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.layout.offset
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.SeekableTransitionState
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.activity.compose.BackHandler
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.window.Dialog
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.withFrameNanos
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.key
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.size.Precision
import org.bragi.nativeapp.LibraryState
import org.bragi.nativeapp.MusicViewModel
import org.bragi.nativeapp.PlaybackState
import org.bragi.nativeapp.hasMusicAccess
import org.bragi.nativeapp.library.Track
import org.bragi.nativeapp.library.SongTag
import org.bragi.nativeapp.library.artworkCacheKey
import org.bragi.nativeapp.library.LibraryArtist
import org.bragi.nativeapp.library.LibraryAlbum
import org.bragi.nativeapp.library.artists
import org.bragi.nativeapp.library.albums
import org.bragi.nativeapp.library.matching
import org.bragi.nativeapp.musicPermission
import java.util.Locale
import kotlin.math.roundToInt
import kotlin.math.abs
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val AccentColor = Color(0xFFA8C69A)
private val ActiveControlColor = Color(0xFF8FE276)
private val PlayerControlColor = Color(0xFFDDE5D5)
private val DefaultPlayerColor = Color(0xFF202321)
private val playerArtworkColors = LruCache<String, Int>(64)

@Composable
private fun rememberPlayerColor(artworkUri: String?): Color {
    val context = LocalContext.current
    val color by produceState(DefaultPlayerColor, artworkUri) {
        val uri = artworkUri ?: run { value = DefaultPlayerColor; return@produceState }
        val key = artworkCacheKey(uri)
        playerArtworkColors.get(key)?.let { value = Color(it); return@produceState }
        value = DefaultPlayerColor
        val request = ImageRequest.Builder(context).data(uri).size(32).allowHardware(false).diskCacheKey(key).build()
        val result = context.imageLoader.execute(request) as? SuccessResult ?: return@produceState
        val tint = withContext(Dispatchers.Default) {
            val bitmap = result.drawable.toBitmap(32, 32)
            val pixels = IntArray(32 * 32)
            bitmap.getPixels(pixels, 0, 32, 0, 0, 32, 32)
            playerArtworkColor(pixels)
        }
        playerArtworkColors.put(key, tint)
        value = Color(tint)
    }
    return color
}

private val BragiColors = darkColorScheme(
    primary = AccentColor,
    onPrimary = Color(0xFF26321B),
    primaryContainer = AccentColor.copy(alpha = 0.20f).compositeOver(Color(0xFF111214)),
    onPrimaryContainer = AccentColor,
    secondary = Color(0xFFB8C6AC),
    background = Color(0xFF111214),
    onBackground = Color(0xFFF4F2EB),
    surface = Color(0xFF111214),
    onSurface = Color(0xFFF4F2EB),
    surfaceVariant = Color(0xFF25272B),
    onSurfaceVariant = Color(0xFFB4B6B4),
    outline = Color(0xFF555954),
)

@Composable
private fun PlayerAnimationFrame(transition: SeekableTransitionState<Boolean>, content: @Composable (Float) -> Unit) {
    val expansion = when {
        transition.currentState == transition.targetState -> if (transition.currentState) 1f else 0f
        transition.targetState -> transition.fraction
        else -> 1f - transition.fraction
    }
    content(expansion)
}

@Composable
fun BragiApp(model: MusicViewModel = viewModel()) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val library by model.library.collectAsStateWithLifecycle()
    val allLibrary by model.allLibrary.collectAsStateWithLifecycle()
    val playback by model.playbackSummary.collectAsStateWithLifecycle()
    val playerPanelColor = rememberPlayerColor(playback.track?.artworkUri)
    val artworkLoader = context.imageLoader
    val configuration = LocalConfiguration.current
    val prefetchDp = minOf(380f, configuration.screenWidthDp - 48f, configuration.screenHeightDp * 0.37f).coerceAtLeast(1f)
    val prefetchSize = with(LocalDensity.current) { prefetchDp.dp.roundToPx() }
    val nearbyArtwork = listOfNotNull(playback.nextTrack?.artworkUri, playback.previousTrack?.artworkUri).distinct()
    (nearbyArtwork + playback.upcomingArtwork).distinct().forEach { uri ->
        key(uri) {
            val immediate = uri in nearbyArtwork
            LaunchedEffect(artworkLoader, uri, prefetchSize, immediate) {
                if (!immediate) delay(250)
                val cacheKey = artworkCacheKey(uri)
                artworkLoader.execute(ImageRequest.Builder(context).data(uri).size(prefetchSize)
                    .precision(Precision.INEXACT).memoryCacheKey(cacheKey).diskCacheKey(cacheKey).build())
            }
        }
    }
    val query by model.query.collectAsStateWithLifecycle()
    val shortcutPreferences = remember { context.getSharedPreferences("sidebar-shortcut", Context.MODE_PRIVATE) }
    var shortcutName by remember { mutableStateOf(shortcutPreferences.getString("name", "").orEmpty()) }
    var shortcutUrl by remember { mutableStateOf(shortcutPreferences.getString("url", "").orEmpty()) }
    val source by model.source.collectAsStateWithLifecycle()
    val genre by model.selectedGenre.collectAsStateWithLifecycle()
    val tags = remember(allLibrary.tracks) {
        fun ordered(values: List<String>) = values.filter { it.isNotBlank() }
            .distinctBy { it.lowercase(Locale.ROOT) }.sortedBy { it.lowercase(Locale.ROOT) }
        ordered(allLibrary.tracks.flatMap { it.moods }) to
            ordered(allLibrary.tracks.flatMap { listOfNotNull(it.genre) + it.genres })
    }
    val filter by model.songFilter.collectAsStateWithLifecycle()
    val phoneFolder by model.phoneFolder.collectAsStateWithLifecycle()
    val settingsMessage by model.settingsMessage.collectAsStateWithLifecycle()
    val scanBusy by model.scanBusy.collectAsStateWithLifecycle()
    var folderError by remember { mutableStateOf<String?>(null) }
    val folderPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            val id = runCatching { DocumentsContract.getTreeDocumentId(uri) }.getOrNull().orEmpty()
            if (!id.startsWith("primary:", ignoreCase = true)) folderError = "Choose a folder in internal storage."
            else { folderError = null; model.setPhoneFolder(id.substringAfter(':').trim('/')) }
        }
    }
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var page by rememberSaveable { mutableStateOf("Songs") }
    var selectedSongId by rememberSaveable { mutableStateOf<String?>(null) }
    var songMenu by remember { mutableStateOf<Track?>(null) }
    var songToDelete by remember { mutableStateOf<Track?>(null) }
    var artistDestination by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedArtist by rememberSaveable(source) { mutableStateOf<String?>(null) }
    var selectedAlbum by rememberSaveable(source) { mutableStateOf<String?>(null) }
    var showServer by rememberSaveable { mutableStateOf(false) }
    var topBarOffset by remember { mutableFloatStateOf(0f) }
    var topBarHeight by remember { mutableIntStateOf(0) }
    LaunchedEffect(page, selectedArtist, selectedAlbum) { topBarOffset = 0f }
    val topBarScroll = remember(page) {
        object : NestedScrollConnection {
            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (page == "Song") return Offset.Zero
                val previous = topBarOffset
                topBarOffset = (previous + consumed.y).coerceIn(-topBarHeight.toFloat(), 0f)
                return Offset.Zero
            }
        }
    }
    var showSearch by rememberSaveable { mutableStateOf(false) }
    var showCast by rememberSaveable { mutableStateOf(false) }
    val castSelected = rememberCastSelected()
    val playerTransitionState = remember { SeekableTransitionState(false) }
    val playerTransition = rememberTransition(playerTransitionState, label = "player")
    val gestures = remember(playerTransitionState, scope) { PlayerGestureState(playerTransitionState, scope) }
    var playerHeight by remember { mutableFloatStateOf(1f) }
    var miniHeight by remember { mutableIntStateOf(0) }
    var navigationHeight by remember { mutableIntStateOf(0) }
    val collapsedHeight = miniHeight + navigationHeight
    var miniArtwork by remember { mutableStateOf<Rect?>(null) }
    var fullArtwork by remember { mutableStateOf<Rect?>(null) }
    var miniPlayBounds by remember { mutableStateOf<Rect?>(null) }
    var fullPlayBounds by remember { mutableStateOf<Rect?>(null) }
    var permissionDenied by rememberSaveable { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionDenied = !granted
        model.setLibraryAccess(granted)
    }
    DisposableEffect(lifecycleOwner, model) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) model.setLibraryAccess(context.hasMusicAccess())
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        model.setLibraryAccess(context.hasMusicAccess())
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val openSettings = permissionDenied && !context.hasMusicAccess() &&
        (context as? Activity)?.let { !ActivityCompat.shouldShowRequestPermissionRationale(it, musicPermission) } == true

    PlayerAnimationFrame(playerTransitionState) { expansion ->
    val moving = playerTransitionState.currentState != playerTransitionState.targetState
    val showHero = moving && miniArtwork != null && fullArtwork != null && playback.track != null
    val heroAlpha = if (showHero) 0f else 1f
    val panelOffset = (playerHeight - collapsedHeight).coerceAtLeast(0f) * (1f - expansion)
    MaterialTheme(colorScheme = BragiColors) {
        Box(Modifier.fillMaxSize().onSizeChanged { playerHeight = it.height.toFloat() }) {
        ModalNavigationDrawer(drawerState = drawer, drawerContent = {
            ModalDrawerSheet(drawerContainerColor = MaterialTheme.colorScheme.background, drawerContentColor = MaterialTheme.colorScheme.onBackground, modifier = Modifier.width(300.dp)) {
                Row(Modifier.fillMaxWidth().padding(start = 22.dp, top = 28.dp, bottom = 26.dp), verticalAlignment = Alignment.CenterVertically) {
                    Image(painterResource(R.drawable.bragi_mark), contentDescription = null, colorFilter = ColorFilter.tint(Color(0xFFA9C0A5)), modifier = Modifier.size(42.dp))
                    Spacer(Modifier.width(12.dp))
                    Text("Bragi", color = MaterialTheme.colorScheme.onBackground, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                    listOf("Songs" to BragiIcon.Music, "Artists" to BragiIcon.Artist, "Albums" to BragiIcon.Album,
                        "For you" to BragiIcon.Explore, "Playlists" to BragiIcon.Playlist, "Statistics" to BragiIcon.Statistics).forEach { (destination, icon) ->
                        NavigationDrawerItem(label = { Text(destination) }, icon = { Glyph(icon, null) }, selected = page == destination,
                            onClick = { if (destination == "Artists") selectedArtist = null; if (destination == "Albums") selectedAlbum = null; page = destination; scope.launch { drawer.close() } }, colors = drawerItemColors(), modifier = Modifier.padding(horizontal = 12.dp))
                    }
                    if (shortcutName.isNotBlank() && shortcutUrl.isNotBlank()) {
                        NavigationDrawerItem(label = { Text(shortcutName) }, icon = { Glyph(BragiIcon.Link, null) }, selected = false,
                            onClick = {
                                scope.launch { drawer.close() }
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(shortcutUrl)).addCategory(Intent.CATEGORY_BROWSABLE))
                                } catch (_: android.content.ActivityNotFoundException) {
                                    Toast.makeText(context, "No app available to open this link.", Toast.LENGTH_SHORT).show()
                                }
                            }, colors = drawerItemColors(), modifier = Modifier.padding(horizontal = 12.dp))
                    }
                }
                Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    NavigationDrawerItem(label = { Text("Settings") }, icon = { Glyph(BragiIcon.Settings, null) }, selected = page == "Settings", onClick = {
                        page = "Settings"; showSearch = false; scope.launch { drawer.close() }
                    }, colors = drawerItemColors(), modifier = Modifier.weight(1f))
                    IconButton(onClick = { model.refresh(); scope.launch { drawer.close() } }) {
                        Glyph(BragiIcon.Refresh, "Refresh library")
                    }
                }
            }
        }) { Scaffold(
            modifier = Modifier.nestedScroll(topBarScroll),
            contentWindowInsets = WindowInsets.safeDrawing.only(androidx.compose.foundation.layout.WindowInsetsSides.Horizontal + androidx.compose.foundation.layout.WindowInsetsSides.Bottom),
            bottomBar = {
                Column {
                    if (playback.track != null) {
                        playerTransition.AnimatedVisibility(visible = { !it }, enter = fadeIn(tween(PlayerTransitionDurationMs, easing = LinearEasing)), exit = fadeOut(tween(PlayerTransitionDurationMs, easing = LinearEasing))) {
                            val livePlayback by model.playback.collectAsStateWithLifecycle()
                            MiniPlayer(livePlayback, gestures, playerHeight, navigationHeight, playerPanelColor, onHeight = { miniHeight = it },
                                artwork = Modifier.onGloballyPositioned { val bounds = it.unclippedBounds(); if (bounds.materiallyDiffersFrom(miniArtwork)) miniArtwork = bounds }.alpha(heroAlpha),
                                playButton = Modifier.onGloballyPositioned { val bounds = it.unclippedBounds(); if (bounds.materiallyDiffersFrom(miniPlayBounds)) miniPlayBounds = bounds },
                                title = Modifier.alpha(if (moving) 1f - expansion else 1f), artist = Modifier.alpha(if (moving) 1f - expansion else 1f)) { gestures.animateTo(true) }
                        }
                    }
                    BottomNavigation(page, onNavigate = { destination ->
                        if (destination == "Artists") selectedArtist = null
                        page = destination
                    }, onHeight = { navigationHeight = it })
                }
            },
        ) { insets ->
            val topSpace = with(LocalDensity.current) { topBarHeight.toDp() }
            Box(Modifier.fillMaxSize().padding(insets)) {
            if (page == "Song") {
                val song = allLibrary.tracks.firstOrNull { it.id == selectedSongId } ?: playback.track?.takeIf { it.id == selectedSongId }
                if (song != null) SongPage(song, model, Modifier.padding(top = topSpace), onDeleted = { page = "Songs" })
            } else if (page == "Settings") SettingsScreen(source, model.savedAddress, model.savedUsername, model.hasSavedPassword, phoneFolder, settingsMessage, folderError, scanBusy, library.error,
                Modifier.padding(top = topSpace), onPhone = { model.usePhone(context.hasMusicAccess()) }, onServer = { if (model.hasSavedPassword) model.useSavedServer() else showServer = true },
                onEditServer = { showServer = true }, onFolder = { folderPicker.launch(null) }, onAllFolders = { folderError = null; model.setPhoneFolder("") },
                onScan = model::scanServer, onLogout = { model.logOut(); page = "Songs" },
                shortcutName = shortcutName, shortcutUrl = shortcutUrl, onSaveShortcut = { name, url ->
                    shortcutPreferences.edit().putString("name", name).putString("url", url).apply()
                    shortcutName = name; shortcutUrl = url
                })
            else if (page == "Songs") LibraryScreen(library, query, playback.track?.id, playback.connected, playback.error,
                modifier = Modifier, listState = listState, topSpace = topSpace,
                source = source, moods = tags.first, genres = tags.second, selectedGenre = genre, filter = filter, onFilter = model::toggleSongFilter,
                onGenre = { model.selectedGenre.value = if (genre == it) null else it },
                onQuery = { model.query.value = it },
                onRefresh = model::refresh,
                onAccess = {
                    if (openSettings) context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        "package:${context.packageName}".toUri()))
                    else {
                        permissionLauncher.launch(musicPermission)
                    }
                },
                accessLabel = if (openSettings) "Open settings" else "Allow music access",
                onPlay = { index -> model.play(library.tracks, index) },
                onSongMenu = { songMenu = it },
            ) else if (page == "Artists" || page == "Albums") {
                BrowseLibraryScreen(page, source, allLibrary, query, playback.track?.id, playback.connected,
                    Modifier, topSpace = topSpace, selectedArtist = selectedArtist, onArtistSelected = { selectedArtist = it }, selectedAlbum = selectedAlbum, onAlbumSelected = { selectedAlbum = it }, initialArtist = artistDestination, onArtistConsumed = { artistDestination = null },
                    onPlay = { tracks, index -> model.play(tracks, index) }, onRefresh = model::refresh, onSongMenu = { songMenu = it })
            } else if (page == "Statistics") {
                StatisticsScreen(model, source, allLibrary.tracks, topSpace, onArtist = { id ->
                    selectedArtist = id; page = "Artists"
                })
            } else if (page == "For you") {
                ForYouScreen(model, source, allLibrary.tracks, topSpace)
            } else Column(Modifier.padding(top = topSpace).fillMaxSize()) {
                EmptyState(BragiIcon.Music, page, "This page will be added in a future update.", Modifier.weight(1f), "Back to songs", { page = "Songs" })
            }
            Box(Modifier.fillMaxWidth().height(110.dp).background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.96f), Color.Black.copy(alpha = 0.55f), Color.Transparent))))
            Box(Modifier.clipToBounds().layout { measurable, constraints ->
                val placeable = measurable.measure(constraints)
                val offset = topBarOffset.coerceIn(-placeable.height.toFloat(), 0f).roundToInt()
                layout(placeable.width, (placeable.height + offset).coerceAtLeast(0)) { placeable.placeRelative(0, offset) }
            }) {
                Box(Modifier.onSizeChanged { topBarHeight = it.height }) {
                    AppTopBar(showSearch, query, onMenu = { scope.launch { drawer.open() } },
                        onSearch = { showSearch = !showSearch; if (!showSearch) model.query.value = "" },
                        onQuery = { model.query.value = it; if (it.isNotBlank() && page !in listOf("Songs", "Artists", "Albums")) page = "Songs" },
                        shuffleEnabled = playback.connected && library.tracks.isNotEmpty(),
                        onShuffle = { if (library.tracks.isNotEmpty()) model.play(library.tracks, library.tracks.indices.random(), shuffle = true) },
                        castSelected = castSelected, onCast = { showCast = true })
                }
            }
            }
        } }
        if (source == "Setup" && !showServer) BragiDialog(onDismissRequest = {},
            title = { Text("Choose your music") },
            text = { Text("Listen to music on this phone or connect to your Bragi server. You can switch sources later in the menu.") },
            confirmButton = { TextButton(onClick = { showServer = true }) { Text("Connect to server") } },
            dismissButton = { TextButton(onClick = { model.usePhone(context.hasMusicAccess()) }) { Text("Music on this phone") } })
        if (showServer) ServerDialog(model.savedAddress, model.savedUsername, model.hasSavedPassword, onDismiss = { showServer = false }, onConnect = { address, username, password, allowUntrusted ->
            model.connectServer(address, username, password, allowUntrusted); page = "Settings"; showServer = false
        })
        if (showCast) CastDeviceDialog(playback.track?.id, onDismiss = { showCast = false })
        BackHandler(enabled = showSearch) { showSearch = false; model.query.value = "" }
        songMenu?.let { song ->
            Dialog(onDismissRequest = { songMenu = null }) {
                Surface(modifier = Modifier.widthIn(max = 320.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f))) {
                    Column(Modifier.padding(12.dp)) {
                        Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Artwork(song, Modifier.size(48.dp), 10)
                            Column(Modifier.weight(1f).padding(start = 14.dp)) {
                                Text(song.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Text(song.artist, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        SongMenuOption("Open song page", BragiIcon.Music) { songMenu = null; selectedSongId = song.id; page = "Song" }
                        SongMenuOption("Play next", BragiIcon.Queue, enabled = playback.connected) { songMenu = null; model.playNext(song) }
                        if (song.id.startsWith("server:")) SongMenuOption("Delete", BragiIcon.Delete, destructive = true) { songMenu = null; songToDelete = song }
                    }
                }
            }
        }
        songToDelete?.let { song -> DeleteSongDialog(song, model, onDismiss = { songToDelete = null }, onDeleted = { songToDelete = null }) }
        BackHandler(enabled = page == "Song") { page = "Songs" }
        BackHandler(enabled = page == "Settings" && !playerTransitionState.currentState && !playerTransitionState.targetState) { page = "Songs" }
        BackHandler(enabled = playerTransitionState.currentState || playerTransitionState.targetState) { gestures.animateTo(false) }
        Box(Modifier.fillMaxSize().drawWithContent {
            clipRect(bottom = size.height - navigationHeight * (1f - expansion)) { this@drawWithContent.drawContent() }
        }) {
        playerTransition.AnimatedVisibility(visible = { it },
            enter = slideInVertically(tween(PlayerTransitionDurationMs, easing = LinearEasing)) { height -> (height - collapsedHeight).coerceAtLeast(0) },
            exit = slideOutVertically(tween(PlayerTransitionDurationMs, easing = LinearEasing)) { height -> (height - collapsedHeight).coerceAtLeast(0) }) {
            Surface(Modifier.fillMaxSize().semantics { contentDescription = "Expanded player" }, color = playerPanelColor) {
                val livePlayback by model.playback.collectAsStateWithLifecycle()
                val gradient = remember(playerPanelColor) {
                    val highlight = Color(
                        red = (playerPanelColor.red * 2.8f).coerceAtMost(0.36f),
                        green = (playerPanelColor.green * 2.8f).coerceAtMost(0.36f),
                        blue = (playerPanelColor.blue * 2.8f).coerceAtMost(0.36f),
                    )
                    Brush.verticalGradient(0f to highlight, 0.85f to playerPanelColor, 1f to playerPanelColor)
                }
                Box(Modifier.fillMaxSize().drawWithContent {
                    drawRect(brush = gradient, alpha = expansion)
                    drawContent()
                }) {
                PlayerScreen(livePlayback, model, gestures, playerHeight, favorite = allLibrary.tracks.any { it.id == playback.track?.id && it.starred }, castSelected = castSelected, onCast = { showCast = true },
                    onSong = { selectedSongId = it.id; page = "Song"; gestures.animateTo(false) },
                    onArtist = { track -> val song = allLibrary.tracks.firstOrNull { it.id == track.id } ?: track; artistDestination = song.artistId.ifBlank { song.artist.trim().lowercase() }; model.query.value = ""; page = "Artists"; gestures.animateTo(false) },
                    artwork = Modifier.onGloballyPositioned { val bounds = it.unclippedBounds().translate(Offset(0f, -panelOffset)); if (bounds.materiallyDiffersFrom(fullArtwork)) fullArtwork = bounds }.alpha(heroAlpha),
                    playButton = Modifier.onGloballyPositioned { val bounds = it.unclippedBounds().translate(Offset(0f, -panelOffset)); if (bounds.materiallyDiffersFrom(fullPlayBounds)) fullPlayBounds = bounds },
                    title = Modifier.alpha(if (moving) expansion else 1f),
                    artist = Modifier.alpha(if (moving) expansion else 1f))
                }
            }
        }
        }
        if (showHero) {
            PlayerTransitionHero(playback.track!!, miniArtwork!!, fullArtwork!!, expansion)
        }
        if (playback.track != null && miniPlayBounds != null) {
            val from = miniPlayBounds!!
            val to = fullPlayBounds ?: from
            val bounds = Rect(
                left = androidx.compose.ui.util.lerp(from.left, to.left, expansion),
                top = androidx.compose.ui.util.lerp(from.top, to.top, expansion),
                right = androidx.compose.ui.util.lerp(from.right, to.right, expansion),
                bottom = androidx.compose.ui.util.lerp(from.bottom, to.bottom, expansion),
            )
            val density = LocalDensity.current
            PlayerPlayButton(playback, model::togglePlayback, Modifier.offset { IntOffset(bounds.left.roundToInt(), bounds.top.roundToInt()) }
                .size(with(density) { bounds.width.toDp() }), expansion)
        }
        }
    }
    }
}

@Composable
private fun SongMenuOption(label: String, icon: BragiIcon, enabled: Boolean = true, destructive: Boolean = false, onClick: () -> Unit) {
    val color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(enabled = enabled, onClick = onClick)
        .heightIn(min = 54.dp).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon.vector, contentDescription = null, modifier = Modifier.size(22.dp), tint = color.copy(alpha = if (enabled) 0.85f else 0.4f))
        Spacer(Modifier.width(16.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium,
            color = color.copy(alpha = if (enabled) 1f else 0.4f))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SongPage(track: Track, model: MusicViewModel, modifier: Modifier, onDeleted: () -> Unit) {
    var editing by rememberSaveable(track.id) { mutableStateOf(false) }
    var title by rememberSaveable(track.id, editing) { mutableStateOf(track.title) }
    var artist by rememberSaveable(track.id, editing) { mutableStateOf(track.artist) }
    var genres by rememberSaveable(track.id, editing) { mutableStateOf((track.genres.ifEmpty { listOfNotNull(track.genre) }).joinToString(", ")) }
    var moods by rememberSaveable(track.id, editing) { mutableStateOf(track.moods.joinToString(", ")) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var deleting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val library by model.allLibrary.collectAsStateWithLifecycle()
    var choosingTags by remember { mutableStateOf<String?>(null) }
    val artworkPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            busy = true; message = null
            scope.launch {
                try { message = model.uploadArtwork(track, uri) }
                catch (e: kotlinx.coroutines.CancellationException) { throw e }
                catch (e: Exception) { message = e.message ?: "Couldn’t change artwork." }
                finally { busy = false }
            }
        }
    }
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(16.dp))
        Box(Modifier.size(180.dp)) {
            Artwork(track, Modifier.fillMaxSize(), 20)
            if (track.id.startsWith("server:")) FilledIconButton(onClick = { artworkPicker.launch("image/*") }, enabled = !busy,
                modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).size(40.dp),
                colors = IconButtonDefaults.filledIconButtonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Glyph(BragiIcon.Edit, "Change song artwork", Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(track.title, Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineSmall,
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
        if (editing) {
            listOf(Triple("Title", title, { v: String -> title = v }), Triple("Artist", artist, { v: String -> artist = v })).forEach { (label, value, change) ->
                OutlinedTextField(value = value, onValueChange = change, label = { Text(label) }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            listOf(Triple("Genres", genres, { v: String -> genres = v }), Triple("Moods", moods, { v: String -> moods = v })).forEach { (label, value, change) ->
                OutlinedTextField(value = value, onValueChange = change, label = { Text(label) }, enabled = !busy, singleLine = true,
                    trailingIcon = { TextButton(onClick = { choosingTags = label }, enabled = !busy) { Text("Choose") } },
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
            }
            Text("Separate genres and moods with commas", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                val changes = org.json.JSONObject()
                if (title != track.title) changes.put("title", title)
                if (artist != track.artist) changes.put("artist", artist)
                fun tags(value: String) = value.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                if (tags(genres) != track.genres.ifEmpty { listOfNotNull(track.genre) }) changes.put("genres", org.json.JSONArray(tags(genres)))
                if (tags(moods) != track.moods) changes.put("moods", org.json.JSONArray(tags(moods)))
                if (changes.length() == 0) editing = false else {
                    busy = true; message = null
                    scope.launch {
                        try { message = model.saveMetadata(track, changes); editing = false }
                        catch (e: kotlinx.coroutines.CancellationException) { throw e }
                        catch (e: Exception) { message = e.message ?: "Couldn’t save metadata." }
                        finally { busy = false }
                    }
                }
            }, enabled = !busy, modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) { Text(if (busy) "Saving…" else "Save changes") }
        } else {
            Text(track.artist, Modifier.padding(top = 2.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            val tags = (track.genres.ifEmpty { listOfNotNull(track.genre) } + track.moods)
                .filter { it.isNotBlank() }.distinctBy { it.lowercase(Locale.ROOT) }
            if (tags.isNotEmpty()) FlowRow(Modifier.fillMaxWidth().padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                tags.forEach { tag ->
                    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.surfaceVariant) {
                        Text(tag, Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (!track.id.startsWith("server:")) Text("Metadata editing is available for server songs.", Modifier.padding(top = 24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        message?.let { Text(it, Modifier.fillMaxWidth().padding(top = 16.dp), color = MaterialTheme.colorScheme.error) }
        if (track.id.startsWith("server:")) TextButton(onClick = { editing = !editing; message = null }, enabled = !busy) {
            Text(if (editing) "Cancel editing" else "Edit metadata")
        }
        if (track.id.startsWith("server:") && !editing) LyricsEditor(track, model)
        if (track.id.startsWith("server:") && !editing) TextButton(onClick = { deleting = true }, enabled = !busy) {
            Text("Delete song", color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(32.dp))
    }
    if (deleting) DeleteSongDialog(track, model, onDismiss = { deleting = false }, onDeleted = onDeleted)
    choosingTags?.let { label ->
        val availableTags = remember(library.tracks, label) {
            library.tracks.flatMap { if (label == "Genres") listOfNotNull(it.genre) + it.genres else it.moods }
                .filter { it.isNotBlank() }.distinctBy { it.lowercase(Locale.ROOT) }.sortedBy { it.lowercase(Locale.ROOT) }
        }
        val value = if (label == "Genres") genres else moods
        val selected = value.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        BragiDialog(onDismissRequest = { choosingTags = null }, title = { Text("Choose $label") }, text = {
            Column(Modifier.fillMaxWidth().heightIn(max = 320.dp).verticalScroll(rememberScrollState())) {
                    availableTags.forEach { tag ->
                        val checked = selected.any { it.equals(tag, ignoreCase = true) }
                        Row(Modifier.fillMaxWidth().clickable {
                            val next = if (checked) selected.filterNot { it.equals(tag, ignoreCase = true) } else selected + tag
                            if (label == "Genres") genres = next.joinToString(", ") else moods = next.joinToString(", ")
                        }, verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = checked, onCheckedChange = null)
                            Text(tag, Modifier.padding(start = 8.dp), style = MaterialTheme.typography.titleMedium)
                        }
                    }
                    if (availableTags.isEmpty()) Text("No ${label.lowercase(Locale.ROOT)} in your library yet. Type new values in the field.", Modifier.padding(vertical = 16.dp))
            }
        }, confirmButton = { TextButton(onClick = { choosingTags = null }) { Text("Done") } })
    }
}

@Composable
private fun DeleteSongDialog(track: Track, model: MusicViewModel, onDismiss: () -> Unit, onDeleted: () -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    BragiDialog(onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Delete song permanently?") },
        text = { Column {
            Text(track.title, maxLines = 2, overflow = TextOverflow.Ellipsis)
            error?.let { Text(it, Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error) }
        } },
        confirmButton = { Button(enabled = !busy, modifier = Modifier.height(48.dp),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError),
            onClick = {
                busy = true; error = null
                scope.launch {
                    try { model.deleteSong(track); onDeleted() }
                    catch (e: kotlinx.coroutines.CancellationException) { throw e }
                    catch (e: Exception) { error = e.message ?: "Couldn’t delete song." }
                    finally { busy = false }
                }
            }) { Text(if (busy) "Deleting…" else "Delete") } },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy, modifier = Modifier.height(48.dp)) { Text("Cancel") } })
}

@Composable
private fun drawerItemColors() = NavigationDrawerItemDefaults.colors(
    selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
    selectedTextColor = MaterialTheme.colorScheme.primary,
    selectedIconColor = MaterialTheme.colorScheme.primary,
    unselectedContainerColor = Color.Transparent,
    unselectedTextColor = MaterialTheme.colorScheme.onBackground,
    unselectedIconColor = MaterialTheme.colorScheme.onBackground,
)

@Composable
private fun AppTopBar(showSearch: Boolean, query: String, onMenu: () -> Unit, onSearch: () -> Unit,
    onQuery: (String) -> Unit, shuffleEnabled: Boolean, onShuffle: () -> Unit, castSelected: Boolean, onCast: () -> Unit) {
    Column(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.safeDrawing.only(
        androidx.compose.foundation.layout.WindowInsetsSides.Top + androidx.compose.foundation.layout.WindowInsetsSides.Horizontal))) {
        val shape = RoundedCornerShape(50)
        val borderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.22f)
        val surfaceColor = Color(0xFF202321)
        AnimatedContent(targetState = showSearch, modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 12.dp),
            transitionSpec = { (fadeIn(tween(180)) + expandHorizontally(tween(220), expandFrom = Alignment.End)) togetherWith
                (fadeOut(tween(120)) + shrinkHorizontally(tween(180), shrinkTowards = Alignment.End)) }, label = "top search") { searching ->
            if (searching) {
                val requester = remember { FocusRequester() }
                LaunchedEffect(Unit) { requester.requestFocus() }
                BasicTextField(value = query, onValueChange = onQuery, singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    modifier = Modifier.fillMaxWidth().height(54.dp).background(surfaceColor, shape).border(1.dp, borderColor, shape).focusRequester(requester),
                    decorationBox = { inner -> Row(Modifier.fillMaxSize().padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Glyph(BragiIcon.Search, null, tint = PlayerControlColor)
                        Box(Modifier.weight(1f).padding(start = 12.dp), contentAlignment = Alignment.CenterStart) {
                            if (query.isEmpty()) Text("Songs, artists, albums", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                            inner()
                        }
                        IconButton(onClick = onSearch, colors = IconButtonDefaults.iconButtonColors(contentColor = PlayerControlColor)) { Glyph(BragiIcon.Close, "Close search") }
                    } })
            } else Row(Modifier.fillMaxWidth().height(54.dp), verticalAlignment = Alignment.CenterVertically) {
                val buttonColors = IconButtonDefaults.iconButtonColors(containerColor = surfaceColor,
                    contentColor = MaterialTheme.colorScheme.onBackground, disabledContainerColor = surfaceColor)
                val buttonModifier = Modifier.size(48.dp).border(1.dp, borderColor, shape)
                IconButton(onClick = onMenu, modifier = buttonModifier, colors = buttonColors) { Glyph(BragiIcon.Menu, "Open menu") }
                Spacer(Modifier.weight(1f)); IconButton(onClick = onShuffle, enabled = shuffleEnabled, modifier = buttonModifier, colors = buttonColors) { Glyph(BragiIcon.Shuffle, "Shuffle songs") }
                Spacer(Modifier.width(8.dp)); IconButton(onClick = onCast, modifier = buttonModifier, colors = buttonColors) { Glyph(BragiIcon.Cast, "Cast", tint = if (castSelected) ActiveControlColor else MaterialTheme.colorScheme.onBackground) }
                Spacer(Modifier.width(8.dp)); IconButton(onClick = onSearch, modifier = buttonModifier, colors = buttonColors) { Glyph(BragiIcon.Search, "Search your music") }
            }
        }
    }
}

@Composable
private fun BrowseLibraryScreen(page: String, source: String, library: LibraryState, search: String, currentId: String?, playerReady: Boolean,
    modifier: Modifier, topSpace: androidx.compose.ui.unit.Dp, selectedArtist: String?, onArtistSelected: (String?) -> Unit, selectedAlbum: String?, onAlbumSelected: (String?) -> Unit,
    initialArtist: String?, onArtistConsumed: () -> Unit, onPlay: (List<Track>, Int) -> Unit, onRefresh: () -> Unit, onSongMenu: (Track) -> Unit) {
    LaunchedEffect(initialArtist) { if (initialArtist != null) { onArtistSelected(initialArtist); onArtistConsumed() } }
    val groups by produceState<Pair<List<LibraryArtist>, List<LibraryAlbum>>?>(null, library.tracks, page) {
        value = null
        value = withContext(Dispatchers.Default) {
            if (page == "Artists") library.tracks.artists() to emptyList()
            else emptyList<LibraryArtist>() to library.tracks.albums()
        }
    }
    val artists = groups?.first.orEmpty()
    val albums = groups?.second.orEmpty()
    val artist = artists.firstOrNull { it.key == selectedArtist }
    val album = albums.firstOrNull { it.key == selectedAlbum }
    val detail = album != null || artist != null
    val browseListState = remember(page, source, selectedArtist, selectedAlbum) { LazyListState() }
    BackHandler(enabled = detail) { if (album != null) onAlbumSelected(null) else onArtistSelected(null) }
    Column(modifier.fillMaxSize()) {
        when {
            library.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            library.error != null -> EmptyState(BragiIcon.Music, "Couldn’t load music", library.error, Modifier.weight(1f), "Retry", onRefresh)
            !library.hasPermission -> EmptyState(BragiIcon.Music, "Music access needed", "Open Songs to allow access to music on this phone.", Modifier.weight(1f), "Refresh", onRefresh)
            library.tracks.isEmpty() -> EmptyState(BragiIcon.Music, "No music found", "Add music to your library and refresh.", Modifier.weight(1f), "Refresh", onRefresh)
            groups == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            else -> LazyColumn(Modifier.fillMaxSize(), state = browseListState, contentPadding = PaddingValues(top = topSpace, bottom = 16.dp)) {
                if (album != null) {
                    item(key = "album-header") {
                        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Artwork(album.tracks.first(), Modifier.size(180.dp), 18)
                            Text(album.name, Modifier.padding(top = 16.dp), style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
                            Text(album.artist, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    val songs = album.tracks.matching(search)
                    if (songs.isEmpty()) item { Text("No songs found", Modifier.padding(24.dp)) }
                    itemsIndexed(songs, key = { _, track -> track.id }) { index, track ->
                        TrackRow(track, currentId == track.id, playerReady, onLongClick = { onSongMenu(track) }) { onPlay(songs, index) }
                    }
                } else if (artist != null) {
                    item(key = "artist-header") {
                        Column(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 28.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                val firstTrack = artist.tracks.first()
                                Artwork(firstTrack.copy(artworkUri = firstTrack.artistArtworkUri ?: firstTrack.artworkUri), Modifier.size(96.dp), 48)
                                Column(Modifier.weight(1f).padding(start = 16.dp)) {
                                    Text(artist.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                    Text("${artist.tracks.size} songs", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    val songs = artist.tracks.matching(search)
                    if (songs.isEmpty()) item { Text("No songs found", Modifier.padding(24.dp)) }
                    itemsIndexed(songs, key = { _, track -> track.id }) { index, track ->
                        TrackRow(track, currentId == track.id, playerReady, onLongClick = { onSongMenu(track) }) { onPlay(songs, index) }
                    }
                } else if (page == "Artists") {
                    val matching = artists.filter { it.name.contains(search.trim(), ignoreCase = true) }
                    if (matching.isEmpty()) item { Text("No artists found", Modifier.padding(24.dp)) }
                    itemsIndexed(matching, key = { _, value -> value.key }) { _, value ->
                        BrowseRow(value.tracks.first(), value.name, "${value.tracks.size} songs") { onArtistSelected(value.key) }
                    }
                } else {
                    val matching = albums.filter { it.name.contains(search.trim(), true) || it.artist.contains(search.trim(), true) }
                    if (matching.isEmpty()) item { Text("No albums found", Modifier.padding(24.dp)) }
                    itemsIndexed(matching, key = { _, value -> value.key }) { _, value ->
                        BrowseRow(value.tracks.first(), value.name, value.artist) { onAlbumSelected(value.key) }
                    }
                }
            }
        }
    }
}

@Composable
private fun BrowseRow(track: Track, title: String, subtitle: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 24.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Artwork(track, Modifier.size(56.dp), 10)
        Column(Modifier.weight(1f).padding(start = 14.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun SettingsScreen(source: String, address: String, username: String, hasServer: Boolean, folder: String,
    message: String?, folderError: String?, scanBusy: Boolean, libraryError: String?, modifier: Modifier,
    onPhone: () -> Unit, onServer: () -> Unit, onEditServer: () -> Unit, onFolder: () -> Unit,
    onAllFolders: () -> Unit, onScan: (Boolean) -> Unit, onLogout: () -> Unit,
    shortcutName: String, shortcutUrl: String, onSaveShortcut: (String, String) -> Unit) {
    var editShortcut by remember { mutableStateOf(false) }
    var confirmLogout by remember { mutableStateOf(false) }
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Spacer(Modifier.height(4.dp))
        Text("Settings", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("MUSIC SOURCE", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    Row(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surface)) {
                        listOf("Phone" to onPhone, "Server" to onServer).forEach { (label, action) ->
                            val selected = source == label
                            Box(Modifier.weight(1f).fillMaxSize().padding(4.dp).clip(RoundedCornerShape(10.dp))
                                .background(if (selected) MaterialTheme.colorScheme.primary else Color.Transparent)
                                .selectable(selected = selected, role = Role.RadioButton, onClick = { if (!selected) action() }),
                                contentAlignment = Alignment.Center) {
                                Text(label, style = MaterialTheme.typography.labelLarge,
                                    color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal, maxLines = 1)
                            }
                        }
                    }
                }
                EqualizerSettings(Modifier.weight(1f))
            }
        }
        if (source == "Server") {
            SettingsCard("SERVER") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(address.ifBlank { "No server connected" }, style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        if (username.isNotBlank()) Text(username, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    IconButton(onClick = onEditServer) {
                        Glyph(BragiIcon.Edit, if (hasServer) "Edit connection" else "Connect to server", Modifier.size(20.dp))
                    }
                    if (hasServer) TextButton(onClick = { confirmLogout = true }) {
                        Text("Log out", color = MaterialTheme.colorScheme.error)
                    }
                }
                if (libraryError != null) Text(libraryError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onScan(false) }, enabled = !scanBusy, modifier = Modifier.weight(1f)) { Text("Quick scan") }
                    OutlinedButton(onClick = { onScan(true) }, enabled = !scanBusy, modifier = Modifier.weight(1f)) { Text("Full scan") }
                }
                if (message != null) Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
        } else if (source == "Phone") {
            SettingsCard("PHONE LIBRARY") {
                Text(if (folder.isBlank()) "All music on this phone" else "Internal storage / $folder", style = MaterialTheme.typography.bodyLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onFolder) { Text("Choose folder") }
                    if (folder.isNotBlank()) TextButton(onClick = onAllFolders) { Text("All music") }
                }
                if (folderError != null) Text(folderError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
        SettingsCard("SIDEBAR SHORTCUT") {
            if (shortcutUrl.isBlank()) {
                Text("Add a link to open in your browser.", style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(onClick = { editShortcut = true }) { Text("Add shortcut") }
            } else {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(shortcutName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(shortcutUrl, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    IconButton(onClick = { editShortcut = true }) {
                        Glyph(BragiIcon.Edit, "Edit shortcut", Modifier.size(20.dp))
                    }
                    IconButton(onClick = { onSaveShortcut("", "") }) {
                        Glyph(BragiIcon.Delete, "Remove shortcut", Modifier.size(20.dp))
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
    if (editShortcut) {
        var name by rememberSaveable { mutableStateOf(shortcutName) }
        var url by rememberSaveable { mutableStateOf(shortcutUrl) }
        val parsed = remember(url) { runCatching { Uri.parse(url.trim()) }.getOrNull() }
        val valid = name.isNotBlank() && parsed != null && parsed.scheme?.lowercase() in listOf("http", "https") && !parsed.host.isNullOrBlank()
        BragiDialog(onDismissRequest = { editShortcut = false }, title = { Text("Sidebar shortcut") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(url, { url = it }, label = { Text("Website URL") }, placeholder = { Text("https://example.com") }, singleLine = true)
                Text("Enter a full URL starting with http:// or https://", style = MaterialTheme.typography.bodySmall)
            } },
            confirmButton = { TextButton(enabled = valid, onClick = { onSaveShortcut(name.trim(), url.trim()); editShortcut = false }) { Text("Save") } },
            dismissButton = { TextButton(onClick = { editShortcut = false }) { Text("Cancel") } })
    }
    if (confirmLogout) BragiDialog(onDismissRequest = { confirmLogout = false }, title = { Text("Log out?") },
        text = { Text("Your saved server credentials will be removed from this device.") },
        confirmButton = { TextButton(onClick = { confirmLogout = false; onLogout() }) { Text("Log out") } },
        dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Cancel") } })
}

@Composable
private fun SettingsCard(title: String, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            content()
        }
    }
}

@Composable
private fun ServerDialog(savedAddress: String, savedUsername: String, hasSavedPassword: Boolean, onDismiss: () -> Unit, onConnect: (String, String, String, Boolean) -> Unit) {
    var address by rememberSaveable { mutableStateOf(savedAddress) }
    var username by rememberSaveable { mutableStateOf(savedUsername) }
    var password by remember { mutableStateOf("") }
    var allowUntrusted by remember { mutableStateOf(false) }
    BragiDialog(onDismissRequest = onDismiss, title = { Text("Connect to server") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Enter your Bragi server address and account.")
                OutlinedTextField(address, { address = it }, label = { Text("Server address") }, placeholder = { Text("https://your-server") }, singleLine = true)
                OutlinedTextField(username, { username = it }, label = { Text("Username") }, singleLine = true)
                OutlinedTextField(password, { password = it }, label = { Text("Password") },
                    placeholder = { if (hasSavedPassword && address.trim() == savedAddress && username.trim() == savedUsername) Text("Saved password") },
                    visualTransformation = PasswordVisualTransformation(), singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = allowUntrusted, onCheckedChange = { allowUntrusted = it })
                    Text("Trust this server even if its certificate is unverified. An impersonator could access your account.", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = { onConnect(address, username, password, allowUntrusted) }) { Text("Connect") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun LibraryScreen(library: LibraryState, query: String, currentId: String?, playerReady: Boolean,
    playerError: String?, modifier: Modifier, listState: LazyListState, topSpace: androidx.compose.ui.unit.Dp, source: String, moods: List<String>, genres: List<String>, selectedGenre: SongTag?,
    filter: Set<String>,
    onGenre: (SongTag) -> Unit, onQuery: (String) -> Unit, onRefresh: () -> Unit, onAccess: () -> Unit,
    accessLabel: String, onFilter: (String) -> Unit, onPlay: (Int) -> Unit, onSongMenu: (Track) -> Unit) {
    Box(modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = PaddingValues(top = topSpace, bottom = 16.dp)) {
            item(key = "header") { Column {
                if (moods.isNotEmpty() || genres.isNotEmpty()) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    fun tagValues(values: List<String>, isMood: Boolean) = values.map { SongTag(it, isMood) }
                    (tagValues(moods, true) + tagValues(genres, false)).forEachIndexed { index, tag ->
                        if (moods.isNotEmpty() && index == moods.size) Box(Modifier.padding(horizontal = 4.dp).width(1.dp).height(22.dp).background(MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)))
                        androidx.compose.material3.FilterChip(selected = selectedGenre == tag, onClick = { onGenre(tag) }, label = { Text(tag.name) },
                            colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(selectedContainerColor = MaterialTheme.colorScheme.primaryContainer, selectedLabelColor = MaterialTheme.colorScheme.primary))
                    }
                }
                if (library.hasPermission) Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(Triple("Recently added", BragiIcon.Recent, "Recently added"), Triple("Most played", BragiIcon.Trending, "Most played"), Triple("Recently played", BragiIcon.History, "Recently played"), Triple("Favorites", BragiIcon.Heart, "Favorites")).forEach { (value, icon, label) ->
                        FilledTonalButton(onClick = { onFilter(value) }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(0.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (value in filter) ActiveControlColor.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.22f)),
                            colors = androidx.compose.material3.ButtonDefaults.filledTonalButtonColors(containerColor = if (value in filter) MaterialTheme.colorScheme.background else MaterialTheme.colorScheme.surfaceVariant, contentColor = if (value in filter) ActiveControlColor else MaterialTheme.colorScheme.onSurface)) { Glyph(icon, label) }
                    }
                }
                if (library.loading) LinearProgressIndicator(Modifier.fillMaxWidth().height(2.dp))
                playerError?.let { ErrorMessage(it, Modifier.padding(horizontal = 24.dp)) }
                library.error?.takeIf { library.totalCount > 0 }?.let { ErrorMessage(it, Modifier.padding(horizontal = 24.dp)) }
            } }
            if (library.totalCount == 0 && library.loading) item { Box(Modifier.fillParentMaxHeight(0.5f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            else if (!library.hasPermission) item { EmptyState(BragiIcon.Music, "Make yourself at home", "Allow access to find and play music stored on your phone.", Modifier.fillParentMaxHeight(0.65f), accessLabel, onAccess) }
            else if (library.totalCount == 0 && library.error != null) item { EmptyState(BragiIcon.Warning, "Couldn’t read your music", library.error, Modifier.fillParentMaxHeight(0.65f), "Try again", onRefresh) }
            else if (library.totalCount == 0) item { EmptyState(BragiIcon.Music, "Your library starts here", if (source == "Server") "No songs were found on this server." else "Copy music to your phone’s Music folder, then refresh.", Modifier.fillParentMaxHeight(0.65f), "Refresh library", onRefresh) }
            else if (library.tracks.isEmpty()) item { EmptyState(BragiIcon.Search, "No songs found", "Try a different search or filter.", Modifier.fillParentMaxHeight(0.65f), "Clear filters", { onQuery(""); selectedGenre?.let(onGenre); onFilter("All") }) }
            else itemsIndexed(library.tracks, key = { _, song -> song.id }, contentType = { _, _ -> "song" }) { index, song -> TrackRow(song, selected = song.id == currentId, enabled = playerReady, onLongClick = { onSongMenu(song) }, onClick = { onPlay(index) }) }
        }
        Box(Modifier.fillMaxWidth().height(18.dp).align(Alignment.TopCenter).background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.65f), Color.Transparent))))
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TrackRow(track: Track, selected: Boolean, enabled: Boolean = true, onLongClick: (() -> Unit)? = null, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth()
        .background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.07f) else Color.Transparent)
        .combinedClickable(enabled = enabled || onLongClick != null, onLongClick = onLongClick, onClick = { if (enabled) onClick() })
        .padding(horizontal = 24.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Artwork(track, Modifier.size(50.dp), radius = 10)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(track.artist, maxLines = 1, overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.width(10.dp))
        if (selected) Glyph(BragiIcon.Music, "Current song", Modifier.size(18.dp), MaterialTheme.colorScheme.primary)
        else Text(formatTime(track.durationMs), color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun BottomNavigation(page: String, onNavigate: (String) -> Unit, onHeight: (Int) -> Unit) {
    val items = listOf("Songs" to BragiIcon.Music, "Artists" to BragiIcon.Artist,
        "Statistics" to BragiIcon.Statistics, "For you" to BragiIcon.Explore)
    Row(Modifier.fillMaxWidth().onSizeChanged { onHeight(it.height) }.background(MaterialTheme.colorScheme.background)
        .windowInsetsPadding(WindowInsets.safeDrawing.onlyBottom()), verticalAlignment = Alignment.CenterVertically) {
        items.forEach { (destination, icon) ->
            val selected = page == destination
            Box(Modifier.weight(1f).height(54.dp).selectable(selected = selected, role = Role.Tab,
                interactionSource = remember { MutableInteractionSource() }, indication = null,
                onClick = { onNavigate(destination) }).semantics { contentDescription = destination },
                contentAlignment = Alignment.Center) {
                Box(Modifier.width(52.dp).height(34.dp)
                    .border(1.dp, if (selected) ActiveControlColor.copy(alpha = 0.7f) else Color.Transparent, RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                    Glyph(icon, null, Modifier.size(25.dp), if (selected) ActiveControlColor else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun PlayerPlayButton(state: PlaybackState, onToggle: () -> Unit, modifier: Modifier, expansion: Float) {
    FilledIconButton(onClick = onToggle, modifier = modifier,
        colors = IconButtonDefaults.filledIconButtonColors(containerColor = PlayerControlColor, contentColor = MaterialTheme.colorScheme.surface)) {
        Box(contentAlignment = Alignment.Center) {
            if (state.buffering) CircularProgressIndicator(Modifier.size((48f + 8f * expansion).dp), color = MaterialTheme.colorScheme.surface, strokeWidth = 2.dp)
            Glyph(if (state.playing) BragiIcon.Pause else BragiIcon.Play,
                if (state.playing) "Pause" else "Play", Modifier.size((42f + 6f * expansion).dp))
        }
    }
}

@Composable
private fun MiniPlayer(state: PlaybackState, gestures: PlayerGestureState, playerHeight: Float, navigationHeight: Int, panelColor: Color, onHeight: (Int) -> Unit, artwork: Modifier, playButton: Modifier, title: Modifier, artist: Modifier, onExpand: () -> Unit) {
    val track = state.track ?: return
    Surface(modifier = Modifier.onSizeChanged { onHeight(it.height) }, color = panelColor) {
        Box {
            Row(Modifier.fillMaxWidth().semantics { contentDescription = "Open player" }.pointerInput(gestures, playerHeight) {
                val tracker = VelocityTracker()
                detectVerticalDragGestures(onDragStart = { tracker.resetTracking() },
                    onDragEnd = { gestures.finish(tracker.calculateVelocity().y) },
                    onDragCancel = { gestures.finish(cancelled = true) },
                    onVerticalDrag = { change, amount ->
                        tracker.addPosition(change.uptimeMillis, change.position)
                        gestures.drag(opening = true, delta = amount, distance = (playerHeight - size.height - navigationHeight).coerceAtLeast(1f))
                        change.consume()
                    })
            }.clickable(onClick = onExpand).height(104.dp).padding(start = 10.dp, end = 16.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Artwork(track, artwork.size(84.dp), radius = 10)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(track.title, modifier = title, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(track.artist, modifier = artist.padding(top = 4.dp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.width(8.dp))
                Spacer(playButton.size(60.dp))
            }
            LinearProgressIndicator(progress = { if (state.durationMs > 0) (state.positionMs.toFloat() / state.durationMs).coerceIn(0f, 1f) else 0f },
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(3.dp), color = ActiveControlColor, trackColor = Color.Transparent)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlayerScreen(state: PlaybackState, model: MusicViewModel, gestures: PlayerGestureState, playerHeight: Float, favorite: Boolean, castSelected: Boolean, onCast: () -> Unit, onSong: (Track) -> Unit, onArtist: (Track) -> Unit, artwork: Modifier, playButton: Modifier, title: Modifier, artist: Modifier) {
    val track = state.track ?: return
    var showQueue by rememberSaveable { mutableStateOf(false) }
    var showLyrics by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val audio = remember { context.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager }
    var volume by remember { mutableStateOf(audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC).toFloat()) }
    val maxVolume = remember { audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC).toFloat().coerceAtLeast(1f) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(context, audio, lifecycleOwner) {
        fun refreshVolume() { volume = audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC).toFloat() }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) { refreshVolume() }
        }
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { refreshVolume() }
        }
        val lifecycleObserver = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) refreshVolume() }
        ContextCompat.registerReceiver(context, receiver, IntentFilter("android.media.VOLUME_CHANGED_ACTION"), ContextCompat.RECEIVER_EXPORTED)
        context.contentResolver.registerContentObserver(Settings.System.CONTENT_URI, true, observer)
        lifecycleOwner.lifecycle.addObserver(lifecycleObserver)
        refreshVolume()
        onDispose {
            context.unregisterReceiver(receiver)
            context.contentResolver.unregisterContentObserver(observer)
            lifecycleOwner.lifecycle.removeObserver(lifecycleObserver)
        }
    }
    var seekFraction by remember(track.id) { mutableStateOf<Float?>(null) }
    val scroll = rememberScrollState()
    val dragConnection = remember(gestures, playerHeight, scroll, showLyrics) {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && ((!showLyrics && available.y > 0f && scroll.value == 0) || gestures.dragging)) {
                    gestures.drag(opening = false, delta = available.y, distance = playerHeight.coerceAtLeast(1f))
                    return Offset(0f, available.y)
                }
                return Offset.Zero
            }
            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (showLyrics && source == NestedScrollSource.UserInput && available.y > 0f && scroll.value == 0) {
                    gestures.drag(opening = false, delta = available.y, distance = playerHeight.coerceAtLeast(1f))
                    return Offset(0f, available.y)
                }
                return Offset.Zero
            }
            override suspend fun onPreFling(available: Velocity): Velocity {
                if (!gestures.dragging) return Velocity.Zero
                gestures.finish(available.y)
                return Velocity(0f, available.y)
            }
        }
    }
    val progress = if (state.durationMs > 0) (state.positionMs.toFloat() / state.durationMs).coerceIn(0f, 1f) else 0f
    val controlColor = PlayerControlColor
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        val artworkSize = minOf(380.dp, maxWidth - 48.dp, maxHeight * 0.37f)
        Column(Modifier.fillMaxSize().nestedScroll(dragConnection).verticalScroll(scroll).padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(38.dp))
            Text(track.title, modifier = title.fillMaxWidth().clickable(role = Role.Button) { onSong(track) }, color = Color.White, fontSize = 23.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold, maxLines = 1,
                overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            Text(track.artist, artist.fillMaxWidth().clickable(role = Role.Button) { onArtist(track) }.padding(top = 6.dp), color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            Spacer(Modifier.height(20.dp))
            if (showLyrics) {
                LyricsArtwork(track, state.positionMs, state.canSeek, model, artwork.size(artworkSize), onClose = { showLyrics = false })
            } else {
                SwipeableArtwork(track, state.queueIndex, state.previousTrack, state.nextTrack, artworkSize,
                    artwork, onPrevious = model::previousTrack, onNext = model::next)
            }
            Spacer(Modifier.height(12.dp))
            Slider(value = seekFraction ?: progress, enabled = state.canSeek,
                colors = SliderDefaults.colors(inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant),
                thumb = { SliderHandle() }, track = { SliderLine(it.value) },
                onValueChange = { seekFraction = it },
                onValueChangeFinished = {
                    seekFraction?.let { model.seek((it * state.durationMs).toLong()) }
                    seekFraction = null
                }, modifier = Modifier.fillMaxWidth().height(48.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatTime(seekFraction?.let { (it * state.durationMs).toLong() } ?: state.positionMs),
                    style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(formatTime(state.durationMs), style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = model::previous, enabled = state.canPrevious, modifier = Modifier.size(64.dp), colors = IconButtonDefaults.iconButtonColors(contentColor = controlColor)) { Glyph(BragiIcon.Previous, "Previous song", Modifier.size(46.dp)) }
                Spacer(playButton.size(72.dp))
                IconButton(onClick = model::next, enabled = state.canNext, modifier = Modifier.size(64.dp), colors = IconButtonDefaults.iconButtonColors(contentColor = controlColor)) { Glyph(BragiIcon.Next, "Next song", Modifier.size(46.dp)) }
            }
            state.error?.let { ErrorMessage(it, Modifier.fillMaxWidth()) }
            Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                PlayerAction(BragiIcon.Heart, if (favorite) "Remove from favorites" else "Add to favorites", favorite) { model.toggleFavorite(track.id) }
                PlayerAction(BragiIcon.Cast, "Cast", castSelected, onClick = onCast)
                PlayerAction(BragiIcon.Lyrics, "Lyrics", showLyrics) { showLyrics = !showLyrics }
                PlayerAction(BragiIcon.Queue, "Show play queue") { showQueue = true }
            }
            Row(Modifier.fillMaxWidth().padding(top = 24.dp), verticalAlignment = Alignment.CenterVertically) {
                Glyph(BragiIcon.Volume, "Volume", Modifier.size(20.dp), tint = controlColor)
                Spacer(Modifier.width(12.dp))
                Slider(value = if (state.remote && state.deviceMaxVolume > 0) state.deviceVolume.toFloat() / state.deviceMaxVolume else volume / maxVolume,
                    onValueChange = { if (state.remote) model.setDeviceVolume((it * state.deviceMaxVolume).roundToInt()) else { volume = it * maxVolume; audio.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, volume.roundToInt(), 0) } },
                    thumb = { SliderHandle(volume = true) }, track = { SliderLine(it.value, volume = true) }, modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
        }
    }
    if (showQueue) {
        ModalBottomSheet(onDismissRequest = { showQueue = false }) {
            Text("Play queue", style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp))
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 520.dp),
                contentPadding = PaddingValues(bottom = 24.dp)) {
                itemsIndexed(state.queue, key = { index, song -> "$index:${song.id}" }) { index, song ->
                    TrackRow(song, selected = index == state.queueIndex, onClick = { model.playQueueIndex(index) })
                }
            }
        }
    }
}

@Composable
private fun SwipeableArtwork(track: Track, queueIndex: Int, previous: Track?, next: Track?, size: androidx.compose.ui.unit.Dp,
    modifier: Modifier, onPrevious: () -> Unit, onNext: () -> Unit) {
    val density = LocalDensity.current
    val width = with(density) { size.toPx() }
    val scope = rememberCoroutineScope()
    var offset by remember(track.id, queueIndex) { mutableFloatStateOf(0f) }
    var settling by remember { mutableStateOf<Job?>(null) }

    fun settle(target: Float, onComplete: (() -> Unit)? = null) {
        settling?.cancel()
        settling = scope.launch {
            animate(offset, target, animationSpec = tween(180)) { value, _ -> offset = value }
            if (onComplete != null) {
                onComplete()
                // Recover if the player cannot switch tracks; a successful switch resets the keyed offset.
                delay(600)
                offset = 0f
            }
        }
    }

    Box(modifier.size(size).clipToBounds().pointerInput(track.id, queueIndex, previous?.id, next?.id, width) {
        val tracker = VelocityTracker()
        var distance = 0f
        detectHorizontalDragGestures(
            onDragStart = { settling?.cancel(); tracker.resetTracking(); distance = 0f },
            onHorizontalDrag = { change, amount ->
                distance += amount
                tracker.addPosition(change.uptimeMillis, change.position)
                val resisted = if ((offset + amount > 0 && previous == null) || (offset + amount < 0 && next == null)) amount * 0.15f else amount
                offset = (offset + resisted).coerceIn(-width, width)
                change.consume()
            },
            onDragEnd = {
                val velocity = tracker.calculateVelocity().x
                val longSwipe = abs(distance) >= with(density) { 48.dp.toPx() }
                val fastSwipe = abs(distance) >= with(density) { 16.dp.toPx() } &&
                    abs(velocity) >= with(density) { 800.dp.toPx() } && distance * velocity > 0
                when {
                    (longSwipe || fastSwipe) && distance < 0 && next != null -> settle(-width, onNext)
                    (longSwipe || fastSwipe) && distance > 0 && previous != null -> settle(width, onPrevious)
                    else -> settle(0f)
                }
            },
            onDragCancel = { settle(0f) },
        )
    }) {
        previous?.let { Artwork(it, Modifier.size(size).offset { IntOffset((offset - width).roundToInt(), 0) }, radius = 24) }
        Artwork(track, Modifier.size(size).offset { IntOffset(offset.roundToInt(), 0) }, radius = 24)
        next?.let { Artwork(it, Modifier.size(size).offset { IntOffset((offset + width).roundToInt(), 0) }, radius = 24) }
    }
}

@Composable
private fun PlayerAction(icon: BragiIcon, description: String, active: Boolean = false, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null,
        role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
        Glyph(icon, description, Modifier.size(30.dp), tint = if (active) ActiveControlColor else PlayerControlColor)
    }
}

private sealed interface LyricsResult {
    data object Loading : LyricsResult
    data class Loaded(val lines: List<org.bragi.nativeapp.library.LyricLine>) : LyricsResult
    data object Failed : LyricsResult
}

@Composable
private fun LyricsArtwork(track: Track, positionMs: Long, canSeek: Boolean, model: MusicViewModel, modifier: Modifier, onClose: () -> Unit) {
    var lyricsRevision by remember(track.id) { mutableIntStateOf(0) }
    var showSearch by remember(track.id) { mutableStateOf(false) }
    var saveWarning by remember(track.id) { mutableStateOf<String?>(null) }
    val result by produceState<LyricsResult>(LyricsResult.Loading, track.id, lyricsRevision) {
        value = LyricsResult.Loading
        value = try {
            LyricsResult.Loaded(model.lyricsFor(track))
        } catch (error: kotlinx.coroutines.CancellationException) {
            throw error
        } catch (_: Exception) {
            LyricsResult.Failed
        }
    }
    val lines = (result as? LyricsResult.Loaded)?.lines.orEmpty()
    val active = lines.indexOfLast { it.startMs != null && it.startMs <= positionMs + 200 }
    val listState = rememberLazyListState()
    LaunchedEffect(active, track.id) {
        if (active >= 0) {
            // Wait for the newly highlighted line to be measured at its current size.
            withFrameNanos { }
            val wasVisible = listState.layoutInfo.visibleItemsInfo.any { it.index == active }
            if (!wasVisible) listState.scrollToItem(active)
            val layout = listState.layoutInfo
            val item = layout.visibleItemsInfo.firstOrNull { it.index == active }
            if (item != null) {
                val center = (layout.viewportStartOffset + layout.viewportEndOffset) / 2f
                val distance = item.offset + item.size / 2f - center
                if (wasVisible) listState.animateScrollBy(distance, animationSpec = tween(450))
                else listState.scrollBy(distance)
            }
        }
    }
    BoxWithConstraints(modifier.clip(RoundedCornerShape(24.dp)).background(Color(0xFF0A0A0F))
        .border(2.dp, ActiveControlColor, RoundedCornerShape(24.dp))
        .clickable(onClickLabel = "Return to artwork", onClick = onClose), contentAlignment = Alignment.Center) {
        when (result) {
            LyricsResult.Loading -> CircularProgressIndicator()
            LyricsResult.Failed -> Text("Couldn’t load lyrics. Tap to return to artwork.", color = Color.White, textAlign = TextAlign.Center, modifier = Modifier.padding(24.dp))
            is LyricsResult.Loaded -> if (lines.isEmpty()) {
                Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (track.id.startsWith("server:")) "No lyrics available" else "Lyrics are not available for phone files yet",
                        color = Color.White, textAlign = TextAlign.Center)
                    if (track.id.startsWith("server:")) {
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { showSearch = true }) { Text("Search lyrics") }
                    }
                    saveWarning?.let { Text(it, Modifier.padding(top = 12.dp), color = Color.White, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodySmall) }
                }
            } else {
                LazyColumn(state = listState, modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = maxHeight / 2),
                    verticalArrangement = Arrangement.spacedBy(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    itemsIndexed(lines) { index, line ->
                        val current = index == active
                        Text(line.text, modifier = Modifier.fillMaxWidth().then(
                            if (line.startMs != null && canSeek) Modifier.clickable { model.seek(line.startMs) } else Modifier
                        ), color = if (current || active < 0) Color.White else Color.White.copy(alpha = 0.45f),
                            textAlign = TextAlign.Center, fontSize = if (current) 23.sp else 21.sp,
                            lineHeight = if (current) 31.sp else 29.sp,
                            fontWeight = if (current) FontWeight.Bold else FontWeight.Medium)
                    }
                }
            }
        }
    }
    if (showSearch) LyricsSearchDialog(track, model, onDismiss = { showSearch = false }) { synced, plain ->
        val destination = if (synced.isNotBlank()) "lrc" else "txt"
        val files = org.json.JSONObject(model.lyricsRequest(track))
        if (files.optJSONObject(destination)?.optBoolean("exists") == true)
            throw IllegalStateException("A lyrics file already exists. Open the song page to review it before replacing it.")
        val body = org.json.JSONObject().put("content", synced.ifBlank { plain })
            .put("extension", ".$destination")
            .put("expectedVersion", files.optJSONObject(destination)?.optString("version").orEmpty())
        val updated = org.json.JSONObject(model.lyricsRequest(track, method = "PUT", body = body))
        saveWarning = if (updated.optBoolean("refreshRequired"))
            updated.optString("refreshError").ifBlank { "Saved, but the library refresh did not finish." } else null
        lyricsRevision++
    }
}

@Composable
private fun SliderHandle(volume: Boolean = false) {
    Box(Modifier.width(12.dp).height(48.dp), contentAlignment = Alignment.Center) {
        Box(if (volume) Modifier.width(4.dp).height(18.dp).background(ActiveControlColor, CircleShape)
            else Modifier.size(12.dp).background(ActiveControlColor, CircleShape))
    }
}

@Composable
private fun SliderLine(progress: Float, volume: Boolean = false) {
    val thickness = if (volume) 8.dp else 5.dp
    Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.CenterStart) {
        Box(Modifier.fillMaxWidth().height(thickness).background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.32f), CircleShape)) {
            Box(Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(thickness).background(ActiveControlColor, CircleShape))
        }
    }
}

@Composable
private fun PlayerTransitionHero(track: Track, from: Rect, to: Rect, progress: Float) {
    val fraction = progress.coerceIn(0f, 1f)
    val density = LocalDensity.current
    Box(Modifier.fillMaxSize()) {
        fun mix(start: Float, end: Float, amount: Float) = start + (end - start) * amount
        val artLeft = mix(from.left, to.left, fraction)
        val artTop = mix(from.top, to.top, fraction)
        val artWidth = mix(from.width, to.width, fraction).coerceAtLeast(1f)
        val artHeight = mix(from.height, to.height, fraction).coerceAtLeast(1f)
        val width = to.width.coerceAtLeast(1f)
        val height = to.height.coerceAtLeast(1f)
        val scaleX = artWidth / width
        val scaleY = artHeight / height
        Artwork(track, Modifier.graphicsLayer {
            translationX = artLeft
            translationY = artTop
            this.scaleX = scaleX
            this.scaleY = scaleY
            transformOrigin = TransformOrigin(0f, 0f)
        }.size(with(density) { width.toDp() }, with(density) { height.toDp() })
            .semantics { contentDescription = "Transition artwork" }, radius = (mix(10f, 24f, fraction) / scaleX).roundToInt())
    }
}

private fun androidx.compose.ui.layout.LayoutCoordinates.unclippedBounds(): Rect =
    Rect(positionInRoot(), Size(size.width.toFloat(), size.height.toFloat()))

private fun Rect.materiallyDiffersFrom(other: Rect?): Boolean = other == null ||
    abs(left - other.left) > 1.5f || abs(top - other.top) > 1.5f ||
    abs(right - other.right) > 1.5f || abs(bottom - other.bottom) > 1.5f

@Composable
private fun Artwork(track: Track, modifier: Modifier, radius: Int) {
    val context = LocalContext.current
    val imageRequest = remember(context, track.artworkUri) {
        track.artworkUri?.let { uri -> ImageRequest.Builder(context).data(uri)
            .memoryCacheKey(artworkCacheKey(uri)).diskCacheKey(artworkCacheKey(uri)).build() }
    }
    Box(modifier.clip(RoundedCornerShape(radius.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center) {
        Glyph(BragiIcon.Music, null, Modifier.fillMaxSize(0.36f), MaterialTheme.colorScheme.primary.copy(alpha = 0.55f))
        AsyncImage(model = imageRequest, contentDescription = null, contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize())
    }
}

@Composable
private fun EmptyState(icon: BragiIcon, title: String, description: String, modifier: Modifier,
    action: String, onAction: () -> Unit) {
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(32.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(24.dp)) {
            Glyph(icon, null, Modifier.padding(24.dp).size(38.dp), MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.height(24.dp))
        Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(description, modifier = Modifier.padding(top = 10.dp, bottom = 24.dp),
            style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Button(onClick = onAction) { Text(action) }
    }
}

@Composable
private fun ErrorMessage(message: String, modifier: Modifier = Modifier) {
    Surface(modifier, color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(12.dp)) {
        Text(message, Modifier.padding(14.dp), color = MaterialTheme.colorScheme.onErrorContainer,
            style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun Glyph(icon: BragiIcon, description: String?, modifier: Modifier = Modifier,
    tint: Color = androidx.compose.material3.LocalContentColor.current) {
    Icon(icon.vector, description, modifier.size(24.dp), tint)
}

private fun formatTime(milliseconds: Long): String {
    val seconds = milliseconds.coerceAtLeast(0) / 1_000
    return if (seconds >= 3_600) String.format(Locale.ROOT, "%d:%02d:%02d", seconds / 3_600, seconds / 60 % 60, seconds % 60)
        else String.format(Locale.ROOT, "%d:%02d", seconds / 60, seconds % 60)
}

private fun WindowInsets.onlyBottom(): WindowInsets = only(androidx.compose.foundation.layout.WindowInsetsSides.Bottom)
