import jsonServerProvider from 'ra-data-json-server'
import httpClient from './httpClient'
import { REST_URL } from '../consts'

const dataProvider = jsonServerProvider(REST_URL, httpClient)

// Lists are the expensive part of changing tabs on a remote/mobile client.
// Keep dynamic lists short-lived (30s), but keep static facet resources (genres, tags/moods)
// cached longer (15 minutes) so tab navigation is instant (0ms).
const LIST_CACHE_TTL_MS = 30 * 1000
const FACET_CACHE_TTL_MS = 15 * 60 * 1000
const MAX_LIST_CACHE_SIZE = 60
const facetResources = new Set(['genre', 'tag'])
const cacheableResources = new Set(['album', 'song', 'artist', 'genre', 'tag'])
const listCache = new Map()

const pruneExpiredOrOverflow = () => {
  const now = Date.now()
  for (const [k, entry] of listCache) {
    if (entry.expiresAt <= now) {
      listCache.delete(k)
    }
  }
  while (listCache.size >= MAX_LIST_CACHE_SIZE) {
    const oldestKey = listCache.keys().next().value
    listCache.delete(oldestKey)
  }
}

const clearListCache = () => {
  listCache.clear()
  return Promise.resolve({ data: null })
}

const cachedGetList = (resource, params, request) => {
  if (!cacheableResources.has(resource)) {
    try {
      return Promise.resolve(request())
    } catch (err) {
      return Promise.reject(err)
    }
  }

  const identity = localStorage.getItem('userId') || ''
  let key
  try {
    key = `${identity}:${resource}:${JSON.stringify(params)}`
  } catch (err) {
    key = `${identity}:${resource}`
  }
  const cached = listCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh insertion order (LRU)
    listCache.delete(key)
    listCache.set(key, cached)
    return cached.value
  }

  let pending
  try {
    pending = Promise.resolve(request()).catch((error) => {
      if (listCache.get(key)?.value === pending) listCache.delete(key)
      throw error
    })
  } catch (err) {
    return Promise.reject(err)
  }
  const ttl = facetResources.has(resource) ? FACET_CACHE_TTL_MS : LIST_CACHE_TTL_MS
  pruneExpiredOrOverflow()
  listCache.delete(key)
  listCache.set(key, {
    value: pending,
    expiresAt: Date.now() + ttl,
  })
  return pending
}

const isAdmin = () => {
  const role = localStorage.getItem('role')
  return role === 'admin'
}

const getSelectedLibraries = () => {
  try {
    const rawState = localStorage.getItem('state')
    if (!rawState) return []
    const state = JSON.parse(rawState)
    const selectedLibraries = Array.isArray(state?.library?.selectedLibraries)
      ? state.library.selectedLibraries
      : []
    const userLibraries = Array.isArray(state?.library?.userLibraries)
      ? state.library.userLibraries
      : []

    // Validate selected libraries against current user libraries
    const userLibraryIds = userLibraries.map((lib) => lib?.id).filter(Boolean)
    const validatedSelection = selectedLibraries.filter((id) =>
      userLibraryIds.includes(id),
    )

    // If user has only one library, return empty array (no filter needed)
    if (userLibraryIds.length === 1) {
      return []
    }

    return validatedSelection
  } catch (err) {
    return []
  }
}

// Function to apply library filtering to appropriate resources
const applyLibraryFilter = (resource, params = {}) => {
  // Content resources that should be filtered by selected libraries
  const filteredResources = ['album', 'song', 'artist', 'playlistTrack', 'tag']

  // Get selected libraries from localStorage
  const selectedLibraries = getSelectedLibraries()

  const p = { ...params, filter: { ...(params?.filter || {}) } }

  // Add library filter for content resources if libraries are selected
  if (filteredResources.includes(resource) && selectedLibraries.length > 0) {
    p.filter.library_id = selectedLibraries
  }

  return p
}

const mapResource = (resource, params = {}) => {
  const p = { ...params, filter: { ...(params?.filter || {}) } }
  switch (resource) {
    // /api/playlistTrack?playlist_id=123  => /api/playlist/123/tracks
    case 'playlistTrack': {
      let plsId = p.filter.playlist_id || '0'
      if (!isAdmin()) {
        p.filter.missing = false
      }
      const filteredParams = applyLibraryFilter(resource, p)

      return [`playlist/${plsId}/tracks`, filteredParams]
    }
    case 'album':
    case 'song':
    case 'artist':
    case 'tag': {
      if (!isAdmin()) {
        p.filter.missing = false
      }
      const filteredParams = applyLibraryFilter(resource, p)

      return [resource, filteredParams]
    }
    default:
      return [resource, p]
  }
}

const callDeleteMany = (resource, params) => {
  const ids = (params?.ids || []).map((id) => `id=${id}`)
  const query = ids.length > 0 ? `?${ids.join('&')}` : ''
  return httpClient(`${REST_URL}/${resource}${query}`, {
    method: 'DELETE',
  }).then((response) => ({ data: response.json.ids || [] }))
}

// Helper function to handle user-library associations
const handleUserLibraryAssociation = async (userId, libraryIds) => {
  if (!libraryIds || libraryIds.length === 0) {
    return // Admin users or users without library assignments
  }

  try {
    await httpClient(`${REST_URL}/user/${userId}/library`, {
      method: 'PUT',
      body: JSON.stringify({ libraryIds }),
    })
  } catch (error) {
    console.error('Error setting user libraries:', error) //eslint-disable-line no-console
    throw error
  }
}

// Enhanced user creation that handles library associations
const createUser = async (params) => {
  const { data } = params
  const { libraryIds, ...userData } = data

  // First create the user
  const userResponse = await dataProvider.create('user', { data: userData })
  const userId = userResponse.data.id

  // Then set library associations for non-admin users
  if (!userData.isAdmin && libraryIds && libraryIds.length > 0) {
    await handleUserLibraryAssociation(userId, libraryIds)
  }

  return userResponse
}

// Enhanced user update that handles library associations
const updateUser = async (params) => {
  const { data } = params
  const { libraryIds, ...userData } = data
  const userId = params.id

  // First update the user
  const userResponse = await dataProvider.update('user', {
    ...params,
    data: userData,
  })

  // Then handle library associations for non-admin users. Only admins can call
  // this endpoint; for self-edits the server manages library assignments
  if (isAdmin() && !userData.isAdmin && libraryIds !== undefined) {
    await handleUserLibraryAssociation(userId, libraryIds)
  }

  return userResponse
}

const wrapperDataProvider = {
  ...dataProvider,
  getList: (resource, params) => {
    try {
      const [r, p] = mapResource(resource, params)
      return cachedGetList(resource, p, () => dataProvider.getList(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  getOne: (resource, params) => {
    try {
      const [r, p] = mapResource(resource, params)
      const response = Promise.resolve(dataProvider.getOne(r, p))

      // Transform user data to ensure libraryIds is present for form compatibility
      if (resource === 'user') {
        return response.then((result) => {
          if (result?.data?.libraries && Array.isArray(result.data.libraries)) {
            result.data.libraryIds = result.data.libraries.map((lib) => lib?.id)
          }
          return result
        })
      }

      return response
    } catch (err) {
      return Promise.reject(err)
    }
  },
  getMany: (resource, params) => {
    try {
      const [r, p] = mapResource(resource, params)
      return Promise.resolve(dataProvider.getMany(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  getManyReference: (resource, params) => {
    try {
      const [r, p] = mapResource(resource, params)
      return Promise.resolve(dataProvider.getManyReference(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  update: (resource, params) => {
    clearListCache()
    if (resource === 'user') {
      return updateUser(params)
    }
    try {
      const [r, p] = mapResource(resource, params)
      return Promise.resolve(dataProvider.update(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  updateMany: (resource, params) => {
    clearListCache()
    try {
      const [r, p] = mapResource(resource, params)
      return Promise.resolve(dataProvider.updateMany(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  create: (resource, params) => {
    clearListCache()
    if (resource === 'user') {
      return createUser(params)
    }
    try {
      const [r, p] = mapResource(resource, params)
      return Promise.resolve(dataProvider.create(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  delete: (resource, params) => {
    clearListCache()
    try {
      const [r, p] = mapResource(resource, params)
      return Promise.resolve(dataProvider.delete(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  deleteMany: (resource, params) => {
    clearListCache()
    try {
      const [r, p] = mapResource(resource, params)
      if (r.endsWith('/tracks') || resource === 'missing') {
        return callDeleteMany(r, p)
      }
      return Promise.resolve(dataProvider.deleteMany(r, p))
    } catch (err) {
      return Promise.reject(err)
    }
  },
  addToPlaylist: (playlistId, data) => {
    clearListCache()
    return httpClient(`${REST_URL}/playlist/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(({ json }) => ({ data: json }))
  },
  getPlaylists: (songId) => {
    return httpClient(`${REST_URL}/song/${songId}/playlists`).then(
      ({ json }) => ({ data: json }),
    )
  },
  inspect: (songId) => {
    return httpClient(`${REST_URL}/inspect?id=${songId}`).then(({ json }) => ({
      data: json,
    }))
  },
  deleteMediaFile: (songId) => {
    clearListCache()
    return httpClient(`${REST_URL}/song/${songId}/file`, {
      method: 'DELETE',
    }).then(({ json }) => ({ data: json }))
  },
  clearCache: clearListCache,
}

export default wrapperDataProvider
