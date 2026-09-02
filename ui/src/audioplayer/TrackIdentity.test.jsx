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
  it('renders album link for title on desktop and delegates artist to ArtistLinkField', () => {
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
    expect(titleLink).toHaveAttribute('href', '/album/album-1/show')

    const artistField = screen.getByTestId('artist-link-field')
    expect(artistField).toHaveTextContent('Artist Name')
  })

  it('renders playlist link for title when playlistId is present', () => {
    const track = {
      song: {
        id: 'song-2',
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
    expect(titleLink).toHaveAttribute('href', '/playlist/playlist-1/show')
  })

  it('renders title without album/playlist link on mobile', () => {
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

    expect(screen.queryByRole('link', { name: 'Mobile Song' })).not.toBeInTheDocument()
    expect(screen.getByText('Mobile Song')).toBeInTheDocument()
    expect(screen.getByTestId('artist-link-field')).toHaveTextContent('Mobile Artist')
  })

  it('does not wrap artist in the title/album link', () => {
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
