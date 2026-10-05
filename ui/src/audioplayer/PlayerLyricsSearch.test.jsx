import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LyricsCanvas from './LyricsCanvas'

const mocks = vi.hoisted(() => ({ httpClient: vi.fn() }))

vi.mock('react-admin', () => ({
  usePermissions: () => ({ permissions: 'admin' }),
}))
vi.mock('../config', () => ({
  default: { enableMediaFileMetadataEditing: true },
}))
vi.mock('../consts', () => ({ REST_URL: '/api' }))
vi.mock('../dataProvider', () => ({ httpClient: mocks.httpClient }))

describe('player lyrics search', () => {
  beforeEach(() => {
    mocks.httpClient.mockReset()
  })

  it('loads a chosen result into the artwork, then saves it without refreshing lyrics', async () => {
    mocks.httpClient
      .mockResolvedValueOnce({
        json: [
          {
            id: 'result-1',
            trackName: 'Song',
            artistName: 'Artist',
            plainLyrics: 'A lyric',
          },
        ],
      })
      .mockResolvedValueOnce({ json: { embedded: { version: 'old-version' } } })
      .mockResolvedValueOnce({ json: {} })

    const onClose = vi.fn()
    render(
      <LyricsCanvas
        songId="song-1"
        searchTitle="Song"
        searchArtist="Artist"
        lyric=""
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Search lyrics' }))

    const dialog = await screen.findByRole('dialog')
    expect(mocks.httpClient).toHaveBeenCalledWith(
      '/api/song/song-1/lyrics/search?q=Song%20Artist',
    )
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Load lyrics: Song by Artist',
      }),
    )
    expect(await screen.findByText('A lyric')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.httpClient).toHaveBeenCalledTimes(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Save lyrics to song file' }),
    )
    await waitFor(() =>
      expect(mocks.httpClient).toHaveBeenCalledWith(
        '/api/song/song-1/lyrics/embedded',
        {
          method: 'PUT',
          body: JSON.stringify({
            content: 'A lyric',
            expectedVersion: 'old-version',
          }),
        },
      ),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('lets the user change the title and search again after no results', async () => {
    mocks.httpClient.mockResolvedValueOnce({ json: [] }).mockResolvedValueOnce({
      json: [
        {
          id: 'result-2',
          trackName: 'Feeling Good',
          artistName: 'Nina Simone',
          plainLyrics: 'New lyrics',
        },
      ],
    })

    const onClose = vi.fn()
    render(
      <LyricsCanvas
        songId="song-1"
        searchTitle="Old title"
        searchArtist="Old artist"
        lyric=""
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Search lyrics' }))

    const dialog = await screen.findByRole('dialog')
    const titleInput = within(dialog).getByRole('textbox', {
      name: 'Song title',
    })
    expect(titleInput).toHaveValue('Old title Old artist')
    fireEvent.click(titleInput)
    fireEvent.keyDown(titleInput, { key: ' ' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(
      await within(dialog).findByText('No lyrics found.'),
    ).toBeInTheDocument()

    fireEvent.change(titleInput, {
      target: { value: 'Nina Simone Feeling Good' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }))

    expect(
      await within(dialog).findByRole('button', {
        name: 'Load lyrics: Feeling Good by Nina Simone',
      }),
    ).toBeInTheDocument()
    expect(mocks.httpClient).toHaveBeenNthCalledWith(
      1,
      '/api/song/song-1/lyrics/search?q=Old%20title%20Old%20artist',
    )
    expect(mocks.httpClient).toHaveBeenNthCalledWith(
      2,
      '/api/song/song-1/lyrics/search?q=Nina%20Simone%20Feeling%20Good',
    )
  })

  it('replaces old results when searching for a different typed title', async () => {
    mocks.httpClient
      .mockResolvedValueOnce({
        json: [
          {
            id: 'old-result',
            trackName: 'Diggin\'',
            artistName: 'Kovacs',
            plainLyrics: 'Old lyrics',
          },
        ],
      })
      .mockResolvedValueOnce({
        json: [
          {
            id: 'new-result',
            trackName: 'Love Song',
            artistName: 'The Cure',
            plainLyrics: 'New lyrics',
          },
        ],
      })

    render(
      <LyricsCanvas
        songId="song-1"
        searchTitle="Diggin'"
        searchArtist="Kovacs"
        lyric=""
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Search lyrics' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('button', {
        name: 'Load lyrics: Diggin\' by Kovacs',
      }),
    ).toBeInTheDocument()

    const titleInput = within(dialog).getByRole('textbox', {
      name: 'Song title',
    })
    fireEvent.change(titleInput, { target: { value: 'love' } })
    expect(
      within(dialog).queryByRole('button', {
        name: 'Load lyrics: Diggin\' by Kovacs',
      }),
    ).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Search' }))
    expect(
      await within(dialog).findByRole('button', {
        name: 'Load lyrics: Love Song by The Cure',
      }),
    ).toBeInTheDocument()
    expect(mocks.httpClient).toHaveBeenNthCalledWith(
      2,
      '/api/song/song-1/lyrics/search?q=love',
    )
  })
})
