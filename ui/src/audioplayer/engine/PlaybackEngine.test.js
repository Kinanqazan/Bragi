import { describe, expect, it, vi } from 'vitest'
import {
  createMemoryAudioElementAdapter,
  createPlaybackEngine,
  PLAYBACK_START_TIMEOUT_MS,
  STREAM_RESOLUTION_TIMEOUT_MS,
} from './index'

const tracks = [
  { uuid: 'a', trackId: 'song-a', title: 'A' },
  { uuid: 'b', trackId: 'song-b', title: 'B' },
  { uuid: 'c', trackId: 'song-c', title: 'C' },
]

const makeEngine = (options = {}) => {
  const audio = options.audio || createMemoryAudioElementAdapter()
  const resolveStreamUrl =
    options.resolveStreamUrl ||
    vi.fn(async (track) => `stream:${track.trackId}`)
  const engine = createPlaybackEngine({
    audio,
    resolveStreamUrl,
    fallbackStreamUrl: options.fallbackStreamUrl,
    reportPlayback: options.reportPlayback,
    random: () => 0,
  })
  return { audio, engine, resolveStreamUrl }
}

describe('PlaybackEngine', () => {
  it('loads and plays the selected track', async () => {
    const { audio, engine } = makeEngine()
    const listener = vi.fn()
    engine.subscribe(listener)

    await engine.setQueue(tracks, 1, { autoplay: true })

    expect(audio.src).toBe('stream:song-b')
    expect(engine.getSnapshot()).toMatchObject({
      currentTrack: tracks[1],
      currentIndex: 1,
      playing: true,
      loading: false,
    })
    expect(listener).toHaveBeenCalled()
  })

  it('tracks a pending stream load without losing the current track', async () => {
    let resolveStream
    const { audio, engine } = makeEngine({
      resolveStreamUrl: () =>
        new Promise((resolve) => {
          resolveStream = resolve
        }),
    })
    const request = engine.setQueue([tracks[0]], 0)

    await Promise.resolve()
    expect(engine.getSnapshot()).toMatchObject({
      currentTrack: tracks[0],
      loading: true,
    })

    resolveStream('stream:song-a')
    await request

    expect(audio.src).toBe('stream:song-a')
    expect(engine.getSnapshot()).toMatchObject({
      loading: false,
    })
  })

  it('pauses, resumes, and bounds seeking', async () => {
    const { audio, engine } = makeEngine()
    await engine.setQueue(tracks, 0, { autoplay: true })
    audio.setDuration(100)

    engine.pause()
    expect(engine.getSnapshot().playing).toBe(false)
    await engine.play()
    expect(engine.getSnapshot().playing).toBe(true)
    expect(engine.seek(150)).toBe(100)
    expect(audio.currentTime).toBe(100)
    expect(engine.seek(-5)).toBe(0)
  })

  it('does not autoplay after pausing while the stream is resolving', async () => {
    let resolveStream
    const resolveStreamUrl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveStream = resolve
        }),
    )
    const { audio, engine } = makeEngine({ resolveStreamUrl })
    const request = engine.setQueue([tracks[0]], 0, { autoplay: true })

    await Promise.resolve()
    engine.pause()
    resolveStream('stream:song-a')
    await request

    expect(audio.src).toBe('stream:song-a')
    expect(engine.getSnapshot()).toMatchObject({
      playing: false,
      loading: false,
    })
  })

  it('honors a user play command while autoplay startup is still pending', async () => {
    let resolveInitialPlay
    let playCalls = 0
    const audio = createMemoryAudioElementAdapter({
      playImplementation: () => {
        playCalls += 1
        if (playCalls === 1) {
          return new Promise((resolve) => {
            resolveInitialPlay = resolve
          })
        }
        return Promise.resolve()
      },
    })
    const { engine } = makeEngine({ audio })

    try {
      engine.setQueue([tracks[0]], 0, { autoplay: true })
      for (let index = 0; index < 6; index += 1) await Promise.resolve()

      expect(engine.getSnapshot()).toMatchObject({
        loading: true,
      })

      const manualPlay = engine.play()
      for (let index = 0; index < 3; index += 1) await Promise.resolve()

      expect(playCalls).toBe(2)
      resolveInitialPlay()
      await manualPlay
      expect(engine.getSnapshot().playing).toBe(true)
    } finally {
      engine.destroy()
    }
  })

  it('keeps a user pause command while autoplay startup is still pending', async () => {
    let resolveInitialPlay
    const audio = createMemoryAudioElementAdapter({
      playImplementation: () =>
        new Promise((resolve) => {
          resolveInitialPlay = resolve
        }),
    })
    const { engine } = makeEngine({ audio })

    try {
      const request = engine.setQueue([tracks[0]], 0, { autoplay: true })
      for (let index = 0; index < 6; index += 1) await Promise.resolve()

      expect(engine.getSnapshot()).toMatchObject({
        loading: true,
      })

      engine.pause()
      resolveInitialPlay()
      await request

      expect(engine.getSnapshot()).toMatchObject({
        playing: false,
        loading: false,
      })
    } finally {
      engine.destroy()
    }
  })

  it('navigates manually and advances when a track ends', async () => {
    const { audio, engine } = makeEngine()
    await engine.setQueue(tracks, 0, { autoplay: true })

    await engine.next()
    expect(engine.getSnapshot().currentTrack).toBe(tracks[1])
    await engine.previous()
    expect(engine.getSnapshot().currentTrack).toBe(tracks[0])

    audio.setEnded(true)
    audio.emit('ended')
    await Promise.resolve()
    expect(engine.getSnapshot().currentTrack).toBe(tracks[1])
  })

  it('supports repeat-one and shuffle navigation', async () => {
    const { audio, engine } = makeEngine()
    await engine.setQueue(tracks, 1, { autoplay: true })
    engine.setMode('singleLoop')
    audio.emit('ended')
    await Promise.resolve()
    expect(engine.getSnapshot().currentTrack).toBe(tracks[1])

    engine.setMode('shufflePlay')
    await engine.next()
    expect(engine.getSnapshot().currentIndex).not.toBe(1)
  })

  it('falls back to a raw stream when decision resolution fails', async () => {
    const fallback = vi.fn(async (track) => `raw:${track.trackId}`)
    const { audio, engine } = makeEngine({
      resolveStreamUrl: vi.fn().mockRejectedValue(new Error('decision failed')),
      fallbackStreamUrl: fallback,
    })

    await engine.setQueue([tracks[0]], 0)
    expect(audio.src).toBe('raw:song-a')
    expect(fallback).toHaveBeenCalledWith(tracks[0], expect.any(Error))
    expect(engine.getSnapshot().error).toBeNull()
  })

  it('does not remain loading forever when stream resolution stalls', async () => {
    vi.useFakeTimers()
    const fallback = vi.fn(async (track) => `raw:${track.trackId}`)
    const { audio, engine } = makeEngine({
      resolveStreamUrl: vi.fn(() => new Promise(() => undefined)),
      fallbackStreamUrl: fallback,
    })

    try {
      engine.setQueue([tracks[0]], 0, { autoplay: true })
      await vi.advanceTimersByTimeAsync(STREAM_RESOLUTION_TIMEOUT_MS)

      expect(fallback).toHaveBeenCalledWith(tracks[0], expect.any(Error))
      expect(audio.src).toBe('raw:song-a')
      expect(engine.getSnapshot()).toMatchObject({
        playing: true,
        loading: false,
      })
    } finally {
      engine.destroy()
      vi.useRealTimers()
    }
  })

  it('does not remain loading forever when native playback startup stalls', async () => {
    vi.useFakeTimers()
    const audio = createMemoryAudioElementAdapter({
      playImplementation: () => new Promise(() => undefined),
    })
    const { engine } = makeEngine({
      audio,
      resolveStreamUrl: vi.fn(() => 'stream:song-a'),
    })

    try {
      engine.setQueue([tracks[0]], 0, { autoplay: true })
      for (let index = 0; index < 5; index += 1) await Promise.resolve()
      await vi.advanceTimersByTimeAsync(PLAYBACK_START_TIMEOUT_MS)

      expect(engine.getSnapshot()).toMatchObject({
        playing: false,
        loading: false,
      })
      expect(engine.getSnapshot().error).toHaveProperty(
        'message',
        'Playback startup timed out',
      )
    } finally {
      engine.destroy()
      vi.useRealTimers()
    }
  })

  it('retries the raw stream when the resolved stream never starts', async () => {
    vi.useFakeTimers()
    let playCalls = 0
    const audio = createMemoryAudioElementAdapter({
      playImplementation: () => {
        playCalls += 1
        return playCalls === 1
          ? new Promise(() => undefined)
          : Promise.resolve()
      },
    })
    const fallback = vi.fn(async (track) => `raw:${track.trackId}`)
    const { engine } = makeEngine({
      audio,
      resolveStreamUrl: vi.fn(() => 'transcoded:song-a'),
      fallbackStreamUrl: fallback,
    })

    try {
      const request = engine.setQueue([tracks[0]], 0, { autoplay: true })
      for (let index = 0; index < 5; index += 1) await Promise.resolve()
      await vi.advanceTimersByTimeAsync(PLAYBACK_START_TIMEOUT_MS)
      await request

      expect(fallback).toHaveBeenCalledWith(
        tracks[0],
        expect.objectContaining({ message: 'Playback startup timed out' }),
      )
      expect(audio.src).toBe('raw:song-a')
      expect(playCalls).toBe(2)
      expect(engine.getSnapshot()).toMatchObject({
        playing: true,
        loading: false,
        error: null,
      })
    } finally {
      engine.destroy()
      vi.useRealTimers()
    }
  })

  it('ignores stale stream resolutions after a rapid track change', async () => {
    const resolvers = {}
    const resolveStreamUrl = vi.fn(
      (track) =>
        new Promise((resolve) => {
          resolvers[track.trackId] = resolve
        }),
    )
    const { audio, engine } = makeEngine({ resolveStreamUrl })
    const first = engine.setQueue([tracks[0]], 0, { autoplay: true })
    await Promise.resolve()
    const second = engine.setQueue([tracks[1]], 0, { autoplay: true })
    await Promise.resolve()

    resolvers['song-a']('stream:song-a')
    await Promise.resolve()
    resolvers['song-b']('stream:song-b')
    await Promise.all([first, second])

    expect(audio.src).toBe('stream:song-b')
    expect(engine.getSnapshot().currentTrack).toBe(tracks[1])
  })

  it('records coarse playback transitions without duplicate starts', async () => {
    const report = vi.fn()
    const { engine } = makeEngine({ reportPlayback: report })
    await engine.setQueue([tracks[0]], 0, { autoplay: true })
    await engine.play()
    engine.pause()

    expect(report.mock.calls.map(([event]) => event.type)).toEqual([
      'starting',
      'playing',
      'paused',
    ])
  })

  it('reports one stop when advancing automatically', async () => {
    const report = vi.fn()
    const { audio, engine } = makeEngine({ reportPlayback: report })
    await engine.setQueue(tracks, 0, { autoplay: true })

    audio.setEnded(true)
    audio.emit('ended')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(report.mock.calls.map(([event]) => event.type)).toEqual([
      'starting',
      'playing',
      'stopped',
      'starting',
      'playing',
    ])
  })

  it('cleans event listeners and stops callbacks on destroy', async () => {
    const audio = createMemoryAudioElementAdapter()
    const { engine } = makeEngine({ audio })
    const listener = vi.fn()
    engine.subscribe(listener)
    await engine.setQueue([tracks[0]], 0)
    const callsBeforeDestroy = listener.mock.calls.length
    engine.destroy()
    expect(audio.listenerCount('timeupdate')).toBe(0)
    audio.emit('timeupdate')
    expect(listener).toHaveBeenCalledTimes(callsBeforeDestroy)
  })

  it('handles autoplay rejection as an engine error', async () => {
    const audio = createMemoryAudioElementAdapter({
      playImplementation: () => Promise.reject(new Error('autoplay blocked')),
    })
    const { engine } = makeEngine({ audio })
    await engine.setQueue([tracks[0]], 0, { autoplay: true })
    expect(engine.getSnapshot().playing).toBe(false)
    expect(engine.getSnapshot().error).toHaveProperty(
      'message',
      'autoplay blocked',
    )
  })

  it('falls back when the active stream emits a media error', async () => {
    const fallback = vi.fn(async (track) => `raw:${track.trackId}`)
    const { audio, engine } = makeEngine({ fallbackStreamUrl: fallback })

    await engine.setQueue([tracks[0]], 0, { autoplay: true })
    audio.emit('error', { type: 'error', error: new Error('stream failed') })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fallback).toHaveBeenCalledWith(
      tracks[0],
      expect.objectContaining({ message: 'stream failed' }),
    )
    expect(audio.src).toBe('raw:song-a')
    expect(engine.getSnapshot()).toMatchObject({
      playing: true,
      loading: false,
      error: null,
    })
  })
})
