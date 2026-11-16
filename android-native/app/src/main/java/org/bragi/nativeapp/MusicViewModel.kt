package org.bragi.nativeapp

import android.app.Application
import android.content.ComponentName
import coil.Coil
import coil.ImageLoader
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.DeviceInfo
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.bragi.nativeapp.library.Track
import org.bragi.nativeapp.library.ServerLibrary
import org.bragi.nativeapp.library.ServerTls
import org.bragi.nativeapp.library.ServerSettings
import org.bragi.nativeapp.library.SavedServer
import org.bragi.nativeapp.library.filterSongs
import org.bragi.nativeapp.playback.PlaybackService
import org.bragi.nativeapp.playback.CastQueueMetadata
import org.bragi.nativeapp.playback.toMediaItem
import org.bragi.nativeapp.playback.toTrack

data class LibraryState(
    val tracks: List<Track> = emptyList(),
    val totalCount: Int = 0,
    val hasPermission: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
    val songOrder: List<String> = emptyList(),
)

data class PlaybackState(
    val connected: Boolean = false,
    val track: Track? = null,
    val playing: Boolean = false,
    val buffering: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val canSeek: Boolean = false,
    val canPrevious: Boolean = false,
    val canNext: Boolean = false,
    val previousTrack: Track? = null,
    val nextTrack: Track? = null,
    val upcomingArtwork: List<String> = emptyList(),
    val queue: List<Track> = emptyList(),
    val queueIndex: Int = -1,
    val error: String? = null,
    val remote: Boolean = false,
    val deviceVolume: Int = 0,
    val deviceMaxVolume: Int = 0,
)

@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class MusicViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as BragiApplication
    private val settings = ServerSettings(app)
    private var savedServer = runCatching { settings.loadServer() }.getOrNull()
    val source = MutableStateFlow(settings.selectedSource ?: "Setup")
    private val libraryData = MutableStateFlow(when (source.value) {
        "Server" -> LibraryState(hasPermission = true, loading = true)
        "Phone" -> if (app.hasMusicAccess()) LibraryState(hasPermission = true, loading = true) else LibraryState()
        else -> LibraryState(loading = true)
    })
    val allLibrary = libraryData.asStateFlow()
    val savedAddress: String get() = settings.address
    val savedUsername: String get() = settings.username
    val hasSavedPassword: Boolean get() = savedServer != null
    val phoneFolder = MutableStateFlow(settings.phoneFolder)
    val settingsMessage = MutableStateFlow<String?>(null)
    val scanBusy = MutableStateFlow(false)
    val genres = MutableStateFlow<List<String>>(emptyList())
    val selectedGenre = MutableStateFlow<String?>(null)
    val songFilter = MutableStateFlow<Set<String>>(emptySet())
    private val localStats = app.getSharedPreferences("local-song-stats", 0)
    private var server: ServerLibrary? = null
    val query = MutableStateFlow("")
    private val refreshes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    private var libraryJob: Job? = null
    private var controller: MediaController? = null
    private var queue = emptyList<Track>()
    private var knownQueueTracks = emptyMap<String, Track>()
    private var selectedQueue = emptyList<Track>()
    private var selectedCastIds: List<Int>? = null
    private val castQueueMetadata = CastQueueMetadata(application)
    private var indexedLibrary: List<Track>? = null
    private var libraryById = emptyMap<String, Track>()
    private var playbackError: String? = null
    private var pendingSelection: Track? = null
    private var pendingSelectionTimeout: Job? = null
    val playback = MutableStateFlow(PlaybackState())
    // Position changes twice a second; screens that only need track and controls
    // should not be invalidated by the progress ticker.
    val playbackSummary = playback.map { it.copy(positionMs = 0) }.distinctUntilChanged()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), PlaybackState())
    val library = combine(libraryData, query.debounce(120), selectedGenre, songFilter) { state, text, genre, filter ->
        withContext(Dispatchers.Default) {
            val order = when {
                "Recently added" in filter -> "Recently added"
                "Most played" in filter -> "Most played"
                "Recently played" in filter -> "Recently played"
                else -> "All"
            }
            val tracksById = state.tracks.associateBy { it.id }
            val songs = state.songOrder.mapNotNull(tracksById::get)
            state.copy(tracks = songs.filterSongs(text, genre, order, favoritesOnly = "Favorites" in filter))
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LibraryState(loading = true))

    private val controllerFuture = MediaController.Builder(application,
        SessionToken(application, ComponentName(application, PlaybackService::class.java))).buildAsync()
    private val playerListener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO || reason == Player.MEDIA_ITEM_TRANSITION_REASON_SEEK) mediaItem?.mediaId?.let(::recordLocalPlay)
        }
        override fun onEvents(player: Player, events: Player.Events) {
            if (events.contains(Player.EVENT_TIMELINE_CHANGED)) {
                if (player.mediaItemCount > 0 || (!app.castHandoff.value && pendingSelection == null)) {
                    refreshQueue(player)
                }
            }
            if (events.contains(Player.EVENT_MEDIA_ITEM_TRANSITION)) playbackError = null
            updatePlayback()
        }

        override fun onPlayerError(error: PlaybackException) {
            clearPendingSelection()
            playbackError = if (controller?.deviceInfo?.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE)
                "Couldn’t play on the Cast device. Check that it can reach the server and supports this audio format."
            else "This song couldn’t be played. Check the source and try again."
            updatePlayback()
        }
    }

    init {
        viewModelScope.launch { app.castHandoff.collect { updatePlayback() } }
        viewModelScope.launch {
            app.castError.collect { error ->
                if (error != null) { clearPendingSelection(); playbackError = error; updatePlayback() }
            }
        }
        if (source.value == "Server") {
            savedServer?.let { server = ServerLibrary(it.address, it.username, it.password, pinnedFingerprint = it.fingerprint); loadServer(server!!) }
                ?: run { libraryData.value = LibraryState(hasPermission = true, error = "Saved server credentials are unavailable. Open server settings to sign in again.") }
        }
        controllerFuture.addListener({
            runCatching { controllerFuture.get() }.onSuccess { connected ->
                controller = connected
                refreshQueue(connected)
                connected.addListener(playerListener)
                updatePlayback()
            }.onFailure {
                playback.value = PlaybackState(error = "Couldn’t connect to the music player. Please reopen Bragi.")
            }
        }, ContextCompat.getMainExecutor(application))
        viewModelScope.launch {
            while (true) {
                delay(500)
                controller?.let { player ->
                    if (player.deviceInfo.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE && queue.any { it.id.startsWith("loading:") }) {
                        refreshQueue(player)
                        updatePlayback()
                    } else if (player.isPlaying) updatePlayback()
                }
            }
        }
    }

    suspend fun lyricsFor(track: Track): List<org.bragi.nativeapp.library.LyricLine> {
        if (!track.id.startsWith("server:")) return emptyList()
        return (server ?: throw IllegalStateException("Connect to the server to load lyrics.")).lyrics(track.id)
    }

    fun setLibraryAccess(granted: Boolean) {
        if (source.value != "Phone") return
        if (granted && libraryJob?.isActive == true) return
        libraryJob?.cancel()
        libraryJob = null
        if (!granted) {
            libraryData.value = LibraryState()
            return
        }
        libraryData.value = libraryData.value.copy(hasPermission = true, loading = true, error = null)
        libraryJob = viewModelScope.launch {
            try {
                merge(app.library.changes(), refreshes).debounce(200).collect {
                    scan()
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: SecurityException) {
                libraryData.value = LibraryState(error = "Music access was removed. Allow access to browse your songs.")
            } catch (_: Exception) {
                libraryData.value = libraryData.value.copy(loading = false,
                    error = "Couldn’t read your music library. Try refreshing it.")
            }
        }
    }

    private suspend fun scan() {
        libraryData.value = libraryData.value.copy(loading = true, error = null)
        try {
            val tracks = app.library.tracks(phoneFolder.value).map { it.copy(starred = localStats.getBoolean("favorite:${it.id}", false), playCount = localStats.getLong("plays:${it.id}", 0), lastPlayedMs = localStats.getLong("last-played:${it.id}", 0)) }
            genres.value = tracks.mapNotNull { it.genre }.distinct().sortedBy { it.lowercase() }
            libraryData.value = LibraryState(tracks, tracks.size, hasPermission = true, songOrder = tracks.map { it.id }.shuffled())
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            libraryData.value = libraryData.value.copy(loading = false, error =
                if (error is SecurityException) "Music access was removed. Please allow access again."
                else "Couldn’t read your music library. Try refreshing it.",
                hasPermission = error !is SecurityException)
        }
    }

    fun refresh() {
        if (source.value == "Server") { server?.let { loadServer(it) }; return }
        if (libraryData.value.hasPermission) {
            if (libraryJob?.isActive == true) refreshes.tryEmit(Unit) else setLibraryAccess(true)
        }
    }

    fun usePhone(granted: Boolean) {
        settings.selectPhone()
        libraryJob?.cancel()
        libraryJob = null
        source.value = "Phone"
        genres.value = emptyList()
        selectedGenre.value = null
        songFilter.value = emptySet()
        setLibraryAccess(granted)
    }

    fun setPhoneFolder(folder: String) {
        settings.setPhoneFolder(folder)
        phoneFolder.value = folder
        refresh()
    }

    fun useSavedServer() {
        savedServer?.let { connectServer(it.address, it.username, "") }
    }

    fun scanServer(full: Boolean) {
        val client = server ?: run { settingsMessage.value = "Connect to your server first."; return }
        if (scanBusy.value) return
        viewModelScope.launch {
            scanBusy.value = true
            settingsMessage.value = null
            try {
                client.startScan(full)
                settingsMessage.value = if (full) "Full scan started. Refresh your library after it finishes." else "Quick scan started. Refresh your library after it finishes."
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { settingsMessage.value = error.message ?: "Couldn’t start the scan. An administrator account may be required." }
            finally { scanBusy.value = false }
        }
    }

    fun logOut() {
        libraryJob?.cancel()
        controller?.stop()
        controller?.clearMediaItems()
        settings.clearServer()
        savedServer = null
        server = null
        source.value = "Setup"
        genres.value = emptyList()
        selectedGenre.value = null
        songFilter.value = emptySet()
        settingsMessage.value = null
        libraryData.value = LibraryState()
    }

    fun connectServer(address: String, username: String, password: String, allowUntrusted: Boolean = false) {
        try {
            val normalizedAddress = address.trim()
            val normalizedUsername = username.trim()
            val resolvedPassword = password.ifEmpty {
                savedServer?.takeIf { it.address == normalizedAddress && it.username == normalizedUsername }?.password.orEmpty()
            }
            require(normalizedUsername.isNotBlank() && resolvedPassword.isNotEmpty()) { "Enter your username and password." }
            val existingPin = savedServer?.takeIf { it.address == normalizedAddress && it.username == normalizedUsername }?.fingerprint
            val client = ServerLibrary(normalizedAddress, normalizedUsername, resolvedPassword, allowUntrusted,
                pinnedFingerprint = if (allowUntrusted) null else existingPin)
            server = client
            source.value = "Server"
            libraryJob?.cancel()
            selectedGenre.value = null
            songFilter.value = emptySet()
            loadServer(client, SavedServer(normalizedAddress, normalizedUsername, resolvedPassword))
        } catch (error: Exception) {
            source.value = "Server"
            libraryData.value = LibraryState(hasPermission = true, error = error.message ?: "Invalid server settings.")
        }
    }

    private fun loadServer(client: ServerLibrary, credentialsToSave: SavedServer? = null) {
        libraryJob?.cancel()
        libraryData.value = LibraryState(hasPermission = true, loading = true)
        libraryJob = viewModelScope.launch {
            try {
                val (tracks, tags) = client.load()
                if (credentialsToSave != null) {
                    val verified = credentialsToSave.copy(fingerprint = client.trustedFingerprint)
                    try {
                        withContext(Dispatchers.IO) { settings.saveServer(verified) }
                    } catch (error: CancellationException) { throw error }
                    catch (_: Exception) { throw IllegalStateException("Connected, but couldn’t securely save server settings. Please try again.") }
                    savedServer = verified
                }
                Coil.setImageLoader(ImageLoader.Builder(app).okHttpClient { ServerTls.imageClient() }.build())
                genres.value = tags
                libraryData.value = LibraryState(tracks, tracks.size, hasPermission = true, songOrder = tracks.map { it.id }.shuffled())
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                libraryData.value = LibraryState(hasPermission = true, error = when (error) {
                    is javax.net.ssl.SSLHandshakeException -> "The server certificate isn’t trusted. If this is your own server, open Server settings and choose to trust its certificate."
                    is java.security.cert.CertificateException -> error.message ?: "The server certificate could not be verified."
                    is IllegalStateException -> error.message ?: "Server request failed."
                    else -> "Couldn’t reach the server. Check the address and connection."
                })
            }
        }
    }

    suspend fun lyricsRequest(track: Track, suffix: String = "", method: String = "GET", body: org.json.JSONObject? = null, query: String? = null): String =
        (server ?: throw IllegalStateException("Connect to a server to edit lyrics.")).lyricsRequest(track.id, suffix, method, body, query)

    suspend fun saveMetadata(track: Track, changes: org.json.JSONObject): String? {
        val client = server ?: throw IllegalStateException("Connect to a server to edit metadata.")
        val warning = client.updateMetadata(track.id, changes)
        val updated = track.copy(
            title = changes.optString("title", track.title), artist = changes.optString("artist", track.artist),
            artistId = if (changes.has("artist")) "" else track.artistId,
            genre = if (changes.has("genres")) changes.getJSONArray("genres").optString(0).takeIf { it.isNotBlank() } else track.genre,
            genres = if (changes.has("genres")) changes.getJSONArray("genres").let { a -> (0 until a.length()).map { a.getString(it) } } else track.genres,
            moods = if (changes.has("moods")) changes.getJSONArray("moods").let { a -> (0 until a.length()).map { a.getString(it) } } else track.moods,
        )
        libraryData.value = libraryData.value.copy(tracks = libraryData.value.tracks.map { if (it.id == track.id) updated else it })
        genres.value = libraryData.value.tracks.flatMap { listOfNotNull(it.genre) + it.genres + it.moods }.distinctBy { it.lowercase(java.util.Locale.ROOT) }.sortedBy { it.lowercase(java.util.Locale.ROOT) }
        controller?.let { player ->
            for (index in 0 until player.mediaItemCount) {
                if (player.getMediaItemAt(index).mediaId == track.id) player.replaceMediaItem(index, updated.toMediaItem())
            }
        }
        updatePlayback()
        return warning
    }

    suspend fun uploadArtwork(track: Track, uri: android.net.Uri): String? {
        val (artwork, warning) = (server ?: error("Connect to a server to change artwork.")).uploadArtwork(track.id, app.contentResolver, uri)
        val updated = track.copy(artworkUri = artwork)
        libraryData.value = libraryData.value.copy(tracks = libraryData.value.tracks.map { if (it.id == track.id) updated else it })
        controller?.let { player ->
            for (index in 0 until player.mediaItemCount) if (player.getMediaItemAt(index).mediaId == track.id) player.replaceMediaItem(index, updated.toMediaItem())
        }
        updatePlayback()
        return warning
    }

    fun toggleSongFilter(value: String) {
        val current = songFilter.value
        songFilter.value = when {
            value == "All" -> emptySet()
            value == "Favorites" -> if (value in current) current - value else current + value
            value in current -> current - value
            else -> (current - "Recently added" - "Most played" - "Recently played") + value
        }
    }

    suspend fun listeningStats(period: String) = (server ?: error("Connect to your Bragi server first.")).listeningStats(period)
    suspend fun recommendations() = (server ?: error("Connect to your Bragi server first.")).recommendations()
    suspend fun linkListenBrainz(token: String) = (server ?: error("Connect to your Bragi server first.")).linkListenBrainz(token)
    suspend fun recommendationLink(id: String) = (server ?: error("Connect to your Bragi server first.")).recommendationLink(id)

    fun play(tracks: List<Track>, index: Int = 0, shuffle: Boolean = false) {
        if (tracks.isEmpty() || index !in tracks.indices) return
        val player = controller ?: return
        val song = tracks[index]
        if (song.id.startsWith("device:") && player.deviceInfo.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE) {
            playbackError = "Phone files cannot be cast yet. Select This phone in the Cast menu to play them."
            updatePlayback()
            return
        }
        recordLocalPlay(song.id)
        playbackError = null
        knownQueueTracks = tracks.associateBy { it.id }
        selectedQueue = tracks.toList()
        selectedCastIds = null
        pendingSelection = song
        pendingSelectionTimeout?.cancel()
        pendingSelectionTimeout = viewModelScope.launch {
            delay(15_000)
            clearPendingSelection()
            updatePlayback()
        }
        updatePlayback()
        player.shuffleModeEnabled = shuffle
        if (player.deviceInfo.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE) player.play()
        player.setMediaItems(tracks.map { it.toMediaItem() }, index, 0)
        player.prepare()
        player.play()
    }

    private fun recordLocalPlay(id: String) {
        if (!id.startsWith("device:")) return
        val playedAt = System.currentTimeMillis()
        val plays = localStats.getLong("plays:$id", 0) + 1
        localStats.edit().putLong("plays:$id", plays).putLong("last-played:$id", playedAt).apply()
        libraryData.value = libraryData.value.copy(tracks = libraryData.value.tracks.map { if (it.id == id) it.copy(playCount = plays, lastPlayedMs = playedAt) else it })
    }

    fun toggleFavorite(id: String) {
        val track = libraryData.value.tracks.firstOrNull { it.id == id } ?: return
        viewModelScope.launch {
            try {
                if (id.startsWith("server:")) server?.setFavorite(id, !track.starred) ?: return@launch
                else localStats.edit().putBoolean("favorite:$id", !track.starred).apply()
                libraryData.value = libraryData.value.copy(tracks = libraryData.value.tracks.map { if (it.id == id) it.copy(starred = !track.starred) else it })
            } catch (_: Exception) { playbackError = "Couldn’t update favorite. Please try again."; updatePlayback() }
        }
    }

    fun togglePlayback() {
        val player = controller ?: return
        playbackError = null
        val active = player.playbackState == Player.STATE_READY || player.playbackState == Player.STATE_BUFFERING
        if (player.playWhenReady && active) player.pause() else {
            if (player.playbackState == Player.STATE_IDLE) player.prepare()
            if (player.playbackState == Player.STATE_ENDED) player.seekToDefaultPosition()
            player.play()
        }
        updatePlayback()
    }

    fun previous() { controller?.seekToPrevious() }
    fun previousTrack() { controller?.takeIf { it.hasPreviousMediaItem() }?.seekToPreviousMediaItem() }
    fun next() { controller?.seekToNextMediaItem() }
    fun setDeviceVolume(volume: Int) { controller?.setDeviceVolume(volume, 0) }
    fun seek(positionMs: Long) {
        controller?.takeIf { it.isCurrentMediaItemSeekable }?.seekTo(positionMs.coerceAtLeast(0))
        updatePlayback()
    }
    fun playQueueIndex(index: Int) {
        controller?.let {
            if (index in 0 until it.mediaItemCount) {
                playbackError = null
                it.seekToDefaultPosition(index)
                it.prepare()
                it.play()
            }
        }
    }

    private fun clearPendingSelection() {
        pendingSelection = null
        pendingSelectionTimeout?.cancel()
        pendingSelectionTimeout = null
    }

    private fun libraryTracksById(): Map<String, Track> {
        val tracks = libraryData.value.tracks
        if (tracks !== indexedLibrary) {
            indexedLibrary = tracks
            libraryById = tracks.associateBy { it.id }
        }
        return libraryById
    }

    private fun refreshQueue(player: Player) {
        val library = libraryTracksById()
        val items = (0 until player.mediaItemCount).map(player::getMediaItemAt)
        var selected = matchingSelectedQueue(selectedQueue, items.map { it.mediaId })
        if (selected != null && player.deviceInfo.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE) {
            val ids = castQueueMetadata.receiverIds()
            if (ids == null || ids.size != items.size || ids.any { it == 0 }) selected = null
            else if (selectedCastIds == null) selectedCastIds = ids
            else if (selectedCastIds != ids) {
                selectedQueue = emptyList()
                selectedCastIds = null
                selected = null
            }
        }
        val castTracks = if (selected == null) castQueueMetadata.read(player) else null
        queue = items.mapIndexed { index, item ->
            val castTrack = selected?.get(index) ?: castTracks?.getOrNull(index)
            val id = item.mediaId.ifBlank { castTrack?.id.orEmpty() }
            val known = library[id] ?: knownQueueTracks[id] ?: castTrack
            if (item.mediaId.isBlank()) known ?: Track("loading:$index", "", "Loading song…", "", "", 0)
            else item.toTrack(known = known)
        }
        if (queue.isEmpty()) knownQueueTracks = emptyMap()
        else knownQueueTracks = knownQueueTracks + queue.filterNot { it.id.startsWith("loading:") }.associateBy { it.id }
    }

    private fun updatePlayback() {
        val player = controller ?: return
        val library = libraryTracksById()
        val current = player.currentMediaItem?.let { item ->
            if (item.mediaId.isBlank()) queue.getOrNull(player.currentMediaItemIndex)
            else item.toTrack(known = library[item.mediaId] ?: knownQueueTracks[item.mediaId])
        }
        fun trackAt(index: Int): Track? = queue.getOrNull(index)?.let { library[it.id] ?: it }
        val duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: current?.durationMs ?: 0
        val timeline = player.currentTimeline
        val currentIndex = player.currentMediaItemIndex
        val artworkToPrefetch = buildList {
            if (currentIndex in 0 until timeline.windowCount) {
                val visited = mutableSetOf(currentIndex)
                val repeatMode = if (player.repeatMode == Player.REPEAT_MODE_ONE) Player.REPEAT_MODE_OFF else player.repeatMode
                var index = currentIndex
                repeat(3) {
                    index = if (index == C.INDEX_UNSET) C.INDEX_UNSET else timeline.getNextWindowIndex(index, repeatMode, player.shuffleModeEnabled)
                    if (index != C.INDEX_UNSET && visited.add(index)) trackAt(index)?.artworkUri?.let(::add)
                }
                val previous = timeline.getPreviousWindowIndex(currentIndex, repeatMode, player.shuffleModeEnabled)
                if (previous != C.INDEX_UNSET && visited.add(previous)) trackAt(previous)?.artworkUri?.let(::add)
            }
        }.distinct()
        val next = PlaybackState(
            connected = true,
            track = current?.copy(durationMs = duration),
            playing = player.playWhenReady && (player.playbackState == Player.STATE_READY || player.playbackState == Player.STATE_BUFFERING),
            buffering = player.playbackState == Player.STATE_BUFFERING,
            positionMs = player.currentPosition.coerceAtLeast(0),
            durationMs = duration,
            canSeek = player.isCurrentMediaItemSeekable && duration > 0,
            canPrevious = player.hasPreviousMediaItem() || player.isCurrentMediaItemSeekable,
            canNext = player.hasNextMediaItem(),
            previousTrack = trackAt(player.previousMediaItemIndex),
            nextTrack = trackAt(player.nextMediaItemIndex),
            upcomingArtwork = artworkToPrefetch,
            queue = queue,
            queueIndex = player.currentMediaItemIndex,
            error = playbackError,
            remote = player.deviceInfo.playbackType == DeviceInfo.PLAYBACK_TYPE_REMOTE,
            deviceVolume = player.deviceVolume,
            deviceMaxVolume = player.deviceInfo.maxVolume,
        )
        val selection = pendingSelection
        playback.value = keepPlayerDuringTransition(playback.value, next, app.castHandoff.value, selection)
        if (selection != null && selectionIsReady(selection, next, player.playbackState == Player.STATE_READY)) clearPendingSelection()
        if (app.castHandoff.value && next.remote && next.track != null) app.castHandoff.value = false
    }

    override fun onCleared() {
        controller?.removeListener(playerListener)
        MediaController.releaseFuture(controllerFuture)
        super.onCleared()
    }
}

internal fun matchingSelectedQueue(selected: List<Track>, timelineIds: List<String>): List<Track>? =
    selected.takeIf { candidate ->
        candidate.isNotEmpty() && candidate.size == timelineIds.size &&
            timelineIds.any { it.isNotBlank() } &&
            timelineIds.indices.all { timelineIds[it].isBlank() || timelineIds[it] == candidate[it].id }
    }

internal fun keepPlayerDuringTransition(previous: PlaybackState, next: PlaybackState, transferring: Boolean,
    selection: Track? = null): PlaybackState = when {
    selection != null && next.track?.id != selection.id -> next.copy(
        track = selection, positionMs = 0, durationMs = selection.durationMs,
        buffering = true, canSeek = false, canPrevious = false, canNext = false,
    )
    transferring && next.track == null && previous.track != null -> next.copy(
        track = previous.track, queue = previous.queue, queueIndex = previous.queueIndex,
        positionMs = previous.positionMs, durationMs = previous.durationMs,
        buffering = true, canSeek = false, canPrevious = false, canNext = false,
    )
    else -> next
}

internal fun selectionIsReady(selection: Track, state: PlaybackState, ready: Boolean): Boolean =
    ready && state.track?.id == selection.id
