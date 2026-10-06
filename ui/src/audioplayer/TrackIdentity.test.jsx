import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TrackIdentity from './TrackIdentity'

const pointerEvent = (type, options = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries(options).map(([key, value]) => [key, { value }]),
    ),
  )
  return event
}

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

  it('runs the mobile title action on click, after touch release', () => {
    const onTitleClick = vi.fn((event) => event.preventDefault())
    render(
      <MemoryRouter>
        <TrackIdentity
          track={{ song: { id: 'song-5', title: 'Touch Song' } }}
          mobile
          onTitleClick={onTitleClick}
        />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Touch Song' })
    fireEvent(link, pointerEvent('pointerdown', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    }))
    const release = pointerEvent('pointerup', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    })
    fireEvent(link, release)

    expect(onTitleClick).not.toHaveBeenCalled()
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    })
    fireEvent(link, click)
    expect(onTitleClick).toHaveBeenCalledOnce()
    expect(click.defaultPrevented).toBe(true)
  })

  it('waits for the link click before running an action that can move the player', () => {
    const LinkRaceHarness = () => {
      const [visible, setVisible] = React.useState(true)
      const location = useLocation()
      return (
        <>
          <span data-testid="current-path">{location.pathname}</span>
          {visible && (
            <TrackIdentity
              track={{ song: { id: 'song-6', title: 'Moving Song' } }}
              mobile
              onTitleClick={() => setVisible(false)}
            />
          )}
        </>
      )
    }

    render(
      <MemoryRouter initialEntries={['/player']}>
        <LinkRaceHarness />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Moving Song' })
    fireEvent(link, pointerEvent('pointerdown', {
      pointerId: 6,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    }))
    fireEvent(link, pointerEvent('pointerup', {
      pointerId: 6,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    }))

    expect(screen.getByTestId('current-path')).toHaveTextContent('/player')
    expect(link).toBeInTheDocument()
    fireEvent.click(link)

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/song/song-6/show',
    )
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
