import { useEffect, useState } from 'react'
import { useImageUrl } from '../common/useImageUrl'

const cache = new Map()
const maxCacheSize = 40

const clampLuminance = ([r, g, b]) => {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  if (luminance > 140) {
    const factor = 100 / luminance
    return [
      Math.round(r * factor),
      Math.round(g * factor),
      Math.round(b * factor),
    ]
  }
  return [r, g, b]
}

const formatColor = (channels) => `rgb(${channels.join(', ')})`

const extractDominantColor = (url) =>
  new Promise((resolve) => {
    if (!url || typeof Image === 'undefined') {
      resolve(null)
      return
    }

    const image = new Image()
    if (url.startsWith('http')) {
      image.crossOrigin = 'anonymous'
    }
    image.decoding = 'async'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 24
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        resolve(null)
        return
      }

      try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data
        const chromaticBuckets = new Map()
        const neutralBuckets = new Map()

        for (let index = 0; index < pixels.length; index += 16) {
          if (pixels[index + 3] < 128) continue
          const r = pixels[index] & 0xf0
          const g = pixels[index + 1] & 0xf0
          const b = pixels[index + 2] & 0xf0
          const chroma = Math.max(r, g, b) - Math.min(r, g, b)
          const bucket = `${r},${g},${b}`

          if (chroma >= 24) {
            chromaticBuckets.set(bucket, (chromaticBuckets.get(bucket) || 0) + 1)
          } else {
            neutralBuckets.set(bucket, (neutralBuckets.get(bucket) || 0) + 1)
          }
        }

        const buckets =
          chromaticBuckets.size > 0 ? chromaticBuckets : neutralBuckets
        const dominant = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]

        resolve(
          dominant
            ? formatColor(clampLuminance(dominant[0].split(',').map(Number)))
            : null,
        )
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = url
  })

const getArtworkColor = (url) => {
  if (!url) return Promise.resolve(null)
  if (cache.has(url)) return Promise.resolve(cache.get(url))

  return extractDominantColor(url).then((color) => {
    if (color) {
      cache.set(url, color)
      if (cache.size > maxCacheSize) cache.delete(cache.keys().next().value)
    }
    return color
  })
}

export const useArtworkColor = (url) => {
  const { imgUrl } = useImageUrl(url)
  const resolvedUrl = imgUrl || url
  const [color, setColor] = useState(null)

  useEffect(() => {
    let active = true
    if (!resolvedUrl) {
      setColor(null)
      return () => {
        active = false
      }
    }

    getArtworkColor(resolvedUrl).then((nextColor) => {
      if (active) setColor(nextColor)
    })
    return () => {
      active = false
    }
  }, [resolvedUrl])

  return color
}
