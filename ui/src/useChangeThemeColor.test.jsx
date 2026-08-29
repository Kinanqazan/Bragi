import { act, renderHook } from '@testing-library/react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const themeState = vi.hoisted(() => ({ color: '#111111' }))

vi.mock('./themes/useCurrentTheme', () => ({
  default: () => ({
    palette: {
      type: 'dark',
      ...(themeState.color === undefined
        ? {}
        : { background: { default: themeState.color } }),
    },
  }),
}))

import useChangeThemeColor, {
  normalizeThemeColor,
  useThemeColorOverride,
} from './useChangeThemeColor'

describe('useChangeThemeColor', () => {
  let root

  beforeEach(() => {
    themeState.color = '#111111'
    root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    document.documentElement.style.removeProperty('background-color')
    document.body.style.removeProperty('background-color')
    document
      .querySelectorAll("meta[name='theme-color']")
      .forEach((element) => element.remove())
  })

  afterEach(() => {
    root?.remove()
    document.documentElement.style.removeProperty('background-color')
    document.body.style.removeProperty('background-color')
  })

  it('updates the theme-color meta tag when the theme changes', () => {
    const { rerender, unmount } = renderHook(() => useChangeThemeColor())

    const themeColor = document.querySelector("meta[name='theme-color']")
    expect(themeColor).toHaveAttribute('content', '#111111')

    themeState.color = '#222222'
    rerender()

    expect(themeColor).toHaveAttribute('content', '#222222')
    unmount()
  })

  it('uses the installed app baseline when a dark theme has no explicit background', () => {
    themeState.color = undefined

    const { unmount } = renderHook(() => useChangeThemeColor())

    expect(document.querySelector("meta[name='theme-color']")).toHaveAttribute(
      'content',
      '#303030',
    )
    unmount()
  })

  it('allows a gesture to switch the override synchronously', () => {
    const { result, unmount } = renderHook(() =>
      useThemeColorOverride('#333333', false),
    )
    const themeColor = document.querySelector("meta[name='theme-color']")
    const baseColor = themeColor.getAttribute('content')

    act(() => result.current(true))
    expect(themeColor).toHaveAttribute('content', '#333333')

    act(() => result.current(false))
    expect(themeColor).toHaveAttribute('content', baseColor)
    unmount()
  })

  it('normalizes RGB overrides for native theme-color consumers', () => {
    const { unmount } = renderHook(() =>
      useThemeColorOverride('rgb(67, 18, 15)', true),
    )

    expect(document.querySelector("meta[name='theme-color']")).toHaveAttribute(
      'content',
      normalizeThemeColor('rgb(67, 18, 15)'),
    )
    unmount()
  })

  it('applies the active color to the safe-area document backgrounds', () => {
    const { result, unmount } = renderHook(() => {
      useChangeThemeColor()
      return useThemeColorOverride('#333333', false)
    })

    act(() => result.current(true))

    expect(document.documentElement.style.backgroundColor).toBe(
      'rgb(51, 51, 51)',
    )
    expect(document.body.style.backgroundColor).toBe('rgb(51, 51, 51)')
    expect(root.style.backgroundColor).toBe('rgb(51, 51, 51)')

    act(() => result.current(false))

    expect(document.documentElement.style.backgroundColor).toBe(
      'rgb(17, 17, 17)',
    )
    expect(document.body.style.backgroundColor).toBe('rgb(17, 17, 17)')
    expect(root.style.backgroundColor).toBe('rgb(17, 17, 17)')
    unmount()
  })

  it('resynchronizes the active color when the PWA becomes visible again', () => {
    const { unmount } = renderHook(() => {
      useChangeThemeColor()
      return useThemeColorOverride('#333333', true)
    })
    const themeColor = document.querySelector("meta[name='theme-color']")

    themeColor.setAttribute('content', '#303030')
    window.dispatchEvent(new Event('pageshow'))

    expect(themeColor).toHaveAttribute('content', '#333333')
    unmount()
  })
})
