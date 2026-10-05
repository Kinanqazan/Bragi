const timestampPattern = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g

export const shiftLyricsTimestamps = (content, offsetMs) => {
  if (!content || !offsetMs) return content
  const absoluteOffset = Math.abs(offsetMs)
  const offsetPrecision = absoluteOffset % 10 !== 0 ? 3 : absoluteOffset % 100 !== 0 ? 2 : 1
  return content.replace(timestampPattern, (timestamp, minutes, seconds, fraction = '') => {
    const minuteValue = Number(minutes)
    const secondValue = Number(seconds)
    if (secondValue > 59) return timestamp
    const originalFraction = Number((fraction || '').padEnd(3, '0'))
    const adjustedMs = Math.max(
      0,
      minuteValue * 60000 + secondValue * 1000 + originalFraction + offsetMs,
    )
    const adjustedMinutes = Math.floor(adjustedMs / 60000)
    const adjustedSeconds = Math.floor(adjustedMs / 1000) % 60
    const precision = Math.max(fraction.length, offsetPrecision)
    const adjustedFraction = String(adjustedMs % 1000).padStart(3, '0').slice(0, precision)
    return `[${String(adjustedMinutes).padStart(Math.max(2, minutes.length), '0')}:${String(adjustedSeconds).padStart(2, '0')}.${adjustedFraction}]`
  })
}

export const hasTimestampedLyrics = (content) => {
  timestampPattern.lastIndex = 0
  return timestampPattern.test(content || '')
}
