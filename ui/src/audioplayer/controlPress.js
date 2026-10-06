import { useCallback, useEffect, useRef } from 'react'

const CLICK_SUPPRESSION_MS = 500
const LINK_MOVE_TOLERANCE = 8

export const useImmediateControlPress = (command, stopPropagation = false) => {
  const options =
    stopPropagation && typeof stopPropagation === 'object'
      ? stopPropagation
      : { stopPropagation: Boolean(stopPropagation) }
  const shouldStopPropagation = Boolean(options.stopPropagation)
  const shouldBlurOnPointerUp = options.blurOnPointerUp !== false
  const shouldBlurOnClick = options.blurOnClick !== false
  const shouldPreventDefaultOnClick = Boolean(options.preventDefaultOnClick)
  const skipClickRef = useRef(false)
  const resetTimerRef = useRef(null)

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (event) => {
      if (shouldStopPropagation) event.stopPropagation()
      skipClickRef.current = false
      clearResetTimer()
    },
    [clearResetTimer, shouldStopPropagation],
  )

  const onPointerUp = useCallback(
    (event) => {
      if (shouldStopPropagation) event.stopPropagation()
      if (event.pointerType === 'mouse') return

      event.preventDefault()
      if (shouldBlurOnPointerUp) event.currentTarget?.blur?.()
      skipClickRef.current = true
      clearResetTimer()
      resetTimerRef.current = window.setTimeout(() => {
        skipClickRef.current = false
        resetTimerRef.current = null
      }, CLICK_SUPPRESSION_MS)
      command?.()
    },
    [
      clearResetTimer,
      command,
      shouldBlurOnPointerUp,
      shouldStopPropagation,
    ],
  )

  const onClick = useCallback(
    (event) => {
      if (shouldStopPropagation) event?.stopPropagation?.()
      if (shouldBlurOnClick) event?.currentTarget?.blur?.()
      if (shouldPreventDefaultOnClick) event?.preventDefault?.()
      if (skipClickRef.current) {
        skipClickRef.current = false
        clearResetTimer()
        return
      }
      command?.()
    },
    [
      clearResetTimer,
      command,
      shouldBlurOnClick,
      shouldPreventDefaultOnClick,
      shouldStopPropagation,
    ],
  )

  useEffect(
    () => () => {
      clearResetTimer()
    },
    [clearResetTimer],
  )

  return { onClick, onPointerDown, onPointerUp }
}

export const useImmediateLinkPress = (action) => {
  const pointerRef = useRef(null)
  const pendingClickRef = useRef(null)
  const resetTimerRef = useRef(null)

  const clearPendingClick = useCallback(() => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    pendingClickRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (event) => {
      clearPendingClick()
      if (event.pointerType === 'mouse') {
        pointerRef.current = null
        return
      }
      pointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      }
    },
    [clearPendingClick],
  )

  const onPointerMove = useCallback((event) => {
    const pointer = pointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    if (
      Math.abs(event.clientX - pointer.x) > LINK_MOVE_TOLERANCE ||
      Math.abs(event.clientY - pointer.y) > LINK_MOVE_TOLERANCE
    ) {
      pointer.moved = true
    }
  }, [])

  const onPointerUp = useCallback(
    (event) => {
      const pointer = pointerRef.current
      pointerRef.current = null
      if (
        event.pointerType === 'mouse' ||
        !pointer ||
        pointer.pointerId !== event.pointerId ||
        pointer.moved
      ) {
        return
      }

      if (action) event.immediateLinkActionHandled = true
      action?.(event)
      pendingClickRef.current = { prevented: event.defaultPrevented }
      resetTimerRef.current = window.setTimeout(clearPendingClick, CLICK_SUPPRESSION_MS)
    },
    [action, clearPendingClick],
  )

  const onClick = useCallback(
    (event) => {
      const pending = pendingClickRef.current
      if (pending) {
        clearPendingClick()
        if (pending.prevented) event.preventDefault()
        return
      }
      action?.(event)
    },
    [action, clearPendingClick],
  )

  useEffect(
    () => () => {
      clearPendingClick()
      pointerRef.current = null
    },
    [clearPendingClick],
  )

  return { onPointerDown, onPointerMove, onPointerUp, onClick }
}
