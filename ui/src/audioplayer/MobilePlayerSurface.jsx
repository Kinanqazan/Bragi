import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import ArtworkCarousel from './ArtworkCarousel'
import LyricsCanvas from './LyricsCanvas'
import MobilePlayerBar from './MobilePlayerBar'
import PlayerControls from './PlayerControls'
import ProgressBar from './ProgressBar'
import QueueDrawer from './QueueDrawer'
import VolumeControl from './VolumeControl'
import PlayerToolbar, { PlayerLoveButton } from './PlayerToolbar'
import TrackIdentity from './TrackIdentity'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import AmbientBackdrop, { getTopBlendedColor } from './AmbientBackdrop'
import { useArtworkColor } from './artworkColor'
import { useImmediateControlPress } from './controlPress'
import { useThemeColorOverride } from '../useChangeThemeColor'
import {
  clamp,
  gestureIntentThreshold,
  getSwipeProgress,
  getSwipeTransitionDuration,
  getVerticalSwipeOffset,
  swipeThreshold,
} from './mobilePlayerGestures'

const snapEasing = 'cubic-bezier(0.22, 1, 0.36, 1)'
const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false

const isInteractiveTarget = (target) =>
  Boolean(
    target?.closest?.(
      'button, a, input, select, textarea, [role="button"], [role="slider"], [data-player-artwork]',
    ),
  )

const isNativeControlTarget = (target) =>
  Boolean(target?.closest?.('button, input, select, textarea, [role="slider"]'))

const useStyles = makeStyles((theme) => ({
  shell: {
    position: 'fixed',
    inset: 0,
    zIndex: 1400,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  frame: {
    position: 'fixed',
    zIndex: 0,
    top: 0,
    left: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    border: 0,
    // Keep this clip static: rounded-frame animation rerasterizes the large
    // background and shadow on Android WebView.
    borderRadius: 0,
    boxShadow: theme.shadows[8],
    transformOrigin: 'top left',
    pointerEvents: 'none',
    willChange: 'transform',
    '--nd-player-surface': theme.palette.background.paper,
  },
  surface: {
    position: 'absolute',
    inset: 0,
    zIndex: 1400,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    padding:
      'max(env(safe-area-inset-top, 0px), 1rem) max(env(safe-area-inset-right, 0px), 20px) max(env(safe-area-inset-bottom, 0px), 2.25rem) max(env(safe-area-inset-left, 0px), 20px)',
    color: theme.palette.text.primary,
    background: 'transparent',
    boxSizing: 'border-box',
    minHeight: 0,
    overflow: 'hidden',
    touchAction: 'none',
    willChange: 'opacity',
    isolation: 'isolate',
    '--nd-player-muted': theme.palette.text.secondary,
    '--nd-player-surface': theme.palette.background.paper,
    '--nd-player-accent': theme.palette.primary.main,
  },
  topSection: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '0 1 auto',
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: 520,
    margin: '0 auto',
    paddingTop: 'clamp(34px, calc(8vh - 6px), 66px)',
    boxSizing: 'border-box',
  },
  headerInfo: {
    position: 'relative',
    zIndex: 1,
    minWidth: 0,
    width: '100%',
    textAlign: 'center',
    margin: '0 auto 16px',
    padding: '0 36px',
    boxSizing: 'border-box',
  },
  fullTitleAnchor: {
    display: 'block',
    width: 'max-content',
    maxWidth: '100%',
    margin: '0 auto',
    overflow: 'hidden',
    fontSize: '1.3rem',
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    visibility: 'hidden',
  },
  fullArtistAnchor: {
    display: 'block',
    width: 'max-content',
    maxWidth: '100%',
    margin: '4px auto 0',
    overflow: 'hidden',
    fontSize: '1.2rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    visibility: 'hidden',
  },
  artworkSlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  artwork: {
    position: 'relative',
    flex: '0 1 auto',
    width: 'min(84vw, 46vh, 380px, max(120px, calc(100dvh - 24rem)))',
    maxWidth: '100%',
    maxHeight: '100%',
    minHeight: 0,
    aspectRatio: '1',
    margin: '0 auto',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow:
      '0 8px 24px -4px rgba(0, 0, 0, 0.22), 0 16px 40px -2px rgba(0, 0, 0, 0.32)',
    background: theme.palette.action.hover,
  },
  sharedArtwork: {
    position: 'fixed',
    zIndex: 1501,
    top: 0,
    left: 0,
    overflow: 'hidden',
    borderRadius: 4,
    boxShadow:
      '0 8px 24px -4px rgba(0, 0, 0, 0.22), 0 16px 40px -2px rgba(0, 0, 0, 0.32)',
    background: theme.palette.action.hover,
    pointerEvents: 'auto',
    touchAction: 'none',
    transformOrigin: 'top left',
    willChange: 'transform',
  },
  sharedPlay: {
    position: 'fixed',
    zIndex: 1502,
    top: 0,
    left: 0,
    padding: 0,
    color: `${theme.palette.primary.contrastText || '#ffffff'} !important`,
    backgroundColor: `${theme.palette.primary.main} !important`,
    borderRadius: '50%',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
    pointerEvents: 'auto',
    transformOrigin: 'top left',
    willChange: 'transform',
    '&:hover': {
      backgroundColor: `${theme.palette.primary.main} !important`,
      filter: 'brightness(1.08)',
    },
    '& svg': { fontSize: 36 },
  },
  bottomSection: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    flex: '0 0 auto',
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: 520,
    margin: '8px auto 0',
    paddingTop: 0,
    boxSizing: 'border-box',
  },
  progress: {
    width: '100%',
    paddingTop: 24,
    boxSizing: 'border-box',
    '& .nd-player-progress': {
      marginTop: 0,
    },
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 0,
    '& .nd-player-controls': {
      gap: 40,
    },
    '& .nd-player-btn-prev, & .nd-player-btn-next': {
      width: '56px !important',
      height: '56px !important',
    },
    '& .nd-player-btn-prev svg, & .nd-player-btn-next svg': {
      fontSize: 36,
    },
  },
  volume: {
    width: 'min(100%, 380px)',
    margin: '20px auto 0',
  },
  error: {
    marginTop: 12,
    color: theme.palette.error.main,
    textAlign: 'center',
    fontSize: '0.85rem',
  },
  retry: {
    marginLeft: 8,
    padding: '4px 10px',
    color: 'inherit',
    background: 'transparent',
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: 4,
    cursor: 'pointer',
  },
}))

const getLayerStyle = (value, full) => {
  const progress = clamp(value)
  return full
    ? {
        transform: 'none',
        opacity: progress === 0 ? 0 : clamp(progress * 1.35),
        visibility: progress === 0 ? 'hidden' : 'visible',
        pointerEvents: progress === 0 ? 'none' : 'auto',
      }
    : {
        transform: 'none',
        opacity: clamp(1 - progress * 1.35),
        visibility: progress >= 1 ? 'hidden' : 'visible',
        pointerEvents: progress >= 1 ? 'none' : 'auto',
      }
}

const getElementRects = (parent, elements) => {
  if (!parent) return {}
  const parentRect = parent.getBoundingClientRect()
  const rects = {
    frame: {
      left: parentRect.left,
      top: parentRect.top,
      width: parentRect.width,
      height: parentRect.height,
    },
    ...Object.fromEntries(
      Object.entries(elements).map(([name, element]) => {
        if (!element) return [name, null]
        const rect = element.getBoundingClientRect()
        return [
          name,
          {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
        ]
      }),
    ),
  }
  return rects
}

const interpolateRect = (start, end, progress) => {
  if (!start || !end) return null
  const mix = (from, to) => from + (to - from) * progress
  return {
    left: mix(start.left, end.left),
    top: mix(start.top, end.top),
    width: mix(start.width, end.width),
    height: mix(start.height, end.height),
  }
}

const getSharedTransform = (rect, base) => {
  if (!rect || !base?.width || !base?.height) return 'none'
  return (
    `translate3d(${rect.left}px, ${rect.top}px, 0) ` +
    `scale(${rect.width / base.width}, ${rect.height / base.height})`
  )
}

const MobilePlayerSurface = ({
  bridge,
  queue,
  expanded,
  onExpandedChange,
  onClear,
  lyrics: resolvedLyrics,
}) => {
  const classes = useStyles()
  const theme = useTheme()
  const [queueOpen, setQueueOpen] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const frameRef = useRef(null)
  const fullRef = useRef(null)
  const miniRef = useRef(null)
  const miniProgressTrackRef = useRef(null)
  const fullArtworkRef = useRef(null)
  const fullPlayRef = useRef(null)
  const fullTitleRef = useRef(null)
  const fullArtistRef = useRef(null)
  const miniArtworkRef = useRef(null)
  const miniPlayRef = useRef(null)
  const miniTitleRef = useRef(null)
  const miniArtistRef = useRef(null)
  const sharedArtworkRef = useRef(null)
  const sharedPlayRef = useRef(null)
  const sharedTitleRef = useRef(null)
  const sharedArtistRef = useRef(null)
  const sharedRects = useRef(null)
  const progressRef = useRef(expanded ? 1 : 0)
  const pendingProgress = useRef(null)
  const progressFrame = useRef(null)
  const swipe = useRef(null)
  const settle = useRef(null)
  const settleTimer = useRef(null)
  const { snapshot, commands, uiVolume } = bridge
  const sharedPlayPress = useImmediateControlPress(
    snapshot.playing ? commands.pause : commands.play,
    true,
  )
  const track = snapshot.currentTrack || {}
  const song = track.song || track
  const ambientColor = useArtworkColor(track.cover)
  const isDark = theme.palette?.type === 'dark'
  const topColor = getTopBlendedColor(
    ambientColor,
    isDark,
    theme.palette?.background?.default,
  )
  const setThemeColorActive = useThemeColorOverride(topColor, expanded)
  const title = song.title || track.title || track.name || 'Now playing'
  const subtitle = song.tags?.subtitle
  const displayTitle = subtitle ? `${title} (${subtitle})` : title
  const artist = song.artist || track.artist || track.singer
  const lyric = resolvedLyrics || track.lyric || track.song?.lyrics || ''
  const initialProgress = expanded ? 1 : 0
  const duration = snapshot.duration || 0
  const miniProgress = duration ? (snapshot.currentTime / duration) * 100 : 0

  const clearSettleTimer = () => {
    if (settleTimer.current != null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
  }

  const setLayerTransition = (value) => {
    if (frameRef.current) frameRef.current.style.transition = value
    if (fullRef.current) fullRef.current.style.transition = value
    if (miniRef.current) miniRef.current.style.transition = value
    if (sharedArtworkRef.current)
      sharedArtworkRef.current.style.transition = value
    if (sharedPlayRef.current) sharedPlayRef.current.style.transition = value
    if (sharedTitleRef.current) sharedTitleRef.current.style.transition = value
    if (sharedArtistRef.current)
      sharedArtistRef.current.style.transition = value
  }

  const measureSharedRects = () => {
    // Only measure when the viewport or track identity changes. Hidden anchors
    // still have layout, so there is no need to reveal either player to read them.
    const frame = frameRef.current
    const previousTransform = frame?.style.transform
    const previousTransition = frame?.style.transition
    if (frame) {
      frame.style.transition = 'none'
      frame.style.width = `${window.innerWidth}px`
      frame.style.height = `${window.innerHeight}px`
      frame.style.transform = 'none'
    }
    const fullRects = getElementRects(fullRef.current, {
      artwork: fullArtworkRef.current,
      play: fullPlayRef.current,
      title: fullTitleRef.current,
      artist: fullArtistRef.current,
    })
    const miniRects = getElementRects(miniRef.current, {
      artwork: miniArtworkRef.current,
      play: miniPlayRef.current,
      title: miniTitleRef.current,
      artist: miniArtistRef.current,
      progressTrack: miniProgressTrackRef.current,
    })
    if (miniRects.artwork && miniRects.progressTrack) {
      miniRects.artwork = {
        ...miniRects.artwork,
        height: Math.max(
          0,
          Math.min(
            miniRects.artwork.height,
            miniRects.progressTrack.top - miniRects.artwork.top - 1,
          ),
        ),
      }
    }
    if (frame) {
      frame.style.transform = previousTransform
      frame.style.transition = previousTransition
    }
    const fontSize = (element, fallback) =>
      element
        ? parseFloat(window.getComputedStyle(element).fontSize) || fallback
        : fallback
    sharedRects.current = {
      fullFrame: fullRects.frame,
      miniFrame: miniRects.frame,
      fullArtwork: fullRects.artwork,
      miniArtwork: miniRects.artwork,
      fullPlay: fullRects.play,
      miniPlay: miniRects.play,
      fullTitle: fullRects.title,
      miniTitle: miniRects.title,
      fullArtist: fullRects.artist,
      miniArtist: miniRects.artist,
      fullTitleSize: fontSize(fullTitleRef.current, 18.4),
      miniTitleSize: fontSize(miniTitleRef.current, 16),
      fullArtistSize: fullArtistRef.current
        ? fontSize(fullArtistRef.current, 16)
        : 16,
      miniArtistSize: miniArtistRef.current
        ? fontSize(miniArtistRef.current, 13.6)
        : 13.6,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
    const bounds = sharedRects.current
    if (sharedArtworkRef.current && bounds.miniArtwork?.width) {
      sharedArtworkRef.current.style.borderRadius = `${(4 * bounds.fullArtwork.width) / bounds.miniArtwork.width}px`
    }
    for (const [element, rect] of [
      [sharedArtworkRef.current, bounds.fullArtwork],
      [sharedPlayRef.current, bounds.fullPlay],
    ]) {
      if (!element || !rect) continue
      // Raster at the largest size and scale down, rather than enlarging a
      // mini-player-sized artwork texture throughout the gesture.
      element.style.width = `${rect.width}px`
      element.style.height = `${rect.height}px`
    }
    for (const [element, fullSize] of [
      [sharedTitleRef.current, bounds.fullTitleSize],
      [sharedArtistRef.current, bounds.fullArtistSize],
    ]) {
      if (!element) continue
      element.style.fontSize = `${fullSize}px`
    }
    syncTextLayout(progressRef.current)
  }

  const syncTextLayout = (value) => {
    const bounds = sharedRects.current
    if (!bounds) return
    for (const [element, mini, full, miniSize, fullSize] of [
      [
        sharedTitleRef.current,
        bounds.miniTitle,
        bounds.fullTitle,
        bounds.miniTitleSize,
        bounds.fullTitleSize,
      ],
      [
        sharedArtistRef.current,
        bounds.miniArtist,
        bounds.fullArtist,
        bounds.miniArtistSize,
        bounds.fullArtistSize,
      ],
    ]) {
      if (!element || !mini || !full) continue
      // Recompute ellipsis only at rest, never while the finger is moving.
      const miniWidth = (mini.width * fullSize) / miniSize
      const width =
        value === 1
          ? full.width
          : value === 0
            ? miniWidth
            : Math.max(full.width, miniWidth)
      element.style.width = `${width}px`
    }
  }

  const ensureSharedRects = () => {
    if (
      !sharedRects.current ||
      sharedRects.current.viewportWidth !== window.innerWidth ||
      sharedRects.current.viewportHeight !== window.innerHeight
    ) {
      measureSharedRects()
    }
  }

  const updateSharedElements = (value) => {
    const progress = clamp(value)
    const bounds = sharedRects.current
    if (!bounds) return

    const update = (element, start, end) => {
      if (!element || !start || !end) return
      const rect = interpolateRect(start, end, progress)
      const base = end
      if (element.style.opacity !== '1') element.style.opacity = '1'
      if (element.style.visibility !== 'visible') {
        element.style.visibility = 'visible'
      }
      element.style.transform = getSharedTransform(rect, base)
    }

    update(sharedArtworkRef.current, bounds.miniArtwork, bounds.fullArtwork)
    update(sharedPlayRef.current, bounds.miniPlay, bounds.fullPlay)

    const updateText = (element, start, end, startSize, endSize) => {
      if (!element || !start || !end) return
      const rect = interpolateRect(start, end, progress)
      const scale = (startSize + (endSize - startSize) * progress) / endSize
      const width = parseFloat(element.style.width)
      element.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(${scale})`
      // Clip just the two text lines; do not relayout their font/width or clip
      // a full-screen controls layer on every animation frame.
      element.style.clipPath = `inset(0 ${Math.max(0, width - rect.width / scale)}px 0 0)`
      element.style.visibility = 'visible'
      element.style.opacity = '1'
    }

    updateText(
      sharedTitleRef.current,
      bounds.miniTitle,
      bounds.fullTitle,
      bounds.miniTitleSize,
      bounds.fullTitleSize,
    )
    updateText(
      sharedArtistRef.current,
      bounds.miniArtist,
      bounds.fullArtist,
      bounds.miniArtistSize,
      bounds.fullArtistSize,
    )

    const frame = frameRef.current
    const base = bounds.fullFrame
    const rect = interpolateRect(bounds.miniFrame, base, progress)
    if (!frame || !base?.width || !base?.height || !rect) return
    frame.style.transform = getSharedTransform(rect, base)
    frame.style.visibility = 'visible'
    frame.style.opacity = '1'
  }

  const applyProgress = (value) => {
    const progress = clamp(value)
    progressRef.current = progress
    const full = fullRef.current
    const mini = miniRef.current

    if (full) Object.assign(full.style, getLayerStyle(progress, true))
    if (mini) Object.assign(mini.style, getLayerStyle(progress, false))
    updateSharedElements(progress)
  }

  const updateSharedMiniOffset = (offset, transition = 'none') => {
    const bounds = sharedRects.current
    if (!bounds) return
    if (frameRef.current && bounds.miniFrame) {
      frameRef.current.style.transition = transition
      frameRef.current.style.transform = getSharedTransform(
        { ...bounds.miniFrame, top: bounds.miniFrame.top + offset },
        bounds.fullFrame,
      )
    }
    for (const [element, rect, base] of [
      [sharedArtworkRef.current, bounds.miniArtwork, bounds.fullArtwork],
      [sharedPlayRef.current, bounds.miniPlay, bounds.fullPlay],
    ]) {
      if (!element || !rect) continue
      element.style.transition = transition
      element.style.transform = getSharedTransform(
        { ...rect, top: rect.top + offset },
        base,
      )
    }
    for (const [element, rect, scale] of [
      [
        sharedTitleRef.current,
        bounds.miniTitle,
        bounds.miniTitleSize / bounds.fullTitleSize,
      ],
      [
        sharedArtistRef.current,
        bounds.miniArtist,
        bounds.miniArtistSize / bounds.fullArtistSize,
      ],
    ]) {
      if (!element || !rect) continue
      element.style.transition = transition
      element.style.transform = `translate3d(${rect.left}px, ${rect.top + offset}px, 0) scale(${scale})`
    }
  }

  const scheduleProgress = (value) => {
    pendingProgress.current = clamp(value)
    progressRef.current = pendingProgress.current
    if (progressFrame.current != null) return
    progressFrame.current = window.requestAnimationFrame(() => {
      progressFrame.current = null
      if (pendingProgress.current != null) {
        applyProgress(pendingProgress.current)
        pendingProgress.current = null
      }
    })
  }

  const flushScheduledProgress = () => {
    if (progressFrame.current != null) {
      window.cancelAnimationFrame(progressFrame.current)
      progressFrame.current = null
    }
    if (pendingProgress.current != null) {
      const progress = pendingProgress.current
      pendingProgress.current = null
      applyProgress(progress)
    }
  }

  const finishSettle = () => {
    const activeSettle = settle.current
    if (!activeSettle) return
    settle.current = null
    clearSettleTimer()
    setLayerTransition('none')
    if (activeSettle.dismiss) {
      onClear?.()
      return
    }
    syncTextLayout(activeSettle.target)
    applyProgress(activeSettle.target)
    if (activeSettle.target === 0 && lyricsOpen) setLyricsOpen(false)
    if (activeSettle.notify) {
      onExpandedChange?.(activeSettle.target === 1)
    }
  }

  const settleDismiss = (velocityY = 0) => {
    clearSettleTimer()
    settle.current = { dismiss: true }
    const duration = prefersReducedMotion()
      ? 0
      : Math.min(240, getSwipeTransitionDuration(0, 0.5, velocityY))
    const fadeDuration = Math.min(90, duration)
    const fadeDelay = duration - fadeDuration
    const transition =
      `transform ${duration}ms ${snapEasing}, ` +
      `opacity ${fadeDuration}ms ease-out ${fadeDelay}ms`
    setLayerTransition(transition)
    if (miniRef.current) {
      miniRef.current.style.transition = transition
      miniRef.current.style.transform =
        'translate3d(0, calc(100% + 120px + env(safe-area-inset-bottom, 0px)), 0)'
      miniRef.current.style.opacity = '0'
      miniRef.current.style.pointerEvents = 'none'
    }
    updateSharedMiniOffset(window.innerHeight + 120, transition)
    if (frameRef.current) frameRef.current.style.opacity = '0'
    if (sharedArtworkRef.current) sharedArtworkRef.current.style.opacity = '0'
    if (sharedPlayRef.current) sharedPlayRef.current.style.opacity = '0'
    if (sharedTitleRef.current) sharedTitleRef.current.style.opacity = '0'
    if (sharedArtistRef.current) sharedArtistRef.current.style.opacity = '0'
    settleTimer.current = window.setTimeout(finishSettle, duration + 40)
  }

  const settleMiniReset = () => {
    clearSettleTimer()
    settle.current = null
    const duration = prefersReducedMotion() ? 0 : 200
    const transition =
      `transform ${duration}ms ${snapEasing}, ` +
      `opacity ${duration}ms ${snapEasing}, ` +
      `clip-path ${duration}ms ${snapEasing}`
    setLayerTransition(transition)
    if (miniRef.current) {
      miniRef.current.style.transition = transition
      miniRef.current.style.transform = 'translate3d(0, 0%, 0) scale(1)'
      miniRef.current.style.opacity = '1'
      miniRef.current.style.pointerEvents = 'auto'
    }
    updateSharedElements(0)
    settleTimer.current = window.setTimeout(() => {
      clearSettleTimer()
      setLayerTransition('none')
    }, duration + 40)
  }

  const settleTo = (target, velocityY = 0, notify = false) => {
    clearSettleTimer()
    const current = progressRef.current
    const nextTarget = clamp(target)
    settle.current = { target: nextTarget, notify }
    const duration = prefersReducedMotion()
      ? 0
      : getSwipeTransitionDuration(current, nextTarget, velocityY)
    const transition =
      `transform ${duration}ms ${snapEasing}, ` +
      `opacity ${duration}ms ${snapEasing}, ` +
      `clip-path ${duration}ms ${snapEasing}`
    setLayerTransition(transition)

    if (duration === 0 || Math.abs(current - nextTarget) < 0.001) {
      finishSettle()
      return
    }

    // Force the browser to commit the drag position before applying the snap
    // target, otherwise the two writes can be coalesced into one frame.
    void frameRef.current?.offsetHeight
    applyProgress(nextTarget)
    settleTimer.current = window.setTimeout(finishSettle, duration + 60)
  }

  const collapseToMiniPlayer = () => {
    ensureSharedRects()
    applyProgress(progressRef.current)
    setThemeColorActive(false)
    settleTo(0, 0, true)
  }

  const cancelSettle = () => {
    clearSettleTimer()
    if (settle.current && !settle.current.dismiss) {
      const bounds = sharedRects.current
      const height = frameRef.current?.getBoundingClientRect().height
      const distance = bounds?.fullFrame.height - bounds?.miniFrame.height
      if (height && distance > 0) {
        progressRef.current = clamp(
          (height - bounds.miniFrame.height) / distance,
        )
      }
    }
    settle.current = null
    setLayerTransition('none')
    applyProgress(progressRef.current)
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // A button press must not cancel or reposition the player snap beneath the
    // finger. The moving frame can otherwise make Android drop the click.
    if (isNativeControlTarget(event.target)) return
    flushScheduledProgress()
    cancelSettle()
    ensureSharedRects()
    const startProgress = progressRef.current
    applyProgress(startProgress)
    swipe.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      startProgress,
      opening: startProgress < 0.5,
      mode: null,
      moved: false,
      themeColorSynced: false,
    }
  }

  const handlePointerMove = (event) => {
    const gesture = swipe.current
    if (
      !gesture ||
      (event.pointerId != null && gesture.pointerId !== event.pointerId)
    )
      return

    if (
      sharedRects.current?.viewportWidth !== window.innerWidth ||
      sharedRects.current?.viewportHeight !== window.innerHeight
    ) {
      measureSharedRects()
    }

    const deltaY = getVerticalSwipeOffset(gesture, event)
    const now = performance.now()
    const elapsed = Math.max(1, now - gesture.lastTime)
    gesture.velocityY = (event.clientY - gesture.lastY) / elapsed
    gesture.lastY = event.clientY
    gesture.lastTime = now

    if (!gesture.mode && Math.abs(deltaY) > gestureIntentThreshold) {
      if (gesture.startProgress <= 0.001) {
        gesture.mode = deltaY < 0 ? 'expand' : 'dismiss'
      } else if (gesture.startProgress < 0.999) {
        // An interrupted snap is still a resize gesture. It must never be
        // mistaken for dismissing the settled mini player and clearing music.
        gesture.mode = deltaY < 0 ? 'expand' : 'collapse'
      } else {
        gesture.mode = deltaY > 0 ? 'collapse' : null
      }
      if (gesture.mode === 'expand' || gesture.mode === 'collapse') {
        gesture.opening = gesture.mode === 'expand'
      }
    }

    if (gesture.mode === 'dismiss') {
      const isCorrectDirection = deltaY > 0
      if (isCorrectDirection && Math.abs(deltaY) >= swipeThreshold) {
        gesture.moved = true
      }
      const dragY = Math.max(0, deltaY)
      if (miniRef.current) {
        miniRef.current.style.transition = 'none'
        miniRef.current.style.transform = `translate3d(0, ${dragY}px, 0) scale(1)`
        // Keep the card opaque while it follows the finger. Fading it during
        // the drag exposes the reserved bottom area before the card has left
        // the screen, which reads as a hole opening behind the player.
        miniRef.current.style.opacity = '1'
      }
      updateSharedMiniOffset(dragY)
      return
    }

    const isCorrectDirection = gesture.opening ? deltaY < 0 : deltaY > 0
    if (
      isCorrectDirection &&
      Math.abs(deltaY) > gestureIntentThreshold &&
      !gesture.themeColorSynced
    ) {
      gesture.themeColorSynced = true
      setThemeColorActive(gesture.opening)
    }
    if (isCorrectDirection && Math.abs(deltaY) >= swipeThreshold) {
      gesture.moved = true
    }

    scheduleProgress(
      getSwipeProgress(gesture.startProgress, deltaY, window.innerHeight),
    )
  }

  const handlePointerUp = (event) => {
    const gesture = swipe.current
    if (
      gesture &&
      event?.pointerId != null &&
      gesture.pointerId !== event.pointerId
    )
      return
    swipe.current = null
    if (!gesture) return
    flushScheduledProgress()

    if (gesture.mode === 'dismiss') {
      const deltaY = getVerticalSwipeOffset(gesture, event)
      const passedThreshold = gesture.moved || deltaY >= swipeThreshold
      if (!passedThreshold && isInteractiveTarget(event?.target)) {
        setThemeColorActive(expanded)
        return
      }
      if (passedThreshold) {
        event?.preventDefault?.()
        settleDismiss(gesture.velocityY)
      } else {
        event?.preventDefault?.()
        settleMiniReset()
      }
      return
    }

    const deltaX = event.clientX - gesture.clientX
    const deltaY = event.clientY - gesture.clientY
    if (
      !gesture.moved &&
      Math.abs(deltaX) > gestureIntentThreshold &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      event?.preventDefault?.()
      return
    }

    if (!gesture.moved && isInteractiveTarget(event?.target)) {
      if (event.immediateLinkActionHandled) return
      // Small finger drift is still a tap. Let the browser synthesize its click
      // instead of settling the layer and cancelling the control activation.
      setThemeColorActive(expanded)
      return
    }

    if (!gesture.moved && gesture.mode) {
      const target = gesture.opening ? 0 : 1
      setThemeColorActive(target === 1)
      event?.preventDefault?.()
      settleTo(target, gesture.velocityY, true)
      return
    }

    if (!gesture.moved) {
      const target = gesture.opening ? 0 : 1
      setThemeColorActive(target === 1)
      settleTo(target, 0, true)
      return
    }

    const target = gesture.opening ? 1 : 0
    setThemeColorActive(target === 1)
    // Prevent the browser from synthesizing a click for the element where the
    // swipe ended. A shell-wide click guard can also swallow the first real
    // control click after the transition completes.
    event?.preventDefault?.()
    settleTo(target, gesture.velocityY, true)
  }

  const handlePointerCancel = (event) => {
    const gesture = swipe.current
    if (
      gesture &&
      event?.pointerId != null &&
      gesture.pointerId !== event.pointerId
    )
      return
    swipe.current = null
    if (gesture) {
      if (gesture.mode === 'dismiss') {
        settleMiniReset()
        return
      }
      const target = gesture.opening ? 0 : 1
      setThemeColorActive(target === 1)
      settleTo(target)
    }
  }

  const handleTransitionEnd = (event) => {
    if (
      (event.target === frameRef.current || event.target === miniRef.current) &&
      event.propertyName === 'transform'
    ) {
      finishSettle()
    }
  }

  const handleOpenRequest = () => {
    ensureSharedRects()
    applyProgress(progressRef.current)
    setThemeColorActive(true)
    settleTo(1, 0, true)
  }

  const handleIdentityClick = (event) => {
    if (progressRef.current < 0.5) {
      event?.preventDefault?.()
      handleOpenRequest()
    } else {
      collapseToMiniPlayer()
    }
  }

  useEffect(
    () => () => {
      clearSettleTimer()
      if (progressFrame.current != null) {
        window.cancelAnimationFrame(progressFrame.current)
      }
      settle.current = null
    },
    [],
  )

  useLayoutEffect(() => {
    measureSharedRects()
    applyProgress(progressRef.current)
    // Geometry helpers read refs; only text changes can alter these anchors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTitle, artist])

  useEffect(() => {
    const handleResize = () => {
      measureSharedRects()
      applyProgress(progressRef.current)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // The listener reads current refs, so its first closure remains valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gestureHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onTransitionEnd: handleTransitionEnd,
  }

  return (
    <div className={classes.shell} data-testid="mobile-player-shell">
      <div
        ref={frameRef}
        data-testid="shared-player-frame"
        className={classes.frame}
        onTransitionEnd={handleTransitionEnd}
        style={{
          visibility: 'hidden',
          transition: 'none',
          background: topColor,
        }}
      >
        <AmbientBackdrop
          cover={track.cover}
          color={ambientColor}
          topColor={topColor}
        />
        <section
          ref={fullRef}
          className={classes.surface}
          aria-label="Full-screen player"
          aria-hidden={!expanded}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onTransitionEnd={handleTransitionEnd}
          style={{
            ...getLayerStyle(initialProgress, true),
            background: 'transparent',
            touchAction: 'none',
            transition: 'none',
            pointerEvents: expanded ? 'auto' : 'none',
          }}
        >
          <PlayerToolbar
            id={track.trackId}
            isRadio={track.isRadio}
            showLove={false}
          />
          <div className={classes.topSection}>
            <div className={classes.headerInfo}>
              <div
                ref={fullTitleRef}
                data-player-anchor="full-title"
                className={classes.fullTitleAnchor}
                aria-hidden="true"
              >
                {displayTitle}
              </div>
              {artist && (
                <div
                  ref={fullArtistRef}
                  data-player-anchor="full-artist"
                  className={classes.fullArtistAnchor}
                  aria-hidden="true"
                >
                  {artist}
                </div>
              )}
            </div>
            <div className={classes.artworkSlot}>
              <div
                ref={fullArtworkRef}
                data-testid="full-artwork-anchor"
                className={classes.artwork}
                style={{ visibility: 'hidden' }}
                aria-hidden="true"
              />
            </div>
            <div className={classes.progress}>
              <ProgressBar snapshot={snapshot} commands={commands} />
            </div>
          </div>
          <div className={classes.bottomSection}>
            <div className={classes.controls}>
              <PlayerControls
                snapshot={snapshot}
                commands={commands}
                onQueue={() => setQueueOpen(true)}
                onLyrics={() => setLyricsOpen((open) => !open)}
                lyricsActive={lyricsOpen}
                primaryControl={
                  <span
                    ref={fullPlayRef}
                    className="nd-player-primary-control nd-player-primary-placeholder"
                    style={{ visibility: 'hidden' }}
                    aria-hidden="true"
                  />
                }
                favoriteButton={
                  <PlayerLoveButton
                    id={track.trackId}
                    isRadio={track.isRadio}
                  />
                }
                compact
                isolateGestures
              />
            </div>
            <div className={classes.volume}>
              <VolumeControl value={uiVolume} onChange={commands.setVolume} />
            </div>
            {snapshot.error && (
              <div className={classes.error} role="alert">
                {snapshot.error.publicMessage || 'Unable to play this track.'}
                <button
                  type="button"
                  className={classes.retry}
                  onClick={commands.play}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
          {queueOpen && (
            <QueueDrawer
              queue={queue}
              currentIndex={snapshot.currentIndex}
              commands={commands}
              onClose={() => setQueueOpen(false)}
              onClear={onClear}
            />
          )}
        </section>
      </div>
      <MobilePlayerBar
        rootRef={miniRef}
        artworkRef={miniArtworkRef}
        playRef={miniPlayRef}
        titleRef={miniTitleRef}
        artistRef={miniArtistRef}
        progressTrackRef={miniProgressTrackRef}
        gestureHandlers={gestureHandlers}
        progress={miniProgress}
        snapshot={snapshot}
        commands={commands}
        sharedPlayback
        sharedIdentity
        style={{
          ...getLayerStyle(initialProgress, false),
          touchAction: 'none',
          transition: 'none',
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          boxShadow: 'none',
        }}
        cover={track.cover}
        ambientColor={ambientColor}
        title={displayTitle}
        artist={artist}
        onOpen={handleOpenRequest}
      />
      <TrackIdentity
        track={track}
        mobile
        shared
        titleRef={sharedTitleRef}
        artistRef={sharedArtistRef}
        gestureHandlers={gestureHandlers}
        onTitleClick={handleIdentityClick}
        onArtistClick={handleIdentityClick}
      />
      <div
        ref={sharedArtworkRef}
        className={classes.sharedArtwork}
        data-player-artwork="true"
        aria-hidden={!expanded}
        onClick={handleOpenRequest}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTransitionEnd={handleTransitionEnd}
        style={{ visibility: 'hidden', transition: 'none' }}
      >
        {lyricsOpen ? (
          <LyricsCanvas
            currentTime={snapshot.currentTime}
            lyric={lyric}
            cover={track.cover}
            glowColor={ambientColor}
            songId={!track.isRadio ? (track.trackId || track.song?.id || track.id) : null}
            searchTitle={displayTitle || track.song?.title || ''}
            searchArtist={artist || ''}
            onClose={() => setLyricsOpen(false)}
            onSeek={commands.seek}
          />
        ) : (
          <ArtworkCarousel
            queue={queue}
            playIndex={snapshot.currentIndex}
            currentTrack={track}
            playMode={snapshot.mode}
            commands={commands}
          />
        )}
      </div>
      <IconButton
        ref={sharedPlayRef}
        data-player-shared-control="true"
        className={classes.sharedPlay}
        {...sharedPlayPress}
        disableRipple
        aria-label={snapshot.playing ? 'Pause' : 'Play'}
        style={{
          width: 64,
          height: 64,
          visibility: 'hidden',
          transition: 'none',
        }}
      >
        {snapshot.loading ? (
          <span className="nd-player-loading" aria-label="Loading" />
        ) : snapshot.playing ? (
          <PauseRoundedIcon />
        ) : (
          <PlayArrowRoundedIcon />
        )}
      </IconButton>
    </div>
  )
}

export default MobilePlayerSurface
