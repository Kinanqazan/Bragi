import React, { useCallback, useEffect, useRef, useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import {
  clampDesktopPlayerWidth,
  desktopPlayerDefaultWidth,
  desktopPlayerMaxWidth,
  desktopPlayerMinWidth,
  desktopPlayerWidthProperty,
} from './playerLayout'

const useStyles = makeStyles((theme) => ({
  resizeHandle: {
    position: 'fixed',
    top: 0,
    right: 'var(--nd-player-width, 480px)',
    bottom: 0,
    zIndex: 1001,
    display: (props) => (props.visible ? 'block' : 'none'),
    width: 12,
    padding: 0,
    background: 'transparent',
    border: 0,
    cursor: 'col-resize',
    touchAction: 'none',
    transform: 'translateX(50%)',
    willChange: 'right',
    '&::after': {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '50%',
      width: 2,
      background: theme.palette.divider,
      content: '""',
      opacity: 0.65,
      transform: 'translateX(-50%)',
      transition: 'width 0.15s ease, background-color 0.15s ease',
    },
    '&:hover::after, &:focus-visible::after': {
      width: 4,
      background: theme.palette.primary.main,
      opacity: 1,
    },
    '&:focus-visible': { outline: 'none' },
    [theme.breakpoints.down('sm')]: { display: 'none' },
  },
}))

const storageKey = 'desktopPlayerWidth'

const readStoredWidth = () => {
  try {
    const storedWidth = Number.parseInt(localStorage.getItem(storageKey), 10)
    return clampDesktopPlayerWidth(storedWidth, window.innerWidth)
  } catch {
    return clampDesktopPlayerWidth(desktopPlayerDefaultWidth, window.innerWidth)
  }
}

const DesktopPlayerResizeHandle = ({ visible }) => {
  const classes = useStyles({ visible })
  const [width, setWidth] = useState(readStoredWidth)
  const stopResizeRef = useRef(null)
  const rafRef = useRef(null)
  const latestWidthRef = useRef(width)

  useEffect(() => {
    document.documentElement.style.setProperty(
      desktopPlayerWidthProperty,
      `${width}px`,
    )
    document.documentElement.style.setProperty(
      '--nd-player-offset',
      visible ? `${width}px` : '0px',
    )
    latestWidthRef.current = width
    try {
      localStorage.setItem(storageKey, String(width))
    } catch {
      // The visual resize still works if browser storage is unavailable.
    }
  }, [width, visible])

  useEffect(() => {
    const handleWindowResize = () =>
      setWidth((currentWidth) =>
        clampDesktopPlayerWidth(currentWidth, window.innerWidth),
      )
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  useEffect(() => () => {
    stopResizeRef.current?.()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    document.documentElement.style.setProperty('--nd-player-offset', '0px')
  }, [])

  const applyWidthFast = useCallback(
    (clientX) => {
      const nextWidth = clampDesktopPlayerWidth(
        window.innerWidth - clientX,
        window.innerWidth,
      )
      latestWidthRef.current = nextWidth
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        document.documentElement.style.setProperty(
          desktopPlayerWidthProperty,
          `${nextWidth}px`,
        )
        document.documentElement.style.setProperty(
          '--nd-player-offset',
          visible ? `${nextWidth}px` : '0px',
        )
      })
    },
    [visible],
  )

  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault()
      stopResizeRef.current?.()
      applyWidthFast(event.clientX)

      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.body.classList.add('is-resizing')

      const handlePointerMove = (moveEvent) =>
        applyWidthFast(moveEvent.clientX)

      const stopResize = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', stopResize)
        window.removeEventListener('pointercancel', stopResize)
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        document.body.classList.remove('is-resizing')
        stopResizeRef.current = null

        const finalWidth = latestWidthRef.current
        document.documentElement.style.setProperty(
          desktopPlayerWidthProperty,
          `${finalWidth}px`,
        )
        setWidth(finalWidth)
      }

      stopResizeRef.current = stopResize
      window.addEventListener('pointermove', handlePointerMove, { passive: true })
      window.addEventListener('pointerup', stopResize)
      window.addEventListener('pointercancel', stopResize)
    },
    [applyWidthFast],
  )

  const handleKeyDown = useCallback((event) => {
    const adjustments = {
      ArrowLeft: 24,
      ArrowRight: -24,
      Home: Number.NEGATIVE_INFINITY,
      End: Number.POSITIVE_INFINITY,
    }
    if (!(event.key in adjustments)) return
    event.preventDefault()
    setWidth((currentWidth) => {
      const adjustment = adjustments[event.key]
      const requestedWidth = Number.isFinite(adjustment)
        ? currentWidth + adjustment
        : adjustment < 0
          ? desktopPlayerMinWidth
          : desktopPlayerMaxWidth
      return clampDesktopPlayerWidth(requestedWidth, window.innerWidth)
    })
  }, [])

  return (
    <div
      aria-label="Resize player"
      aria-orientation="vertical"
      aria-valuemax={desktopPlayerMaxWidth}
      aria-valuemin={desktopPlayerMinWidth}
      aria-valuenow={width}
      className={classes.resizeHandle}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={visible ? 0 : -1}
      title="Drag to resize player"
    />
  )
}

export default DesktopPlayerResizeHandle
