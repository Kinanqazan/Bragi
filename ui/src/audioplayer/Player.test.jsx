import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({
  bridge: null,
  state: {
    player: { queue: [{ trackId: 'song-a' }] },
    settings: { notifications: false },
    replayGain: {},
    lyricsResponse: { json: {} },
  },
}))

vi.mock('@material-ui/core', async () => {
  const actual = await vi.importActual('@material-ui/core')
  return { ...actual, useMediaQuery: () => false }
})

vi.mock('react-admin', () => ({
  useAuthState: () => ({ authenticated: true }),
}))

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) => selector(fixtures.state),
}))

vi.mock('../themes/useCurrentTheme', () => ({
  default: () => ({
    palette: {
      type: 'light',
      primary: { main: '#1976d2' },
      background: { default: '#fff', paper: '#fff' },
      text: { primary: '#111', secondary: '#666' },
    },
  }),
}))

vi.mock('./PlaybackBridge', () => ({
  usePlaybackBridge: () => fixtures.bridge,
}))

vi.mock('./MobilePlayerSurface', () => ({
  default: ({ expanded, onExpandedChange, lyrics }) => (
    <div data-testid="mobile-surface" data-expanded={String(expanded)}>
      <span data-testid="resolved-lyrics">{lyrics}</span>
      <button type="button" onClick={() => onExpandedChange(true)}>
        Expand
      </button>
    </div>
  ),
}))

vi.mock('./DesktopPlayer', () => ({ default: () => null }))
vi.mock('./DesktopPlayerResizeHandle', () => ({ default: () => null }))
vi.mock('./mediaSession', () => ({
  clearMediaSessionMetadata: vi.fn(),
  setupMediaSessionActionHandlers: vi.fn(),
  updateMediaSessionMetadata: vi.fn(),
  updateMediaSessionPlaybackState: vi.fn(),
  updateMediaSessionPositionState: vi.fn(),
}))
vi.mock('../subsonic', () => ({
  default: {
    reportPlayback: vi.fn(),
    reportPlaybackKeepalive: vi.fn(),
    getLyricsBySongId: vi.fn(() => Promise.resolve(fixtures.lyricsResponse)),
  },
}))

import Player from './Player'
import subsonic from '../subsonic'

const makeBridge = (snapshot) => ({
  audioRef: vi.fn(),
  audioElement: null,
  engine: null,
  snapshot,
  commands: { clear: vi.fn() },
})

describe('Player mobile surface state', () => {
  it('loads resolved lyrics for the current track and passes them to the player', async () => {
    fixtures.lyricsResponse = {
      json: {
        'subsonic-response': {
          lyricsList: {
            structuredLyrics: [
              { kind: 'main', synced: false, line: [{ value: 'Resolved lyric' }] },
            ],
          },
        },
      },
    }
    fixtures.bridge = makeBridge({
      currentTrack: { trackId: 'song-lyrics', title: 'Lyrics song' },
      error: null,
      playing: true,
      currentTime: 0,
      duration: 100,
      volume: 1,
    })

    render(<Player />)

    await waitFor(() =>
      expect(screen.getByTestId('resolved-lyrics')).toHaveTextContent(
        'Resolved lyric',
      ),
    )
  })

  it('reloads lyrics for the current song after the song page saves a sidecar', async () => {
    fixtures.lyricsResponse = {
      json: {
        'subsonic-response': {
          lyricsList: {
            structuredLyrics: [{ kind: 'main', synced: false, line: [{ value: 'Before save' }] }],
          },
        },
      },
    }
    fixtures.bridge = makeBridge({
      currentTrack: { trackId: 'song-refresh', title: 'Lyrics song' },
      error: null,
      playing: true,
      currentTime: 0,
      duration: 100,
      volume: 1,
    })
    render(<Player />)
    await waitFor(() =>
      expect(screen.getByTestId('resolved-lyrics')).toHaveTextContent('Before save'),
    )
    const callsBeforeSave = subsonic.getLyricsBySongId.mock.calls.length
    fixtures.lyricsResponse = {
      json: {
        'subsonic-response': {
          lyricsList: {
            structuredLyrics: [{ kind: 'main', synced: false, line: [{ value: 'After save' }] }],
          },
        },
      },
    }

    window.dispatchEvent(
      new CustomEvent('bragi:refresh-song-lyrics', { detail: { songId: 'song-refresh' } }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('resolved-lyrics')).toHaveTextContent('After save'),
    )
    expect(subsonic.getLyricsBySongId.mock.calls.length).toBeGreaterThan(callsBeforeSave)
  })

  it('keeps the fullscreen player expanded while the next song loads', () => {
    fixtures.bridge = makeBridge({
      currentTrack: { trackId: 'song-a', title: 'Song A' },
      error: null,
      playing: true,
      currentTime: 10,
      duration: 100,
      volume: 1,
    })

    const view = render(<Player />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(screen.getByTestId('mobile-surface')).toHaveAttribute(
      'data-expanded',
      'true',
    )

    fixtures.bridge = makeBridge({
      currentTrack: { trackId: 'song-b', title: 'Song B' },
      error: null,
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
    })
    view.rerender(<Player />)

    fixtures.bridge = makeBridge({
      currentTrack: { trackId: 'song-b', title: 'Song B' },
      error: null,
      playing: true,
      currentTime: 0,
      duration: 100,
      volume: 1,
    })
    view.rerender(<Player />)

    expect(screen.getByTestId('mobile-surface')).toHaveAttribute(
      'data-expanded',
      'true',
    )
  })
})
