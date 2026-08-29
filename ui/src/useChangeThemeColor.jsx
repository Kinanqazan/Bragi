import { useCallback, useLayoutEffect, useRef } from 'react'
import { createTheme } from '@material-ui/core/styles'
import useCurrentTheme from './themes/useCurrentTheme'

// Keep the browser/PWA baseline aligned with the default Material UI dark
// background and the manifest theme color. Fullscreen playback can override
// this synchronously while the player is visible.
let currentBaseColor = '#303030'
const overrideColors = new Map()

const getThemeColorElement = () =>
  document.querySelector("meta[name='theme-color']")

const ensureThemeColorElement = () => {
  let themeColor = getThemeColorElement()
  if (!themeColor) {
    themeColor = document.createElement('meta')
    themeColor.setAttribute('name', 'theme-color')
    document.head.appendChild(themeColor)
  }
  return themeColor
}

const lastColor = (colors) => [...colors.values()].pop()

// Native standalone shells consistently accept opaque hexadecimal theme
// colors. Keep CSS surfaces free to use rgb(), but normalize the value written
// to the browser/PWA theme-color metadata.
export const normalizeThemeColor = (color) => {
  if (typeof color !== 'string') return color
  const match = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)
  if (!match) return color

  return (
    '#' +
    match
      .slice(1, 4)
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('')
  )
}

const getDocumentBackgroundTargets = () =>
  [
    document.documentElement,
    document.body,
    document.getElementById('root'),
  ].filter(Boolean)

const syncDocumentBackground = (color) => {
  getDocumentBackgroundTargets().forEach((element) => {
    // !important keeps the safe-area backing color in place when the theme
    // hook reapplies its normal body background in a passive effect.
    element.style.setProperty('background-color', color, 'important')
  })
}

const syncThemeColor = () => {
  const color = normalizeThemeColor(
    lastColor(overrideColors) || currentBaseColor,
  )
  if (!color) return

  syncDocumentBackground(color)
  const themeColors = document.querySelectorAll("meta[name='theme-color']")
  if (themeColors.length === 0) {
    ensureThemeColorElement().setAttribute('content', color)
    return
  }
  themeColors.forEach((themeColor) => themeColor.setAttribute('content', color))
}

const useChangeThemeColor = () => {
  const themeConfig = useCurrentTheme()

  useLayoutEffect(() => {
    try {
      const muiTheme = createTheme(themeConfig)
      const color = muiTheme.palette?.background?.default
      if (color) {
        currentBaseColor = color
        syncThemeColor()
      }
    } catch {
      // ignore
    }
  }, [themeConfig])

  // Standalone PWA hosts can restore their launch theme after a page is
  // resumed. Re-apply the active override so returning to the app does not
  // leave the notch/status-bar on the manifest's static color.
  useLayoutEffect(() => {
    const resync = () => syncThemeColor()
    window.addEventListener('pageshow', resync)
    window.addEventListener('focus', resync)
    document.addEventListener('visibilitychange', resync)
    return () => {
      window.removeEventListener('pageshow', resync)
      window.removeEventListener('focus', resync)
      document.removeEventListener('visibilitychange', resync)
    }
  }, [])
}

export const useThemeColorOverride = (overrideColor, active = true) => {
  const colorRef = useRef(overrideColor)
  const keyRef = useRef(Symbol('theme-color-override'))
  colorRef.current = overrideColor

  const setActive = useCallback((nextActive) => {
    if (nextActive && colorRef.current) {
      overrideColors.set(keyRef.current, colorRef.current)
    } else {
      overrideColors.delete(keyRef.current)
    }
    syncThemeColor()
  }, [])

  useLayoutEffect(() => {
    setActive(active)
    return () => setActive(false)
  }, [active, overrideColor, setActive])

  return setActive
}

export default useChangeThemeColor
