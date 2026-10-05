import { describe, expect, it } from 'vitest'
import { hasTimestampedLyrics, shiftLyricsTimestamps } from './lyricsTiming'

describe('lyrics timing', () => {
  it('shifts all timestamps and leaves metadata and lyric text unchanged', () => {
    expect(shiftLyricsTimestamps(
      '[ti:Track]\n[00:01.00]First\n[00:02.00][00:03.00]Repeat',
      1250,
    )).toBe('[ti:Track]\n[00:02.25]First\n[00:03.25][00:04.25]Repeat')
  })

  it('supports negative shifts and clamps timestamps before the start to zero', () => {
    expect(shiftLyricsTimestamps('[00:01.00]First\n[00:02.00]Second', -1500))
      .toBe('[00:00.00]First\n[00:00.50]Second')
  })

  it('identifies synced lyrics and leaves plain text unchanged', () => {
    expect(hasTimestampedLyrics('[00:01.00]Timed line')).toBe(true)
    expect(hasTimestampedLyrics('Plain line')).toBe(false)
    expect(shiftLyricsTimestamps('Plain line', 1000)).toBe('Plain line')
  })
})
