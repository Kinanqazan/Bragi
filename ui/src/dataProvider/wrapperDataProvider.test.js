import { describe, it, expect, vi, beforeEach } from 'vitest'
import wrapperDataProvider from './wrapperDataProvider'

const { mockProvider, mockHttpClient } = vi.hoisted(() => ({
  mockProvider: {
    update: vi.fn(),
    create: vi.fn(),
    getOne: vi.fn(),
    getList: vi.fn(),
  },
  mockHttpClient: vi.fn(),
}))

vi.mock('ra-data-json-server', () => ({ default: () => mockProvider }))
vi.mock('./httpClient', () => ({ default: mockHttpClient }))

describe('wrapperDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    wrapperDataProvider.clearCache()
    mockProvider.update.mockResolvedValue({ data: { id: 'u1' } })
    mockProvider.create.mockResolvedValue({ data: { id: 'u1' } })
    mockProvider.getList.mockResolvedValue({ data: [], total: 0 })
    mockHttpClient.mockResolvedValue({ json: [] })
  })

  describe('update user', () => {
    it('sets library associations when an admin edits a non-admin user', async () => {
      localStorage.setItem('role', 'admin')

      await wrapperDataProvider.update('user', {
        id: 'u1',
        data: { name: 'Sam', isAdmin: false, libraryIds: [1] },
      })

      expect(mockProvider.update).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ id: 'u1' }),
      )
      expect(mockHttpClient).toHaveBeenCalledWith('/api/user/u1/library', {
        method: 'PUT',
        body: JSON.stringify({ libraryIds: [1] }),
      })
    })

    it('does not call the admin-only library endpoint when a non-admin edits their own profile', async () => {
      localStorage.setItem('role', 'regular')

      await wrapperDataProvider.update('user', {
        id: 'u1',
        data: {
          name: 'Sam',
          isAdmin: false,
          libraryIds: [1],
          currentPassword: 'old',
          password: 'new',
        },
      })

      expect(mockProvider.update).toHaveBeenCalled()
      expect(mockHttpClient).not.toHaveBeenCalled()
    })

    it('does not set library associations when the edited user is an admin', async () => {
      localStorage.setItem('role', 'admin')

      await wrapperDataProvider.update('user', {
        id: 'u1',
        data: { name: 'Sam', isAdmin: true, libraryIds: [1] },
      })

      expect(mockProvider.update).toHaveBeenCalled()
      expect(mockHttpClient).not.toHaveBeenCalled()
    })

    it('strips libraryIds from the user update payload', async () => {
      localStorage.setItem('role', 'admin')

      await wrapperDataProvider.update('user', {
        id: 'u1',
        data: { name: 'Sam', isAdmin: false, libraryIds: [1] },
      })

      expect(mockProvider.update).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({
          data: { name: 'Sam', isAdmin: false },
        }),
      )
    })
  })

  describe('deleteMediaFile', () => {
    it('uses the dedicated media-file endpoint', async () => {
      mockHttpClient.mockResolvedValue({ json: { id: 'song-1' } })

      await wrapperDataProvider.deleteMediaFile('song-1')

      expect(mockHttpClient).toHaveBeenCalledWith('/api/song/song-1/file', {
        method: 'DELETE',
      })
    })
  })

  describe('list caching', () => {
    it('deduplicates and briefly caches content list requests', async () => {
      const params = {
        pagination: { page: 1, perPage: 25 },
        sort: { field: 'title', order: 'ASC' },
        filter: {},
      }

      await wrapperDataProvider.getList('song', params)
      await wrapperDataProvider.getList('song', params)

      expect(mockProvider.getList).toHaveBeenCalledTimes(1)
    })

    it('invalidates cached lists after a mutation', async () => {
      const params = {
        pagination: { page: 1, perPage: 25 },
        sort: { field: 'title', order: 'ASC' },
        filter: {},
      }

      await wrapperDataProvider.getList('song', params)
      await wrapperDataProvider.update('song', {
        id: 'song-1',
        data: { starred: true },
      })
      await wrapperDataProvider.getList('song', params)

      expect(mockProvider.getList).toHaveBeenCalledTimes(2)
    })

    it('returns a resolved Promise when clearCache is called', async () => {
      const result = await wrapperDataProvider.clearCache()
      expect(result).toEqual({ data: null })
    })

    it('handles getList with undefined params without crashing', async () => {
      await wrapperDataProvider.getList('song')
      expect(mockProvider.getList).toHaveBeenCalled()
    })

    it('bounds the cache and does not grow unbounded', async () => {
      for (let i = 0; i < 75; i++) {
        await wrapperDataProvider.getList('song', {
          pagination: { page: i + 1, perPage: 25 },
          sort: { field: 'title', order: 'ASC' },
          filter: {},
        })
      }
      expect(mockProvider.getList).toHaveBeenCalledTimes(75)

      // Querying the most recent page (page 75) should be a cache hit
      await wrapperDataProvider.getList('song', {
        pagination: { page: 75, perPage: 25 },
        sort: { field: 'title', order: 'ASC' },
        filter: {},
      })
      expect(mockProvider.getList).toHaveBeenCalledTimes(75)

      // Querying page 1 (which should have been evicted by the 60 item LRU cap) should fetch again
      await wrapperDataProvider.getList('song', {
        pagination: { page: 1, perPage: 25 },
        sort: { field: 'title', order: 'ASC' },
        filter: {},
      })
      expect(mockProvider.getList).toHaveBeenCalledTimes(76)
    })
  })
})

