import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LyricsCanvas from './LyricsCanvas'

describe('LyricsCanvas', () => {
  it('seeks through the engine command instead of an audio element', () => {
    const onSeek = vi.fn()

    render(
      <LyricsCanvas
        currentTime={0}
        lyric="[00:10.00]Jump here"
        onSeek={onSeek}
      />,
    )

    fireEvent.click(screen.getByText('Jump here'))

    expect(onSeek).toHaveBeenCalledWith(10)
  })
})
