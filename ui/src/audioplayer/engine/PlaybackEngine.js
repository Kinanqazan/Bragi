import {
  AUDIO_EVENT_NAMES,
  createAudioElementAdapter,
} from './audioElementAdapter'
import {
  createQueuePolicy,
  normalizePlayMode,
  PLAY_MODE_ORDER,
} from './queuePolicy'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const STREAM_RESOLUTION_TIMEOUT_MS = 15000
export const PLAYBACK_START_TIMEOUT_MS = 30000

const resolveWithTimeout = (
  resolver,
  timeoutMs,
  message = 'Stream resolution timed out',
) => {
  let timer
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    Promise.resolve()
      .then(resolver)
      .then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
      )
  })
}

const trackKey = (track) => track?.uuid || track?.trackId || track?.id || null

const bufferedEnd = (buffered) => {
  if (!buffered || !buffered.length) return 0
  try {
    return buffered.end(buffered.length - 1)
  } catch {
    return 0
  }
}

export const createPlaybackEngine = ({
  audio,
  resolveStreamUrl,
  fallbackStreamUrl,
  reportPlayback,
  random,
}) => {
  if (!audio) throw new Error('PlaybackEngine requires an audio adapter')
  if (typeof resolveStreamUrl !== 'function') {
    throw new Error('PlaybackEngine requires resolveStreamUrl')
  }

  const adapter = audio.element ? audio : createAudioElementAdapter(audio)
  const queuePolicy = createQueuePolicy(random)
  const subscribers = new Set()
  let queue = []
  let currentIndex = -1
  let currentTrack = null
  let loadId = 0
  let destroyed = false
  let startReportedForLoad = null
  let fallbackAttemptedForLoad = null
  let fallbackPromise = null
  let autoplayForLoad = false
  let playbackIntent = false
  let state = {
    currentTrack: null,
    currentIndex: -1,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: adapter.volume ?? 1,
    mode: PLAY_MODE_ORDER,
    error: null,
  }

  const notify = () => {
    if (destroyed) return
    const snapshot = getSnapshot()
    subscribers.forEach((listener) => listener(snapshot))
  }

  const update = (changes) => {
    if (destroyed) return
    state = { ...state, ...changes }
    notify()
  }

  const report = (
    type,
    track = currentTrack,
    position = adapter.currentTime,
  ) => {
    if (typeof reportPlayback !== 'function' || !track || track.isRadio) return
    const positionMs = Math.max(0, Math.floor((position || 0) * 1000))
    reportPlayback({ type, track, positionMs })
  }

  const syncFromAudio = () => {
    const duration = Number.isFinite(adapter.duration) ? adapter.duration : 0
    const currentTime = Number.isFinite(adapter.currentTime)
      ? adapter.currentTime
      : 0
    update({
      currentTime,
      duration,
      buffered: bufferedEnd(adapter.buffered),
    })
  }

  const handlePlay = () => {
    if (destroyed) return
    const wasPlaying = state.playing
    update({ playing: true, loading: false, error: null })
    if (!wasPlaying) {
      report('playing')
    }
  }

  const handlePause = () => {
    if (destroyed) return
    const wasPlaying = state.playing
    update({ playing: false })
    if (wasPlaying) report('paused')
  }

  const handleWaiting = () => update({ loading: true })
  const handleCanPlay = () => update({ loading: false })

  function retryWithFallback(operation, track, error, sourceUrl, autoplay) {
    if (fallbackPromise?.operation === operation) return fallbackPromise.promise
    if (fallbackAttemptedForLoad === operation) return Promise.resolve(false)

    fallbackAttemptedForLoad = operation
    const promise = (async () => {
      if (typeof fallbackStreamUrl !== 'function') throw error

      update({ loading: true, playing: false, error: null })
      const fallbackUrl = await resolveWithTimeout(
        () => fallbackStreamUrl(track, error),
        STREAM_RESOLUTION_TIMEOUT_MS,
      )
      if (
        destroyed ||
        operation !== loadId ||
        !fallbackUrl ||
        fallbackUrl === sourceUrl
      ) {
        throw error
      }

      adapter.pause()
      adapter.src = fallbackUrl
      adapter.load()
      const shouldAutoplay = autoplay && playbackIntent && operation === loadId
      if (!shouldAutoplay) {
        update({ loading: false })
        return true
      }

      await resolveWithTimeout(
        () => adapter.play(),
        PLAYBACK_START_TIMEOUT_MS,
        'Playback startup timed out',
      )
      if (destroyed || operation !== loadId) return false
      if (!playbackIntent) {
        adapter.pause()
        update({ playing: false, loading: false })
        return true
      }
      handlePlay()
      return true
    })().catch((fallbackError) => {
      if (!destroyed && operation === loadId) {
        update({ loading: false, playing: false, error: fallbackError })
      }
      return false
    })

    fallbackPromise = { operation, promise }
    promise.then(() => {
      if (fallbackPromise?.promise === promise) fallbackPromise = null
    })
    return promise
  }

  const handleError = (event) => {
    if (destroyed) return
    if (!adapter.src || !currentTrack) return
    const error =
      event?.error ||
      event?.target?.error ||
      (event instanceof Error ? event : new Error('Audio playback failed'))
    if (fallbackAttemptedForLoad === loadId) {
      update({ loading: false, playing: false, error })
      return
    }
    retryWithFallback(
      loadId,
      currentTrack,
      error,
      adapter.src,
      autoplayForLoad || state.playing || playbackIntent,
    )
  }

  const handleEnded = () => {
    if (destroyed) return
    syncFromAudio()
    report('stopped', currentTrack, adapter.duration)
    const nextIndex = queuePolicy.next()
    if (nextIndex < 0) {
      update({ playing: false, loading: false })
      return
    }
    loadTrack(nextIndex, { autoplay: true, skipStopped: true, fromEnded: true })
  }

  const eventHandlers = {
    play: handlePlay,
    playing: handlePlay,
    pause: handlePause,
    timeupdate: syncFromAudio,
    loadedmetadata: syncFromAudio,
    durationchange: syncFromAudio,
    progress: syncFromAudio,
    waiting: handleWaiting,
    canplay: handleCanPlay,
    error: handleError,
    ended: handleEnded,
  }
  AUDIO_EVENT_NAMES.forEach((name) =>
    adapter.addEventListener(name, eventHandlers[name]),
  )

  const getSnapshot = () => ({ ...state })

  const loadTrack = async (
    index,
    { autoplay = false, skipStopped = false, fromEnded = false } = {},
  ) => {
    if (destroyed || !queue[index]) return false
    const track = queue[index]
    const operation = ++loadId
    fallbackAttemptedForLoad = null
    autoplayForLoad = autoplay
    playbackIntent = autoplay

    if (
      !skipStopped &&
      currentTrack &&
      trackKey(currentTrack) !== trackKey(track)
    ) {
      report('stopped')
    }
    currentTrack = track
    currentIndex = index
    queuePolicy.setQueue(queue.length, index)
    startReportedForLoad = null
    if (state.playing) state = { ...state, playing: false }
    if (!autoplay || !fromEnded) adapter.pause()
    update({
      currentTrack: track,
      currentIndex: index,
      playing: false,
      loading: true,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      error: null,
    })

    const request = (async () => {
      let url
      try {
        url = await resolveWithTimeout(
          () => resolveStreamUrl(track),
          STREAM_RESOLUTION_TIMEOUT_MS,
        )
      } catch (error) {
        try {
          if (typeof fallbackStreamUrl !== 'function') throw error
          fallbackAttemptedForLoad = operation
          url = await resolveWithTimeout(
            () => fallbackStreamUrl(track, error),
            STREAM_RESOLUTION_TIMEOUT_MS,
          )
        } catch (fallbackError) {
          if (destroyed || operation !== loadId) return false
          update({ loading: false, playing: false, error: fallbackError })
          return false
        }
      }

      if (destroyed || operation !== loadId) return false
      adapter.pause()
      adapter.src = url
      adapter.load()
      const shouldAutoplay = playbackIntent && operation === loadId
      if (!shouldAutoplay) {
        update({ loading: false })
        return true
      }

      if (startReportedForLoad !== operation) {
        startReportedForLoad = operation
        report('starting', track, 0)
      }
      try {
        await resolveWithTimeout(
          () => adapter.play(),
          PLAYBACK_START_TIMEOUT_MS,
          'Playback startup timed out',
        )
        if (destroyed || operation !== loadId) return false
        if (!playbackIntent) {
          adapter.pause()
          update({ playing: false, loading: false })
          return true
        }
        // Some test adapters and older browsers do not emit play reliably.
        handlePlay()
        return true
      } catch (error) {
        if (destroyed || operation !== loadId) return false
        const recovered = await retryWithFallback(
          operation,
          track,
          error,
          url,
          true,
        )
        if (recovered) return true
        if (destroyed || operation !== loadId) return false
        update({ loading: false, playing: false, error })
        return false
      }
    })()
    return request
  }

  const setQueue = (nextQueue = [], startIndex, options = {}) => {
    const normalizedQueue = Array.isArray(nextQueue)
      ? nextQueue.filter(Boolean)
      : []
    const previousKey = trackKey(currentTrack)
    const nextIndex = normalizedQueue.length
      ? clamp(
          Number.isInteger(startIndex)
            ? startIndex
            : normalizedQueue.findIndex(
                (track) => trackKey(track) === previousKey,
              ),
          0,
          normalizedQueue.length - 1,
        )
      : -1
    const sameTrack =
      previousKey && trackKey(normalizedQueue[nextIndex]) === previousKey
    queue = normalizedQueue
    queuePolicy.setQueue(queue.length, nextIndex)

    if (!queue.length) {
      const stoppedTrack = currentTrack
      const stoppedPosition = adapter.currentTime
      ++loadId
      playbackIntent = false
      update({ playing: false, loading: false })
      adapter.pause()
      report('stopped', stoppedTrack, stoppedPosition)
      currentTrack = null
      currentIndex = -1
      update({
        currentTrack: null,
        currentIndex: -1,
        playing: false,
        loading: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
        error: null,
      })
      return Promise.resolve(true)
    }

    if (sameTrack && currentIndex === nextIndex) {
      currentTrack = normalizedQueue[nextIndex]
      update({ currentTrack, currentIndex })
      return options.autoplay ? play() : Promise.resolve(true)
    }
    return loadTrack(nextIndex, { autoplay: options.autoplay })
  }

  const play = async () => {
    if (destroyed) return false
    if (!currentTrack && queue.length) return loadTrack(0, { autoplay: true })
    if (!currentTrack) return false
    if (state.playing) return true
    playbackIntent = true
    if (state.loading && !adapter.src) {
      // Keep the intent alive until the stream URL exists, but do not wait for
      // an asynchronous resolver from a user gesture.
      return true
    }
    if (startReportedForLoad !== loadId) {
      startReportedForLoad = loadId
      report('starting', currentTrack)
    }
    try {
      await resolveWithTimeout(
        () => adapter.play(),
        PLAYBACK_START_TIMEOUT_MS,
        'Playback startup timed out',
      )
      if (!playbackIntent) {
        adapter.pause()
        update({ playing: false, loading: false })
        return true
      }
      handlePlay()
      return true
    } catch (error) {
      update({ loading: false, playing: false, error })
      return false
    }
  }

  const pause = () => {
    if (destroyed) return
    playbackIntent = false
    adapter.pause()
    update({ playing: false, loading: false })
  }

  const seek = (seconds) => {
    if (destroyed) return 0
    const duration = Number.isFinite(adapter.duration)
      ? adapter.duration
      : Infinity
    const nextTime = clamp(Number(seconds) || 0, 0, duration)
    adapter.currentTime = nextTime
    syncFromAudio()
    return nextTime
  }

  const navigate = (direction) => {
    if (!queue.length) return false
    const nextIndex =
      direction === 'previous'
        ? queuePolicy.previous({ manual: true })
        : queuePolicy.next({ manual: true })
    if (nextIndex < 0) return false
    return loadTrack(nextIndex, { autoplay: state.playing })
  }

  const setVolume = (volume) => {
    const nextVolume = clamp(Number(volume) || 0, 0, 1)
    adapter.volume = nextVolume
    update({ volume: nextVolume })
    return nextVolume
  }

  const setMode = (mode) => {
    const nextMode = normalizePlayMode(mode)
    queuePolicy.setMode(nextMode)
    update({ mode: nextMode })
    return nextMode
  }

  const subscribe = (listener) => {
    if (typeof listener !== 'function') return () => undefined
    subscribers.add(listener)
    listener(getSnapshot())
    return () => subscribers.delete(listener)
  }

  const destroy = () => {
    if (destroyed) return
    const stoppedTrack = currentTrack
    const stoppedPosition = adapter.currentTime
    destroyed = true
    ++loadId
    playbackIntent = false
    state = { ...state, playing: false }
    adapter.pause()
    AUDIO_EVENT_NAMES.forEach((name) =>
      adapter.removeEventListener(name, eventHandlers[name]),
    )
    report('stopped', stoppedTrack, stoppedPosition)
    subscribers.clear()
    queue = []
    currentTrack = null
    currentIndex = -1
  }

  return {
    setQueue,
    play,
    pause,
    toggle: () => (state.playing ? (pause(), false) : play()),
    seek,
    previous: () => navigate('previous'),
    next: () => navigate('next'),
    select: (index) => loadTrack(index, { autoplay: true }),
    setVolume,
    setMode,
    getSnapshot,
    subscribe,
    destroy,
    getAudioElement: () => adapter.element || adapter,
  }
}
