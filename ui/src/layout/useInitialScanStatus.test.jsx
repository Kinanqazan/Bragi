import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import subsonic from '../subsonic'
import { useInitialScanStatus } from './useInitialScanStatus'

const TestComponent = () => {
  useInitialScanStatus()
  return <div>Test</div>
}

describe('useInitialScanStatus', () => {
  it('updates scanStatus when subsonic response is ok', async () => {
    const dispatch = vi.fn()
    const store = { getState: () => ({}), subscribe: () => () => {}, dispatch }
    vi.spyOn(subsonic, 'getScanStatus').mockResolvedValue({
      json: {
        'subsonic-response': {
          status: 'ok',
          scanStatus: { count: 42, scanning: true },
        },
      },
    })

    render(
      <Provider store={store}>
        <TestComponent />
      </Provider>,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'scanStatus',
        data: { count: 42, scanning: true },
      }),
    )
  })

  it('silently handles missing subsonic-response without throwing', async () => {
    const dispatch = vi.fn()
    const store = { getState: () => ({}), subscribe: () => () => {}, dispatch }
    // Simulates 401 or non-subsonic JSON error response
    vi.spyOn(subsonic, 'getScanStatus').mockResolvedValue({
      json: undefined,
    })

    expect(() => {
      render(
        <Provider store={store}>
          <TestComponent />
        </Provider>,
      )
    }).not.toThrow()

    await Promise.resolve()
    await Promise.resolve()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('silently handles rejection (e.g. 401 network error) without uncaught error', async () => {
    const dispatch = vi.fn()
    const store = { getState: () => ({}), subscribe: () => () => {}, dispatch }
    vi.spyOn(subsonic, 'getScanStatus').mockRejectedValue(new Error('Unauthorized 401'))

    expect(() => {
      render(
        <Provider store={store}>
          <TestComponent />
        </Provider>,
      )
    }).not.toThrow()

    await Promise.resolve()
    await Promise.resolve()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
