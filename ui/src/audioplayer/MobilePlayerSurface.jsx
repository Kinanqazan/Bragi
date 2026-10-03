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
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[8],
    transformOrigin: 'top left',
    pointerEvents: 'none',
    willChange: 'transform',
    '--nd-player-surface': theme.palette.background.paper,
  },
  surface: {
    position: 'fixed',
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
    willChange: 'opacity, clip-path',
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
    paddingTop: 'clamp(40px, 8vh, 72px)',
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
    fontSize: '1.15rem',
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
    fontSize: '1rem',
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
    borderRadius: 16,
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
    borderRadius: 16,
    boxShadow:
      '0 8px 24px -4px rgba(0, 0, 0, 0.22), 0 16px 40px -2px rgba(0, 0, 0, 0.32)',
    background: theme.palette.action.hover,
    pointerEvents: 'auto',
    touchAction: 'none',
    transformOrigin: 'top left',
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
    margin: 'auto auto 0',
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
    marginTop: 20,
    '& .nd-player-controls': {
      gap: 40,
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

const getElementRects = (parent, progress, full, elements) => {
  if (!parent) return {}
  const properties = [
    'transform',
    'opacity',
    'visibility',
    'pointerEvents',
    'transition',
  ]
  const previous = Object.fromEntries(
    properties.map((property) => [property, parent.style[property]]),
  )
  Object.assign(parent.style, getLayerStyle(progress, full), {
    opacity: '1',
    visibility: 'visible',
    transition: 'none',
  })
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
  Object.assign(parent.style, previous)
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
    const fullRects = getElementRects(fullRef.current, 1, true, {
      artwork: fullArtworkRef.current,
      play: fullPlayRef.current,
      title: fullTitleRef.current,
      artist: fullArtistRef.current,
    })
    const miniRects = getElementRects(miniRef.current, 0, false, {
      artwork: miniArtworkRef.current,
      play: miniPlayRef.current,
      title: miniTitleRef.current,
      artist: miniArtistRef.current,
    })
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
  }

  const updateSharedElements = (value) => {
    const progress = clamp(value)
    const bounds = sharedRects.current
    if (!bounds) return

    const update = (element, start, end) => {
      if (!element || !start || !end) return
      const rect = interpolateRect(start, end, progress)
      const base = start
      if (element.style.width !== `${base.width}px`) {
        element.style.width = `${base.width}px`
      }
      if (element.style.height !== `${base.height}px`) {
        element.style.height = `${base.height}px`
      }
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
      element.style.width = `${rect.width}px`
      element.style.fontSize = `${startSize + (endSize - startSize) * progress}px`
      element.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`
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
    const base = bounds.miniFrame
    const rect = interpolateRect(base, bounds.fullFrame, progress)
    if (!frame || !base?.width || !base?.height || !rect) return
    const scaleX = rect.width / base.width
    const scaleY = rect.height / base.height
    const corner = 18 * (1 - progress)
    const border = 1 - progress
    frame.style.width = `${base.width}px`
    frame.style.height = `${base.height}px`
    frame.style.transform = getSharedTransform(rect, base)
    frame.style.borderRadius = `${corner / scaleX}px / ${corner / scaleY}px`
    frame.style.borderWidth = `${border / scaleY}px ${border / scaleX}px`
    frame.style.visibility = 'visible'
    frame.style.opacity = '1'

    if (fullRef.current) {
      const full = bounds.fullFrame
      const top = Math.max(0, rect.top - full.top)
      const right = Math.max(0, full.left + full.width - rect.left - rect.width)
      const bottom = Math.max(
        0,
        full.top + full.height - rect.top - rect.height,
      )
      const left = Math.max(0, rect.left - full.left)
      fullRef.current.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${corner}px)`
    }
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
        bounds.miniFrame,
      )
    }
    for (const [element, rect] of [
      [sharedArtworkRef.current, bounds.miniArtwork],
      [sharedPlayRef.current, bounds.miniPlay],
    ]) {
      if (!element || !rect) continue
      element.style.transition = transition
      element.style.transform = getSharedTransform(
        { ...rect, top: rect.top + offset },
        rect,
      )
    }
    for (const [element, rect] of [
      [sharedTitleRef.current, bounds.miniTitle],
      [sharedArtistRef.current, bounds.miniArtist],
    ]) {
      if (!element || !rect) continue
      element.style.transition = transition
      element.style.transform = `translate3d(${rect.left}px, ${rect.top + offset}px, 0)`
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
      `clip-path ${duration}ms ${snapEasing}, ` +
      `border-radius ${duration}ms ${snapEasing}, ` +
      `border-width ${duration}ms ${snapEasing}, ` +
      `width ${duration}ms ${snapEasing}, ` +
      `font-size ${duration}ms ${snapEasing}`
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
      `clip-path ${duration}ms ${snapEasing}, ` +
      `border-radius ${duration}ms ${snapEasing}, ` +
      `border-width ${duration}ms ${snapEasing}, ` +
      `width ${duration}ms ${snapEasing}, ` +
      `font-size ${duration}ms ${snapEasing}`
    setLayerTransition(transition)

    if (Math.abs(current - nextTarget) < 0.001) {
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
    measureSharedRects()
    applyProgress(progressRef.current)
    setThemeColorActive(false)
    settleTo(0, 0, true)
  }

  const cancelSettle = () => {
    clearSettleTimer()
    if (settle.current && !settle.current.dismiss) {
      progressRef.current = settle.current.target
    }
    settle.current = null
    setLayerTransition('none')
    applyProgress(progressRef.current)
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    flushScheduledProgress()
    cancelSettle()
    measureSharedRects()
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
      if (gesture.startProgress < 0.5) {
        gesture.mode = deltaY < 0 ? 'expand' : 'dismiss'
      } else {
        gesture.mode = deltaY > 0 ? 'collapse' : null
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

    if (!gesture.moved && gesture.mode) {
      const target = gesture.opening ? 0 : 1
      setThemeColorActive(target === 1)
      event?.preventDefault?.()
      settleTo(target, gesture.velocityY, true)
      return
    }

    if (!gesture.moved) {
      // Leave taps on controls to those controls. Settling the layer here can
      // race the browser's synthesized click on the first tap after opening
      // or collapsing the player. Real swipes that start on a control still
      // take the normal gesture path once they pass the movement threshold.
      if (isInteractiveTarget(event?.target)) {
        setThemeColorActive(expanded)
        return
      }
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
    measureSharedRects()
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
    <div className={classes.shell}>
      <div
        ref={frameRef}
        data-testid="shared-player-frame"
        className={classes.frame}
        aria-hidden="true"
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
      </div>
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
                <PlayerLoveButton id={track.trackId} isRadio={track.isRadio} />
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
      <MobilePlayerBar
        rootRef={miniRef}
        artworkRef={miniArtworkRef}
        playRef={miniPlayRef}
        titleRef={miniTitleRef}
        artistRef={miniArtistRef}
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTransitionEnd={handleTransitionEnd}
        onClick={snapshot.playing ? commands.pause : commands.play}
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
