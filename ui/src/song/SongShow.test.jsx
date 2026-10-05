import React from 'react'
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  record: {
    id: 'song-1',
    mediaFileId: 'media-1',
    title: 'Old title',
    artist: 'Old artist',
    albumArtist: 'Old album artist',
    duration: 120,
    genres: [],
    tags: {},
  },
  httpClient: vi.fn(),
  notify: vi.fn(),
  refresh: vi.fn(),
  clearCache: vi.fn(),
}))

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
afterEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
})

vi.mock('../config', () => ({
  default: { enableMediaFileMetadataEditing: true },
}))
vi.mock('../dataProvider', () => ({ httpClient: mocks.httpClient }))
vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }))
vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Title: () => null,
    ShowContextProvider: ({ children }) => children,
    useShowContext: () => ({ record: mocks.record, loading: false }),
    useShowController: () => ({ record: mocks.record, loading: false }),
    useNotify: () => mocks.notify,
    useRefresh: () => mocks.refresh,
    useDataProvider: () => ({
      clearCache: mocks.clearCache,
      getList: vi.fn().mockResolvedValue({ data: [] }),
    }),
    usePermissions: () => ({ permissions: 'admin' }),
  }
})
vi.mock('../common', () => ({
  ArtistLinkField: ({ record }) => <span>{record.artist}</span>,
  Artwork: () => <div data-testid="song-artwork" />,
  DurationField: () => <span>02:00</span>,
  LoveButton: ({ 'aria-label': ariaLabel }) => <button aria-label={ariaLabel} />,
  Title: () => null,
  useScrollRestoration: () => undefined,
}))

import SongShow from './SongShow'

const renderSongShow = () =>
  render(
    <MemoryRouter initialEntries={['/song/song-1/show']}>
      <ThemeProvider theme={createTheme()}>
        <SongShow />
      </ThemeProvider>
    </MemoryRouter>,
  )

describe('SongShow metadata editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.record = {
      id: 'song-1',
      mediaFileId: 'media-1',
      title: 'Old title',
      artist: 'Old artist',
      albumArtist: 'Old album artist',
      duration: 120,
      genres: [],
      tags: {},
    }
    mocks.httpClient.mockImplementation((url) => Promise.resolve({
      status: 200,
      json: url.endsWith('/lyrics')
        ? { txt: {}, lrc: {}, embedded: {} }
        : {
            saved: true,
            refreshRequired: false,
            mediaFile: { ...mocks.record, title: 'New title', artist: 'New artist' },
          },
    }))
  })

  const metadataPutCalls = () =>
    mocks.httpClient.mock.calls.filter(
      ([url, options]) => url.endsWith('/metadata') && options?.method === 'PUT',
    )

  it('applies the timing shift when the existing lyrics Save button is used', async () => {
    const originalLyrics = '[00:01.00]First\n[00:02.00]Second'
    mocks.httpClient.mockImplementation((url, options = {}) => Promise.resolve({
      status: 200,
      json: options.method === 'PUT'
        ? { txt: {}, lrc: { content: '[00:02.00]First\n[00:03.00]Second', version: 'lrc-v2', exists: true }, embedded: {} }
        : { txt: {}, lrc: { content: originalLyrics, version: 'lrc-v1', exists: true }, embedded: {} },
    }))
    renderSongShow()

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue(originalLyrics))
    fireEvent.click(screen.getByRole('button', { name: 'Shift lyrics later by 1 second' }))
    expect(screen.getByLabelText('Pending lyrics shift +1 seconds')).toHaveTextContent('+1s')
    expect(screen.getByRole('button', { name: 'Save lyrics' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save lyrics' }))

    await waitFor(() => expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics', {
      method: 'PUT',
      body: JSON.stringify({
        extension: '.lrc',
        content: '[00:02.00]First\n[00:03.00]Second',
        expectedVersion: 'lrc-v1',
      }),
    }))
  })

  it('sends only changed title and artist fields and refreshes the app data', async () => {
    renderSongShow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Song title' }), {
      target: { value: 'New title' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Artist' }), {
      target: { value: 'New artist' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(metadataPutCalls()).toHaveLength(1))
    expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/metadata', {
      method: 'PUT',
      body: JSON.stringify({ title: 'New title', artist: 'New artist' }),
    })
    expect(mocks.clearCache).toHaveBeenCalledOnce()
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('shows Album artist on the page and while editing without an extra disclosure click', () => {
    renderSongShow()

    expect(screen.getByText('Old album artist')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))
    expect(screen.getByRole('combobox', { name: 'Album artist' })).toHaveValue(
      'Old album artist',
    )
  })

  it('explains when the displayed cover falls back to shared disc or album artwork', () => {
    renderSongShow()

    expect(screen.getByText(
      'No embedded cover is stored in this song. The displayed cover comes from shared disc, album, or folder artwork when available.',
    )).toBeInTheDocument()
  })

  it('edits genres and moods in their existing chip positions and saves trimmed values', async () => {
    mocks.record = {
      ...mocks.record,
      genres: [{ name: 'Rock' }, { name: 'Alternative' }],
      tags: { mood: ['Dreamy'] },
    }
    renderSongShow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))
    expect(screen.getByRole('combobox', { name: 'Genre 1' })).toHaveValue('Rock')
    expect(screen.getByRole('combobox', { name: 'Genre 2' })).toHaveValue('Alternative')
    expect(screen.getByRole('combobox', { name: 'Mood 1' })).toHaveValue('Dreamy')
    expect(screen.queryByRole('textbox', { name: 'Genres' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Genre 2' }), {
      target: { value: ' Indie ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove genre 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add mood' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Mood 2' }), {
      target: { value: 'Calm' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(metadataPutCalls()).toHaveLength(1))
    expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/metadata', {
      method: 'PUT',
      body: JSON.stringify({
        genres: ['Indie'],
        moods: ['Dreamy', 'Calm'],
      }),
    })
  })

  it('keeps the title, artist, and album artist in their display positions while editing', () => {
    renderSongShow()
    const titleHeading = screen.getByRole('heading', { name: 'Old title' })
    const artistLine = screen.getByText('Old artist').parentElement
    const albumArtistLine = screen.getByText(/Album artist/).parentElement
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))

    expect(screen.getByRole('textbox', { name: 'Song title' }).parentElement).toBe(titleHeading)
    expect(screen.getByRole('combobox', { name: 'Artist' }).parentElement).toBe(artistLine)
    expect(screen.getByRole('combobox', { name: 'Album artist' }).parentElement).toBe(albumArtistLine)
    expect(screen.queryByText('Duration')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Song actions' })).getByRole('button', {
        name: 'Toggle favorite',
      }),
    ).toBeInTheDocument()
  })

  it('places Play over the cover and Favorite and icon-only editing beside the title', () => {
    renderSongShow()
    const metadata = screen.getByRole('group', { name: 'Song metadata' })
    const actions = screen.getByRole('group', { name: 'Song actions' })
    const editButton = within(actions).getByRole('button', { name: 'Edit metadata' })
    const playback = screen.getByRole('group', { name: 'Song playback' })
    const playButton = within(playback).getByRole('button', { name: /Play/ })

    expect(metadata).toContainElement(actions)
    expect(actions.parentElement).toContainElement(screen.getByRole('heading', { name: 'Old title' }))
    expect(screen.getByTestId('cover-frame')).toContainElement(playButton)
    expect(within(actions).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument()
    expect(playButton).toHaveTextContent('(02:00)')
    expect(editButton).toHaveTextContent('')
  })

  it('previews a replacement cover before saving it to the song file', async () => {
    const createObjectURL = vi.fn(() => 'blob:cover-preview')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const view = renderSongShow()
    const file = new File(['cover bytes'], 'cover.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Choose song artwork'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('img', { name: 'Artwork preview' })).toHaveAttribute(
      'src',
      'blob:cover-preview',
    )
    expect(mocks.httpClient).not.toHaveBeenCalledWith(
      expect.stringContaining('/artwork'),
      expect.anything(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save artwork' }))

    await waitFor(() =>
      expect(mocks.httpClient).toHaveBeenCalledWith(
        '/api/song/media-1/artwork',
        expect.objectContaining({ method: 'PUT', body: expect.any(FormData) }),
      ),
    )
    expect(mocks.clearCache).toHaveBeenCalledOnce()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(view.container.querySelector('img[alt="Artwork preview"]')).not.toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cover-preview')
  })

  it('discards a cover preview when canceled without writing the song file', () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:discarded-cover') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    const view = renderSongShow()
    const file = new File(['cover bytes'], 'cover.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Choose song artwork'), {
      target: { files: [file] },
    })
    expect(screen.getByRole('img', { name: 'Artwork preview' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel artwork change' }))

    expect(view.container.querySelector('img[alt="Artwork preview"]')).not.toBeInTheDocument()
    expect(mocks.httpClient).not.toHaveBeenCalledWith(
      expect.stringContaining('/artwork'),
      expect.anything(),
    )
  })

  it('lets the user cancel a draft without saving', () => {
    renderSongShow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Song title' }), {
      target: { value: 'Unsaved title' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Old title' })).toBeInTheDocument()
    expect(metadataPutCalls()).toHaveLength(0)
  })

  it('shows a refresh retry after the tags save while a scan is already running', async () => {
    mocks.httpClient.mockImplementation((url) => Promise.resolve({
      status: 202,
      json: url.endsWith('/metadata')
        ? { saved: true, refreshRequired: true, refreshError: 'scanner busy' }
        : { txt: {}, lrc: {} },
    }))
    renderSongShow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Song title' }), {
      target: { value: 'New title' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Retry library refresh' })).toBeInTheDocument()
    expect(screen.getByText(/scanner busy/)).toBeInTheDocument()
  })

  it('imports and saves lyrics independently of an unsaved metadata draft', async () => {
    const view = renderSongShow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Song title' }), {
      target: { value: 'Unsaved metadata title' },
    })
    const file = new File(['First line\nSecond line'], 'song.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: async () => 'First line\nSecond line' })
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toBeInTheDocument())
    fireEvent.change(view.container.querySelector('input[accept=".txt,.lrc"]'), {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('First line\nSecond line'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save lyrics' }))

    await waitFor(() =>
      expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics', {
        method: 'PUT',
        body: JSON.stringify({
          extension: '.txt',
          content: 'First line\nSecond line',
          expectedVersion: '',
        }),
      }),
    )
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Unsaved metadata title')
    expect(metadataPutCalls()).toHaveLength(0)
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('loads a selected online lyric into the draft and saves it only when Save is clicked', async () => {
    const match = {
      id: 42,
      trackName: 'Alternate Track',
      artistName: 'Test Artist',
      albumName: 'Test Album',
      duration: 123,
      plainLyrics: 'Plain version',
      syncedLyrics: '[00:01.00]Synced version',
    }
    mocks.httpClient.mockImplementation((url, options = {}) => Promise.resolve({
      status: 200,
      json: options.method === 'PUT'
        ? { lrc: {}, txt: {}, embedded: { content: match.syncedLyrics, version: 'embedded-v1', exists: true } }
        : url.includes('/lyrics/search')
          ? [match]
          : { txt: {}, lrc: {}, embedded: {} },
    }))
    renderSongShow()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Search lyrics' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Search lyrics' }))

    const searchDialog = await screen.findByRole('dialog', { name: 'Search lyrics' })
    expect(within(searchDialog).getByRole('button', { name: /Use lyrics: Alternate Track by Test Artist/ })).toBeInTheDocument()
    expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics/search?q=Old%20title%20Old%20artist')
    fireEvent.click(within(searchDialog).getByRole('button', { name: /Use lyrics: Alternate Track by Test Artist/ }))

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Search lyrics' }))
    expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue(match.syncedLyrics)
    expect(screen.getByRole('button', { name: 'Lyrics storage: Inside music file' })).toBeInTheDocument()
    expect(mocks.httpClient.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Save lyrics' }))

    await waitFor(() => expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics/embedded', {
      method: 'PUT',
      body: JSON.stringify({ content: match.syncedLyrics, expectedVersion: '' }),
    }))
  })

  it('shows an empty search result without changing the current lyrics draft', async () => {
    let searchCount = 0
    const alternateMatch = {
      id: 43,
      trackName: 'Feeling Good',
      artistName: 'Nina Simone',
      plainLyrics: 'Matched lyrics',
    }
    mocks.httpClient.mockImplementation((url) => Promise.resolve({
      status: 200,
      json: url.includes('/lyrics/search')
        ? (++searchCount === 1 ? [] : [alternateMatch])
        : { txt: { content: 'Existing lyrics', version: 'txt-v1', exists: true }, lrc: {}, embedded: {} },
    }))
    renderSongShow()

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('Existing lyrics'))
    fireEvent.click(screen.getByRole('button', { name: 'Search lyrics' }))

    const searchDialog = await screen.findByRole('dialog', { name: 'Search lyrics' })
    expect(within(searchDialog).getByText('No lyrics found.')).toBeInTheDocument()
    const titleInput = within(searchDialog).getByRole('textbox', { name: 'Song title' })
    expect(titleInput).toHaveValue('Old title Old artist')
    fireEvent.change(titleInput, { target: { value: 'Nina Simone Feeling Good' } })
    fireEvent.click(within(searchDialog).getByRole('button', { name: 'Search' }))
    expect(await within(searchDialog).findByRole('button', { name: 'Use lyrics: Feeling Good by Nina Simone' })).toBeInTheDocument()
    expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics/search?q=Nina%20Simone%20Feeling%20Good')
    fireEvent.click(within(searchDialog).getByRole('button', { name: 'Close lyrics search' }))
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Search lyrics' }))
    expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('Existing lyrics')
    expect(mocks.httpClient.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0)
  })

  it('detects LRC format from the selected file without a format picker', async () => {
    mocks.httpClient.mockImplementation((url) => Promise.resolve({
      status: 200,
      json: url.endsWith('/lyrics')
        ? {
            txt: { content: 'Plain lyric', version: 'txt-v1', exists: true },
            lrc: { content: '[00:01.00]Timed lyric', version: 'lrc-v1', exists: true },
          }
        : {},
    }))
    const view = renderSongShow()

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('[00:01.00]Timed lyric'),
    )
    const file = new File(['[00:02.00]New timed line'], 'new-song.lrc', { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: async () => '[00:02.00]New timed line' })
    fireEvent.change(view.container.querySelector('input[accept=".txt,.lrc"]'), {
      target: { files: [file] },
    })
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('[00:02.00]New timed line'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save lyrics' }))
    await waitFor(() =>
      expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics', {
        method: 'PUT',
        body: JSON.stringify({
          extension: '.lrc',
          content: '[00:02.00]New timed line',
          expectedVersion: 'lrc-v1',
        }),
      }),
    )
    expect(screen.queryByRole('combobox', { name: 'Lyrics format' })).not.toBeInTheDocument()
    expect(screen.queryByText('Preview')).not.toBeInTheDocument()
  })

  it('deletes both separate lyric files so the player can fall back to embedded lyrics', async () => {
    mocks.httpClient.mockImplementation((url, options = {}) => Promise.resolve({
      status: 200,
      json: options.method === 'DELETE'
        ? { txt: {}, lrc: {} }
        : url.endsWith('/lyrics')
          ? {
              txt: { content: 'Plain lyrics', version: 'txt-v1', exists: true },
              lrc: { content: '[00:01.00]Timed lyrics', version: 'lrc-v1', exists: true },
            }
          : {},
    }))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderSongShow()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete lyrics' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete lyrics' }))

    await waitFor(() =>
      expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics', {
        method: 'DELETE',
        body: JSON.stringify({ txtVersion: 'txt-v1', lrcVersion: 'lrc-v1' }),
      }),
    )
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Delete lyrics' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('')
    confirmSpy.mockRestore()
  })

  it('saves lyrics into the music file and keeps separate sidecars untouched', async () => {
    mocks.httpClient.mockImplementation((url) => Promise.resolve({
      status: 200,
      json: url.endsWith('/lyrics/embedded')
        ? {
            txt: { content: 'Sidecar lyric', version: 'txt-v1', exists: true },
            lrc: {},
            embedded: { content: 'Updated embedded lyric', version: 'embedded-v2', exists: true },
            saved: true,
          }
        : url.endsWith('/lyrics')
          ? {
              txt: { content: 'Sidecar lyric', version: 'txt-v1', exists: true },
              lrc: {},
              embedded: { content: 'Embedded lyric', version: 'embedded-v1', exists: true },
            }
          : {},
    }))
    renderSongShow()

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('Sidecar lyric'))
    fireEvent.click(screen.getByRole('button', { name: 'Lyrics storage: Separate file' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Inside music file' }))
    expect(screen.getByRole('status')).toHaveTextContent(/take priority in the player/)
    expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('Embedded lyric')
    fireEvent.change(screen.getByRole('textbox', { name: 'Lyrics text' }), {
      target: { value: 'Updated embedded lyric' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save lyrics' }))

    await waitFor(() => expect(mocks.httpClient).toHaveBeenCalledWith('/api/song/media-1/lyrics/embedded', {
      method: 'PUT',
      body: JSON.stringify({ content: 'Updated embedded lyric', expectedVersion: 'embedded-v1' }),
    }))
    expect(screen.getByRole('textbox', { name: 'Lyrics text' })).toHaveValue('Updated embedded lyric')
    expect(screen.queryByRole('button', { name: 'Delete lyrics' })).not.toBeInTheDocument()
  })
})
