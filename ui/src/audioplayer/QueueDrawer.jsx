import React, { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import SaveOutlinedIcon from '@material-ui/icons/SaveOutlined'
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline'
import PauseIcon from '@material-ui/icons/Pause'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import DragIndicatorIcon from '@material-ui/icons/DragIndicator'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import CloseIcon from '@material-ui/icons/Close'
import { alpha, useTheme } from '@material-ui/core/styles'
import {
  openSaveQueueDialog,
  removeQueuedTrack,
  reorderQueuedTrack,
} from '../actions'
import { Artwork } from '../common/Artwork'
import { useQueueReorder } from './useQueueReorder'
import { MOBILE_BACKGROUND_COLOR } from '../consts'

const QueueDrawer = ({
  queue = [],
  currentIndex = -1,
  snapshot,
  commands,
  onClose,
  onClear,
  mobile = true,
}) => {
  const dispatch = useDispatch()
  const theme = useTheme()
  const drawerRef = useRef(null)
  const listRef = useRef(null)
  const swipeRef = useRef(null)
  const gestureHandlersRef = useRef(null)
  const skipClickRef = useRef(false)
  const closingRef = useRef(false)
  const closeTimerRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const isDark = theme.palette.type === 'dark'
  const playerTextColor =
    !mobile || isDark ? theme.palette.text.primary : '#f5f5f5'
  const playerMutedColor =
    !mobile || isDark
      ? theme.palette.text.secondary
      : 'rgba(255, 255, 255, 0.68)'
  const playbackIntent = Boolean(
    snapshot?.playbackIntent ?? (snapshot?.playing || snapshot?.loading),
  )
  const reorder = useQueueReorder(
    listRef,
    (uuid, beforeUuid) =>
      dispatch(reorderQueuedTrack(uuid, beforeUuid, currentIndex)),
    () => {
      skipClickRef.current = true
    },
  )

  useEffect(() => {
    const previousFocus = document.activeElement
    drawerRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  const handleSwipeStart = (event, nativeTouch = false) => {
    const drawer = drawerRef.current
    if (!drawer || closingRef.current) return
    skipClickRef.current = false
    if (event.target?.closest?.('[data-queue-action]')) return
    if (reorder.start(event)) {
      if (!nativeTouch) drawer.setPointerCapture?.(event.pointerId)
      return
    }
    const row = event.target?.closest?.('[data-queue-row]')
    swipeRef.current = {
      pointerId: event.pointerId,
      nativeTouch,
      startX: event.clientX,
      startY: event.clientY,
      inList: Boolean(listRef.current?.contains(event.target)),
      startScrollTop: listRef.current?.scrollTop || 0,
      mode: null,
      row,
      rowButton: row?.querySelector('[data-queue-track]'),
    }
  }
  const handleSwipeMove = (event) => {
    if (reorder.move(event)) return
    const swipe = swipeRef.current
    const drawer = drawerRef.current
    if (
      !swipe ||
      !drawer ||
      (event.pointerId != null && swipe.pointerId !== event.pointerId)
    )
      return

    const deltaX = event.clientX - swipe.startX
    const deltaY = event.clientY - swipe.startY
    if (!swipe.mode) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) < 12) return
        swipe.mode =
          deltaX > 0 && swipe.row?.dataset.queueId ? 'remove' : 'ignore'
      } else {
        // Keep native list scrolling, including momentum, when there is content
        // above the finger or the list is swiped upward.
        swipe.mode =
          swipe.inList && (!mobile || swipe.startScrollTop > 0 || deltaY < 0)
            ? 'scroll'
            : mobile
              ? 'drag'
              : 'ignore'
      }
      if (swipe.mode === 'drag' || swipe.mode === 'remove') {
        if (swipe.mode === 'drag') {
          drawer.style.animation = 'none'
          drawer.style.transition = 'none'
        } else {
          swipe.row.dataset.swiping = 'true'
          swipe.rowButton.style.transition = 'none'
        }
        skipClickRef.current = true
        if (!swipe.nativeTouch && event.pointerId != null) {
          drawer.setPointerCapture?.(event.pointerId)
        }
      }
    }
    if (swipe.mode === 'ignore') return
    if (swipe.mode === 'scroll') {
      if (!swipe.nativeTouch && listRef.current) {
        listRef.current.scrollTop = swipe.startScrollTop - deltaY
        skipClickRef.current = true
      }
      return
    }

    if (event.cancelable) event.preventDefault()

    if (swipe.mode === 'remove') {
      swipe.rowButton.style.transform = `translate3d(${Math.max(0, deltaX)}px, 0, 0)`
      return
    }

    drawer.style.transform = `translate3d(0, ${Math.max(0, deltaY)}px, 0)`
  }
  const completeClose = () => {
    if (!closingRef.current) return
    closingRef.current = false
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    onClose?.()
  }
  const finishSwipe = (event, cancelled = false) => {
    if (reorder.finish(event, cancelled)) return
    const swipe = swipeRef.current
    const drawer = drawerRef.current
    if (
      !swipe ||
      (!cancelled &&
        event?.pointerId != null &&
        swipe.pointerId !== event.pointerId)
    )
      return

    swipeRef.current = null
    if (swipe.mode === 'remove') {
      if (event.cancelable) event.preventDefault()
      const deltaX = (event.clientX ?? swipe.startX) - swipe.startX
      const width = swipe.row.getBoundingClientRect().width || 320
      swipe.rowButton.style.removeProperty('transition')
      swipe.rowButton.style.removeProperty('transform')
      swipe.row.removeAttribute('data-swiping')
      if (!cancelled && deltaX >= Math.min(96, width * 0.3)) {
        dispatch(
          removeQueuedTrack(
            swipe.row.dataset.queueId,
            currentIndex,
            playbackIntent,
          ),
        )
      }
      return
    }
    if (swipe.mode !== 'drag') return
    if (event.cancelable) event.preventDefault()
    const deltaY = (event?.clientY ?? swipe.startY) - swipe.startY
    const shouldClose = !cancelled && deltaY > 80
    drawer?.style.removeProperty('transition')
    if (shouldClose) {
      closingRef.current = true
      drawer.style.transform = `translate3d(0, ${window.innerHeight}px, 0)`
      closeTimerRef.current = window.setTimeout(completeClose, 260)
      return
    }

    drawer?.style.removeProperty('transform')
  }
  gestureHandlersRef.current = {
    start: handleSwipeStart,
    move: handleSwipeMove,
    finish: finishSwipe,
    completeClose,
  }

  useEffect(() => {
    const drawer = drawerRef.current
    const point = (event) => {
      const touch =
        Array.from(event.changedTouches).find(
          (candidate) => candidate.identifier === swipeRef.current?.pointerId,
        ) || event.changedTouches[0]
      return {
        target: event.target,
        clientX: touch.clientX,
        clientY: touch.clientY,
        pointerId: touch.identifier,
        cancelable: event.cancelable,
        preventDefault: () => event.preventDefault(),
      }
    }
    const start = (event) => {
      if (event.touches.length !== 1) {
        gestureHandlersRef.current.finish(point(event), true)
        return
      }
      gestureHandlersRef.current.start(point(event), true)
    }
    const move = (event) => {
      if (event.touches.length !== 1) {
        gestureHandlersRef.current.finish(point(event), true)
        return
      }
      gestureHandlersRef.current.move(point(event))
    }
    const end = (event) => gestureHandlersRef.current.finish(point(event))
    const cancel = (event) =>
      gestureHandlersRef.current.finish(point(event), true)
    // React's delegated touchmove listener is passive in mobile browsers.
    // This listener can stop browser panning only when the sheet owns the drag.
    drawer.addEventListener('touchstart', start, { passive: true })
    drawer.addEventListener('touchmove', move, { passive: false })
    drawer.addEventListener('touchend', end)
    drawer.addEventListener('touchcancel', cancel)
    return () => {
      drawer.removeEventListener('touchstart', start)
      drawer.removeEventListener('touchmove', move)
      drawer.removeEventListener('touchend', end)
      drawer.removeEventListener('touchcancel', cancel)
      window.clearTimeout(closeTimerRef.current)
    }
  }, [])
  const playing = Boolean(snapshot?.playing)
  const togglePlayback = playing ? commands?.pause : commands?.play
  const currentTrack = snapshot?.currentTrack || queue[currentIndex]

  return (
    <aside
      ref={drawerRef}
      className={`nd-player-queue-drawer${mobile ? '' : ' is-desktop'}`}
      aria-label="Playback queue"
      data-sidebar-swipe-lock="true"
      tabIndex={-1}
      style={{
        color: playerTextColor,
        '--nd-player-surface': mobile
          ? MOBILE_BACKGROUND_COLOR
          : theme.palette.background.paper,
        '--nd-player-text': playerTextColor,
        '--nd-player-muted': playerMutedColor,
        '--nd-player-accent': theme.palette.primary.main,
        '--nd-player-divider': alpha(playerTextColor, 0.12),
        '--nd-player-remove': theme.palette.error.main,
        '--nd-player-remove-tint': alpha(theme.palette.error.main, 0.2),
        '--nd-player-tint': alpha(
          theme.palette.primary.main,
          isDark ? 0.16 : 0.1,
        ),
        '--nd-player-tint-hover': alpha(
          theme.palette.primary.main,
          isDark ? 0.23 : 0.15,
        ),
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.pointerType === 'touch') return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        handleSwipeStart(event)
      }}
      onPointerMove={(event) => {
        event.stopPropagation()
        if (event.pointerType !== 'touch') handleSwipeMove(event)
      }}
      onPointerUp={(event) => {
        event.stopPropagation()
        if (event.pointerType !== 'touch') finishSwipe(event)
      }}
      onPointerCancel={(event) => {
        if (event.pointerType !== 'touch') finishSwipe(event, true)
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerType !== 'touch') finishSwipe(event, true)
      }}
      onClickCapture={(event) => {
        if (!skipClickRef.current || event.detail === 0) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => event.stopPropagation()}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === 'transform'
        ) {
          gestureHandlersRef.current.completeClose()
        }
      }}
    >
      <div
        className="nd-player-queue-drawer-handle"
        aria-hidden="true"
        hidden={!mobile}
      >
        <span />
      </div>
      <div className="nd-player-queue-toolbar" aria-label="Queue controls">
        <div
          className="nd-player-queue-current"
          role="group"
          aria-label="Current song"
        >
          {currentTrack && (
            <>
              <span
                className="nd-player-queue-cover"
                aria-hidden="true"
                onDragStart={(event) => event.preventDefault()}
              >
                <MusicNoteIcon />
                {!currentTrack.isRadio && (
                  <Artwork
                    className="nd-player-queue-artwork"
                    record={
                      currentTrack.song || {
                        ...currentTrack,
                        id: currentTrack.trackId,
                      }
                    }
                    size={84}
                    fit="cover"
                    title=""
                  />
                )}
              </span>
              <span className="nd-player-queue-details">
                <strong>
                  {currentTrack.title ||
                    currentTrack.name ||
                    currentTrack.song?.title ||
                    'Untitled'}
                </strong>
                <small>
                  {currentTrack.artist ||
                    currentTrack.singer ||
                    currentTrack.song?.artist ||
                    ''}
                </small>
              </span>
            </>
          )}
        </div>
        <div className="nd-player-queue-actions" data-queue-action="true">
          {queue.length > 0 && (
            <button
              type="button"
              className="nd-player-queue-action"
              aria-label="Save queue"
              title="Save queue"
              onClick={() => dispatch(openSaveQueueDialog())}
            >
              <SaveOutlinedIcon />
            </button>
          )}
          {onClear && (
            <button
              type="button"
              className="nd-player-queue-action"
              aria-label="Clear queue"
              title="Clear queue"
              onClick={onClear}
            >
              <DeleteOutlineIcon />
            </button>
          )}
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </button>
          {!mobile && (
            <button
              type="button"
              className="nd-player-queue-action"
              aria-label="Close queue"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
      <ol ref={listRef}>
        {queue.map((track, index) => (
          <li
            key={track.uuid || track.trackId || index}
            data-queue-row="true"
            data-queue-id={track.uuid}
          >
            <span className="nd-player-queue-remove-hint" aria-hidden="true">
              <DeleteOutlineIcon />
            </span>
            <div
              data-queue-track="true"
              className={`nd-player-queue-row-content${index === currentIndex ? ' is-current' : ''}`}
            >
              <button
                type="button"
                className="nd-player-queue-song"
                aria-current={index === currentIndex ? 'true' : undefined}
                onClick={() => commands.select(index)}
                onKeyDown={(event) => {
                  if (event.key !== 'Delete' || !track.uuid) return
                  event.preventDefault()
                  dispatch(
                    removeQueuedTrack(track.uuid, currentIndex, playbackIntent),
                  )
                }}
              >
                <span
                  className="nd-player-queue-cover"
                  aria-hidden="true"
                  onDragStart={(event) => event.preventDefault()}
                >
                  <MusicNoteIcon />
                  {!track.isRadio && (
                    <Artwork
                      className="nd-player-queue-artwork"
                      record={track.song || { ...track, id: track.trackId }}
                      size={84}
                      fit="cover"
                      title=""
                    />
                  )}
                </span>
                <span className="nd-player-queue-details">
                  <span>
                    {track.title ||
                      track.name ||
                      track.song?.title ||
                      'Untitled'}
                  </span>
                  <small>
                    {track.artist || track.singer || track.song?.artist || ''}
                  </small>
                </span>
              </button>
              <button
                type="button"
                data-queue-reorder="true"
                className="nd-player-queue-reorder"
                disabled={!track.uuid}
                aria-label={`Reorder ${track.title || track.name || track.song?.title || 'Untitled'}`}
                title="Drag to reorder"
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                    return
                  event.preventDefault()
                  const to = index + (event.key === 'ArrowUp' ? -1 : 1)
                  if (to < 0 || to >= queue.length) return
                  dispatch(
                    reorderQueuedTrack(
                      track.uuid,
                      event.key === 'ArrowUp'
                        ? queue[to].uuid
                        : (queue[to + 1]?.uuid ?? null),
                      currentIndex,
                    ),
                  )
                }}
              >
                <DragIndicatorIcon />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default QueueDrawer
