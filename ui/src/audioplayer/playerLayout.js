export const desktopPlayerDefaultWidth = 480
export const desktopPlayerMinWidth = 420
export const desktopPlayerMaxWidth = 720
export const desktopLibraryMinWidth = 360
export const desktopPlayerBreakpoint = 810
export const desktopPlayerMediaQuery = `@media (min-width: ${desktopPlayerBreakpoint}px)`
export const desktopPlayerWidthProperty = '--nd-player-width'
export const desktopPlayerWidth = `var(${desktopPlayerWidthProperty}, ${desktopPlayerDefaultWidth}px)`

export const clampDesktopPlayerWidth = (width, viewportWidth) => {
  const availableWidth = Number.isFinite(viewportWidth)
    ? viewportWidth - desktopLibraryMinWidth
    : desktopPlayerMaxWidth
  const maximumWidth = Math.max(
    desktopPlayerMinWidth,
    Math.min(desktopPlayerMaxWidth, availableWidth),
  )
  const requestedWidth = Number.isFinite(width)
    ? width
    : desktopPlayerDefaultWidth
  return Math.min(maximumWidth, Math.max(desktopPlayerMinWidth, requestedWidth))
}
