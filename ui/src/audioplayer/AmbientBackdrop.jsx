import React from 'react'
import { useTheme } from '@material-ui/core/styles'
import { useArtworkColor } from './artworkColor'

// eslint-disable-next-line react-refresh/only-export-components
export const parseRgb = (color) => {
  if (!color) return null
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const num = parseInt(
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex,
      16,
    )
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }
  const match = color.match(/\d+/g)
  return match && match.length >= 3 ? match.slice(0, 3).map(Number) : null
}

// eslint-disable-next-line react-refresh/only-export-components
export const getTopBlendedColor = (
  ambientColor,
  isDark = true,
  fallback = '#1e1e24',
) => {
  const rgb = parseRgb(ambientColor)
  if (!rgb) return fallback
  const [r, g, b] = rgb
  const bg = isDark ? [20, 20, 24] : [245, 245, 245]
  const blend = isDark ? 0.38 : 0.45
  const topR = Math.round(r * blend + bg[0] * (1 - blend))
  const topG = Math.round(g * blend + bg[1] * (1 - blend))
  const topB = Math.round(b * blend + bg[2] * (1 - blend))
  return `rgb(${topR}, ${topG}, ${topB})`
}

const AmbientBackdropView = ({ color, topColor }) => {
  const theme = useTheme()
  const isDark = theme.palette.type === 'dark'
  const computedTopColor =
    topColor ||
    getTopBlendedColor(
      color,
      isDark,
      theme.palette.background?.default || (isDark ? '#1e1e24' : '#fafafa'),
    )

  const overlay = isDark
    ? 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.75) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.6) 100%)'

  return (
    <div
      className="nd-player-ambient-backdrop"
      style={{
        '--nd-player-ambient-color': color || undefined,
        '--nd-player-ambient-top': computedTopColor || undefined,
        '--nd-player-ambient-overlay': overlay,
      }}
      aria-hidden="true"
    />
  )
}

const ExtractedAmbientBackdrop = ({ cover, topColor }) => {
  const color = useArtworkColor(cover)
  return <AmbientBackdropView color={color} topColor={topColor} />
}

const AmbientBackdrop = ({ cover, color, topColor }) =>
  color === undefined ? (
    <ExtractedAmbientBackdrop cover={cover} topColor={topColor} />
  ) : (
    <AmbientBackdropView color={color} topColor={topColor} />
  )

export default AmbientBackdrop
