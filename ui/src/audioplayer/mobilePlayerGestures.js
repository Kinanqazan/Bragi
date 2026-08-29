export const swipeThreshold = 48
export const gestureIntentThreshold = 6

export const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

export const getVerticalSwipeOffset = (start, end) => {
  const deltaX = end.clientX - start.clientX
  const deltaY = end.clientY - start.clientY
  return Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : 0
}

export const getSwipeProgress = (startProgress, deltaY, viewportHeight) => {
  const height = Math.max(1, viewportHeight || 1)
  return clamp(startProgress - deltaY / height)
}

export const getSwipeTransitionDuration = (progress, target, velocityY = 0) => {
  const distance = Math.abs(target - progress)
  const speed = Math.min(1, Math.abs(velocityY) * 2)
  return Math.round(180 + distance * 180 - speed * 35)
}
