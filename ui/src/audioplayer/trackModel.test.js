import { describe, expect, it } from 'vitest'
import { formatLyrics } from './trackModel'

describe('formatLyrics', () => {
  it('keeps plain unsynchronized lyrics for the player', () => {
    expect(
      formatLyrics([
        {
          kind: 'main',
          synced: false,
          line: [{ value: 'First line' }, { value: 'Second line' }],
        },
      ]),
    ).toBe('First line\nSecond line')
  })

  it('formats synchronized lyric timestamps for highlighting', () => {
    expect(
      formatLyrics([
        {
          kind: 'main',
          synced: true,
          line: [{ start: 10250, value: 'Timed line' }],
        },
      ]),
    ).toBe('[00:10.25] Timed line')
  })

  it('prefers the main lyric when the resolver returns multiple kinds', () => {
    expect(
      formatLyrics([
        { kind: 'translation', synced: false, line: [{ value: 'Translation' }] },
        { kind: 'main', synced: false, line: [{ value: 'Main' }] },
      ]),
    ).toBe('Main')
  })
})
