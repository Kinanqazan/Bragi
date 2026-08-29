import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VolumeControl from './VolumeControl'

describe('VolumeControl', () => {
  afterEach(cleanup)

  it('renders volume slider with correct value and toggles mute', () => {
    const onChange = vi.fn()
    const { rerender } = render(<VolumeControl value={0.8} onChange={onChange} />)

    const slider = screen.getByRole('slider', { name: 'Volume' })
    const muteButton = screen.getByRole('button', { name: 'Mute' })
    expect(slider).toHaveValue('0.8')

    fireEvent.click(muteButton)
    expect(onChange).toHaveBeenCalledWith(0)

    rerender(<VolumeControl value={0} onChange={onChange} />)
    const unmuteButton = screen.getByRole('button', { name: 'Unmute' })
    fireEvent.click(unmuteButton)
    expect(onChange).toHaveBeenCalledWith(0.8)
  })

  it('preserves local drag value during user dragging and ignores delayed prop updates', () => {
    const onChange = vi.fn()
    const { rerender } = render(<VolumeControl value={0.5} onChange={onChange} />)

    const slider = screen.getByRole('slider', { name: 'Volume' })

    // User starts dragging
    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.75' } })
    expect(slider).toHaveValue('0.75')
    expect(onChange).toHaveBeenCalledWith(0.75)

    // Simulate an asynchronous incoming Cast snapshot update with an older value
    rerender(<VolumeControl value={0.55} onChange={onChange} />)
    // The slider should STILL hold the user's active drag value of 0.75, not jump to 0.55
    expect(slider).toHaveValue('0.75')

    // User continues dragging to 0.9
    fireEvent.change(slider, { target: { value: '0.9' } })
    expect(slider).toHaveValue('0.9')
    expect(onChange).toHaveBeenCalledWith(0.9)

    // User releases pointer on window
    fireEvent.pointerUp(window)

    // Now after release, external updates apply cleanly
    rerender(<VolumeControl value={0.9} onChange={onChange} />)
    expect(slider).toHaveValue('0.9')
  })

  it('handles keyboard navigation immediately without getting stuck in drag state', () => {
    const onChange = vi.fn()
    render(<VolumeControl value={0.5} onChange={onChange} />)

    const slider = screen.getByRole('slider', { name: 'Volume' })
    fireEvent.change(slider, { target: { value: '0.6' } })
    expect(onChange).toHaveBeenCalledWith(0.6)
  })
})
