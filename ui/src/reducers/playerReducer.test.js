import { describe, expect, it } from 'vitest'
import { playerReducer } from './playerReducer'
import {
  addTracks,
  clearQueue,
  currentPlaying,
  playNext,
  playTracks,
  setTrack,
  updateTrackMetadata,
  removeQueuedTrack,
} from '../actions'

const song = (id, title = id) => ({
  id,
  title,
  artist: 'Artist',
  album: 'Album',
  duration: 120,
})

describe('playerReducer', () => {
  it('reorders repeated entries by queue identity while preserving the active song', async () => {
    const { reorderQueuedTrack } = await import('../actions')
    let state = playerReducer(
      undefined,
      playTracks({ a: song('a'), b: song('b') }, ['a', 'a', 'b'], 'b'),
    )
    state = playerReducer(state, currentPlaying(state.queue[2]))
    const next = playerReducer(
      state,
      reorderQueuedTrack(state.queue[2].uuid, state.queue[0].uuid, 2),
    )
    expect(next.queue.map((track) => track.uuid)).toEqual([
      state.queue[2].uuid,
      state.queue[0].uuid,
      state.queue[1].uuid,
    ])
    expect(next.current).toBe(state.current)
    expect(next.savedPlayIndex).toBe(0)
    expect(next.playIndex).toBeUndefined()
    expect(next.autoPlay).toBe(false)
    expect(playerReducer(next, reorderQueuedTrack('stale', null, 0))).toBe(next)
    expect(
      playerReducer(next, reorderQueuedTrack(next.queue[0].uuid, 'stale', 0)),
    ).toBe(next)
  })

  it('reindexes a pending play request when moving an earlier entry', async () => {
    const { reorderQueuedTrack } = await import('../actions')
    const state = playerReducer(
      undefined,
      playTracks({ a: song('a'), b: song('b') }, undefined, 'b'),
    )
    const next = playerReducer(
      state,
      reorderQueuedTrack(state.queue[0].uuid, null, 0),
    )
    expect(next.queue.map((track) => track.trackId)).toEqual(['b', 'a'])
    expect(next.playIndex).toBe(0)
    expect(next.autoPlay).toBe(true)
  })
  it('removes only the swiped occurrence of a repeated song and reindexes the current entry', () => {
    let state = playerReducer(
      undefined,
      playTracks({ a: song('a'), b: song('b') }, ['a', 'a', 'b'], 'b'),
    )
    state = playerReducer(state, currentPlaying(state.queue[2]))
    const next = playerReducer(
      state,
      removeQueuedTrack(state.queue[0].uuid, 2, true),
    )
    expect(next.queue.map((track) => track.uuid)).toEqual([
      state.queue[1].uuid,
      state.queue[2].uuid,
    ])
    expect(next.current.uuid).toBe(state.current.uuid)
    expect(next.savedPlayIndex).toBe(1)
    expect(next.playIndex).toBeUndefined()
    expect(next.autoPlay).toBe(false)
    expect(
      playerReducer(next, removeQueuedTrack(state.queue[0].uuid, 1, true)),
    ).toBe(next)
  })

  it.each([true, false])(
    'removes the current song and preserves playing=%s for its successor',
    (playing) => {
      const state = playerReducer(
        undefined,
        playTracks(
          { a: song('a'), b: song('b'), c: song('c') },
          undefined,
          'b',
        ),
      )
      const next = playerReducer(
        state,
        removeQueuedTrack(state.queue[1].uuid, 1, playing),
      )
      expect(next.queue.map((track) => track.trackId)).toEqual(['a', 'c'])
      expect(next.playIndex).toBe(1)
      expect(next.autoPlay).toBe(playing)
      expect(next.current).toEqual({})
    },
  )

  it('removes the final queue item without resetting player preferences', () => {
    const state = {
      ...playerReducer(undefined, setTrack(song('a'))),
      volume: 0.42,
      mode: 'shuffle',
    }
    const next = playerReducer(
      state,
      removeQueuedTrack(state.queue[0].uuid, 0, true),
    )
    expect(next).toMatchObject({
      queue: [],
      current: {},
      autoPlay: false,
      volume: 0.42,
      mode: 'shuffle',
    })
    expect(next.playIndex).toBeUndefined()
  })
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

  it('updates matching queued and current song metadata without changing track identity', () => {
    let state = playerReducer(
      undefined,
      playTracks({ a: song('a'), b: song('b') }),
    )
    state = playerReducer(
      state,
      currentPlaying({ ...state.queue[0], volume: 1 }),
    )
    const firstUuid = state.queue[0].uuid
    const next = playerReducer(
      state,
      updateTrackMetadata({ id: 'a', title: 'Renamed', artist: 'New Artist' }),
    )

    expect(next.queue[0]).toMatchObject({
      uuid: firstUuid,
      trackId: 'a',
      title: 'Renamed',
      artist: 'New Artist',
      song: { id: 'a', title: 'Renamed', artist: 'New Artist' },
    })
    expect(next.current).toMatchObject({
      uuid: firstUuid,
      title: 'Renamed',
      artist: 'New Artist',
      song: { id: 'a', title: 'Renamed', artist: 'New Artist' },
    })
    expect(next.queue[1]).toEqual(state.queue[1])
    expect(next.playIndex).toBe(state.playIndex)
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
