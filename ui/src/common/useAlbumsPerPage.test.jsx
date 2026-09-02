import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAlbumsPerPage } from './useAlbumsPerPage'
import { setStoredPerPage } from './perPageStore'

vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
}))

describe('useAlbumsPerPage', () => {
  let mockUseSelector

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    const { useSelector } = await import('react-redux')
    mockUseSelector = vi.mocked(useSelector)
  })

  const setReduxPerPage = (value) =>
    mockUseSelector.mockImplementation((selector) =>
      selector({
        admin: {
          resources: { album: { list: { params: { perPage: value } } } },
        },
      }),
    )

  it('prefers the redux session value over the stored one', () => {
    setReduxPerPage(25)
    setStoredPerPage('album', 50)
    const { result } = renderHook(() => useAlbumsPerPage())
    expect(result.current[0]).toEqual(25)
  })

  it('falls back to the stored value on fresh load', () => {
    setReduxPerPage(undefined)
    setStoredPerPage('album', 50)
    const { result } = renderHook(() => useAlbumsPerPage())
    expect(result.current[0]).toEqual(50)
  })

  it('returns the default 25 when nothing is stored', () => {
    setReduxPerPage(undefined)
    const { result } = renderHook(() => useAlbumsPerPage())
    expect(result.current).toEqual([25, [10, 25, 50, 100]])
  })

  it('ignores an invalid redux value and falls back to stored', () => {
    setReduxPerPage(999)
    setStoredPerPage('album', 25)
    const { result } = renderHook(() => useAlbumsPerPage())
    expect(result.current[0]).toEqual(25)
  })
})
