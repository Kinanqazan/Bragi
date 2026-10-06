import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { describe, expect, it, vi } from 'vitest'
import { LoveButton } from './LoveButton'

const mockedToggleLove = vi.hoisted(() => vi.fn())

vi.mock('react-admin', () => ({
  useRecordContext: ({ record }) => record,
}))

vi.mock('./useToggleLove', () => ({
  useToggleLove: () => [mockedToggleLove, false],
}))

describe('LoveButton', () => {
  it('toggles immediately on touch release and ignores the following click', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <LoveButton
          record={{ id: 'song-1', starred: false }}
          resource="song"
          immediateTouch
          aria-label="Toggle favorite"
        />
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: 'Toggle favorite' })
    fireEvent.pointerUp(button, { pointerType: 'touch' })
    fireEvent.click(button)

    expect(mockedToggleLove).toHaveBeenCalledOnce()
  })
})
