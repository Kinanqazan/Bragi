import { useCallback, useEffect, useRef } from 'react'

const CLICK_SUPPRESSION_MS = 500

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
  const onClick = useCallback((event) => action?.(event), [action])
  return { onClick }
}
