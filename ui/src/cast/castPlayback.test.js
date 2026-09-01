import { describe, expect, it, vi } from 'vitest'
import config from '../config'
import { createCastPlaybackTarget } from './castPlayback'

const createFakeRuntime = () => {
  class RemotePlayer {
    constructor() {
      this.volumeLevel = 1
      this.isMediaLoaded = false
      this.isPaused = true
      this.currentTime = 0
      this.duration = 0
    }
  }

  class RemotePlayerController {
    constructor(player) {
      this.player = player
      this.listeners = new Map()
      RemotePlayerController.last = this
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener)
    }

    removeEventListener(type) {
      this.listeners.delete(type)
    }

    emit(type = 'ANY_CHANGE') {
      this.listeners.get(type)?.()
      if (type !== 'ANY_CHANGE') this.listeners.get('ANY_CHANGE')?.()
    }

    playOrPause() {
      this.player.isMediaLoaded = true
      this.player.isPaused = !this.player.isPaused
      this.emit()
    }

    setVolumeLevel() {
      this.emit()
    }

    seek() {
      this.emit()
    }

    stop() {
      this.player.isMediaLoaded = false
      this.player.isPaused = true
      this.emit()
    }
  }

  class MediaInfo {
    constructor(contentId, contentType) {
      this.contentId = contentId
      this.contentType = contentType
    }
  }

  class LoadRequest {
    constructor(mediaInfo) {
      this.media = mediaInfo
    }
  }

  class MusicTrackMediaMetadata {}
  class Image {
    constructor(url) {
      this.url = url
    }
  }

  return {
    controller: () => RemotePlayerController.last,
    runtime: {
      framework: {
        RemotePlayer,
        RemotePlayerController,
        RemotePlayerEventType: {
          ANY_CHANGE: 'ANY_CHANGE',
          IS_CONNECTED_CHANGED: 'IS_CONNECTED_CHANGED',
        },
        SessionEventType: {
          MEDIA_SESSION: 'MEDIA_SESSION',
        },
      },
      chrome: {
        cast: {
          Image,
          media: {
            MediaInfo,
            LoadRequest,
            MusicTrackMediaMetadata,
            StreamType: { BUFFERED: 'BUFFERED' },
          },
        },
      },
    },
  }
}

const track = {
  uuid: 'track-1',
  trackId: 'track-1',
  title: 'Test song',
  artist: 'Test artist',
  album: 'Test album',
  cover: 'https://server.test/cover.jpg',
}

describe('createCastPlaybackTarget', () => {
  it('loads the current track with metadata and preserves the play position', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.currentTime = request.currentTime
        player.duration = 180
        fake.controller().emit()
      }),
    }
    const resolveMedia = vi.fn(() =>
      Promise.resolve({
        url: 'https://server.test/rest/stream?id=track-1',
        contentType: 'audio/mpeg',
      }),
    )

    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia,
    })

    await target.setQueue([track], 0, { autoplay: true, position: 12 })

    const request = session.loadMedia.mock.calls[0][0]
    expect(resolveMedia).toHaveBeenCalledWith(track)
    expect(request.media.contentId).toContain('/rest/stream')
    expect(request.media.contentType).toBe('audio/mpeg')
    expect(request.media.metadata.title).toBe('Test song')
    expect(request.autoplay).toBe(true)
    expect(request.currentTime).toBe(12)
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: track,
      playing: true,
      currentTime: 12,
      duration: 180,
    })
  })

  it('rebases same-origin artwork onto the receiver-accessible URL', async () => {
    const originalBaseURL = config.baseURL
    const originalCastMediaBaseURL = config.castMediaBaseURL
    config.baseURL = ''
    config.castMediaBaseURL = 'http://receiver.test:4533'
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.playerState = request.autoplay ? 'PLAYING' : 'PAUSED'
        fake.controller().emit()
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'http://receiver.test:4533/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
    })

    try {
      await target.setQueue(
        [{ ...track, cover: '/rest/getCoverArt?id=track-1' }],
        0,
        { autoplay: true },
      )

      const request = session.loadMedia.mock.calls[0][0]
      expect(request.media.metadata.images[0].url).toBe(
        'http://receiver.test:4533/rest/getCoverArt?id=track-1',
      )
    } finally {
      target.destroy()
      config.baseURL = originalBaseURL
      config.castMediaBaseURL = originalCastMediaBaseURL
    }
  })

  it('retries a transient receiver startup failure once', async () => {
    const fake = createFakeRuntime()
    let attempts = 0
    const session = {
      loadMedia: vi.fn(async (request) => {
        attempts += 1
        if (attempts === 1) {
          const error = new Error('receiver is still starting')
          error.code = 'MEDIA_SESSION_NOT_CREATED'
          throw error
        }

        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.currentTime = request.currentTime
        fake.controller().emit()
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      true,
    )

    expect(session.loadMedia).toHaveBeenCalledTimes(2)
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: track,
      playing: true,
    })
  })

  it('does not let a failed media-session event poison a successful retry', async () => {
    const fake = createFakeRuntime()
    let attempts = 0
    let mediaSession = null
    let mediaSessionListener
    const session = {
      getMediaSession: vi.fn(() => mediaSession),
      addEventListener: vi.fn((type, listener) => {
        if (type === 'MEDIA_SESSION') mediaSessionListener = listener
      }),
      removeEventListener: vi.fn(),
      loadMedia: vi.fn(async (request) => {
        attempts += 1
        if (attempts === 1) {
          mediaSession = {
            mediaSessionId: 1,
            media: { contentId: request.media.contentId },
            playerState: 'IDLE',
            idleReason: 'ERROR',
          }
          mediaSessionListener?.({ mediaSession })
          return
        }

        // The Cast session getter can expose the successful replacement before
        // its MEDIA_SESSION event reaches the sender.
        mediaSession = {
          mediaSessionId: 2,
          media: { contentId: request.media.contentId },
          playerState: 'PLAYING',
          idleReason: null,
        }
      }),
    }
    const onSessionError = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      onSessionError,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 1000,
    })

    try {
      await expect(
        target.setQueue([track], 0, { autoplay: true }),
      ).resolves.toBe(true)
      expect(session.loadMedia).toHaveBeenCalledTimes(2)
      expect(onSessionError).not.toHaveBeenCalled()
      expect(target.getSnapshot()).toMatchObject({
        currentTrack: track,
        playing: true,
        error: null,
      })
    } finally {
      target.destroy()
      errorSpy.mockRestore()
    }
  })

  it('keeps startup recovery isolated through transient playing events', async () => {
    const fake = createFakeRuntime()
    let attempts = 0
    const session = {
      loadMedia: vi.fn(async (request) => {
        attempts += 1
        const player = fake.controller().player
        player.mediaInfo = { contentId: request.media.contentId }
        player.isMediaLoaded = true
        player.isPaused = false
        player.playerState = 'PLAYING'
        player.idleReason = null
        fake.controller().emit()

        if (attempts === 1) {
          player.isMediaLoaded = false
          player.isPaused = true
          player.playerState = 'IDLE'
          player.idleReason = 'ERROR'
          fake.controller().emit()
        }
      }),
    }
    const onSessionError = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      onSessionError,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 1000,
    })

    try {
      await expect(
        target.setQueue([track], 0, { autoplay: true }),
      ).resolves.toBe(true)
      expect(session.loadMedia).toHaveBeenCalledTimes(2)
      expect(onSessionError).not.toHaveBeenCalled()
      expect(target.getSnapshot()).toMatchObject({
        playing: true,
        loading: false,
        error: null,
      })
    } finally {
      target.destroy()
      errorSpy.mockRestore()
    }
  })

  it('prefers a replacement getter over a delayed failed-session event', async () => {
    const fake = createFakeRuntime()
    let attempts = 0
    let mediaSession = null
    let mediaSessionListener
    const session = {
      getMediaSession: vi.fn(() => mediaSession),
      addEventListener: vi.fn((type, listener) => {
        if (type === 'MEDIA_SESSION') mediaSessionListener = listener
      }),
      removeEventListener: vi.fn(),
      loadMedia: vi.fn(async (request) => {
        attempts += 1
        if (attempts === 1) {
          mediaSession = {
            mediaSessionId: 1,
            media: { contentId: request.media.contentId },
            playerState: 'IDLE',
            idleReason: 'ERROR',
          }
          mediaSessionListener?.({ mediaSession })
          return
        }

        const failedMediaSession = mediaSession
        setTimeout(() => {
          mediaSessionListener?.({ mediaSession: failedMediaSession })
        }, 5)
        setTimeout(() => {
          mediaSession = {
            mediaSessionId: 2,
            media: { contentId: request.media.contentId },
            playerState: 'PLAYING',
            idleReason: null,
          }
        }, 20)
      }),
    }
    const onSessionError = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      onSessionError,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 1000,
    })

    try {
      await expect(
        target.setQueue([track], 0, { autoplay: true }),
      ).resolves.toBe(true)
      expect(session.loadMedia).toHaveBeenCalledTimes(2)
      expect(onSessionError).not.toHaveBeenCalled()
    } finally {
      target.destroy()
      errorSpy.mockRestore()
    }
  })

  it('waits for the replacement session when the failed session getter is stale', async () => {
    const fake = createFakeRuntime()
    let attempts = 0
    let mediaSession = null
    let mediaSessionListener
    const session = {
      getMediaSession: vi.fn(() => mediaSession),
      addEventListener: vi.fn((type, listener) => {
        if (type === 'MEDIA_SESSION') mediaSessionListener = listener
      }),
      removeEventListener: vi.fn(),
      loadMedia: vi.fn(async (request) => {
        attempts += 1
        if (attempts === 1) {
          mediaSession = {
            mediaSessionId: 1,
            media: { contentId: request.media.contentId },
            playerState: 'IDLE',
            idleReason: 'ERROR',
          }
          mediaSessionListener?.({ mediaSession })
          return
        }

        // The getter can keep exposing the failed attempt until the receiver
        // announces the replacement media session asynchronously.
        setTimeout(() => {
          mediaSession = {
            mediaSessionId: 2,
            media: { contentId: request.media.contentId },
            playerState: 'PLAYING',
            idleReason: null,
          }
          mediaSessionListener?.({ mediaSession })
        }, 20)
      }),
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 1000,
    })

    try {
      await expect(
        target.setQueue([track], 0, { autoplay: true }),
      ).resolves.toBe(true)
      expect(session.loadMedia).toHaveBeenCalledTimes(2)
      expect(target.getSnapshot()).toMatchObject({
        currentTrack: track,
        playing: true,
        error: null,
      })
    } finally {
      target.destroy()
      errorSpy.mockRestore()
    }
  })

  it('accepts a receiver-normalized stream path after a new media session starts', async () => {
    const fake = createFakeRuntime()
    let mediaSession = {
      mediaSessionId: 41,
      media: { contentId: '/rest/stream' },
      playerState: 'PLAYING',
      idleReason: null,
    }
    const session = {
      getMediaSession: vi.fn(() => mediaSession),
      loadMedia: vi.fn(async () => {
        mediaSession = {
          mediaSessionId: 42,
          media: { contentId: '/rest/stream' },
          playerState: 'PLAYING',
          idleReason: null,
        }
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'http://192.168.2.11:4533/rest/stream?u=alice&id=track-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 50,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      true,
    )
  })

  it('does not treat an unchanged normalized path as the newly requested track', async () => {
    const fake = createFakeRuntime()
    const session = {
      getMediaSession: vi.fn(() => ({
        mediaSessionId: 41,
        media: { contentId: '/rest/stream' },
        playerState: 'PLAYING',
        idleReason: null,
      })),
      loadMedia: vi.fn(async () => undefined),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'http://192.168.2.11:4533/rest/stream?u=alice&id=track-2',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 20,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )
    expect(target.getSnapshot().error).toMatchObject({
      code: 'MEDIA_SESSION_NOT_CREATED',
    })
  })

  it('uses the Cast media-session event when the session getter has not caught up', async () => {
    const fake = createFakeRuntime()
    let mediaSessionListener
    const session = {
      getMediaSession: vi.fn(() => null),
      addEventListener: vi.fn((type, listener) => {
        if (type === 'MEDIA_SESSION') mediaSessionListener = listener
      }),
      removeEventListener: vi.fn(),
      loadMedia: vi.fn(async () => {
        mediaSessionListener?.({
          mediaSession: {
            media: { contentId: '/rest/stream' },
            playerState: 'PLAYING',
            idleReason: null,
          },
        })
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'http://192.168.2.11:4533/rest/stream?u=alice&id=track-3',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 50,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      true,
    )
    expect(session.addEventListener).toHaveBeenCalledWith(
      'MEDIA_SESSION',
      expect.any(Function),
    )
    expect(session.removeEventListener).toHaveBeenCalledWith(
      'MEDIA_SESSION',
      expect.any(Function),
    )
  })

  it('does not complete an autoplay handoff until the receiver is playing', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async () => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = true
        fake.controller().emit()
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 500,
    })
    let settled = false

    const result = target
      .setQueue([track], 0, { autoplay: true })
      .then((loaded) => {
        settled = true
        return loaded
      })

    await vi.waitFor(() => expect(session.loadMedia).toHaveBeenCalled())
    expect(settled).toBe(false)

    fake.controller().player.isPaused = false
    fake.controller().emit()

    await expect(result).resolves.toBe(true)
    expect(target.getSnapshot().playing).toBe(true)
  })

  it('uses the media session playback state while RemotePlayer catches up', async () => {
    const fake = createFakeRuntime()
    let mediaSession = null
    const session = {
      getMediaSession: vi.fn(() => mediaSession),
      loadMedia: vi.fn(async (request) => {
        mediaSession = {
          media: { contentId: request.media.contentId },
          playerState: 'PLAYING',
          idleReason: null,
        }
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      true,
    )
    expect(fake.controller().player.isMediaLoaded).toBe(false)
    expect(target.getSnapshot()).toMatchObject({
      playing: true,
      loading: false,
      error: null,
    })
  })

  it('routes pause, seek, and volume commands to the remote player', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.duration = 100
        fake.controller().emit()
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
    })

    await target.setQueue([track], 0, { autoplay: true })
    target.pause()
    target.seek(25)
    target.setVolume(0.36)

    expect(target.getSnapshot()).toMatchObject({
      playing: false,
      currentTime: 25,
      volume: 0.36,
    })
    expect(fake.controller().player.volumeLevel).toBe(0.36)
    await expect(target.next()).resolves.toBe(false)
  })

  it('throttles rapid volume adjustments to the remote player controller', async () => {
    const fake = createFakeRuntime()
    const track = { id: 'track-1', duration: 200 }
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.duration = 200
        fake.controller().emit()
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
    })

    await target.setQueue([track], 0, { autoplay: true })
    const setVolumeLevelSpy = vi.spyOn(fake.controller(), 'setVolumeLevel')

    // Perform multiple rapid volume updates
    target.setVolume(0.4)
    target.setVolume(0.5)
    target.setVolume(0.6)

    // Snapshot updates immediately for the UI
    expect(target.getSnapshot().volume).toBe(0.6)
    expect(fake.controller().player.volumeLevel).toBe(0.6)

    // Remote network calls are throttled leading-edge
    expect(setVolumeLevelSpy).toHaveBeenCalledTimes(1)

    target.destroy()
  })

  it('routes controls when the receiver normalizes the stream URL', async () => {
    const fake = createFakeRuntime()
    let normalizedMediaSession = {
      media: { contentId: 'https://server.test/rest/stream' },
      mediaSessionId: 16,
      playerState: 'PLAYING',
      idleReason: null,
    }
    const session = {
      getMediaSession: vi.fn(() => normalizedMediaSession),
      loadMedia: vi.fn(async () => {
        normalizedMediaSession = {
          ...normalizedMediaSession,
          mediaSessionId: 17,
        }
        const player = fake.controller().player
        player.mediaInfo = { contentId: normalizedMediaSession.media.contentId }
        player.isMediaLoaded = true
        player.isPaused = false
        player.playerState = 'PLAYING'
        player.duration = 100
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=track-1',
          contentType: 'audio/mpeg',
        }),
    })
    const playOrPause = vi.spyOn(fake.controller(), 'playOrPause')

    await target.setQueue([track], 0, { autoplay: true })
    target.pause()

    expect(playOrPause).toHaveBeenCalledTimes(1)
  })

  it('navigates the Cast queue for next, previous, and direct selection', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.currentTime = request.currentTime
        player.duration = 100
        fake.controller().emit()
      }),
    }
    const first = { ...track, trackId: 'first', uuid: 'first' }
    const second = { ...track, trackId: 'second', uuid: 'second' }
    const third = { ...track, trackId: 'third', uuid: 'third' }
    const resolveMedia = vi.fn((nextTrack) =>
      Promise.resolve({
        url: `https://server.test/${nextTrack.trackId}.mp3`,
        contentType: 'audio/mpeg',
      }),
    )
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia,
    })

    await target.setQueue([first, second, third], 0, { autoplay: true })
    await target.next()
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: second,
      currentIndex: 1,
      playing: true,
    })

    await target.previous()
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: first,
      currentIndex: 0,
      playing: true,
    })

    await target.select(2)
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: third,
      currentIndex: 2,
      playing: true,
    })
    expect(
      resolveMedia.mock.calls.map(([nextTrack]) => nextTrack.trackId),
    ).toEqual(['first', 'second', 'first', 'third'])
  })

  it('serializes receiver loads so an older request cannot overtake a newer one', async () => {
    const fake = createFakeRuntime()
    let resolveFirst
    let resolveSecond
    let activeLoads = 0
    let maxActiveLoads = 0
    const firstLoad = new Promise((resolve) => {
      resolveFirst = resolve
    })
    const secondLoad = new Promise((resolve) => {
      resolveSecond = resolve
    })
    const first = { ...track, trackId: 'first', uuid: 'first' }
    const second = { ...track, trackId: 'second', uuid: 'second' }
    const completeLoad = (request) => {
      const player = fake.controller().player
      player.mediaInfo = { contentId: request.media.contentId }
      player.isMediaLoaded = true
      player.isPaused = !request.autoplay
      player.playerState = request.autoplay ? 'PLAYING' : 'PAUSED'
      fake.controller().emit()
    }
    const session = {
      loadMedia: vi.fn((request) => {
        activeLoads += 1
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads)
        const load =
          session.loadMedia.mock.calls.length === 1 ? firstLoad : secondLoad
        return load.then(() => {
          activeLoads -= 1
          completeLoad(request)
        })
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      mediaLoadTimeoutMs: 100,
      resolveMedia: (nextTrack) =>
        Promise.resolve({
          url: `https://server.test/rest/stream?id=${nextTrack.trackId}`,
          contentType: 'audio/mpeg',
        }),
    })

    const firstResult = target.setQueue([first], 0, { autoplay: true })
    await vi.waitFor(() => expect(session.loadMedia).toHaveBeenCalledTimes(1))
    const secondResult = target.setQueue([second], 0, { autoplay: true })
    expect(session.loadMedia).toHaveBeenCalledTimes(1)

    resolveFirst()
    await vi.waitFor(() => expect(session.loadMedia).toHaveBeenCalledTimes(2))
    expect(maxActiveLoads).toBe(1)
    resolveSecond()

    await expect(secondResult).resolves.toBe(true)
    await expect(firstResult).resolves.toBe(false)
    expect(target.getSnapshot().currentTrack).toBe(second)
  })

  it('gives the latest serialized load a full timeout budget', async () => {
    const fake = createFakeRuntime()
    let loadCount = 0
    let resolveFirstLoad
    const firstLoad = new Promise((resolve) => {
      resolveFirstLoad = resolve
    })
    const first = { ...track, trackId: 'first', uuid: 'first' }
    const second = { ...track, trackId: 'second', uuid: 'second' }
    const completeLoad = (request) => {
      const player = fake.controller().player
      player.mediaInfo = { contentId: request.media.contentId }
      player.isMediaLoaded = true
      player.isPaused = !request.autoplay
      player.playerState = request.autoplay ? 'PLAYING' : 'PAUSED'
      fake.controller().emit()
    }
    const session = {
      loadMedia: vi.fn((request) => {
        loadCount += 1
        if (loadCount === 1) {
          return firstLoad.then(() => completeLoad(request))
        }
        return new Promise((resolve) => {
          setTimeout(() => {
            completeLoad(request)
            resolve()
          }, 70)
        })
      }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      mediaLoadTimeoutMs: 120,
      resolveMedia: (nextTrack) =>
        Promise.resolve({
          url: `https://server.test/rest/stream?id=${nextTrack.trackId}`,
          contentType: 'audio/mpeg',
        }),
    })

    const firstResult = target.setQueue([first], 0, { autoplay: true })
    await vi.waitFor(() => expect(session.loadMedia).toHaveBeenCalledTimes(1))
    const secondResult = target.setQueue([second], 0, { autoplay: true })
    await new Promise((resolve) => setTimeout(resolve, 90))
    resolveFirstLoad()

    await expect(firstResult).resolves.toBe(false)
    const secondLoaded = await secondResult
    await new Promise((resolve) => setTimeout(resolve, 50))
    target.destroy()

    expect(secondLoaded).toBe(true)
    expect(session.loadMedia).toHaveBeenCalledTimes(2)
    expect(target.getSnapshot().currentTrack).toBe(second)
  })

  it('releases the serializer when an obsolete load never settles', async () => {
    const fake = createFakeRuntime()
    const first = { ...track, trackId: 'first', uuid: 'first' }
    const second = { ...track, trackId: 'second', uuid: 'second' }
    const session = {
      loadMedia: vi
        .fn()
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockImplementationOnce(async (request) => {
          const player = fake.controller().player
          player.mediaInfo = { contentId: request.media.contentId }
          player.isMediaLoaded = true
          player.isPaused = !request.autoplay
          player.playerState = request.autoplay ? 'PLAYING' : 'PAUSED'
          fake.controller().emit()
        }),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      mediaLoadTimeoutMs: 30,
      resolveMedia: (nextTrack) =>
        Promise.resolve({
          url: `https://server.test/rest/stream?id=${nextTrack.trackId}`,
          contentType: 'audio/mpeg',
        }),
    })

    const firstResult = target.setQueue([first], 0, { autoplay: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(session.loadMedia).toHaveBeenCalledTimes(1)
    const secondResult = target.setQueue([second], 0, { autoplay: true })

    await expect(firstResult).resolves.toBe(false)
    await expect(secondResult).resolves.toBe(true)
    expect(session.loadMedia).toHaveBeenCalledTimes(2)
    expect(target.getSnapshot().currentTrack).toBe(second)
  })

  it('adopts matching media from a resumed Cast session without reloading it', async () => {
    const fake = createFakeRuntime()
    const session = {
      getMediaSession: vi.fn(() => ({
        media: {
          contentId:
            'https://server.test/rest/stream?u=alice&t=old-token&_=100&id=track-1',
        },
        playerState: 'PLAYING',
        idleReason: null,
      })),
      loadMedia: vi.fn(),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?u=alice&t=new-token&_=200&id=track-1',
          contentType: 'audio/mpeg',
        }),
    })
    const player = fake.controller().player
    player.isMediaLoaded = true
    player.isPaused = false
    player.playerState = 'PLAYING'
    player.currentTime = 37
    player.duration = 120

    await expect(target.adoptSession(track)).resolves.toBe(true)
    expect(session.loadMedia).not.toHaveBeenCalled()
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: track,
      currentIndex: 0,
      playing: true,
      currentTime: 37,
      duration: 120,
    })
  })

  it('automatically loads the next Cast queue item after a track finishes', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.playerState = request.autoplay ? 'PLAYING' : 'PAUSED'
        player.idleReason = null
        fake.controller().emit()
      }),
    }
    const first = { ...track, trackId: 'first', uuid: 'first' }
    const second = { ...track, trackId: 'second', uuid: 'second' }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: (nextTrack) =>
        Promise.resolve({
          url: `https://server.test/${nextTrack.trackId}.mp3`,
          contentType: 'audio/mpeg',
        }),
    })

    await target.setQueue([first, second], 0, { autoplay: true })
    fake.controller().player.isMediaLoaded = false
    fake.controller().player.isPaused = true
    fake.controller().player.playerState = 'IDLE'
    fake.controller().player.idleReason = 'FINISHED'
    fake.controller().emit()

    await vi.waitFor(() =>
      expect(target.getSnapshot()).toMatchObject({
        currentTrack: second,
        currentIndex: 1,
        playing: true,
      }),
    )
    expect(session.loadMedia).toHaveBeenCalledTimes(2)
  })

  it('replays the current Cast queue item after it finishes in repeat-one mode', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = !request.autoplay
        player.playerState = request.autoplay ? 'PLAYING' : 'PAUSED'
        player.idleReason = null
        fake.controller().emit()
      }),
    }
    const first = { ...track, trackId: 'first', uuid: 'first' }
    const second = { ...track, trackId: 'second', uuid: 'second' }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: (nextTrack) =>
        Promise.resolve({
          url: `https://server.test/${nextTrack.trackId}.mp3`,
          contentType: 'audio/mpeg',
        }),
    })

    await target.setQueue([first, second], 0, { autoplay: true })
    target.setMode('singleLoop')
    fake.controller().player.isMediaLoaded = false
    fake.controller().player.isPaused = true
    fake.controller().player.playerState = 'IDLE'
    fake.controller().player.idleReason = 'FINISHED'
    fake.controller().emit()

    await vi.waitFor(() => expect(session.loadMedia).toHaveBeenCalledTimes(2))
    expect(
      session.loadMedia.mock.calls.map(([request]) => request.media.contentId),
    ).toEqual([
      'https://server.test/first.mp3',
      'https://server.test/first.mp3',
    ])
    expect(target.getSnapshot()).toMatchObject({
      currentTrack: first,
      currentIndex: 0,
      playing: true,
    })
  })

  it('fails clearly when the receiver never creates a media session', async () => {
    const fake = createFakeRuntime()
    const session = {
      getMediaSession: vi.fn(() => null),
      loadMedia: vi.fn(async () => undefined),
    }
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      mediaLoadTimeoutMs: 20,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )
    expect(target.getSnapshot().error).toMatchObject({
      code: 'MEDIA_SESSION_NOT_CREATED',
    })
  })

  it('reports a genuine receiver idle error without waiting for a timeout', async () => {
    const fake = createFakeRuntime()
    let mediaSession = null
    const session = {
      getCastDevice: () => ({ friendlyName: 'Kitchen Nest' }),
      getMediaSession: vi.fn(() => mediaSession),
      loadMedia: vi.fn(async (request) => {
        mediaSession = {
          media: { contentId: request.media.contentId },
          playerState: 'IDLE',
          idleReason: 'ERROR',
        }
      }),
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 500,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )
    expect(target.getSnapshot().error).toMatchObject({
      code: 'RECEIVER_ERROR',
    })
    errorSpy.mockRestore()
  })

  it('logs a sanitized diagnostic when the receiver rejects media', async () => {
    const fake = createFakeRuntime()
    const session = {
      getCastDevice: () => ({ friendlyName: 'Kitchen Nest' }),
      loadMedia: vi.fn(async () => {
        throw { code: 'LOAD_MEDIA_FAILED', message: 'receiver rejected media' }
      }),
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?u=alice&t=secret&s=salt&id=song-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 20,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )

    expect(errorSpy).toHaveBeenCalledWith(
      '[Navidrome Cast] Media load failed',
      expect.objectContaining({
        code: 'LOAD_MEDIA_FAILED',
        mediaUrl: 'https://server.test/rest/stream',
        contentType: 'audio/mpeg',
        deviceName: 'Kitchen Nest',
        phase: 'load-media',
      }),
    )
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('secret')
    errorSpy.mockRestore()
  })

  it('handles a Cast load error returned as a resolved promise value', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async () => 'LOAD_FAILED'),
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/song.mp3',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 20,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )
    expect(target.getSnapshot().error).toMatchObject({
      code: 'LOAD_FAILED',
      phase: 'load-media',
    })
    expect(errorSpy).toHaveBeenCalledWith(
      '[Navidrome Cast] Media load failed',
      expect.objectContaining({ phase: 'load-media' }),
    )
    errorSpy.mockRestore()
  })

  it('notifies the host when the Cast session becomes invalid', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async () => {
        throw 'session_error'
      }),
    }
    const onSessionError = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      onSessionError,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=song-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 20,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )
    expect(onSessionError).toHaveBeenCalledWith(
      'session_error',
      expect.objectContaining({
        track,
        autoplay: true,
      }),
    )
    errorSpy.mockRestore()
  })

  it('notifies the host when the receiver rejects a media load', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async () => {
        const error = new Error('receiver rejected the stream')
        error.code = 'RECEIVER_ERROR'
        throw error
      }),
    }
    const onSessionError = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      onSessionError,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=song-1',
          contentType: 'audio/mpeg',
        }),
      mediaLoadTimeoutMs: 20,
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )
    expect(onSessionError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RECEIVER_ERROR' }),
      expect.objectContaining({
        track,
        autoplay: true,
      }),
    )
    errorSpy.mockRestore()
  })

  it('notifies the host once when an active receiver later fails', async () => {
    const fake = createFakeRuntime()
    let loadCallCount = 0
    const session = {
      ...fake.session,
      loadMedia: vi.fn((request) => {
        loadCallCount += 1
        if (loadCallCount === 1) {
          // First load (initial setQueue) succeeds.
          const player = fake.controller().player
          player.mediaInfo = { contentId: request.media.contentId }
          player.isMediaLoaded = true
          player.isPaused = false
          player.playerState = 'PLAYING'
          player.idleReason = null
          fake.controller().emit()
          return Promise.resolve(null)
        }
        // Retry loads (from receiver-failure recovery) fail with a
        // non-retryable error so onSessionError fires quickly.
        const err = new Error('session_error')
        err.code = 'SESSION_ERROR'
        return Promise.reject(err)
      }),
    }
    const onSessionError = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      onSessionError,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?id=song-1',
          contentType: 'audio/mpeg',
        }),
    })

    try {
      await expect(
        target.setQueue([track], 0, { autoplay: true }),
      ).resolves.toBe(true)

      // Simulate receiver dropping the stream during remote-playback.
      const player = fake.controller().player
      player.isMediaLoaded = false
      player.isPaused = true
      player.playerState = 'IDLE'
      player.idleReason = 'ERROR'
      fake.controller().emit()

      // The code retries loadTrack first; that retry fails, so
      // onSessionError fires through loadTrack's catch block.
      await vi.waitFor(() => expect(onSessionError).toHaveBeenCalledTimes(1), {
        timeout: 3000,
      })

      // Verify a retry was attempted (more than the initial load).
      expect(loadCallCount).toBeGreaterThan(1)

      // A second receiver-idle event should not trigger another notification.
      player.idleReason = 'CANCELLED'
      fake.controller().emit()

      expect(onSessionError).toHaveBeenCalledTimes(1)
    } finally {
      target.destroy()
      errorSpy.mockRestore()
    }
  })

  it('reports when the Cast session disappears before media loading', async () => {
    const fake = createFakeRuntime()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => null,
      resolveMedia: () =>
        Promise.resolve({
          url: 'https://server.test/rest/stream?u=alice&t=secret',
          contentType: 'audio/mpeg',
        }),
    })

    await expect(target.setQueue([track], 0, { autoplay: true })).resolves.toBe(
      false,
    )

    expect(target.getSnapshot().error).toMatchObject({
      code: 'NO_CAST_SESSION',
    })
    expect(errorSpy).toHaveBeenCalledWith(
      '[Navidrome Cast] Media load failed',
      expect.objectContaining({ code: 'NO_CAST_SESSION' }),
    )
    errorSpy.mockRestore()
  })

  it('preserves track metadata duration and allows seeking when remote player reports 0 duration', async () => {
    const fake = createFakeRuntime()
    const session = {
      loadMedia: vi.fn(async (request) => {
        const player = fake.controller().player
        player.isMediaLoaded = true
        player.isPaused = false
        player.currentTime = 0
        player.duration = 0 // Simulating live/transcoded stream where receiver has not resolved duration
        fake.controller().emit()
      }),
    }
    const resolveMedia = vi.fn(() =>
      Promise.resolve({
        url: 'https://server.test/rest/stream?id=track-transcoded',
        contentType: 'audio/mpeg',
      }),
    )

    const transcodedTrack = {
      ...track,
      uuid: 'track-transcoded',
      trackId: 'track-transcoded',
      duration: 210,
    }

    const target = createCastPlaybackTarget({
      runtime: fake.runtime,
      getSession: () => session,
      resolveMedia,
    })

    await target.setQueue([transcodedTrack], 0, { autoplay: true })

    const request = session.loadMedia.mock.calls[0][0]
    expect(request.media.duration).toBe(210)
    expect(target.getSnapshot().duration).toBe(210)

    const seekResult = target.seek(45)
    expect(seekResult).toBe(45)
    expect(fake.controller().player.currentTime).toBe(45)
  })
})
