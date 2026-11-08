import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@material-ui/core/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForYouPage from './ForYouPage'
import { httpClient } from '../dataProvider'

const dispatch = vi.fn()
vi.mock('react-redux', () => ({ useDispatch: () => dispatch }))
vi.mock('../dialogs', () => ({ ListenBrainzTokenDialog: () => null }))
vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))
vi.mock('../actions', () => ({
  openListenBrainzTokenDialog: () => ({ type: 'CONNECT' }),
  playTracks: (data, ids) => ({ type: 'PLAY', data, ids }),
}))

const renderPage = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <ForYouPage />
    </ThemeProvider>,
  )

describe('ForYouPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete window.BragiNative
  })

  it('keeps horizontal touch gestures available on its scroll container', async () => {
    httpClient.mockResolvedValue({ json: { linked: false } })
    const { container } = renderPage()
    await screen.findByRole('button', { name: 'Connect ListenBrainz' })
    const className = [...container.firstChild.classList].find((name) =>
      name.includes('root'),
    )
    const rules = [...document.styleSheets].flatMap((sheet) => [
      ...sheet.cssRules,
    ])
    expect(
      rules.find((rule) => rule.selectorText === `.${className}`)?.cssText,
    ).toContain('touch-action: pan-y pinch-zoom')
  })

  it('offers the existing connection flow for unlinked users', async () => {
    httpClient.mockResolvedValue({ json: { linked: false } })
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Connect ListenBrainz' }),
    )
    expect(dispatch).toHaveBeenCalledWith({ type: 'CONNECT' })
  })

  it('offers connection and retry when recommendations cannot be loaded', async () => {
    httpClient.mockRejectedValue({ status: 502 })
    renderPage()
    expect(
      await screen.findByText(
        'Could not load recommendations from ListenBrainz.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect ListenBrainz' }),
    )
    expect(dispatch).toHaveBeenCalledWith({ type: 'CONNECT' })
  })

  it('suggests updating the server when the recommendations route is missing', async () => {
    httpClient.mockRejectedValue({ status: 404 })
    renderPage()
    expect(
      await screen.findByText(/server may need to be updated or restarted/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Connect ListenBrainz' }),
    ).toBeInTheDocument()
  })

  it('does not copy a search link when the backend is missing the recording route', async () => {
    httpClient.mockImplementation((url) => {
      if (url.includes('/recording/')) return Promise.reject({ status: 404 })
      if (url.endsWith('recommendations'))
        return Promise.resolve({
          json: {
            linked: true,
            playlists: [
              {
                playlist: {
                  identifier: 'https://listenbrainz.org/playlist/123',
                },
              },
            ],
          },
        })
      return Promise.resolve({
        json: {
          playlist: {
            track: [
              {
                title: 'Song',
                creator: 'Artist',
                identifier: [
                  'https://musicbrainz.org/recording/22222222-2222-4222-8222-222222222222',
                ],
              },
            ],
          },
        },
      })
    })
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Copy link for Song' }),
    )
    expect(
      await screen.findByText('Restart the Bragi server to enable song links.'),
    ).toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('opens and copies direct links, displays artwork, and plays matched tracks', async () => {
    httpClient.mockImplementation((url) =>
      Promise.resolve({
        json: url.includes('/recording/')
          ? { url: 'https://music.youtube.com/watch?v=abc' }
          : url.endsWith('recommendations')
            ? {
                linked: true,
                user: 'listener',
                playlists: [
                  {
                    playlist: {
                      identifier: 'https://listenbrainz.org/playlist/123',
                      title: 'Weekly',
                    },
                  },
                  {
                    playlist: {
                      identifier: 'https://listenbrainz.org/playlist/456',
                    },
                  },
                ],
              }
            : url.endsWith('/123')
              ? {
                  playlist: {
                    title: 'Weekly',
                    track: [
                      {
                        title: 'A & B',
                        creator: 'Artist',
                        album: 'Hidden album',
                        identifier: [
                          'https://musicbrainz.org/recording/22222222-2222-4222-8222-222222222222',
                        ],
                        extension: {
                          'https://musicbrainz.org/doc/jspf#track': {
                            additional_metadata: {
                              caa_release_mbid:
                                '11111111-1111-4111-8111-111111111111',
                            },
                          },
                        },
                        library: { id: 'local', title: 'A & B' },
                      },
                    ],
                  },
                }
              : {
                  playlist: {
                    track: [
                      {
                        title: 'A & B',
                        creator: 'Artist',
                        identifier: [
                          'https://musicbrainz.org/recording/22222222-2222-4222-8222-222222222222',
                        ],
                      },
                      { title: 'Other', creator: 'Artist' },
                    ],
                  },
                },
      }),
    )
    window.BragiNative = { openExternalUrl: vi.fn() }
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Play A & B in Bragi' }),
    )
    expect(screen.getAllByText('A & B')).toHaveLength(1)
    expect(screen.queryByText('Weekly')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden album')).not.toBeInTheDocument()
    expect(screen.queryByText('For listener')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Stats' })).toHaveAttribute(
      'href',
      'https://listenbrainz.org/user/listener/stats/',
    )
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAY', ids: ['local'] }),
    )
    expect(document.querySelector('img').src).toBe(
      'https://coverartarchive.org/release/11111111-1111-4111-8111-111111111111/front-250',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Open A & B in YouTube Music' }),
    )
    await screen.findByRole('button', { name: 'Copy link for A & B' })
    await vi.waitFor(() =>
      expect(window.BragiNative.openExternalUrl).toHaveBeenCalledWith(
        'https://music.youtube.com/watch?v=abc',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy link for A & B' }))
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'https://music.youtube.com/watch?v=abc',
      ),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Open Other in YouTube Music' }),
    )
    await vi.waitFor(() =>
      expect(window.BragiNative.openExternalUrl).toHaveBeenCalledWith(
        'https://music.youtube.com/search?q=Artist%20Other',
      ),
    )
    writeText.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link for Other' }))
    expect(
      await screen.findByText(
        'No direct song link was found for this recording.',
      ),
    ).toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Play Other in Bragi' }),
    ).not.toBeInTheDocument()
  })
})
