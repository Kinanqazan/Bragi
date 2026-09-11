import throttle from 'lodash.throttle'
import { getCastRuntime, getCurrentCastSession } from './castApi'
import { resolveCastMedia, toCastReceiverUrl } from './castMedia'
import {
  createCastMediaError,
  getCastErrorCode,
  logCastMediaFailure,
} from './castDiagnostics'
import {
  createQueuePolicy,
  normalizePlayMode,
} from '../audioplayer/engine/queuePolicy'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const trackKey = (track) => track?.uuid || track?.trackId || track?.id || null
const MEDIA_RESOLUTION_TIMEOUT_MS = 10000
const MEDIA_LOAD_TIMEOUT_MS = 15000
const MEDIA_LOAD_RETRY_DELAY_MS = 300
const MEDIA_LOAD_MAX_ATTEMPTS = 2
const CAST_LOAD_SKIPPED = Symbol('cast-load-skipped')

const isRetryableMediaLoadError = (error) =>
  [
    'MEDIA_SESSION_NOT_CREATED',
    'MEDIA_PLAYBACK_NOT_STARTED',
    'RECEIVER_ERROR',
    'LOAD_FAILED',
    'LOAD_INTERRUPTED',
    'UNKNOWN',
    'GENERIC',
  ].includes(getCastErrorCode(error).toUpperCase())

const delay = (duration) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration)
  })

const isCastSessionFailure = (error) =>
  ['SESSION_ERROR', 'CHANNEL_ERROR'].includes(
    getCastErrorCode(error).toUpperCase(),
  )

const mediaIdentity = (url) => {
  if (!url) return ''

  try {
    const origin =
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin
    const parsed = new URL(url, origin)
    const trackId = parsed.searchParams.get('id')

    // Navidrome stream URLs contain a fresh cache-busting/authentication
    // query string on every resolution. The endpoint and track ID identify
    // the media across a page refresh; the other query values do not.
    if (trackId && parsed.pathname.endsWith('/rest/stream')) {
      return `${parsed.origin}${parsed.pathname}?id=${encodeURIComponent(trackId)}`
    }
    return parsed.href
  } catch {
    return String(url)
  }
}

const parseMediaUrl = (url) => {
  if (!url) return null

  try {
    const origin =
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin
    return new URL(url, origin)
  } catch {
    return null
  }
}

const isReceiverNormalizedStreamPath = (loadedUrl, requestedUrl) => {
  const loaded = parseMediaUrl(loadedUrl)
  const requested = parseMediaUrl(requestedUrl)
  if (!loaded || !requested) return false

  return (
    loaded.pathname.endsWith('/rest/stream') &&
    !loaded.searchParams.get('id') &&
    requested.pathname.endsWith('/rest/stream') &&
    Boolean(requested.searchParams.get('id'))
  )
}

const toPositionMs = (position) =>
  Math.max(0, Math.floor((position || 0) * 1000))

const withTimeout = (promise, timeoutMs, message) => {
  let timer
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    Promise.resolve(promise).then(
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

const inspectReceiverMedia = (
  session,
  remotePlayer,
  contentId,
  {
    allowNormalizedPath = false,
    mediaSession: mediaSessionOverride,
    normalizedSessionConfirmed = false,
    previousMediaSessionId,
    expectedMediaSession,
    expectedMediaSessionId,
  } = {},
) => {
  const mediaSession =
    mediaSessionOverride !== undefined
      ? mediaSessionOverride
      : session?.getMediaSession?.()
  const loadedContentId =
    mediaSession?.media?.contentId || remotePlayer.mediaInfo?.contentId
  const mediaSessionId = mediaSession?.mediaSessionId
  const exactContentMatch =
    !loadedContentId ||
    Boolean(
      contentId && mediaIdentity(loadedContentId) === mediaIdentity(contentId),
    )
  const normalizedPathMatch =
    allowNormalizedPath &&
    isReceiverNormalizedStreamPath(loadedContentId, contentId) &&
    (normalizedSessionConfirmed ||
      (expectedMediaSession != null && mediaSession === expectedMediaSession) ||
      (mediaSessionId != null &&
        (expectedMediaSessionId != null
          ? mediaSessionId === expectedMediaSessionId
          : previousMediaSessionId == null ||
            mediaSessionId !== previousMediaSessionId)))
  const contentMatches = exactContentMatch || normalizedPathMatch
  const playerState = mediaSession?.playerState || remotePlayer.playerState
  const idleReason = mediaSession?.idleReason || remotePlayer.idleReason
  const mediaLoaded = Boolean(mediaSession || remotePlayer.isMediaLoaded)

  return {
    contentMatches,
    idleReason,
    mediaLoaded,
    mediaSession,
    mediaSessionId,
    playerState,
    playing:
      contentMatches &&
      mediaLoaded &&
      (playerState === 'PLAYING' ||
        (!playerState && remotePlayer.isPaused === false)),
    paused:
      contentMatches &&
      mediaLoaded &&
      (playerState === 'PAUSED' ||
        (!playerState && remotePlayer.isPaused === true)),
  }
}

const receiverFailureFrom = (status, { previousPlaying = false } = {}) => {
  if (
    !status.contentMatches ||
    status.playerState !== 'IDLE' ||
    !status.idleReason ||
    status.idleReason === 'FINISHED'
  ) {
    return null
  }

  const reason = String(status.idleReason).toUpperCase()
  if (
    !previousPlaying &&
    (reason === 'CANCELLED' || reason === 'INTERRUPTED')
  ) {
    return null
  }

  const error = new Error(`Cast receiver became idle: ${reason}`)
  error.code = `RECEIVER_${reason}`
  error.idleReason = reason
  return error
}

const isSameMediaSession = (left, right) => {
  if (!left || !right) return false
  if (left === right) return true
  return (
    left.mediaSessionId != null &&
    right.mediaSessionId != null &&
    left.mediaSessionId === right.mediaSessionId
  )
}

const isFailedMediaSession = (mediaSession) =>
  mediaSession?.playerState === 'IDLE' &&
  Boolean(mediaSession.idleReason) &&
  String(mediaSession.idleReason).toUpperCase() !== 'FINISHED'

const waitForRemoteMedia = ({
  session,
  remotePlayer,
  contentId,
  autoplay,
  getMediaSession,
  isMediaSessionConfirmed,
  previousMediaSessionId,
  ignoredMediaSession,
  timeoutMs,
}) => {
  return new Promise((resolve, reject) => {
    let timer
    let settled = false
    let sawMedia = false
    const startedAt = Date.now()

    const finish = (callback, value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      callback(value)
    }

    const check = () => {
      const receiverStatus = inspectReceiverMedia(
        session,
        remotePlayer,
        contentId,
        {
          allowNormalizedPath: true,
          mediaSession: getMediaSession?.(),
          normalizedSessionConfirmed: isMediaSessionConfirmed?.(),
          previousMediaSessionId,
        },
      )
      const ignoredReceiverFailure = Boolean(
        isSameMediaSession(receiverStatus.mediaSession, ignoredMediaSession) &&
        isFailedMediaSession(receiverStatus.mediaSession),
      )
      sawMedia ||=
        !ignoredReceiverFailure &&
        receiverStatus.contentMatches &&
        receiverStatus.mediaLoaded

      const receiverFailure = receiverFailureFrom(receiverStatus)
      if (receiverFailure && !ignoredReceiverFailure) {
        finish(reject, receiverFailure)
        return
      }

      if (receiverStatus.playing || (!autoplay && receiverStatus.paused)) {
        finish(resolve, receiverStatus)
        return
      }

      const remaining = timeoutMs - (Date.now() - startedAt)
      if (remaining <= 0) {
        const error = new Error(
          sawMedia
            ? 'Cast receiver did not enter the requested playback state'
            : 'Cast receiver did not create a media session',
        )
        error.code = sawMedia
          ? 'MEDIA_PLAYBACK_NOT_STARTED'
          : 'MEDIA_SESSION_NOT_CREATED'
        finish(reject, error)
        return
      }

      timer = setTimeout(check, Math.min(50, remaining))
    }

    check()
  })
}

const createMusicMetadata = (track, chromeCast) => {
  const metadata = new chromeCast.cast.media.MusicTrackMediaMetadata()
  metadata.title = track.title || track.name || track.song?.title || ''
  metadata.artist = track.artist || track.singer || track.song?.artist || ''
  metadata.albumName = track.album || track.song?.album || ''

  if (track.cover && chromeCast.cast.Image) {
    const imageUrl = toCastReceiverUrl(track.cover)
    metadata.images = [new chromeCast.cast.Image(imageUrl)]
  }
  return metadata
}

export const createCastPlaybackTarget = ({
  getSession = getCurrentCastSession,
  resolveMedia = resolveCastMedia,
  onPlaybackEvent,
  onSessionError,
  runtime = getCastRuntime(),
  mediaResolutionTimeoutMs = MEDIA_RESOLUTION_TIMEOUT_MS,
  mediaLoadTimeoutMs = MEDIA_LOAD_TIMEOUT_MS,
} = {}) => {
  if (!runtime?.framework?.RemotePlayer || !runtime?.chrome?.cast?.media) {
    throw new Error('Google Cast playback is not available')
  }

  const { framework, chrome: chromeCast } = runtime
  const remotePlayer = new framework.RemotePlayer()
  const controller = new framework.RemotePlayerController(remotePlayer)
  const subscribers = new Set()
  const eventTypes = framework.RemotePlayerEventType || {}
  let destroyed = false
  let loadOperation = 0
  let mediaLoadTail = Promise.resolve()
  let currentTrack = null
  let currentMedia = null
  let currentMediaSession = null
  let currentMediaSessionId = null
  let currentIndex = -1
  let queue = []
  const queuePolicy = createQueuePolicy()
  let loggedReceiverFailure = null
  let recoveredReceiverFailureOperation = null
  let state = {
    currentTrack: null,
    currentIndex: -1,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: Number.isFinite(remotePlayer.volumeLevel)
      ? remotePlayer.volumeLevel
      : 1,
    mode: 'order',
    error: null,
  }

  const notify = () => {
    if (destroyed) return
    const snapshot = { ...state }
    subscribers.forEach((listener) => listener(snapshot))
  }

  const enqueueMediaLoad = (session, request, operation, getLoadDeadline) => {
    const scheduledLoad = mediaLoadTail.then(() => {
      // A previous load may have occupied the Cast channel while the user
      // selected another song. Do not send an obsolete request after it ends.
      if (
        destroyed ||
        operation !== loadOperation ||
        getSession() !== session
      ) {
        return CAST_LOAD_SKIPPED
      }
      const loadDeadline = getLoadDeadline()
      return withTimeout(
        session.loadMedia(request),
        Math.max(1, loadDeadline - Date.now()),
        'Cast media loading timed out',
      )
    })

    // Keep the chain usable after a receiver rejection without allowing the
    // rejection to become an unhandled promise.
    mediaLoadTail = scheduledLoad.catch(() => undefined)
    return scheduledLoad
  }

  const report = (type, position = state.currentTime) => {
    if (!currentTrack || currentTrack.isRadio) return
    onPlaybackEvent?.({
      type,
      track: currentTrack,
      positionMs: toPositionMs(position),
    })
  }

  const getObservedMediaSession = (session) =>
    currentMediaSession || session?.getMediaSession?.()

  const syncFromRemote = () => {
    if (destroyed) return
    const previousPlaying = state.playing
    const loadInProgress = state.loading
    const session = getSession()
    const receiverStatus = session
      ? inspectReceiverMedia(session, remotePlayer, currentMedia?.url, {
          allowNormalizedPath: true,
          mediaSession: getObservedMediaSession(session),
          expectedMediaSession: currentMediaSession,
          expectedMediaSessionId: currentMediaSessionId,
        })
      : null
    const currentTime =
      receiverStatus?.contentMatches &&
      Number.isFinite(remotePlayer.currentTime)
        ? remotePlayer.currentTime
        : state.currentTime
    const remoteDuration =
      receiverStatus?.contentMatches &&
      Number.isFinite(remotePlayer.duration) &&
      remotePlayer.duration > 0
        ? remotePlayer.duration
        : null
    const trackDuration =
      Number(currentTrack?.duration || currentTrack?.song?.duration) || 0
    const duration = remoteDuration || trackDuration || state.duration
    const playing = Boolean(
      receiverStatus?.playing ||
      (receiverStatus?.contentMatches &&
        remotePlayer.isMediaLoaded &&
        !remotePlayer.isPaused),
    )
    const volume = Number.isFinite(remotePlayer.volumeLevel)
      ? remotePlayer.volumeLevel
      : state.volume
    const receiverFailure = receiverStatus
      ? receiverFailureFrom(receiverStatus, { previousPlaying })
      : null
    const finished = Boolean(
      receiverStatus?.contentMatches &&
      receiverStatus.playerState === 'IDLE' &&
      receiverStatus.idleReason === 'FINISHED' &&
      previousPlaying,
    )
    const receiverReady = Boolean(
      receiverStatus?.playing ||
      receiverStatus?.paused ||
      (receiverStatus?.contentMatches && remotePlayer.isMediaLoaded),
    )
    let error = receiverReady ? null : state.error

    if (receiverFailure && currentTrack && currentMedia && !loadInProgress) {
      error = createCastMediaError(receiverFailure, {
        mediaUrl: currentMedia.url,
        contentType: currentMedia.contentType,
        deviceName: session.getCastDevice?.()?.friendlyName,
        phase: 'remote-playback',
      })
      const failureKey = `${loadOperation}:${error.code}`
      if (loggedReceiverFailure !== failureKey) {
        loggedReceiverFailure = failureKey
        logCastMediaFailure(error, { trackId: trackKey(currentTrack) })
      }
      if (recoveredReceiverFailureOperation !== loadOperation) {
        recoveredReceiverFailureOperation = loadOperation
        // Retry the load on Cast before giving up. By this point the
        // server has very likely cached the transcode, so the next
        // attempt will serve a seekable file that Cast handles reliably.
        // If this retry also fails, loadTrack's own catch block will
        // call onSessionError which falls back to local playback.
        const retryTrack = currentTrack
        const retryPosition = currentTime
        const retryAutoplay = previousPlaying
        Promise.resolve()
          .then(() =>
            loadTrack(retryTrack, {
              autoplay: retryAutoplay,
              position: retryPosition,
              index: currentIndex,
            }),
          )
          .catch(() => undefined)
      }
    }

    state = {
      ...state,
      currentTrack,
      currentIndex,
      playing,
      // loadTrack owns this flag. Remote events can arrive in short-lived
      // PLAYING -> IDLE/ERROR sequences before loadTrack has committed or
      // retried the operation, so they must not close the startup boundary.
      loading: state.loading,
      currentTime,
      duration,
      volume,
      error,
    }

    if (previousPlaying !== playing && currentTrack) {
      report(playing ? 'playing' : 'paused', currentTime)
    }
    notify()

    if (finished) {
      Promise.resolve(
        navigate('next', { autoplay: true, manual: false }),
      ).catch(() => undefined)
    }
  }

  const handleRemoteChange = () => syncFromRemote()
  const anyChangeType = eventTypes.ANY_CHANGE
  const connectionChangeType = eventTypes.IS_CONNECTED_CHANGED
  if (anyChangeType) {
    controller.addEventListener(anyChangeType, handleRemoteChange)
  }
  if (connectionChangeType && connectionChangeType !== anyChangeType) {
    controller.addEventListener(connectionChangeType, handleRemoteChange)
  }

  const getSnapshot = () => ({ ...state })

  const getRemoteStatus = () => {
    const session = getSession()
    if (session)
      return inspectReceiverMedia(session, remotePlayer, currentMedia?.url, {
        allowNormalizedPath: true,
        mediaSession: getObservedMediaSession(session),
        expectedMediaSession: currentMediaSession,
        expectedMediaSessionId: currentMediaSessionId,
      })
    return {
      contentMatches: true,
      mediaLoaded: Boolean(remotePlayer.isMediaLoaded),
      playing: Boolean(remotePlayer.isMediaLoaded && !remotePlayer.isPaused),
      paused: Boolean(remotePlayer.isMediaLoaded && remotePlayer.isPaused),
    }
  }

  const loadTrack = async (
    track,
    { autoplay = false, position = 0, index } = {},
  ) => {
    if (destroyed || !track) return false
    const session = getSession()
    if (!session) {
      const diagnostic = createCastMediaError(
        { code: 'NO_CAST_SESSION' },
        { deviceName: 'Cast device' },
      )
      logCastMediaFailure(diagnostic)
      state = {
        ...state,
        loading: false,
        playing: false,
        error: diagnostic,
      }
      notify()
      return false
    }

    const operation = ++loadOperation
    const previousMediaSessionId = session.getMediaSession?.()?.mediaSessionId
    currentTrack = track
    currentMedia = null
    currentMediaSession = null
    currentMediaSessionId = null
    loggedReceiverFailure = null
    recoveredReceiverFailureOperation = null
    currentIndex = Number.isInteger(index) ? index : Math.max(0, currentIndex)
    const trackDuration =
      Number(track?.duration || track?.song?.duration) || 0
    state = {
      ...state,
      currentTrack,
      currentIndex,
      playing: false,
      loading: true,
      currentTime: position,
      duration: trackDuration,
      buffered: 0,
      error: null,
    }
    notify()

    if (autoplay) report('starting', position)

    let media
    let mediaSessionFromEvent
    let mediaSessionListener
    let failurePhase = 'resolve-media'
    try {
      media = await withTimeout(
        resolveMedia(track),
        mediaResolutionTimeoutMs,
        'Cast media resolution timed out',
      )
      if (destroyed || operation !== loadOperation) return false
      currentMedia = media

      const mediaInfo = new chromeCast.cast.media.MediaInfo(
        media.url,
        media.contentType,
      )
      mediaInfo.streamType =
        chromeCast.cast.media.StreamType?.BUFFERED || 'BUFFERED'
      mediaInfo.metadata = createMusicMetadata(track, chromeCast)
      if (trackDuration > 0) {
        mediaInfo.duration = trackDuration
      }

      const request = new chromeCast.cast.media.LoadRequest(mediaInfo)
      request.autoplay = Boolean(autoplay)
      request.currentTime = Math.max(0, Number(position) || 0)
      const mediaSessionEventType = framework.SessionEventType?.MEDIA_SESSION
      if (mediaSessionEventType && session.addEventListener) {
        mediaSessionListener = (event) => {
          mediaSessionFromEvent = event?.mediaSession || null
        }
        session.addEventListener(mediaSessionEventType, mediaSessionListener)
      }
      let loadDeadline
      const getLoadDeadline = () => {
        loadDeadline ??= Date.now() + mediaLoadTimeoutMs
        return loadDeadline
      }
      let receiverStatus
      let failedMediaSession
      for (let attempt = 1; attempt <= MEDIA_LOAD_MAX_ATTEMPTS; attempt += 1) {
        if (destroyed || operation !== loadOperation) return false

        try {
          // A failed attempt may have emitted an IDLE/ERROR media session.
          // Do not let that stale event override the replacement session while
          // a retry waits for its own MEDIA_SESSION event to arrive.
          mediaSessionFromEvent = null
          failurePhase = 'load-media'
          const loadResult = await enqueueMediaLoad(
            session,
            request,
            operation,
            getLoadDeadline,
          )
          if (loadResult === CAST_LOAD_SKIPPED) return false
          if (loadResult !== null && loadResult !== undefined) {
            const loadError = new Error(
              `Cast media load request failed: ${getCastErrorCode(loadResult)}`,
            )
            loadError.code = getCastErrorCode(loadResult)
            throw loadError
          }
          failurePhase = 'wait-for-media-session'
          const getAttemptMediaSession = () => {
            const sessionMedia = session.getMediaSession?.()
            if (
              isSameMediaSession(mediaSessionFromEvent, failedMediaSession) &&
              sessionMedia &&
              !isSameMediaSession(sessionMedia, failedMediaSession)
            ) {
              return sessionMedia
            }
            return mediaSessionFromEvent ?? sessionMedia
          }
          receiverStatus = await waitForRemoteMedia({
            session,
            remotePlayer,
            contentId: media.url,
            autoplay: Boolean(autoplay),
            getMediaSession: getAttemptMediaSession,
            isMediaSessionConfirmed: () =>
              Boolean(
                mediaSessionFromEvent &&
                !isSameMediaSession(mediaSessionFromEvent, failedMediaSession),
              ),
            previousMediaSessionId,
            ignoredMediaSession: failedMediaSession,
            timeoutMs: Math.max(1, loadDeadline - Date.now()),
          })
          break
        } catch (error) {
          if (
            destroyed ||
            operation !== loadOperation ||
            attempt >= MEDIA_LOAD_MAX_ATTEMPTS ||
            !isRetryableMediaLoadError(error) ||
            loadDeadline - Date.now() <= MEDIA_LOAD_RETRY_DELAY_MS
          ) {
            throw error
          }
          const rejectedMediaSession =
            mediaSessionFromEvent ?? session.getMediaSession?.()
          failedMediaSession = isFailedMediaSession(rejectedMediaSession)
            ? rejectedMediaSession
            : null
          await delay(MEDIA_LOAD_RETRY_DELAY_MS)
        }
      }
      if (destroyed || operation !== loadOperation) return false
      currentMediaSession = receiverStatus.mediaSession ?? null
      currentMediaSessionId = receiverStatus.mediaSessionId ?? null

      state = { ...state, loading: false, error: null }
      syncFromRemote()
      return true
    } catch (error) {
      if (destroyed || operation !== loadOperation) return false
      const diagnostic = createCastMediaError(error, {
        mediaUrl: media?.url,
        contentType: media?.contentType,
        deviceName: session.getCastDevice?.()?.friendlyName,
        phase: failurePhase,
      })
      logCastMediaFailure(diagnostic, { trackId: trackKey(track) })
      // A receiver can reject a media URL while the Cast session itself is
      // still connected. Tell the bridge about every media failure so it can
      // restore local playback instead of leaving the UI on a silent Cast
      // target. Obsolete operations were returned above and never reach here.
      if (onSessionError) {
        Promise.resolve()
          .then(() =>
            onSessionError(error, {
              track,
              autoplay,
              position,
              mediaUrl: media?.url,
              contentType: media?.contentType,
            }),
          )
          .catch(() => undefined)
      }
      state = {
        ...state,
        loading: false,
        playing: false,
        error: diagnostic,
      }
      notify()
      return false
    } finally {
      if (mediaSessionListener) {
        session.removeEventListener?.(
          framework.SessionEventType?.MEDIA_SESSION,
          mediaSessionListener,
        )
      }
    }
  }

  const adoptSession = async (track, { index = 0 } = {}) => {
    if (destroyed || !track) return false
    const session = getSession()
    if (!session) return false

    const mediaSession = session.getMediaSession?.()
    const loadedContentId =
      mediaSession?.media?.contentId || remotePlayer.mediaInfo?.contentId
    if (!loadedContentId) return false

    const operation = ++loadOperation
    let media
    try {
      media = await withTimeout(
        resolveMedia(track),
        mediaResolutionTimeoutMs,
        'Cast media resolution timed out',
      )
    } catch {
      return false
    }
    if (
      destroyed ||
      operation !== loadOperation ||
      !media ||
      mediaIdentity(loadedContentId) !== mediaIdentity(media.url)
    ) {
      return false
    }

    const receiverStatus = inspectReceiverMedia(
      session,
      remotePlayer,
      media.url,
    )
    if (!receiverStatus.mediaLoaded || receiverFailureFrom(receiverStatus)) {
      return false
    }

    currentTrack = track
    currentMedia = media
    currentMediaSession = receiverStatus.mediaSession ?? null
    currentMediaSessionId = receiverStatus.mediaSessionId ?? null
    currentIndex = Number.isInteger(index) ? index : 0
    queue = [track]
    queuePolicy.setQueue(queue.length, 0)
    loggedReceiverFailure = null
    state = {
      ...state,
      currentTrack,
      currentIndex,
      loading: false,
      currentTime: Number.isFinite(remotePlayer.currentTime)
        ? remotePlayer.currentTime
        : state.currentTime,
      duration:
        (Number.isFinite(remotePlayer.duration) && remotePlayer.duration > 0
          ? remotePlayer.duration
          : null) ||
        Number(track?.duration || track?.song?.duration) ||
        state.duration,
      error: null,
    }
    syncFromRemote()
    return true
  }

  const setQueue = (nextQueue = [], startIndex, options = {}) => {
    queue = Array.isArray(nextQueue) ? nextQueue.filter(Boolean) : []
    if (!queue.length) {
      ++loadOperation
      const stoppedTrack = currentTrack
      if (state.playing) report('stopped')
      currentTrack = null
      currentMedia = null
      currentMediaSession = null
      currentMediaSessionId = null
      currentIndex = -1
      queuePolicy.setQueue(0, -1)
      state = {
        ...state,
        currentTrack: null,
        currentIndex: -1,
        playing: false,
        loading: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
        error: null,
      }
      if (stoppedTrack) notify()
      controller.stop?.()
      return Promise.resolve(true)
    }

    const requestedIndex = Number.isInteger(startIndex) ? startIndex : 0
    currentIndex = clamp(requestedIndex, 0, queue.length - 1)
    queuePolicy.setQueue(queue.length, currentIndex)
    const nextTrack = queue[currentIndex]
    const sameTrack = trackKey(currentTrack) === trackKey(nextTrack)

    if (sameTrack) {
      currentTrack = nextTrack
      state = { ...state, currentTrack, currentIndex }
      notify()
      return options.autoplay && !state.playing ? play() : Promise.resolve(true)
    }

    return loadTrack(nextTrack, {
      autoplay: options.autoplay,
      position: options.position,
      index: currentIndex,
    })
  }

  const play = () => {
    if (destroyed) return Promise.resolve(false)
    const remoteStatus = getRemoteStatus()
    if (
      !remoteStatus.mediaLoaded ||
      !remoteStatus.contentMatches ||
      state.error
    ) {
      if (currentTrack) {
        state = { ...state, error: null }
        notify()
        return loadTrack(currentTrack, {
          autoplay: true,
          position: state.currentTime,
          index: currentIndex,
        })
      }
      if (queue.length) {
        state = { ...state, error: null }
        notify()
        return loadTrack(queue[0], { autoplay: true, index: 0 })
      }
      return Promise.resolve(false)
    }
    if (remoteStatus.playing) return Promise.resolve(true)
    controller.playOrPause?.()
    return Promise.resolve(true)
  }

  const pause = () => {
    const remoteStatus = getRemoteStatus()
    if (
      destroyed ||
      !remoteStatus.mediaLoaded ||
      !remoteStatus.contentMatches
    ) {
      return
    }
    if (remoteStatus.playing) controller.playOrPause?.()
  }

  const toggle = () => (state.playing ? pause() : play())

  const navigate = (
    direction,
    { autoplay = state.playing, manual = true } = {},
  ) => {
    if (!queue.length) return Promise.resolve(false)
    const nextIndex =
      direction === 'previous'
        ? queuePolicy.previous({ manual })
        : queuePolicy.next({ manual })
    if (nextIndex < 0) return Promise.resolve(false)
    return loadTrack(queue[nextIndex], { autoplay, index: nextIndex })
  }

  const seek = (seconds) => {
    const remoteStatus = getRemoteStatus()
    if (
      destroyed ||
      !remoteStatus.mediaLoaded ||
      !remoteStatus.contentMatches
    ) {
      return state.currentTime
    }
    const duration =
      (Number.isFinite(remotePlayer.duration) && remotePlayer.duration > 0
        ? remotePlayer.duration
        : null) ||
      Number(currentTrack?.duration || currentTrack?.song?.duration) ||
      state.duration ||
      Infinity
    const nextTime = clamp(Number(seconds) || 0, 0, duration)
    remotePlayer.currentTime = nextTime
    controller.seek?.()
    syncFromRemote()
    return nextTime
  }

  const throttledSetRemoteVolume = throttle(
    () => {
      if (destroyed) return
      controller.setVolumeLevel?.()
    },
    75,
    { leading: true, trailing: true },
  )

  const setVolume = (volume) => {
    const nextVolume = clamp(Number(volume) || 0, 0, 1)
    remotePlayer.volumeLevel = nextVolume
    throttledSetRemoteVolume()
    state = { ...state, volume: nextVolume }
    notify()
    return nextVolume
  }

  const setMode = (mode) => {
    const nextMode = normalizePlayMode(mode)
    queuePolicy.setMode(nextMode)
    state = { ...state, mode: nextMode }
    notify()
    return state.mode
  }

  return {
    setQueue,
    adoptSession,
    play,
    pause,
    toggle,
    seek,
    previous: () => navigate('previous'),
    next: () => navigate('next'),
    select: (index) => {
      if (!queue[index]) return Promise.resolve(false)
      currentIndex = index
      queuePolicy.setQueue(queue.length, index)
      return loadTrack(queue[index], { autoplay: true, index })
    },
    setVolume,
    setMode,
    getSnapshot,
    subscribe: (listener) => {
      subscribers.add(listener)
      listener(getSnapshot())
      return () => subscribers.delete(listener)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      ++loadOperation
      throttledSetRemoteVolume.cancel?.()
      controller.removeEventListener?.(anyChangeType, handleRemoteChange)
      if (connectionChangeType && connectionChangeType !== anyChangeType) {
        controller.removeEventListener?.(
          connectionChangeType,
          handleRemoteChange,
        )
      }
      subscribers.clear()
    },
    getRemotePlayer: () => remotePlayer,
  }
}

export const createNativeCastPlaybackTarget = ({
  onPlaybackEvent,
  onSessionError,
  resolveMedia = resolveCastMedia,
} = {}) => {
  let destroyed = false
  const subscribers = new Set()
  let currentTrack = null
  let currentIndex = -1
  let queue = []
  const queuePolicy = createQueuePolicy()
  let loadOperation = 0

  let state = {
    currentTrack: null,
    currentIndex: -1,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    mode: 'order',
    error: null,
  }

  const notify = () => {
    if (destroyed) return
    const snapshot = { ...state }
    subscribers.forEach((l) => l(snapshot))
  }

  const report = (event, position = state.currentTime) => {
    onPlaybackEvent?.(event, position)
  }

  const loadTrack = async (
    track,
    { autoplay = false, position = 0, index } = {},
  ) => {
    if (destroyed || !track) return false
    const operation = ++loadOperation
    currentTrack = track
    currentIndex = Number.isInteger(index) ? index : Math.max(0, currentIndex)
    queuePolicy.setQueue(queue.length, currentIndex)
    const trackDuration =
      Number(track?.duration || track?.song?.duration) || 0

    state = {
      ...state,
      currentTrack,
      currentIndex,
      playing: false,
      loading: true,
      currentTime: position,
      duration: trackDuration,
      buffered: 0,
      error: null,
    }
    notify()

    if (autoplay) report('starting', position)

    try {
      const media = await resolveMedia(track)
      if (destroyed || operation !== loadOperation) return false

      const meta = track
      if (typeof window !== 'undefined' && window.BragiNative?.loadMedia) {
        window.BragiNative.loadMedia(
          meta.title || meta.name || '',
          meta.artist || meta.artistName || '',
          meta.album || meta.albumName || '',
          media.url || '',
          meta.artworkUrl || meta.coverArt || '',
          position || 0,
          Boolean(autoplay),
        )
      }

      state = {
        ...state,
        loading: false,
        playing: Boolean(autoplay),
      }
      notify()
      if (autoplay) report('playing', position)
      return true
    } catch (err) {
      if (destroyed || operation !== loadOperation) return false
      state = {
        ...state,
        loading: false,
        error: err?.message || 'Cast load failed',
      }
      notify()
      onSessionError?.(err)
      return false
    }
  }

  const navigate = (
    direction,
    { autoplay = state.playing, manual = true } = {},
  ) => {
    if (!queue.length) return Promise.resolve(false)
    const nextIndex =
      direction === 'previous'
        ? queuePolicy.previous({ manual })
        : queuePolicy.next({ manual })
    if (nextIndex < 0 || !queue[nextIndex]) return Promise.resolve(false)
    return loadTrack(queue[nextIndex], { autoplay, index: nextIndex })
  }

  // Handle updates from Android RemoteMediaClient
  const handleNativeStatus = ({
    playerState,
    idleReason,
    currentTime,
    duration,
    volume,
  }) => {
    if (destroyed) return
    const previousPlaying = state.playing
    const isPlaying = playerState === 'PLAYING'
    const isLoading = playerState === 'BUFFERING'
    const isPaused = playerState === 'PAUSED'
    const isIdle = playerState === 'IDLE'

    let nextPlaying = state.playing
    if (isPlaying) nextPlaying = true
    else if (isPaused || isIdle) nextPlaying = false

    state = {
      ...state,
      playing: nextPlaying,
      loading: isLoading,
      currentTime:
        typeof currentTime === 'number' && currentTime >= 0
          ? currentTime
          : state.currentTime,
      duration: duration > 0 ? duration : state.duration,
      volume: typeof volume === 'number' && volume >= 0 ? volume : state.volume,
    }

    if (previousPlaying !== nextPlaying && currentTrack) {
      report(nextPlaying ? 'playing' : 'paused', state.currentTime)
    }
    notify()

    if (isIdle && idleReason === 'FINISHED') {
      navigate('next', { autoplay: true, manual: false })
    }
  }

  if (typeof window !== 'undefined') {
    window.__bragiNativeCastMediaStatus = handleNativeStatus
  }

  const play = () => {
    if (destroyed) return Promise.resolve(false)
    if (!currentTrack && queue.length) {
      return loadTrack(queue[0], { autoplay: true, index: 0 })
    }
    state = { ...state, playing: true }
    notify()
    if (typeof window !== 'undefined') window?.BragiNative?.play?.()
    report('playing', state.currentTime)
    return Promise.resolve(true)
  }

  const pause = () => {
    if (destroyed) return Promise.resolve(false)
    state = { ...state, playing: false }
    notify()
    if (typeof window !== 'undefined') window?.BragiNative?.pause?.()
    report('paused', state.currentTime)
    return Promise.resolve(true)
  }

  return {
    getSnapshot: () => ({ ...state }),
    subscribe: (listener) => {
      subscribers.add(listener)
      listener({ ...state })
      return () => subscribers.delete(listener)
    },
    setQueue: async (nextQueue = [], startIndex = 0, options = {}) => {
      queue = Array.isArray(nextQueue) ? nextQueue.filter(Boolean) : []
      if (!queue.length) {
        currentTrack = null
        currentIndex = -1
        state = {
          ...state,
          currentTrack: null,
          currentIndex: -1,
          playing: false,
          loading: false,
          currentTime: 0,
          duration: 0,
        }
        notify()
        if (typeof window !== 'undefined') window?.BragiNative?.pause?.()
        return true
      }

      const requestedIndex = Number.isInteger(startIndex) ? startIndex : 0
      currentIndex = clamp(requestedIndex, 0, queue.length - 1)
      queuePolicy.setQueue(queue.length, currentIndex)
      const nextTrack = queue[currentIndex]
      const sameTrack = trackKey(currentTrack) === trackKey(nextTrack)

      if (sameTrack) {
        currentTrack = nextTrack
        state = { ...state, currentTrack, currentIndex }
        notify()
        return options.autoplay && !state.playing
          ? play()
          : Promise.resolve(true)
      }

      return loadTrack(nextTrack, {
        autoplay: options.autoplay,
        position: options.position || 0,
        index: currentIndex,
      })
    },
    adoptSession: (track, { index } = {}) => {
      if (!track) return Promise.resolve(false)
      currentTrack = track
      if (Number.isInteger(index)) {
        currentIndex = index
        queuePolicy.setQueue(queue.length, index)
      }
      state = {
        ...state,
        currentTrack,
        currentIndex,
        playing: true,
        loading: false,
      }
      notify()
      return Promise.resolve(true)
    },
    play,
    pause,
    toggle: () => (state.playing ? pause() : play()),
    seek: (seconds) => {
      const duration = state.duration || Infinity
      const nextTime = clamp(Number(seconds) || 0, 0, duration)
      state = { ...state, currentTime: nextTime }
      notify()
      if (typeof window !== 'undefined') window?.BragiNative?.seek?.(nextTime)
      return nextTime
    },
    previous: () => navigate('previous', { manual: true }),
    next: () => navigate('next', { manual: true }),
    select: (index) => {
      if (!queue[index]) return Promise.resolve(false)
      currentIndex = index
      queuePolicy.setQueue(queue.length, index)
      return loadTrack(queue[index], { autoplay: true, index })
    },
    setVolume: (volume) => {
      const nextVolume = clamp(Number(volume) || 0, 0, 1)
      state = { ...state, volume: nextVolume }
      notify()
      if (typeof window !== 'undefined')
        window?.BragiNative?.setVolume?.(nextVolume)
      return nextVolume
    },
    setMode: (mode) => {
      const nextMode = normalizePlayMode(mode)
      queuePolicy.setMode(nextMode)
      state = { ...state, mode: nextMode }
      notify()
      return state.mode
    },
    stop: () => {
      state = { ...state, playing: false, loading: false }
      notify()
      if (typeof window !== 'undefined') window?.BragiNative?.pause?.()
      report('stopped')
      return Promise.resolve(true)
    },
    destroy: () => {
      destroyed = true
      subscribers.clear()
      if (
        typeof window !== 'undefined' &&
        window.__bragiNativeCastMediaStatus === handleNativeStatus
      ) {
        window.__bragiNativeCastMediaStatus = null
      }
    },
  }
}

