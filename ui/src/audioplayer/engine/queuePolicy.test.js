import { describe, expect, it } from 'vitest'
import {
  getNextIndex,
  getPreviousIndex,
  PLAY_MODE_ORDER,
  PLAY_MODE_REPEAT_ALL,
  PLAY_MODE_REPEAT_ONE,
  PLAY_MODE_SHUFFLE,
} from './queuePolicy'

describe('queuePolicy', () => {
  it('advances in order and stops at the end', () => {
    expect(getNextIndex(0, 3, PLAY_MODE_ORDER)).toBe(1)
    expect(getNextIndex(2, 3, PLAY_MODE_ORDER)).toBe(-1)
  })

  it('repeats the queue or current track according to mode', () => {
    expect(getNextIndex(2, 3, PLAY_MODE_REPEAT_ALL)).toBe(0)
    expect(getNextIndex(1, 3, PLAY_MODE_REPEAT_ONE)).toBe(1)
    expect(getPreviousIndex(0, 3, PLAY_MODE_REPEAT_ALL)).toBe(2)
  })

  it('allows manual navigation to leave repeat-one mode', () => {
    expect(
      getNextIndex({
        currentIndex: 1,
        length: 3,
        mode: PLAY_MODE_REPEAT_ONE,
        manual: true,
      }),
    ).toBe(2)
    expect(
      getPreviousIndex({
        currentIndex: 1,
        length: 3,
        mode: PLAY_MODE_REPEAT_ONE,
        manual: true,
      }),
    ).toBe(0)
  })

  it('does not select the current track in shuffle mode when alternatives exist', () => {
    expect(getNextIndex(1, 3, PLAY_MODE_SHUFFLE, () => 0)).toBe(0)
    expect(getPreviousIndex(1, 3, PLAY_MODE_SHUFFLE, () => 0.99)).toBe(2)
  })
})
