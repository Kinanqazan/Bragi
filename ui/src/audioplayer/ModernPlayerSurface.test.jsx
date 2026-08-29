import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PlayerControls from './PlayerControls'
import ProgressBar from './ProgressBar'

const renderControls = (overrides = {}) => {
  const commands = {
    play: vi.fn(),
    pause: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    seek: vi.fn(),
    ...overrides.commands,
  }
  const snapshot = {
    playing: false,
    loading: false,
    currentTime: 10,
    duration: 180,
    mode: 'order',
    ...overrides.snapshot,
  }
  render(
    <ThemeProvider theme={createTheme()}>
      <PlayerControls
        snapshot={snapshot}
        commands={commands}
        onQueue={vi.fn()}
        onLyrics={vi.fn()}
        favoriteButton={<button data-testid="favorite-button">Favorite</button>}
      />
      <ProgressBar snapshot={snapshot} commands={commands} />
    </ThemeProvider>,
  )
  return commands
}

describe('native player surfaces', () => {
  afterEach(cleanup)

  it('keeps essential playback controls available in two rows', () => {
    const commands = renderControls()
    expect(screen.getByRole('button', { name: 'Previous track' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next track' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enable shuffle' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Repeat off' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open queue' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open lyrics' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cast/i })).toBeTruthy()
    expect(screen.getByTestId('favorite-button')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(commands.play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('slider', { name: 'Seek' })).toHaveValue('10')
  })

  it('starts fullscreen playback on touch release without a duplicate click toggle', () => {
    const commands = renderControls()
    const play = screen.getByRole('button', { name: 'Play' })

    fireEvent.pointerUp(play, { pointerType: 'touch' })
    fireEvent.click(play)

    expect(commands.play).toHaveBeenCalledOnce()
  })
})
