import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

// Opening can start sooner; menu links still need room for ordinary finger drift.
const openingIntentThreshold = 6
const intentThreshold = 12
export const mobileSidebarWidth = 82
const clamp = (value) => Math.max(0, Math.min(1, value))
const snapEasing = 'cubic-bezier(0.22, 1, 0.36, 1)'
const sidebarSwipeLocked = () =>
  Boolean(document.querySelector('[data-sidebar-swipe-lock="true"]'))

const ownsHorizontalGesture = (target, allowedCarousel = null) => {
  if (
    target?.closest?.(
      'input, textarea, select, [contenteditable="true"], [role="slider"], .nd-artwork-carousel, [data-sidebar-swipe-ignore]',
    )
  ) {
    return true
  }
  for (
    let node = target;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (
      node !== allowedCarousel &&
      node.scrollWidth > node.clientWidth + 1 &&
      /auto|scroll/.test(window.getComputedStyle(node).overflowX)
    ) {
      return true
    }
  }
  return false
}

// Move the drawer and app together without rendering the song list on each move.
export default function useSidebarSwipe(open, onChange) {
  const paperRef = useRef(null)
  const progressRef = useRef(open ? 1 : 0)
  const targetRef = useRef(open ? 1 : 0)
  const openRef = useRef(open)
  const gestureRef = useRef(null)
  const frameRef = useRef(null)
  const timerRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [present, setPresent] = useState(open)
  const [dragging, setDragging] = useState(false)

  const stopAnimation = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const applyProgress = useCallback((progress) => {
    progressRef.current = clamp(progress)
    const paper = paperRef.current
    if (paper) {
      paper.style.transform = `translate3d(${(progressRef.current - 1) * 100}%, 0, 0)`
      const app = document.getElementById('root')
      if (app) {
        app.style.transform = `translate3d(${progressRef.current * mobileSidebarWidth}vw, 0, 0)`
      }
    }
  }, [])

  const readProgress = useCallback(() => {
    const paper = paperRef.current
    if (!paper) return progressRef.current
    const matrix = window
      .getComputedStyle(paper)
      .transform.match(/^matrix(3d)?\((.+)\)$/)
    if (!matrix) return progressRef.current
    const values = matrix[2].split(',').map(Number)
    const translateX = values[matrix[1] ? 12 : 4]
    return clamp(1 + translateX / (paper.getBoundingClientRect().width || 240))
  }, [])

  const settleTo = useCallback(
    (target, velocity = 0) => {
      const progress = readProgress()
      stopAnimation()
      targetRef.current = target
      setDragging(false)
      const reducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      const duration = reducedMotion
        ? 0
        : Math.round(
            100 +
              Math.abs(target - progress) * 80 -
              Math.min(1, Math.abs(velocity)) * 30,
          )
      if (target || progress > 0) setPresent(true)
      if (paperRef.current) {
        paperRef.current.style.transition = `transform ${duration}ms ${snapEasing}`
      }
      const app = document.getElementById('root')
      if (app) app.style.transition = `transform ${duration}ms ${snapEasing}`
      applyProgress(target)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (!target) setPresent(false)
        if (paperRef.current) paperRef.current.style.willChange = ''
        if (app && !target) {
          app.style.removeProperty('transform')
          app.style.removeProperty('transition')
        }
      }, duration)
    },
    [applyProgress, readProgress, stopAnimation],
  )

  useLayoutEffect(() => {
    openRef.current = open
    if (targetRef.current !== Number(open)) {
      gestureRef.current = null
      settleTo(Number(open))
    }
  }, [open, settleTo])

  useLayoutEffect(() => {
    if (progressRef.current) applyProgress(progressRef.current)
    return () => {
      const app = document.getElementById('root')
      if (app) {
        app.style.removeProperty('transform')
        app.style.removeProperty('transition')
      }
    }
  }, [applyProgress])

  useEffect(() => {
    const cancelGesture = () => {
      const gesture = gestureRef.current
      gestureRef.current = null
      if (gesture?.claimed) settleTo(Number(openRef.current))
    }

    const handleDown = (event, allowedCarousel = null) => {
      // A fresh press must always be able to click immediately after a swipe.
      suppressClickRef.current = false
      if (
        event.pointerType === 'touch' &&
        event.target.closest?.('[data-sidebar-swipe-at-start]')
      ) return
      if (gestureRef.current) {
        cancelGesture()
        return
      }
      if (sidebarSwipeLocked()) return
      if (
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0)
      )
        return
      const paper = paperRef.current
      const inDrawer = paper?.contains(event.target)
      if (
        ownsHorizontalGesture(event.target, allowedCarousel) ||
        (!inDrawer &&
          event.target.closest?.(
            '[role="dialog"], [role="menu"], .MuiPopover-root',
          ))
      )
        return
      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastTime: performance.now(),
        velocity: 0,
        startProgress: readProgress(),
        width: paper.getBoundingClientRect().width || 240,
        claimed: false,
      }
    }

    const handleMove = (event) => {
      if (event.pointerType === 'touch' && carouselTouch != null) return
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      if (sidebarSwipeLocked()) {
        cancelGesture()
        return
      }
      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      if (!gesture.claimed) {
        const clearOpeningSwipe =
          gesture.startProgress <= 0 &&
          dx >= openingIntentThreshold &&
          dx > Math.abs(dy) * 1.5
        if (
          !clearOpeningSwipe &&
          Math.max(Math.abs(dx), Math.abs(dy)) < intentThreshold
        ) return
        if (
          Math.abs(dy) >= Math.abs(dx) ||
          (gesture.startProgress <= 0 && dx < 0) ||
          (gesture.startProgress >= 1 && dx > 0)
        ) {
          gestureRef.current = null
          return
        }
        gesture.claimed = true
        stopAnimation()
        setPresent(true)
        setDragging(true)
        paperRef.current.style.transition = 'none'
        paperRef.current.style.willChange = 'transform'
        const app = document.getElementById('root')
        if (app) {
          app.style.transition = 'none'
        }
      }
      event.preventDefault()
      const now = performance.now()
      const elapsed = now - gesture.lastTime
      if (elapsed > 0) {
        gesture.velocity = (event.clientX - gesture.lastX) / elapsed
      }
      gesture.lastX = event.clientX
      gesture.lastTime = now
      const nextProgress = gesture.startProgress + dx / gesture.width
      progressRef.current = clamp(nextProgress)
      // Reverse immediately at either edge, even after dragging past its limit.
      if (nextProgress < 0 || nextProgress > 1) {
        gesture.startProgress = progressRef.current
        gesture.startX = event.clientX
      }
      if (frameRef.current == null) {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null
          applyProgress(progressRef.current)
        })
      }
    }

    const handleUp = (event) => {
      if (event.pointerType === 'touch' && carouselTouch != null) return
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      if (sidebarSwipeLocked()) {
        cancelGesture()
        return
      }
      gestureRef.current = null
      if (!gesture.claimed) return
      event.preventDefault()
      suppressClickRef.current = true
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      applyProgress(progressRef.current)
      // Pausing before release cancels the flick, so a small held swipe snaps back.
      const velocity =
        performance.now() - gesture.lastTime < 100 ? gesture.velocity : 0
      const target =
        Math.abs(velocity) >= 0.45
          ? Number(velocity > 0)
          : Number(progressRef.current >= 0.5)
      settleTo(target, velocity)
      if (Boolean(target) !== openRef.current) onChange(Boolean(target))
    }

    const handleCancel = (event) => {
      if (event.pointerType === 'touch' && carouselTouch != null) return
      if (gestureRef.current?.pointerId === event.pointerId) {
        if (gestureRef.current.claimed) {
          suppressClickRef.current = true
        }
        cancelGesture()
      }
    }

    const handleClick = (event) => {
      if (!suppressClickRef.current || event.detail === 0) return
      suppressClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
    }

    // Native touch scrolling normally cancels pointer events. At the start of
    // opted-in carousels, use a non-passive touch listener so a right swipe can
    // be claimed before the browser starts horizontal scrolling.
    let carouselTouch = null
    const handleCarouselTouch = (event) => {
      if (event.type === 'touchstart') {
        if (event.touches.length !== 1) {
          if (carouselTouch != null) cancelGesture()
          carouselTouch = null
          return
        }
        const carousel = event.target.closest?.('[data-sidebar-swipe-at-start]')
        if (!carousel || carousel.scrollLeft > 1 || openRef.current) return
        const touch = event.changedTouches[0]
        carouselTouch = touch.identifier
        handleDown(touchPoint(event, touch), carousel)
        if (!gestureRef.current) carouselTouch = null
        return
      }
      if (carouselTouch == null) return
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === carouselTouch,
      )
      if (!touch) return
      const point = touchPoint(event, touch)
      if (event.type === 'touchmove') {
        const gesture = gestureRef.current
        if (gesture && !gesture.claimed) {
          const dx = touch.clientX - gesture.startX
          const dy = touch.clientY - gesture.startY
          if (dx >= 6 && dx > Math.abs(dy) * 1.5) event.preventDefault()
        }
        handleMove(point)
      } else {
        carouselTouch = null
        if (event.type === 'touchcancel') handleCancel(point)
        else handleUp(point)
      }
    }
    const touchPoint = (event, touch) => ({
      pointerId: touch.identifier,
      clientX: touch.clientX,
      clientY: touch.clientY,
      target: event.target,
      preventDefault: () => event.preventDefault(),
    })
    const handlePointerDown = (event) => handleDown(event)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handleMove, {
      capture: true,
      passive: false,
    })
    document.addEventListener('pointerup', handleUp, true)
    document.addEventListener('pointercancel', handleCancel, true)
    document.addEventListener('click', handleClick, true)
    const touchTypes = ['touchstart', 'touchmove', 'touchend', 'touchcancel']
    touchTypes.forEach((type) =>
      document.addEventListener(type, handleCarouselTouch, {
        capture: true,
        passive: type === 'touchstart' || type === 'touchcancel',
      }),
    )
    window.addEventListener('blur', cancelGesture)
    window.addEventListener('resize', cancelGesture)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handleMove, true)
      document.removeEventListener('pointerup', handleUp, true)
      document.removeEventListener('pointercancel', handleCancel, true)
      document.removeEventListener('click', handleClick, true)
      touchTypes.forEach((type) =>
        document.removeEventListener(type, handleCarouselTouch, true),
      )
      window.removeEventListener('blur', cancelGesture)
      window.removeEventListener('resize', cancelGesture)
      stopAnimation()
    }
  }, [applyProgress, onChange, readProgress, settleTo, stopAnimation])

  return { paperRef, present, dragging }
}
