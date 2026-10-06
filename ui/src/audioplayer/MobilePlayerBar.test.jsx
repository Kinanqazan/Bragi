import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobilePlayerBar from './MobilePlayerBar'

describe('MobilePlayerBar', () => {
  afterEach(cleanup)

  it('opens the full-screen player from the track area', () => {
    const onOpen = vi.fn()

    render(
      <MobilePlayerBar
        title="Test song"
        artist="Test artist"
        cover="cover.jpg"
        onOpen={onOpen}
        snapshot={{ duration: 180, currentTime: 0, playing: false }}
        commands={{ play: vi.fn(), pause: vi.fn() }}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open full-screen player for Test song',
      }),
    )

    expect(onOpen).toHaveBeenCalledOnce()
    expect(screen.getByText('Test artist')).toBeInTheDocument()
  })

  it('controls playback without opening the full-screen player', () => {
    const onOpen = vi.fn()
    const play = vi.fn()

    render(
      <MobilePlayerBar
        title="Test song"
        onOpen={onOpen}
        snapshot={{ duration: 180, currentTime: 0, playing: false }}
        commands={{ play, pause: vi.fn() }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(play).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('starts playback on touch release without double-toggling the synthesized click', () => {
    const play = vi.fn()

    render(
      <MobilePlayerBar
        title="Test song"
        snapshot={{ duration: 180, currentTime: 0, playing: false }}
        commands={{ play, pause: vi.fn() }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Play' })
    fireEvent.pointerUp(button, { pointerType: 'touch' })
    fireEvent.click(button)

    expect(play).toHaveBeenCalledOnce()
  })

  it('renders title and artist cleanly without album name', () => {
    render(
      <MobilePlayerBar
        title="My Cool Song"
        artist="Awesome Artist"
        cover="cover.jpg"
        onOpen={() => {}}
        snapshot={{ duration: 180, currentTime: 0, playing: false }}
        commands={{ play: vi.fn(), pause: vi.fn() }}
      />,
    )

    expect(screen.getByText('My Cool Song')).toBeInTheDocument()
    expect(screen.getByText('Awesome Artist')).toBeInTheDocument()
  })

  it('opens the full-screen player from the mini-player title without linking to the song page', () => {
    const onOpen = vi.fn()
    render(
      <MemoryRouter initialEntries={['/song?filter=recent']}>
        <MobilePlayerBar
          title="My Cool Song"
          onOpen={onOpen}
          snapshot={{ duration: 180, currentTime: 0, playing: false }}
          commands={{ play: vi.fn(), pause: vi.fn() }}
        />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'My Cool Song' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('My Cool Song'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('exposes its progress strip so shared artwork can reserve its space', () => {
    const progressTrackRef = React.createRef()

    render(
      <MobilePlayerBar
        sharedPlayback
        cover="cover.jpg"
        progressTrackRef={progressTrackRef}
        title="Test song"
        snapshot={{ duration: 120, currentTime: 30, playing: false }}
        commands={{ play: vi.fn(), pause: vi.fn() }}
      />,
    )

    expect(progressTrackRef.current).toHaveAttribute('aria-hidden', 'true')
  })
})
