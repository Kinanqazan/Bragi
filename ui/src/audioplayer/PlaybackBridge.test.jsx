import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { combineReducers, createStore } from 'redux'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { Provider, useSelector } from 'react-redux'
import { addTracks, playTracks, setTrack } from '../actions'
import { playerReducer } from '../reducers/playerReducer'
import { usePlaybackBridge } from './PlaybackBridge'

const mockedResolveStreamUrl = vi.hoisted(() =>
  vi.fn((id) => Promise.resolve(`stream:${id}`)),
)
const mockedPrefetchDecisions = vi.hoisted(() =>
  vi.fn(() => Promise.resolve()),
)
const mockedStreamUrl = vi.hoisted(() =>
  vi.fn((id) => `raw:${id}`),
)
const mockedCastState = vi.hoisted(() => ({
  initialized: false,
  connected: false,
  sessionState: 'NO_SESSION',
}))
const mockedCreateCastPlaybackTarget = vi.hoisted(() => vi.fn())

vi.mock('../subsonic', () => ({
  default: {
    getCoverArtUrl: vi.fn(() => ''),
    streamUrl: mockedStreamUrl,
  },
}))

vi.mock('../transcode', () => ({
  decisionService: {
    resolveStreamUrl: mockedResolveStreamUrl,
    setProfile: vi.fn(),
    prefetchDecisions: mockedPrefetchDecisions,
  },
  detectBrowserProfile: vi.fn(() => 'test-profile'),
}))

vi.mock('../cast/useCastState', () => ({
  useCastState: () => mockedCastState,
}))

vi.mock('../cast/castPlayback', () => ({
  createCastPlaybackTarget: mockedCreateCastPlaybackTarget,
}))

const song = (id) => ({
  id,
  title: `Song ${id}`,
  artist: 'Artist',
  album: 'Album',
  duration: 120,
})

const BridgeProbe = () => {
  const bridge = usePlaybackBridge()
  const state = useSelector((store) => store.player)
  return (
    <audio
      ref={bridge.audioRef}
      data-testid="audio"
      data-track={bridge.snapshot.currentTrack?.trackId || ''}
      data-queue-length={String(state.queue?.length || 0)}
      data-playing={String(bridge.snapshot.playing)}
      data-src={bridge.audioElement?.src || ''}
      data-redux-track={state.current?.trackId || ''}
      data-ui-volume={String(bridge.uiVolume)}
    >
      <button
        type="button"
        data-testid="pause"
        onClick={bridge.commands.pause}
      />
      <button
        type="button"
        data-testid="set-volume-half"
        onClick={() => bridge.commands.setVolume(0.5)}
      />
    </audio>
  )
}

const renderBridge = () => {
  const store = createStore(combineReducers({ player: playerReducer }))
  render(
    <Provider store={store}>
      <BridgeProbe />
    </Provider>,
  )
  return store
}

describe('usePlaybackBridge', () => {
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalLoad = HTMLMediaElement.prototype.load

  beforeEach(() => {
    mockedCastState.initialized = false
    mockedCastState.connected = false
    mockedCastState.sessionState = 'NO_SESSION'
    mockedCreateCastPlaybackTarget.mockReset()
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })

  afterEach(() => {
    cleanup()
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    HTMLMediaElement.prototype.load = originalLoad
  })

  it('starts the newly selected song while another song is playing', async () => {
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('audio')).toHaveAttribute('data-track', 'first')
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      )
    })
    expect(screen.getByTestId('audio')).toHaveAttribute(
      'data-src',
      'raw:first',
    )
    expect(mockedStreamUrl).toHaveBeenCalledWith('first', undefined)

    act(() => {
      store.dispatch(playTracks({ second: song('second') }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-track',
        'second',
      )
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      )
      expect(store.getState().player.current.trackId).toBe('second')
    })
  })

  it('starts a directly selected song from a single-track list', async () => {
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    act(() => {
      store.dispatch(setTrack(song('second')))
    })
    await waitFor(() => {
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-track',
        'second',
      )
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      )
    })
  })

  it('plays the clicked song when API IDs arrive as numbers', async () => {
    const store = renderBridge()

    act(() => {
      store.dispatch(
        playTracks({ 101: song(101), 202: song(202) }, undefined, 202),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('audio')).toHaveAttribute('data-track', '202')
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      )
    })
  })

  it('does not resume a paused track when another track is added to the queue', async () => {
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    act(() => {
      screen.getByTestId('pause').click()
    })
    expect(screen.getByTestId('audio')).toHaveAttribute('data-playing', 'false')

    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })

    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-queue-length',
        '2',
      ),
    )
    expect(screen.getByTestId('audio')).toHaveAttribute('data-playing', 'false')
  })

  it('keeps local playback running when the Cast handoff fails', async () => {
    const castTarget = {
      setQueue: vi.fn(() => Promise.resolve(false)),
      getSnapshot: vi.fn(() => ({
        error: new Error('receiver rejected media'),
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    HTMLMediaElement.prototype.pause.mockClear()

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })

    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled()
    expect(screen.getByTestId('audio')).toHaveAttribute('data-playing', 'true')
  })

  it('falls back to local playback when the Cast session fails on a later song', async () => {
    let onSessionError
    const castTarget = {
      setQueue: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      getSnapshot: vi.fn(() => ({
        currentTrack: song('first'),
        currentIndex: 0,
        playing: true,
        loading: false,
        currentTime: 18,
        duration: 120,
        volume: 0.25,
        mode: 'order',
        error: new Error('session_error'),
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockImplementation((options) => {
      onSessionError = options.onSessionError
      return castTarget
    })
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })
    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())
    await waitFor(() =>
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled(),
    )
    expect(onSessionError).toEqual(expect.any(Function))

    const callsBeforeSecondSong = castTarget.setQueue.mock.calls.length
    act(() => {
      store.dispatch(setTrack(song('second')))
    })
    await waitFor(() =>
      expect(castTarget.setQueue.mock.calls.length).toBeGreaterThan(
        callsBeforeSecondSong,
      ),
    )
    expect(mockedCreateCastPlaybackTarget).toHaveBeenCalledTimes(1)

    await act(async () => {
      onSessionError('session_error', {
        track: song('second'),
        autoplay: true,
        position: 0,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-track',
        'second',
      )
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      )
    })
  })

  it('keeps local playback active until Cast is playing and preserves speaker volume', async () => {
    let completeHandoff
    const handoff = new Promise((resolve) => {
      completeHandoff = resolve
    })
    const castTarget = {
      setQueue: vi
        .fn()
        .mockImplementationOnce(() => handoff)
        .mockResolvedValue(true),
      play: vi.fn(() => Promise.resolve(true)),
      setMode: vi.fn(),
      setVolume: vi.fn(),
      getSnapshot: vi.fn(() => ({
        currentTrack: song('first'),
        currentIndex: 0,
        playing: true,
        loading: false,
        currentTime: 0,
        duration: 120,
        volume: 0.25,
        mode: 'order',
        error: null,
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    HTMLMediaElement.prototype.pause.mockClear()

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })

    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())
    expect(castTarget.setQueue.mock.calls[0][2]).toMatchObject({
      autoplay: true,
    })
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled()
    expect(castTarget.setVolume).not.toHaveBeenCalled()

    await act(async () => completeHandoff(true))

    await waitFor(() =>
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled(),
    )
    expect(castTarget.play).not.toHaveBeenCalled()
    expect(castTarget.setVolume).not.toHaveBeenCalled()
  })

  it('routes app playback controls to Cast after a successful handoff', async () => {
    const castTarget = {
      setQueue: vi.fn(() => Promise.resolve(true)),
      pause: vi.fn(),
      getSnapshot: vi.fn(() => ({
        currentTrack: song('first'),
        currentIndex: 0,
        playing: true,
        loading: false,
        currentTime: 0,
        duration: 120,
        volume: 0.25,
        mode: 'order',
        error: null,
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })

    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())
    await waitFor(() =>
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled(),
    )

    castTarget.pause.mockClear()
    act(() => {
      screen.getByTestId('pause').click()
    })

    expect(castTarget.pause).toHaveBeenCalledTimes(1)
  })

  it('resumes local playback at the remote position when casting stops', async () => {
    const handoff = Promise.resolve(true)
    const castTarget = {
      setQueue: vi
        .fn()
        .mockImplementationOnce(() => handoff)
        .mockResolvedValue(true),
      play: vi.fn(() => Promise.resolve(true)),
      setMode: vi.fn(),
      setVolume: vi.fn(),
      getSnapshot: vi.fn(() => ({
        currentTrack: song('first'),
        currentIndex: 0,
        playing: true,
        loading: false,
        currentTime: 37,
        duration: 120,
        volume: 0.25,
        mode: 'order',
        error: null,
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })
    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())
    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalledTimes(2))

    HTMLMediaElement.prototype.play.mockClear()
    mockedCastState.connected = false
    act(() => {
      store.dispatch(addTracks({ third: song('third') }))
    })

    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalledWith([]))
    await waitFor(() =>
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    )
    expect(screen.getByTestId('audio')).toHaveAttribute('data-playing', 'true')
  })

  it('switches to the current Cast track when casting stops on a later song', async () => {
    const handoff = Promise.resolve(true)
    const castTarget = {
      setQueue: vi
        .fn()
        .mockImplementationOnce(() => handoff)
        .mockResolvedValue(true),
      play: vi.fn(() => Promise.resolve(true)),
      setMode: vi.fn(),
      setVolume: vi.fn(),
      getSnapshot: vi.fn(() => ({
        currentTrack: song('second'),
        currentIndex: 1,
        playing: true,
        loading: false,
        currentTime: 52,
        duration: 180,
        volume: 0.5,
        mode: 'order',
        error: null,
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(
        playTracks({
          first: song('first'),
          second: song('second'),
        }),
      )
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ third: song('third') }))
    })
    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())

    HTMLMediaElement.prototype.play.mockClear()
    mockedCastState.connected = false
    act(() => {
      store.dispatch(addTracks({ fourth: song('fourth') }))
    })

    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalledWith([]))
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-track',
        'second',
      ),
    )
    expect(screen.getByTestId('audio')).toHaveAttribute('data-playing', 'true')
    expect(store.getState().player.current.trackId).toBe('second')
  })

  it('adopts a resumed Cast session instead of reloading the local track', async () => {
    const castTarget = {
      adoptSession: vi.fn(() => Promise.resolve(true)),
      setQueue: vi.fn(() => Promise.resolve(true)),
      getSnapshot: vi.fn(() => ({
        currentTrack: song('first'),
        currentIndex: 0,
        playing: true,
        loading: false,
        currentTime: 37,
        duration: 120,
        volume: 0.25,
        mode: 'order',
        error: null,
      })),
      subscribe: vi.fn(() => () => undefined),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )

    mockedCastState.initialized = true
    mockedCastState.connected = true
    mockedCastState.sessionState = 'SESSION_RESUMED'
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })

    await waitFor(() => expect(castTarget.adoptSession).toHaveBeenCalled())
    expect(castTarget.setQueue.mock.calls[0][0]).toHaveLength(2)
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('manages UI volume linearly when casting without square-root distortion', async () => {
    let subscriber = null
    const castSnapshot = {
      currentTrack: song('first'),
      currentIndex: 0,
      playing: true,
      loading: false,
      currentTime: 10,
      duration: 120,
      volume: 0.5,
      mode: 'order',
      error: null,
    }
    const castTarget = {
      setQueue: vi.fn(() => Promise.resolve(true)),
      play: vi.fn(() => Promise.resolve(true)),
      setMode: vi.fn(),
      setVolume: vi.fn((vol) => {
        castSnapshot.volume = vol
        subscriber?.(castSnapshot)
      }),
      getSnapshot: vi.fn(() => castSnapshot),
      subscribe: vi.fn((cb) => {
        subscriber = cb
        return () => {
          subscriber = null
        }
      }),
      destroy: vi.fn(),
    }
    mockedCreateCastPlaybackTarget.mockReturnValue(castTarget)
    const store = renderBridge()

    act(() => {
      store.dispatch(playTracks({ first: song('first') }))
    })

    mockedCastState.initialized = true
    mockedCastState.connected = true
    act(() => {
      store.dispatch(addTracks({ second: song('second') }))
    })

    await waitFor(() => expect(castTarget.setQueue).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByTestId('audio')).toHaveAttribute('data-ui-volume', '0.5'),
    )

    // When setting volume to 0.5 while casting, uiVolume must be exactly 0.5, NOT Math.sqrt(0.5) ≈ 0.707
    act(() => {
      screen.getByTestId('set-volume-half').click()
    })

    expect(castTarget.setVolume).toHaveBeenCalledWith(0.5)
    expect(screen.getByTestId('audio')).toHaveAttribute('data-ui-volume', '0.5')
  })
})
