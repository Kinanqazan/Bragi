import React, { useEffect, useRef, useState } from 'react'
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

const isInteractiveTarget = (target) =>
  Boolean(
    target?.closest?.(
      'button, a, input, select, textarea, [role="button"], [role="slider"]',
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
  surface: {
    position: 'fixed',
    inset: 0,
    zIndex: 1400,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    padding:
      'max(env(safe-area-inset-top, 0px), 1rem) max(env(safe-area-inset-right, 0px), 20px) max(env(safe-area-inset-bottom, 0px), 2.25rem) max(env(safe-area-inset-left, 0px), 20px)',
    color: theme.palette.text.primary,
    background: theme.palette.background.default,
    boxSizing: 'border-box',
    minHeight: 0,
    overflow: 'hidden',
    touchAction: 'none',
    willChange: 'transform, opacity',
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
        transform: `translate3d(0, ${(1 - progress) * 100}%, 0) scale(${0.98 + progress * 0.02})`,
        opacity: progress === 0 ? 0 : clamp(progress * 1.35),
        visibility: progress === 0 ? 'hidden' : 'visible',
        pointerEvents: progress === 0 ? 'none' : 'auto',
      }
    : {
        transform: `translate3d(0, ${progress * 100}%, 0) scale(${1 - progress * 0.04})`,
        opacity: clamp(1 - progress * 1.35),
        visibility: progress >= 1 ? 'hidden' : 'visible',
        pointerEvents: progress >= 1 ? 'none' : 'auto',
      }
}

const MobilePlayerSurface = ({
  bridge,
  queue,
  expanded,
  onExpandedChange,
  onClear,
}) => {
  const classes = useStyles()
  const theme = useTheme()
  const [queueOpen, setQueueOpen] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const fullRef = useRef(null)
  const miniRef = useRef(null)
  const progressRef = useRef(expanded ? 1 : 0)
  const swipe = useRef(null)
  const settle = useRef(null)
  const settleTimer = useRef(null)
  const { snapshot, commands, uiVolume } = bridge
  const track = snapshot.currentTrack || {}
  const ambientColor = useArtworkColor(track.cover)
  const isDark = theme.palette?.type === 'dark'
  const topColor = getTopBlendedColor(
    ambientColor,
    isDark,
    theme.palette?.background?.default,
  )
  const setThemeColorActive = useThemeColorOverride(topColor, expanded)
  const title = track.title || track.name || track.song?.title
  const artist = track.artist || track.singer || track.song?.artist
  const lyric = track.lyric || track.song?.lyrics || ''
  const initialProgress = expanded ? 1 : 0

  const clearSettleTimer = () => {
    if (settleTimer.current != null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
  }

  const setLayerTransition = (value) => {
    if (fullRef.current) fullRef.current.style.transition = value
    if (miniRef.current) miniRef.current.style.transition = value
  }

  const applyProgress = (value) => {
    const progress = clamp(value)
    progressRef.current = progress
    const full = fullRef.current
    const mini = miniRef.current

    if (full) Object.assign(full.style, getLayerStyle(progress, true))
    if (mini) Object.assign(mini.style, getLayerStyle(progress, false))
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
    if (activeSettle.notify) {
      onExpandedChange?.(activeSettle.target === 1)
    }
  }

  const settleDismiss = (velocityY = 0) => {
    clearSettleTimer()
    settle.current = { dismiss: true }
    const duration = Math.min(240, getSwipeTransitionDuration(0, 0.5, velocityY))
    const transition = `transform ${duration}ms ${snapEasing}, opacity ${duration}ms ${snapEasing}`
    if (miniRef.current) {
      miniRef.current.style.transition = transition
      miniRef.current.style.transform =
        'translate3d(0, calc(100% + 120px + env(safe-area-inset-bottom, 0px)), 0)'
      miniRef.current.style.opacity = '0'
      miniRef.current.style.pointerEvents = 'none'
    }
    settleTimer.current = window.setTimeout(finishSettle, duration + 40)
  }

  const settleMiniReset = () => {
    clearSettleTimer()
    settle.current = null
    const duration = 200
    const transition = `transform ${duration}ms ${snapEasing}, opacity ${duration}ms ${snapEasing}`
    if (miniRef.current) {
      miniRef.current.style.transition = transition
      miniRef.current.style.transform = 'translate3d(0, 0%, 0) scale(1)'
      miniRef.current.style.opacity = '1'
      miniRef.current.style.pointerEvents = 'auto'
    }
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
    const duration = getSwipeTransitionDuration(current, nextTarget, velocityY)
    const transition = `transform ${duration}ms ${snapEasing}, opacity ${duration}ms ${snapEasing}`
    setLayerTransition(transition)

    if (Math.abs(current - nextTarget) < 0.001) {
      finishSettle()
      return
    }

    // Force the browser to commit the drag position before applying the snap
    // target, otherwise the two writes can be coalesced into one frame.
    void fullRef.current?.offsetHeight
    applyProgress(nextTarget)
    settleTimer.current = window.setTimeout(finishSettle, duration + 60)
  }

  const cancelSettle = () => {
    clearSettleTimer()
    settle.current = null
    setLayerTransition('none')
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    cancelSettle()
    const startProgress = progressRef.current
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
        miniRef.current.style.opacity = `${Math.max(0, 1 - dragY / 240)}`
      }
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

    applyProgress(
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
      settleTo(target)
      return
    }

    const target = gesture.opening ? 1 : 0
    setThemeColorActive(target === 1)
    // Prevent the browser from synthesizing a click for the element where the
    // swipe ended. A shell-wide click guard can also swallow the first real
    // control click after the transition completes.
    event?.preventDefault?.()
    settleTo(target, gesture.velocityY, target !== (gesture.opening ? 0 : 1))
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
      event.target === event.currentTarget &&
      event.propertyName === 'transform'
    ) {
      finishSettle()
    }
  }

  const handleOpenRequest = () => {
    setThemeColorActive(true)
    settleTo(1, 0, true)
  }

  useEffect(
    () => () => {
      clearSettleTimer()
      settle.current = null
    },
    [],
  )

  const gestureHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onTransitionEnd: handleTransitionEnd,
  }

  return (
    <div className={classes.shell}>
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
          // Keep the area behind a translucent system status bar aligned with
          // the active theme color while the fullscreen layer is moving.
          background: topColor,
          touchAction: 'none',
          transition: 'none',
        }}
      >
        <AmbientBackdrop
          cover={track.cover}
          color={ambientColor}
          topColor={topColor}
        />
        <PlayerToolbar
          id={track.trackId}
          isRadio={track.isRadio}
          showLove={false}
        />
        <div className={classes.topSection}>
          <div className={classes.headerInfo}>
            <TrackIdentity track={track} mobile />
          </div>
          <div className={classes.artworkSlot}>
            <div className={classes.artwork}>
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
        gestureHandlers={gestureHandlers}
        style={{
          ...getLayerStyle(initialProgress, false),
          touchAction: 'none',
          transition: 'none',
        }}
        snapshot={snapshot}
        commands={commands}
        cover={track.cover}
        ambientColor={ambientColor}
        title={title}
        artist={artist}
        onOpen={handleOpenRequest}
      />
    </div>
  )
}

export default MobilePlayerSurface
