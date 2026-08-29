import { describe, expect, it } from 'vitest'
import { playerReducer } from './playerReducer'
import {
  addTracks,
  clearQueue,
  currentPlaying,
  playNext,
  playTracks,
  setTrack,
} from '../actions'

const song = (id, title = id) => ({
  id,
  title,
  artist: 'Artist',
  album: 'Album',
  duration: 120,
})

describe('playerReducer', () => {
  it('stores serializable tracks without stream resolver functions', () => {
    const state = playerReducer(undefined, playTracks({ first: song('first') }))
    expect(state.queue).toHaveLength(1)
    expect(state.queue[0]).toMatchObject({ trackId: 'first', title: 'first' })
    expect(Object.keys(state.queue[0])).not.toContain(['music', 'Src'].join(''))
    expect(state.queue[0].song).toEqual(song('first'))
    expect(state.autoPlay).toBe(true)
  })

  it('replaces the queue for Play Now and supports setTrack', () => {
    const first = playerReducer(
      undefined,
      playTracks({ a: song('a'), b: song('b') }),
    )
    const next = playerReducer(first, setTrack(song('c')))
    expect(next.queue.map((track) => track.trackId)).toEqual(['c'])
    expect(next.playIndex).toBe(0)
    expect(next.autoPlay).toBe(true)
  })

  it('keeps the selected numeric ID aligned with string object keys', () => {
    const state = playerReducer(
      undefined,
      playTracks({ 101: song(101), 202: song(202) }, undefined, 202),
    )

    expect(state.playIndex).toBe(1)
  })

  it('adds tracks immutably', () => {
    const first = playerReducer(undefined, playTracks({ a: song('a') }))
    const next = playerReducer(first, addTracks({ b: song('b') }))
    expect(next.queue.map((track) => track.trackId)).toEqual(['a', 'b'])
    expect(next.queue).not.toBe(first.queue)
    expect(first.queue).toHaveLength(1)
  })

  it('inserts Play Next after the current track', () => {
    let state = playerReducer(
      undefined,
      playTracks({ a: song('a'), b: song('b') }),
    )
    state = playerReducer(
      state,
      currentPlaying({ ...state.queue[0], volume: 1 }),
    )
    const next = playerReducer(state, playNext({ c: song('c') }))
    expect(next.queue.map((track) => track.trackId)).toEqual(['a', 'c', 'b'])
  })

  it('clears durable queue state', () => {
    const state = playerReducer(undefined, playTracks({ a: song('a') }))
    const cleared = playerReducer(state, clearQueue())
    expect(cleared.queue).toEqual([])
    expect(cleared.current).toEqual({})
    expect(cleared.clear).toBe(true)
  })
})
