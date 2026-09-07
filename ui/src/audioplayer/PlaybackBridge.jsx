import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  currentPlaying,
  setTranscodingProfile,
  setVolume as setReduxVolume,
} from '../actions'
import subsonic from '../subsonic'
import { detectBrowserProfile, decisionService } from '../transcode'
import { endCastSession, isNativeCastAvailable } from '../cast/castApi'
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

const toCurrentInfo = (snapshot) => {
  if (!snapshot.currentTrack) return { ended: true, volume: 1 }
  return {
    ...snapshot.currentTrack,
    volume: Math.sqrt(Math.max(0, snapshot.volume || 0)),
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
      resolveStreamUrl: (track) => {
        if (track.isRadio)
          return track.streamUrl || subsonic.streamUrl(trackIdOf(track))
        return decisionService.resolveStreamUrl(trackIdOf(track))
      },
      fallbackStreamUrl: (track) =>
        track.streamUrl || subsonic.streamUrl(trackIdOf(track)),
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
        dispatch(currentPlaying(toCurrentInfo(nextSnapshot)))
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
        dispatch(currentPlaying(toCurrentInfo(nextSnapshot)))
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
      if (isNativeCastAvailable()) {
        target = createNativeCastPlaybackTarget({
          onPlaybackEvent: (event) => eventHandlerRef.current?.(event),
          onSessionError: (error, details) => {
            recoverLocalFromCast(target, details)
            Promise.resolve()
              .then(() => endCastSession(false))
              .catch(() => undefined)
          },
        })
      } else {
        target = createCastPlaybackTarget({
          onPlaybackEvent: (event) => eventHandlerRef.current?.(event),
          onSessionError: (error, details) => {
            recoverLocalFromCast(target, details)
            Promise.resolve()
              .then(() => endCastSession(false))
              .catch(() => undefined)
          },
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
          ? castTarget.setQueue([handoffTrack], 0, {
              autoplay: wasPlaying,
              position: localSnapshot.currentTime,
            })
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
      const remoteSnapshot = castTarget.getSnapshot()
      const localSnapshot = localEngine.getSnapshot()
      activeTargetRef.current = 'local'
      setEngine(localEngine)
      // Forget the remote queue after capturing its position. This prevents
      // a later Cast connection from treating an old receiver track as the
      // current one and skipping the required media load.
      castTarget.setQueue([])

      const sameTrack =
        localSnapshot.currentTrack &&
        remoteSnapshot.currentTrack &&
        (localSnapshot.currentTrack.uuid === remoteSnapshot.currentTrack.uuid ||
          trackIdOf(localSnapshot.currentTrack) ===
            trackIdOf(remoteSnapshot.currentTrack))
      if (sameTrack) {
        localEngine.seek(remoteSnapshot.currentTime)
        if (remoteSnapshot.playing) localEngine.play()
      }
      publishSnapshot(localEngine.getSnapshot(), 'local')
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
    const firstNext = getNextIndex(snapshot.currentIndex, queue.length, mode)
    if (firstNext >= 0 && queue[firstNext]) upcoming.push(queue[firstNext])
    if (firstNext >= 0 && queue.length > 1) {
      const secondNext = getNextIndex(firstNext, queue.length, mode)
      if (secondNext >= 0 && secondNext !== firstNext && queue[secondNext]) {
        upcoming.push(queue[secondNext])
      }
    }
    const nextTracks = (upcoming.length ? upcoming : queue.slice(snapshot.currentIndex + 1, snapshot.currentIndex + 3))
      .filter((t) => t && !t.isRadio)
    const nextIds = nextTracks.map(trackIdOf).filter(Boolean)
    if (nextIds.length && typeof decisionService?.prefetchDecisions === 'function') {
      decisionService.prefetchDecisions(nextIds).catch(() => undefined)
    }
  }, [queue, snapshot.currentIndex, mode])

  const setVolume = useCallback(
    (nextVolume) => {
      const normalized = Math.min(1, Math.max(0, Number(nextVolume) || 0))
      dispatch(setReduxVolume(normalized))
      engine?.setVolume(normalized * normalized)
    },
    [dispatch, engine],
  )

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

  return {
    audioRef: setAudioElement,
    audioElement,
    engine,
    snapshot,
    commands,
    uiVolume: Math.sqrt(Math.max(0, snapshot.volume || 0)),
  }
}
