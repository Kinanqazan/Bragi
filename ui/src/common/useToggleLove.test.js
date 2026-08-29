import { renderHook, act } from '@testing-library/react-hooks'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useToggleLove } from './useToggleLove'
import subsonic from '../subsonic'
import { useDataProvider } from 'react-admin'
import { useDispatch } from 'react-redux'

vi.mock('../subsonic', () => ({
  default: {
    star: vi.fn(() => Promise.resolve()),
    unstar: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('react-redux', () => ({
  useDispatch: vi.fn(),
}))

vi.mock('react-admin', async () => {
  const actual = await vi.importActual('react-admin')
  return {
    ...actual,
    useDataProvider: vi.fn(),
    useNotify: vi.fn(() => vi.fn()),
  }
})

describe('useToggleLove', () => {
  let getOne
  let mockDispatch
  beforeEach(() => {
    getOne = vi.fn(() => Promise.resolve())
    mockDispatch = vi.fn()
    useDispatch.mockReturnValue(mockDispatch)
    useDataProvider.mockReturnValue({ getOne })
    vi.clearAllMocks()
  })

  it('uses mediaFileId when present', async () => {
    const record = { id: 'pt-1', mediaFileId: 'sg-1', starred: false }
    const { result } = renderHook(() => useToggleLove('song', record))
    await act(async () => {
      await result.current[0]()
    })
    expect(subsonic.star).toHaveBeenCalledWith('sg-1')
    expect(getOne).toHaveBeenCalledWith('song', { id: 'sg-1' })
  })

  it('falls back to id when mediaFileId not present', async () => {
    const record = { id: 'sg-1', starred: false }
    const { result } = renderHook(() => useToggleLove('song', record))
    await act(async () => {
      await result.current[0]()
    })
    expect(subsonic.star).toHaveBeenCalledWith('sg-1')
    expect(getOne).toHaveBeenCalledWith('song', { id: 'sg-1' })
  })

  it('calls unstar when record is already loved', async () => {
    const record = { id: 'sg-1', starred: true }
    const { result } = renderHook(() => useToggleLove('song', record))
    await act(async () => {
      await result.current[0]()
    })
    expect(subsonic.unstar).toHaveBeenCalledWith('sg-1')
  })

  describe('playlist track scenarios', () => {
    it('refreshes both playlist track and song for playlist tracks', async () => {
      const record = {
        id: 'pt-1',
        mediaFileId: 'sg-1',
        playlistId: 'pl-1',
        starred: false,
      }
      const { result } = renderHook(() =>
        useToggleLove('playlistTrack', record),
      )
      await act(async () => {
        await result.current[0]()
      })

      // Should star using the media file ID
      expect(subsonic.star).toHaveBeenCalledWith('sg-1')

      // Should refresh both the playlist track and the song
      expect(getOne).toHaveBeenCalledTimes(2)
      expect(getOne).toHaveBeenCalledWith('playlistTrack', {
        id: 'pt-1',
        filter: { playlist_id: 'pl-1' },
      })
      expect(getOne).toHaveBeenCalledWith('song', { id: 'sg-1' })
    })

    it('includes playlist_id filter when refreshing playlist tracks', async () => {
      const record = {
        id: 'pt-5',
        mediaFileId: 'sg-10',
        playlistId: 'pl-123',
        starred: true,
      }
      const { result } = renderHook(() =>
        useToggleLove('playlistTrack', record),
      )
      await act(async () => {
        await result.current[0]()
      })

      // Should unstar using the media file ID
      expect(subsonic.unstar).toHaveBeenCalledWith('sg-10')

      // Should refresh playlist track with correct playlist_id filter
      expect(getOne).toHaveBeenCalledWith('playlistTrack', {
        id: 'pt-5',
        filter: { playlist_id: 'pl-123' },
      })
      // Should also refresh the underlying song
      expect(getOne).toHaveBeenCalledWith('song', { id: 'sg-10' })
    })

    it('only refreshes original resource when no mediaFileId present', async () => {
      const record = { id: 'sg-1', starred: false }
      const { result } = renderHook(() => useToggleLove('song', record))
      await act(async () => {
        await result.current[0]()
      })

      // Should only refresh the original resource (song)
      expect(getOne).toHaveBeenCalledTimes(1)
      expect(getOne).toHaveBeenCalledWith('song', { id: 'sg-1' })
    })

    it('does not include playlist_id filter for non-playlist resources', async () => {
      const record = { id: 'sg-1', starred: false }
      const { result } = renderHook(() => useToggleLove('song', record))
      await act(async () => {
        await result.current[0]()
      })

      // Should refresh without any filter
      expect(getOne).toHaveBeenCalledWith('song', { id: 'sg-1' })
    })
  })

  describe('optimistic updates', () => {
    it('immediately dispatches optimistic update before network request finishes', async () => {
      const record = { id: 'sg-1', starred: false }
      const { result } = renderHook(() => useToggleLove('song', record))
      await act(async () => {
        await result.current[0]()
      })

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'RA/CRUD_UPDATE_OPTIMISTIC',
        payload: {
          id: 'sg-1',
          data: expect.objectContaining({ starred: true }),
        },
        meta: {
          resource: 'song',
          fetch: 'UPDATE',
          optimistic: true,
        },
      })
    })

    it('rolls back optimistic update when subsonic call fails', async () => {
      subsonic.star.mockRejectedValueOnce(new Error('Network error'))
      const record = { id: 'sg-1', starred: false }
      const { result } = renderHook(() => useToggleLove('song', record))
      await act(async () => {
        await result.current[0]()
      })

      // First call is optimistic update
      expect(mockDispatch).toHaveBeenNthCalledWith(1, {
        type: 'RA/CRUD_UPDATE_OPTIMISTIC',
        payload: {
          id: 'sg-1',
          data: expect.objectContaining({ starred: true }),
        },
        meta: {
          resource: 'song',
          fetch: 'UPDATE',
          optimistic: true,
        },
      })

      // Second call is rollback
      expect(mockDispatch).toHaveBeenNthCalledWith(2, {
        type: 'RA/CRUD_UPDATE_OPTIMISTIC',
        payload: {
          id: 'sg-1',
          data: expect.objectContaining({ starred: false }),
        },
        meta: {
          resource: 'song',
          fetch: 'UPDATE',
          optimistic: true,
        },
      })
    })
  })
})
