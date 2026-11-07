import { useEffect, useRef } from 'react'

// Some Android WebViews occasionally omit the click after an otherwise normal
// touch release. Complete selected taps on release and discard the duplicate
// browser click if one follows.
export default function useTouchActivation(selector) {
  const press = useRef(null)
  const suppressClick = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    const onNewPress = () => {
      suppressClick.current = false
      clearTimeout(timer.current)
    }
    const onClick = (event) => {
      if (!suppressClick.current || event.detail === 0) return
      suppressClick.current = false
      clearTimeout(timer.current)
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('pointerdown', onNewPress, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('pointerdown', onNewPress, true)
      clearTimeout(timer.current)
    }
  }, [])

  const onPointerDown = (event) => {
    const target = event.target.closest?.(selector)
    if (event.pointerType !== 'touch' || !event.isPrimary || !target) {
      press.current = null
      return
    }
    press.current = {
      target,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    }
  }

  const onPointerMove = (event) => {
    const start = press.current
    if (
      start &&
      event.pointerId === start.id &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 12
    ) {
      press.current = null
    }
  }

  const onPointerUp = (event) => {
    const start = press.current
    press.current = null
    if (
      !start ||
      event.pointerId !== start.id ||
      event.defaultPrevented ||
      Date.now() - start.time > 500 ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 12 ||
      !start.target.isConnected ||
      !start.target.contains(event.target)
    )
      return
    suppressClick.current = true
    timer.current = setTimeout(() => {
      suppressClick.current = false
    }, 500)
    start.target.click()
  }

  const onPointerCancel = () => {
    press.current = null
  }
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
