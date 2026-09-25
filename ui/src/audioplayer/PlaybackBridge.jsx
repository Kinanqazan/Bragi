import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  currentPlaying,
  setTranscodingProfile,
  setVolume as setReduxVolume,
} from '../actions'
import subsonic from '../subsonic'
import { detectBrowserProfile, decisionService } from '../transcode'
import {
  consumeResumeLocalOnEnd,
  endCastSession,
  isNativeCastAvailable,
} from '../cast/castApi'
import {
  createCastPlaybackTarget,
  createNativeCastPlaybackTarget,
} from '../cast/castPlayback'
import { getCastErrorCode } from '../cast/castDiagnostics'
import { useCastState } from '../cast/useCastState'
import { createAudioElementAdapter, createPlaybackEngine } from './engine'
import { getNextIndex } from './engine/queuePolicy'
import { trackIdOf } from './trackModel'

const queueKeyOf = (queue) =>
  queue
    .map((track) => track?.uuid || track?.trackId || track?.id || '')
    .join('|')

const toCurrentInfo = (snapshot, isLocal = true) => {
  if (!snapshot.currentTrack) return { ended: true, volume: 1 }
  const rawVolume = Math.max(0, snapshot.volume || 0)
  return {
    ...snapshot.currentTrack,
    volume: isLocal ? Math.sqrt(rawVolume) : Math.min(1, rawVolume),
  }
}

export const usePlaybackBridge = ({ onPlaybackEvent } = {}) => {
  const dispatch = useDispatch()
  const playerState = useSelector((state) => state.player)
  const queue = useMemo(() => playerState?.queue || [], [playerState?.queue])
  const volume =
    typeof playerState?.volume === 'number' ? playerState.volume : 1
  const playIndex = playerState?.playIndex
  const savedPlayIndex = playerState?.savedPlayIndex
  const clear = playerState?.clear
  const autoPlay = playerState?.autoPlay
  const mode = playerState?.mode
  const [audioElement, setAudioElement] = useState(null)
  const [engine, setEngine] = useState(null)
  const [localEngine, setLocalEngine] = useState(null)
  const [castTarget, setCastTarget] = useState(null)
  const castState = useCastState()
  const [snapshot, setSnapshot] = useState({
    currentTrack: null,
    currentIndex: -1,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: volume * volume,
    mode: mode || 'order',
    error: null,
  })
  const eventHandlerRef = useRef(onPlaybackEvent)
  const currentKeyRef = useRef(null)
  const [activeTarget, setActiveTarget] = useState('local')
  const activeTargetRef = useRef('local')
  const castHandoffRef = useRef(0)
  const castHandoffKeyRef = useRef(null)
  const localEngineRef = useRef(null)
  const queueRef = useRef(queue)

  localEngineRef.current = localEngine
  queueRef.current = queue

  eventHandlerRef.current = onPlaybackEvent

  const profile = useMemo(() => detectBrowserProfile(), [])
  useEffect(() => {
    decisionService.setProfile(profile)
    dispatch(setTranscodingProfile(profile))
  }, [dispatch, profile])

  useEffect(() => {
    if (!audioElement) return undefined

    const adapter = createAudioElementAdapter(audioElement)
    const playbackEngine = createPlaybackEngine({
      audio: adapter,
      resolveStreamUrl: (track, position) => {
        if (track.isRadio)
          return track.streamUrl || subsonic.streamUrl(trackIdOf(track))
        return position != null && position > 0
          ? decisionService.resolveStreamUrl(trackIdOf(track), position)
          : decisionService.resolveStreamUrl(trackIdOf(track))
      },
      fallbackStreamUrl: (track, error, position) =>
        track.streamUrl ||
        subsonic.streamUrl(
          trackIdOf(track),
          position && position > 0
            ? { offset: Math.floor(position) }
            : undefined,
        ),
      reportPlayback: (event) => eventHandlerRef.current?.(event),
    })

    setLocalEngine(playbackEngine)
    if (activeTargetRef.current === 'local') setEngine(playbackEngine)
    const unsubscribe = playbackEngine.subscribe((nextSnapshot) => {
      if (activeTargetRef.current !== 'local') return
      setSnapshot(nextSnapshot)
      const nextKey =
        nextSnapshot.currentTrack?.uuid ||
        nextSnapshot.currentTrack?.trackId ||
        null
      if (nextKey && nextKey !== currentKeyRef.current) {
        currentKeyRef.current = nextKey
        dispatch(currentPlaying(toCurrentInfo(nextSnapshot, true)))
      }
      if (!nextKey) currentKeyRef.current = null
    })

    return () => {
      unsubscribe()
      playbackEngine.destroy()
      setLocalEngine((current) => (current === playbackEngine ? null : current))
      setEngine((current) => (current === playbackEngine ? null : current))
    }
  }, [audioElement, dispatch])

  const publishSnapshot = useCallback(
    (nextSnapshot, targetName) => {
      if (activeTargetRef.current !== targetName) return
      setSnapshot(nextSnapshot)
      const nextKey =
        nextSnapshot.currentTrack?.uuid ||
        nextSnapshot.currentTrack?.trackId ||
        null
      if (nextKey && nextKey !== currentKeyRef.current) {
        currentKeyRef.current = nextKey
        dispatch(
          currentPlaying(
            toCurrentInfo(nextSnapshot, targetName === 'local'),
          ),
        )
      }
      if (!nextKey) currentKeyRef.current = null
    },
    [dispatch],
  )

  const recoverLocalFromCast = useCallback(
    (target, details = {}) => {
      const currentLocalEngine = localEngineRef.current
      const currentQueue = queueRef.current
      if (!currentLocalEngine || activeTargetRef.current !== 'cast') return

      const remoteSnapshot = target?.getSnapshot?.() || {}
      const fallbackTrack =
        details.track || remoteSnapshot.currentTrack || currentQueue[0]
      const fallbackTrackId = trackIdOf(fallbackTrack)
      const queueIndex =
        fallbackTrackId == null
          ? -1
          : currentQueue.findIndex(
              (candidate) =>
                String(trackIdOf(candidate)) === String(fallbackTrackId),
            )
      const fallbackQueue =
        queueIndex >= 0 ? currentQueue : [fallbackTrack]
      if (!fallbackQueue[0]) return

      const fallbackIndex = queueIndex >= 0 ? queueIndex : 0
      const fallbackPosition = Number.isFinite(details.position)
        ? Math.max(0, details.position)
        : Math.max(0, Number(remoteSnapshot.currentTime) || 0)
      const autoplay =
        typeof details.autoplay === 'boolean'
          ? details.autoplay
          : Boolean(remoteSnapshot.playing)

      ++castHandoffRef.current
      castHandoffKeyRef.current = null
      activeTargetRef.current = 'local'
      setActiveTarget('local')
      setEngine(currentLocalEngine)

      let loadResult
      try {
        loadResult = currentLocalEngine.setQueue(fallbackQueue, fallbackIndex, {
          autoplay,
          position: fallbackPosition,
        })
      } catch {
        return
      }
      Promise.resolve(loadResult)
        .then(() =>
          publishSnapshot(currentLocalEngine.getSnapshot(), 'local'),
        )
        .catch(() => undefined)
    },
    [publishSnapshot],
  )

  useEffect(() => {
    if (!castState.initialized) return undefined

    let target
    try {
      const handleSessionError = (error, details) => {
        const errCode = getCastErrorCode(error).toUpperCase()
        const isFatal =
          ['SESSION_ERROR', 'CHANNEL_ERROR', 'NO_SESSION'].includes(errCode)
        if (isFatal) {
          recoverLocalFromCast(target, details)
          Promise.resolve()
            .then(() => endCastSession(false))
            .catch(() => undefined)
        } else {
          // eslint-disable-next-line no-console
          console.warn('[Bragi Cast] Non-fatal cast track error, keeping session active:', errCode)
        }
      }

      if (isNativeCastAvailable()) {
        target = createNativeCastPlaybackTarget({
          onPlaybackEvent: (event) => eventHandlerRef.current?.(event),
          onSessionError: handleSessionError,
        })
      } else {
        target = createCastPlaybackTarget({
          onPlaybackEvent: (event) => eventHandlerRef.current?.(event),
          onSessionError: handleSessionError,
        })
      }
    } catch (error) {
      // If the SDK reports ready before its remote-player classes are usable,
      // keep the failure visible instead of silently losing the Cast target.
      // eslint-disable-next-line no-console
      console.error('[Navidrome Cast] Playback target unavailable', {
        code: getCastErrorCode(error),
      })
      return undefined
    }

    setCastTarget(target)
    return () => {
      target.destroy()
      setCastTarget((current) => (current === target ? null : current))
    }
  }, [castState.initialized, recoverLocalFromCast])

  useEffect(() => {
    if (!castTarget) return undefined
    return castTarget.subscribe((nextSnapshot) =>
      publishSnapshot(nextSnapshot, 'cast'),
    )
  }, [castTarget, publishSnapshot])

  const targetIndex = useMemo(() => {
    if (!queue.length) return -1
    if (Number.isInteger(playIndex)) return playIndex
    if (Number.isInteger(savedPlayIndex)) return savedPlayIndex
    return 0
  }, [playIndex, queue.length, savedPlayIndex])
  const queueKey = useMemo(() => queueKeyOf(queue), [queue])

  useEffect(() => {
    if (!localEngine || !castTarget) return

    if (!castState.connected) castHandoffKeyRef.current = null

    if (castState.connected && activeTargetRef.current !== 'cast') {
      const localSnapshot = localEngine.getSnapshot()
      const handoffTrack = localSnapshot.currentTrack || queue[targetIndex]
      const handoffKey = [
        castState.sessionState || '',
        queueKey,
        targetIndex,
        trackIdOf(handoffTrack) || '',
      ].join(':')
      if (castHandoffKeyRef.current === handoffKey) return
      castHandoffKeyRef.current = handoffKey
      const wasPlaying = localSnapshot.playing
      const handoffId = ++castHandoffRef.current
      const restoreLocal = () => {
        activeTargetRef.current = 'local'
        setActiveTarget('local')
        setEngine(localEngine)
        if (wasPlaying) localEngine.play()
        publishSnapshot(
          {
            ...localEngine.getSnapshot(),
            error: castTarget.getSnapshot().error,
          },
          'local',
        )
      }

      const resumedSession = castState.sessionState === 'SESSION_RESUMED'
      const adoptResult =
        resumedSession &&
        handoffTrack &&
        typeof castTarget.adoptSession === 'function'
          ? Promise.resolve().then(() =>
              castTarget.adoptSession(handoffTrack, { index: targetIndex }),
            )
          : Promise.resolve(false)
      const loadResult = adoptResult.then((adopted) => {
        if (
          adopted ||
          handoffId !== castHandoffRef.current ||
          !castState.connected
        ) {
          return adopted
        }
        return handoffTrack
          ? castTarget.setQueue(
              queue.length ? queue : [handoffTrack],
              targetIndex >= 0 ? targetIndex : 0,
              {
                autoplay: wasPlaying,
                position: localSnapshot.currentTime,
              },
            )
          : castTarget.setQueue([])
      })

      Promise.resolve(loadResult)
        .then((loaded) => {
          if (handoffId !== castHandoffRef.current || !castState.connected) {
            return
          }

          if (!loaded) {
            restoreLocal()
            return
          }

          // Activate Cast only after the receiver has accepted the media.
          // This prevents a failed handoff from silencing local playback.
          activeTargetRef.current = 'cast'
          setActiveTarget('cast')
          setEngine(castTarget)
          localEngine.pause()
          publishSnapshot(castTarget.getSnapshot(), 'cast')
        })
        .catch(() => {
          if (handoffId === castHandoffRef.current && castState.connected) {
            restoreLocal()
          }
        })
      return
    }

    if (!castState.connected && activeTargetRef.current === 'cast') {
      ++castHandoffRef.current
      castHandoffKeyRef.current = null
      const remoteSnapshot = castTarget.getSnapshot() || {}
      activeTargetRef.current = 'local'
      setActiveTarget('local')
      setEngine(localEngine)
      // Forget the remote queue after capturing its position. This prevents
      // a later Cast connection from treating an old receiver track as the
      // current one and skipping the required media load.
      castTarget.setQueue([])

      const handoffTrack =
        remoteSnapshot.currentTrack ||
        queue[targetIndex] ||
        localEngine.getSnapshot().currentTrack
      const handoffTrackId = trackIdOf(handoffTrack)
      const queueIndex =
        handoffTrackId == null
          ? -1
          : queue.findIndex(
              (candidate) =>
                String(trackIdOf(candidate)) === String(handoffTrackId),
            )
      const handoffIndex =
        queueIndex >= 0
          ? queueIndex
          : Number.isInteger(remoteSnapshot.currentIndex) &&
              remoteSnapshot.currentIndex >= 0
            ? remoteSnapshot.currentIndex
            : targetIndex >= 0
              ? targetIndex
              : 0
      const handoffQueue =
        queueIndex >= 0 ? queue : [handoffTrack].filter(Boolean)
      const handoffPosition = Math.max(
        0,
        Number(remoteSnapshot.currentTime) || 0,
      )
      const shouldResume =
        consumeResumeLocalOnEnd() ||
        Boolean(remoteSnapshot.playing) ||
        Boolean(remoteSnapshot.wasPlaying)

      const localSnapshot = localEngine.getSnapshot()
      const sameTrack =
        localSnapshot.currentTrack &&
        handoffTrack &&
        (localSnapshot.currentTrack.uuid === handoffTrack.uuid ||
          trackIdOf(localSnapshot.currentTrack) === trackIdOf(handoffTrack))

      if (sameTrack && localSnapshot.currentIndex === handoffIndex) {
        localEngine.seek(handoffPosition)
        if (shouldResume) {
          localEngine.play()
        }
        publishSnapshot(localEngine.getSnapshot(), 'local')
      } else if (handoffQueue.length) {
        let loadResult
        try {
          loadResult = localEngine.setQueue(handoffQueue, handoffIndex, {
            autoplay: shouldResume,
            position: handoffPosition,
          })
        } catch {
          return
        }
        Promise.resolve(loadResult)
          .then(() => {
            if (activeTargetRef.current === 'local') {
              publishSnapshot(localEngine.getSnapshot(), 'local')
            }
          })
          .catch(() => undefined)
      }
    }
  }, [
    castState.connected,
    castState.sessionState,
    castTarget,
    localEngine,
    publishSnapshot,
    queue,
    queueKey,
    targetIndex,
  ])

  useEffect(() => {
    if (!engine) return
    engine.setQueue(queue, targetIndex, {
      autoplay: Boolean(clear || autoPlay),
    })
  }, [autoPlay, clear, engine, queueKey, queue, targetIndex])

  useEffect(() => {
    if (
      !localEngine ||
      activeTargetRef.current !== 'local' ||
      typeof volume !== 'number'
    ) {
      return
    }
    localEngine.setVolume(volume * volume)
  }, [localEngine, volume])

  useEffect(() => {
    if (!engine || !mode) return
    engine.setMode(mode)
  }, [engine, mode])

  // Prefetch transcode decision and stream URL for upcoming tracks in queue
  // so next-track transitions resolve instantly with 0ms network latency.
  useEffect(() => {
    if (!queue.length || snapshot.currentIndex < 0) return
    const upcoming = []
    let currentIdx = snapshot.currentIndex
    for (let i = 0; i < 4 && queue.length > 1; i++) {
      const nextIdx = getNextIndex(currentIdx, queue.length, mode)
      if (
        nextIdx >= 0 &&
        nextIdx !== snapshot.currentIndex &&
        queue[nextIdx] &&
        !upcoming.includes(queue[nextIdx])
      ) {
        upcoming.push(queue[nextIdx])
        currentIdx = nextIdx
      } else {
        break
      }
    }
    const nextTracks = (
      upcoming.length
        ? upcoming
        : queue.slice(snapshot.currentIndex + 1, snapshot.currentIndex + 5)
    ).filter((t) => t && !t.isRadio)
    const nextIds = nextTracks.map(trackIdOf).filter(Boolean)
    if (nextIds.length && typeof decisionService?.prefetchDecisions === 'function') {
      decisionService.prefetchDecisions(nextIds).catch(() => undefined)
    }
  }, [queue, snapshot.currentIndex, mode])

  const setVolume = useCallback(
    (nextVolume) => {
      const normalized = Math.min(1, Math.max(0, Number(nextVolume) || 0))
      dispatch(setReduxVolume(normalized))
      if (activeTargetRef.current === 'local') {
        engine?.setVolume(normalized * normalized)
      } else {
        engine?.setVolume(normalized)
      }
      if (typeof window !== 'undefined' && window.BragiNative?.setVolume) {
        window.BragiNative.setVolume(normalized)
      }
    },
    [dispatch, engine],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    // If native Android volume is available on startup, sync Redux volume
    if (window.BragiNative?.getVolume) {
      try {
        const initialNativeVol = Number(window.BragiNative.getVolume())
        if (Number.isFinite(initialNativeVol) && initialNativeVol >= 0) {
          dispatch(setReduxVolume(initialNativeVol))
        }
      } catch {
        // Native volume bridge not available or failed
      }
    }

    // Hardware volume buttons broadcast listener
    window.__bragiNativeVolumeChanged = (vol) => {
      const normalized = Math.min(1, Math.max(0, Number(vol) || 0))
      dispatch(setReduxVolume(normalized))
      if (activeTargetRef.current === 'local') {
        engine?.setVolume(normalized * normalized)
      } else {
        engine?.setVolume(normalized)
      }
    }

    // Hardware/notification media action buttons
    window.__bragiTogglePlayback = () => engine?.toggle()
    window.__bragiNextTrack = () => engine?.next()
    window.__bragiPreviousTrack = () => engine?.previous()
    window.__bragiSeek = (pos) => {
      if (typeof pos === 'number') engine?.seek(pos)
    }

    return () => {
      window.__bragiNativeVolumeChanged = null
      window.__bragiTogglePlayback = null
      window.__bragiNextTrack = null
      window.__bragiPreviousTrack = null
      window.__bragiSeek = null
    }
  }, [dispatch, engine])

  // Sync notification metadata with native Android PlaybackService
  useEffect(() => {
    if (typeof window === 'undefined' || !window.BragiNative?.updateMetadata) return
    const track = snapshot.currentTrack
    if (!track) return
    const title = track.title || track.name || ''
    const artist = track.artist || track.artistName || ''
    const album = track.album || track.albumName || ''
    const artworkUrl = track.cover || track.artworkUrl || track.coverArt || ''
    const duration = Number(snapshot.duration) || Number(track.duration) || 0
    const position = Number(snapshot.currentTime) || 0
    window.BragiNative.updateMetadata(
      title,
      artist,
      album,
      artworkUrl,
      Boolean(snapshot.playing),
      duration,
      position,
    )
    // snapshot.currentTime is intentionally excluded to prevent native bridge overhead on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.currentTrack, snapshot.playing, snapshot.duration])

  // Keep native PlaybackService active whenever playing
  useEffect(() => {
    if (typeof window === 'undefined' || !window.BragiNative) return
    if (snapshot.playing) {
      window.BragiNative.onPlaybackStarted?.()
    } else {
      window.BragiNative.onPlaybackStopped?.()
    }
  }, [snapshot.playing])

  const commands = useMemo(
    () => ({
      play: () => engine?.play(),
      pause: () => engine?.pause(),
      toggle: () => engine?.toggle(),
      seek: (seconds) => engine?.seek(seconds),
      previous: () => engine?.previous(),
      next: () => engine?.next(),
      select: (index) => engine?.select(index),
      setVolume,
      setMode: (nextMode) => engine?.setMode(nextMode),
      clear: () => engine?.setQueue([]),
    }),
    [engine, setVolume],
  )

  const isLocal =
    activeTarget === 'local' && activeTargetRef.current === 'local'

  return {
    audioRef: setAudioElement,
    audioElement,
    engine,
    snapshot,
    commands,
    uiVolume: isLocal
      ? Math.sqrt(Math.max(0, snapshot.volume || 0))
      : Math.min(1, Math.max(0, snapshot.volume || 0)),
  }
}
