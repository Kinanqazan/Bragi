import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CastButton from './CastButton'

const mockedCastState = vi.hoisted(() => ({
  connected: true,
  deviceName: 'Enki',
}))
const mockedEndCastSession = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockedRequestCastSession = vi.hoisted(() => vi.fn())

vi.mock('./castApi', () => ({
  endCastSession: mockedEndCastSession,
  requestCastSession: mockedRequestCastSession,
}))

vi.mock('./useCastState', () => ({
  useCastState: () => mockedCastState,
}))

vi.mock('react-icons/md', () => ({
  MdCast: () => <span data-testid="cast-icon" />,
  MdPhoneAndroid: () => <span data-testid="phone-icon" />,
}))

describe('CastButton', () => {
  beforeEach(() => {
    mockedCastState.connected = true
    mockedCastState.deviceName = 'Enki'
    mockedEndCastSession.mockClear()
    mockedRequestCastSession.mockClear()
  })

  it('offers Play on this device and ends casting when selected', async () => {
    render(<CastButton />)

    fireEvent.click(screen.getByRole('button', { name: /cast options/i }))
    fireEvent.click(
      screen.getByRole('menuitem', { name: /play on this device/i }),
    )

    await waitFor(() =>
      expect(mockedEndCastSession).toHaveBeenCalledWith(true, {
        resumeLocal: true,
      }),
    )
  })

  it('does not submit duplicate discovery requests while opening the picker', async () => {
    mockedCastState.connected = false
    let resolveRequest
    mockedRequestCastSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    render(<CastButton />)
    const button = screen.getByRole('button', { name: /cast to device/i })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(mockedRequestCastSession).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()

    resolveRequest()
    await waitFor(() => expect(button).not.toBeDisabled())
  })

  it('does not warn when the Cast picker returns lowercase cancel', async () => {
    mockedCastState.connected = false
    mockedRequestCastSession.mockRejectedValue({ code: 'cancel' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      render(<CastButton />)
      const button = screen.getByRole('button', { name: /cast to device/i })

      fireEvent.click(button)

      await waitFor(() => expect(button).not.toBeDisabled())
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('re-enables the button when a session request times out', async () => {
    mockedCastState.connected = false
    mockedRequestCastSession.mockRejectedValue({ code: 'TIMEOUT' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      render(<CastButton />)
      const button = screen.getByRole('button', { name: /cast to device/i })

      fireEvent.click(button)

      await waitFor(() => expect(button).not.toBeDisabled())
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('safely unlocks the button if the request hangs beyond the safety timer', async () => {
    vi.useFakeTimers()
    try {
      mockedCastState.connected = false
      mockedRequestCastSession.mockReturnValue(new Promise(() => {}))

      render(<CastButton />)
      const button = screen.getByRole('button', { name: /cast to device/i })

      fireEvent.click(button)
      expect(button).toBeDisabled()

      vi.advanceTimersByTime(12500)
      expect(button).not.toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })
})
