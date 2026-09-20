import { useCallback, useEffect, useRef } from 'react'

const CLICK_SUPPRESSION_MS = 500

export const useImmediateControlPress = (command, stopPropagation = false) => {
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
      if (stopPropagation) event.stopPropagation()
    },
    [stopPropagation],
  )

  const onPointerUp = useCallback(
    (event) => {
      if (stopPropagation) event.stopPropagation()
      if (event.pointerType === 'mouse') return

      event.preventDefault()
      event.currentTarget?.blur?.()
      skipClickRef.current = true
      clearResetTimer()
      resetTimerRef.current = window.setTimeout(() => {
        skipClickRef.current = false
        resetTimerRef.current = null
      }, CLICK_SUPPRESSION_MS)
      command?.()
    },
    [clearResetTimer, command, stopPropagation],
  )

  const onClick = useCallback(
    (event) => {
      event?.currentTarget?.blur?.()
      if (skipClickRef.current) {
        skipClickRef.current = false
        clearResetTimer()
        return
      }
      command?.()
    },
    [clearResetTimer, command],
  )

  useEffect(
    () => () => {
      clearResetTimer()
    },
    [clearResetTimer],
  )

  return { onClick, onPointerDown, onPointerUp }
}
