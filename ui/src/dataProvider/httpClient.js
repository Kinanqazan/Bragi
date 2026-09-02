import { fetchUtils } from 'react-admin'
import { v4 as uuidv4 } from 'uuid'
import { baseUrl } from '../utils'
import config from '../config'
import { jwtDecode } from 'jwt-decode'

const customAuthorizationHeader = 'X-ND-Authorization'
export const clientUniqueIdHeader = 'X-ND-Client-Unique-Id'
export const clientUniqueId = uuidv4()

const activeSearchControllers = new Map()

const isSearchUrl = (url) =>
  url.includes('title=') ||
  url.includes('name=') ||
  url.includes('q=')

const getSearchCategory = (url) => {
  if (url.includes('/api/song')) return 'song'
  if (url.includes('/api/album')) return 'album'
  if (url.includes('/api/artist')) return 'artist'
  if (url.includes('/api/playlist')) return 'playlist'
  return null
}

const httpClient = (url, options = {}) => {
  url = baseUrl(url)
  if (!options.headers) {
    options.headers = new Headers({ Accept: 'application/json' })
  }
  options.headers.set(clientUniqueIdHeader, clientUniqueId)
  const token = localStorage.getItem('token')
  if (token) {
    options.headers.set(customAuthorizationHeader, `Bearer ${token}`)
  }

  // Cancel any prior in-flight search request for this category
  const category = isSearchUrl(url) ? getSearchCategory(url) : null
  if (category && !options.signal) {
    const prev = activeSearchControllers.get(category)
    if (prev) {
      prev.abort()
    }
    const controller = new AbortController()
    activeSearchControllers.set(category, controller)
    options.signal = controller.signal
  }

  return fetchUtils
    .fetchJson(url, options)
    .then((response) => {
      const token = response.headers.get(customAuthorizationHeader)
      if (token) {
        const decoded = jwtDecode(token)
        localStorage.setItem('token', token)
        localStorage.setItem('userId', decoded.uid)
        // Avoid going to create admin dialog after logout/login without a refresh
        config.firstTime = false
      }
      return response
    })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        // Silently resolve aborted search requests with empty payload and total count header
        const headers = new Headers()
        headers.set('X-Total-Count', '0')
        return { status: 200, headers, json: [] }
      }
      throw error
    })
    .finally(() => {
      if (category && activeSearchControllers.get(category)?.signal === options.signal) {
        activeSearchControllers.delete(category)
      }
    })
}

export default httpClient
