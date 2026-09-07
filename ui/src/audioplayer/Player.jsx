import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuthState } from 'react-admin'
import { ThemeProvider, createTheme, useMediaQuery } from '@material-ui/core'
import useCurrentTheme from '../themes/useCurrentTheme'
import config from '../config'
import { clearQueue } from '../actions'
import { sendNotification } from '../utils'
import subsonic from '../subsonic'
import DesktopPlayerResizeHandle from './DesktopPlayerResizeHandle'
import DesktopPlayer from './DesktopPlayer'
import MobilePlayerSurface from './MobilePlayerSurface'
import { usePlaybackBridge } from './PlaybackBridge'
import {
  clearMediaSessionMetadata,
  setupMediaSessionActionHandlers,
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPositionState,
} from './mediaSession'
import { calculateGain } from '../utils/calculateReplayGain'
import { desktopPlayerBreakpoint } from './playerLayout'

const getTrackId = (track) => track?.trackId || track?.song?.id || track?.id
const getTrackKey = (track) => track?.uuid || getTrackId(track) || null

export const Player = () => {
  const theme = useCurrentTheme()
  const muiTheme = useMemo(() => createTheme(theme), [theme])
  const dispatch = useDispatch()
  const { authenticated } = useAuthState()
  const playerState = useSelector((state) => state.player)
  const showNotifications = useSelector(
    (state) => state.settings?.notifications || false,
  )
  const gainInfo = useSelector((state) => state.replayGain)
  const isDesktop = useMediaQuery(`(min-width:${desktopPlayerBreakpoint}px)`)
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const lastPositionRef = useRef(0)
  const latestSnapshotRef = useRef(null)

  const onPlaybackEvent = useCallback(
    ({ type, track, positionMs }) => {
      const trackId = getTrackId(track)
      if (!trackId || track?.isRadio) return
      lastPositionRef.current = positionMs

      if (type === 'starting') {
        subsonic.reportPlayback(trackId, positionMs, 'starting')
      } else if (type === 'playing') {
        subsonic.reportPlayback(trackId, positionMs, 'playing')
        if (showNotifications) {
          const song = track.song || track
          sendNotification(
            song.title || track.title || track.name || 'Now playing',
            `${song.artist || track.artist || track.singer || ''} - ${song.album || track.album || ''}`,
            track.cover,
          )
        }
      } else if (type === 'paused') {
        subsonic.reportPlayback(trackId, positionMs, 'paused')
      } else if (type === 'stopped') {
        subsonic.reportPlaybackKeepalive(trackId, positionMs, 'stopped')
      }
    },
    [showNotifications],
  )

  const bridge = usePlaybackBridge({ onPlaybackEvent })
  latestSnapshotRef.current = bridge.snapshot

  const queue = playerState?.queue || []
  const visible = Boolean(
      authenticated &&
      queue.length &&
      bridge.snapshot.currentTrack,
  )
  const currentTrack = bridge.snapshot.currentTrack
  const currentKey = getTrackKey(currentTrack)
  const isPlaying = bridge.snapshot.playing

  useEffect(() => {
    if (!bridge.engine || !bridge.audioElement) return undefined
    setupMediaSessionActionHandlers({
      onPlay: bridge.commands.play,
      onPause: bridge.commands.pause,
      onPrev: bridge.commands.previous,
      onNext: bridge.commands.next,
      onSeekTo: (details) => bridge.commands.seek(details.seekTime),
      onSeekBackward: (details) =>
        bridge.commands.seek(
          Math.max(
            0,
            (latestSnapshotRef.current?.currentTime || 0) -
              (details.seekOffset || 10),
          ),
        ),
      onSeekForward: (details) =>
        bridge.commands.seek(
          (latestSnapshotRef.current?.currentTime || 0) +
            (details.seekOffset || 10),
        ),
    })
    return () => {
      setupMediaSessionActionHandlers({})
      clearMediaSessionMetadata()
    }
  }, [bridge.audioElement, bridge.commands, bridge.engine])

  useEffect(() => {
    if (!currentTrack) {
      clearMediaSessionMetadata()
      document.title = 'Bragi'
      return
    }
    updateMediaSessionMetadata(currentTrack)
    document.title = currentTrack.title
      ? `${currentTrack.title} - ${currentTrack.artist || currentTrack.singer || ''} - Bragi`
      : 'Bragi'
  }, [currentKey, currentTrack])

  useEffect(() => {
    updateMediaSessionPlaybackState(isPlaying)
  }, [isPlaying])

  const currentTime = bridge.snapshot.currentTime
  const duration = bridge.snapshot.duration
  useEffect(() => {
    updateMediaSessionPositionState(bridge.audioElement)
  }, [bridge.audioElement, currentTime, duration])

  useEffect(() => {
    if (!isPlaying || !currentKey) {
      return undefined
    }
    const interval = window.setInterval(() => {
      const latest = latestSnapshotRef.current
      const trackId = getTrackId(latest?.currentTrack)
      if (latest?.playing && trackId && !latest.currentTrack?.isRadio) {
        lastPositionRef.current = Math.floor((latest.currentTime || 0) * 1000)
        subsonic.reportPlayback(trackId, lastPositionRef.current, 'playing')
      }
    }, config.playbackReportIntervalMs)
    return () => window.clearInterval(interval)
  }, [isPlaying, currentKey])

  useEffect(() => {
    const handlePageHide = () => {
      const snapshot = bridge.engine?.getSnapshot()
      const trackId = getTrackId(snapshot?.currentTrack)
      if (trackId && !snapshot.currentTrack?.isRadio) {
        subsonic.reportPlaybackKeepalive(
          trackId,
          Math.floor((snapshot.currentTime || 0) * 1000),
          'stopped',
        )
      }
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [bridge.engine])

  // ReplayGain remains optional and is isolated from the engine. A failure to
  // construct Web Audio must never prevent native playback.
  const gainContextRef = useRef(null)
  const gainNodeRef = useRef(null)
  useEffect(() => {
    if (
      !bridge.audioElement ||
      !config.enableReplayGain ||
      typeof window === 'undefined' ||
      !window.AudioContext ||
      !['album', 'track'].includes(gainInfo?.gainMode)
    ) {
      return undefined
    }
    try {
      const context = new window.AudioContext()
      const source = context.createMediaElementSource(bridge.audioElement)
      const gainNode = context.createGain()
      source.connect(gainNode)
      gainNode.connect(context.destination)
      gainContextRef.current = context
      gainNodeRef.current = gainNode
    } catch {
      gainContextRef.current = null
      gainNodeRef.current = null
    }
    return () => {
      gainNodeRef.current = null
      gainContextRef.current?.close?.()
      gainContextRef.current = null
    }
  }, [bridge.audioElement, gainInfo?.gainMode])

  useEffect(() => {
    const gainNode = gainNodeRef.current
    const context = gainContextRef.current
    if (!gainNode || !context || !currentTrack) return
    const numericGain = calculateGain(
      gainInfo,
      currentTrack.song || currentTrack,
    )
    gainNode.gain.setValueAtTime(numericGain, context.currentTime)
  }, [currentTrack, gainInfo])

  useEffect(() => {
    // A track switch temporarily makes the bridge not ready while the new
    // source is resolved. Keep the fullscreen mobile surface selected across
    // that loading gap; only collapse it when playback is actually gone.
    if (
      !isDesktop &&
      (!authenticated || !queue.length || !bridge.snapshot.currentTrack)
    ) {
      setMobileExpanded(false)
    }
  }, [authenticated, bridge.snapshot.currentTrack, isDesktop, queue.length])

  const handleClear = useCallback(() => {
    bridge.commands.clear()
    dispatch(clearQueue())
    setMobileExpanded(false)
  }, [bridge.commands, dispatch])

  return (
    <ThemeProvider theme={muiTheme}>
      <audio
        ref={bridge.audioRef}
        preload="auto"
        crossOrigin="anonymous"
        aria-hidden="true"
        style={{ display: 'none' }}
      />
      <DesktopPlayerResizeHandle visible={visible && isDesktop} />
      {visible && isDesktop && (
        <DesktopPlayer
          bridge={bridge}
          queue={queue}
          onClear={handleClear}
        />
      )}
      {visible && !isDesktop && (
        <MobilePlayerSurface
          bridge={bridge}
          queue={queue}
          expanded={mobileExpanded}
          onExpandedChange={setMobileExpanded}
          onClear={handleClear}
        />
      )}
    </ThemeProvider>
  )
}

export default Player
