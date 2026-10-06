import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const httpClientMock = vi.hoisted(() => vi.fn())

vi.mock('../dataProvider/httpClient', () => ({ default: httpClientMock }))
vi.mock('../common/useRefreshOnEvents', () => ({
  useRefreshOnEvents: () => {},
}))
vi.mock('../common/Artwork', () => ({ Artwork: () => null }))
vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }))

import { ListeningStats } from './ListeningStats'

describe('<ListeningStats />', () => {
  beforeEach(() => {
    httpClientMock.mockReset()
  })

  it('aborts the listening stats request when its page unmounts', async () => {
    httpClientMock.mockImplementation(() => new Promise(() => {}))
    const { unmount } = render(<ListeningStats />)

    await waitFor(() => expect(httpClientMock).toHaveBeenCalledOnce())
    const request = httpClientMock.mock.calls[0][1]

    act(() => unmount())

    expect(request.signal.aborted).toBe(true)
  })
})
