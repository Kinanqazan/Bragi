import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TrackIdentity from './TrackIdentity'

vi.mock('../common', () => ({
  ArtistLinkField: ({ record, source }) => (
    <span data-testid="artist-link-field">
      {record?.[source] || 'Artist'}
    </span>
  ),
}))

describe('TrackIdentity', () => {
  it('links the player title to its song page and delegates artist to ArtistLinkField', () => {
    const track = {
      song: {
        id: 'song-1',
        title: 'Song Title',
        albumId: 'album-1',
        artist: 'Artist Name',
        artistId: 'artist-1',
      },
    }

    render(
      <MemoryRouter>
        <TrackIdentity track={track} />
      </MemoryRouter>,
    )

    const titleLink = screen.getByRole('link', { name: 'Song Title' })
    expect(titleLink).toHaveAttribute('href', '/song/song-1/show')

    const artistField = screen.getByTestId('artist-link-field')
    expect(artistField).toHaveTextContent('Artist Name')
  })

  it('uses the media song identity instead of the playlist entry for its link', () => {
    const track = {
      song: {
        id: 'entry-2',
        mediaFileId: 'song-2',
        title: 'Playlist Song',
        playlistId: 'playlist-1',
        albumId: 'album-1',
        artist: 'Playlist Artist',
      },
    }

    render(
      <MemoryRouter>
        <TrackIdentity track={track} />
      </MemoryRouter>,
    )

    const titleLink = screen.getByRole('link', { name: 'Playlist Song' })
    expect(titleLink).toHaveAttribute('href', '/song/song-2/show')
  })

  it('links the title to the song page on mobile too', () => {
    const track = {
      song: {
        id: 'song-3',
        title: 'Mobile Song',
        albumId: 'album-1',
        artist: 'Mobile Artist',
      },
    }

    render(
      <MemoryRouter>
        <TrackIdentity track={track} mobile />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Mobile Song' })).toHaveAttribute(
      'href',
      '/song/song-3/show',
    )
    expect(screen.getByText('Mobile Song')).toBeInTheDocument()
    expect(screen.getByTestId('artist-link-field')).toHaveTextContent('Mobile Artist')
  })

  it('does not wrap artist in the song page link', () => {
    const track = {
      song: {
        id: 'song-4',
        title: 'Song Title',
        albumId: 'album-1',
        artist: 'Artist Name',
      },
    }

    render(
      <MemoryRouter>
        <TrackIdentity track={track} />
      </MemoryRouter>,
    )

    const titleLink = screen.getByRole('link', { name: 'Song Title' })
    const artistField = screen.getByTestId('artist-link-field')
    expect(titleLink).not.toContainElement(artistField)
  })
})
