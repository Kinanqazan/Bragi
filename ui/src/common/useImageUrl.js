import { useEffect, useState, useRef } from 'react'
import { getArtworkBlob, setArtworkBlob } from './artworkStore'

// In-memory LRU cache: keeps recent object URLs alive for 0ms synchronous paints.
const cache = new Map()
const MAX_CACHE_SIZE = 300

// In-flight requests (both IndexedDB lookups and network fetches) mapped by canonicalKey:
// canonicalKey -> { controller, subscribers: Set<Function>, inQueue: boolean, fetchStarted: boolean }
const inFlightRequests = new Map()

// Concurrency pool for distinct network fetches.
const MAX_CONCURRENT = 6
let activeFetches = 0
const pendingQueue = []

const processQueue = () => {
  while (pendingQueue.length > 0 && activeFetches < MAX_CONCURRENT) {
    const next = pendingQueue.shift()
    next()
  }
}

// Evicts oldest unused entries from in-memory LRU.
const evictIfNeeded = () => {
  if (cache.size <= MAX_CACHE_SIZE) return
  for (const [key, entry] of cache) {
    if (cache.size <= MAX_CACHE_SIZE) break
    if (entry.refCount === 0) {
      if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl)
      cache.delete(key)
    }
  }
}

/**
 * Derives a content-addressable canonical cache key for an image URL.
 * Strips transient session authentication parameters (u, t, s, jwt)
 * and coalesces tracks from the same album into a single hash key.
 */
export const getCanonicalKey = (url) => {
  if (!url) return ''
  try {
    const parsed = new URL(url, 'http://localhost')
    if (parsed.pathname.includes('getCoverArt')) {
      const id = parsed.searchParams.get('id') || ''
      const size = parsed.searchParams.get('size') || 'orig'
      const square = parsed.searchParams.get('square') || 'false'

      // Check for content-addressed imageHash suffix (e.g., mf-123_0123456789abcdef)
      const hashMatch = id.match(/_([a-fA-F0-9]{8,64})$/)
      if (hashMatch) {
        return `art:hash:${hashMatch[1]}:${size}:${square}`
      }

      const ts = parsed.searchParams.get('_') || ''
      return `art:id:${id}:${size}:${square}${ts ? `:${ts}` : ''}`
    }

    // Generic URL: remove session auth parameters
    parsed.searchParams.delete('u')
    parsed.searchParams.delete('t')
    parsed.searchParams.delete('s')
    parsed.searchParams.delete('jwt')
    parsed.searchParams.delete('_')
    return parsed.pathname + (parsed.search ? parsed.search : '')
  } catch {
    return url
  }
}

/**
 * Hook to load an image with:
 * 1. Synchronous L1 memory LRU cache hit (0ms)
 * 2. Immediate in-flight request deduplication across multiple tracks
 * 3. Persistent L2 on-device storage (IndexedDB) for offline/app restart
 * 4. Automatic cancellation on unmount
 */
export const useImageUrl = (url) => {
  const canonicalKey = url ? getCanonicalKey(url) : ''
  const cached = canonicalKey ? cache.get(canonicalKey) : null

  const [imgUrl, setImgUrl] = useState(cached?.blobUrl || null)
  const [loading, setLoading] = useState(!!url && !cached?.blobUrl)
  const [error, setError] = useState(cached?.error || false)
  const [fromCache, setFromCache] = useState(!!cached?.blobUrl)
  const [trackedKey, setTrackedKey] = useState(canonicalKey)

  const isMountedRef = useRef(true)

  if (trackedKey !== canonicalKey) {
    setTrackedKey(canonicalKey)
    setImgUrl(cached?.blobUrl || null)
    setLoading(!!url && !cached?.blobUrl)
    setError(cached?.error || false)
    setFromCache(!!cached?.blobUrl)
  }

  useEffect(() => {
    isMountedRef.current = true

    if (!url || !canonicalKey) {
      setImgUrl(null)
      setLoading(false)
      setError(false)
      setFromCache(false)
      return undefined
    }

    // 1. Check L1 Memory Cache (synchronous)
    const memEntry = cache.get(canonicalKey)
    if (memEntry) {
      if (memEntry.error) {
        setImgUrl(null)
        setLoading(false)
        setError(true)
        return undefined
      }
      cache.delete(canonicalKey)
      cache.set(canonicalKey, memEntry)
      memEntry.refCount++
      setImgUrl(memEntry.blobUrl)
      setLoading(false)
      setError(false)
      setFromCache(true)
      return () => {
        memEntry.refCount--
      }
    }

    let isEffectActive = true

    const notifySubscriber = (result) => {
      if (!isEffectActive || !isMountedRef.current) return
      if (result.error) {
        setError(true)
        setLoading(false)
      } else if (result.blobUrl) {
        setImgUrl(result.blobUrl)
        setLoading(false)
        setError(false)
        if (result.fromCache) {
          setFromCache(true)
        }
      }
    }

    // 2. Immediate In-Flight Deduplication Check
    const existingInFlight = inFlightRequests.get(canonicalKey)
    if (existingInFlight) {
      setLoading(true)
      existingInFlight.subscribers.add(notifySubscriber)
      return () => {
        isEffectActive = false
        existingInFlight.subscribers.delete(notifySubscriber)
        if (existingInFlight.subscribers.size === 0) {
          if (existingInFlight.inQueue && existingInFlight.doFetch) {
            const idx = pendingQueue.indexOf(existingInFlight.doFetch)
            if (idx !== -1) pendingQueue.splice(idx, 1)
          } else {
            existingInFlight.controller.abort()
          }
          inFlightRequests.delete(canonicalKey)
        }
        const entry = cache.get(canonicalKey)
        if (entry) entry.refCount--
      }
    }

    // 3. Register as the primary in-flight coordinator for this canonicalKey
    const controller = new AbortController()
    const inFlightRecord = {
      controller,
      subscribers: new Set([notifySubscriber]),
      inQueue: false,
      doFetch: null,
    }
    inFlightRequests.set(canonicalKey, inFlightRecord)
    setLoading(true)

    // Complete pipeline handler
    const resolveSuccess = (blob, fromIdb = false) => {
      const objectUrl = URL.createObjectURL(blob)
      const existing = cache.get(canonicalKey)
      let finalUrl = objectUrl

      if (existing && existing.blobUrl) {
        existing.refCount++
        URL.revokeObjectURL(objectUrl)
        finalUrl = existing.blobUrl
      } else {
        cache.set(canonicalKey, { blobUrl: objectUrl, refCount: inFlightRecord.subscribers.size })
        evictIfNeeded()
      }

      inFlightRequests.delete(canonicalKey)
      inFlightRecord.subscribers.forEach((sub) =>
        sub({ blobUrl: finalUrl, fromCache: fromIdb }),
      )
    }

    const resolveError = (err) => {
      inFlightRequests.delete(canonicalKey)
      if (err?.name === 'AbortError') {
        return
      }
      cache.set(canonicalKey, { blobUrl: null, error: true, refCount: 0 })
      inFlightRecord.subscribers.forEach((sub) => sub({ error: true }))
    }

    // 4. Check L2 Persistent Storage (IndexedDB)
    getArtworkBlob(canonicalKey)
      .then((storedBlob) => {
        if (!inFlightRequests.has(canonicalKey)) return

        if (storedBlob) {
          resolveSuccess(storedBlob, true)
        } else {
          // Cache miss in IndexedDB: proceed to network fetch
          inFlightRecord.doFetch = () => {
            inFlightRecord.inQueue = false
            activeFetches++

            fetch(url, { signal: controller.signal })
              .then((res) => {
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`)
                }
                return res.blob()
              })
              .then((blob) => {
                activeFetches--
                processQueue()

                // Persist to IndexedDB in background
                setArtworkBlob(canonicalKey, blob).catch(() => {})
                resolveSuccess(blob, false)
              })
              .catch((err) => {
                activeFetches--
                processQueue()
                resolveError(err)
              })
          }

          if (activeFetches < MAX_CONCURRENT) {
            inFlightRecord.doFetch()
          } else {
            inFlightRecord.inQueue = true
            pendingQueue.push(inFlightRecord.doFetch)
          }
        }
      })
      .catch(() => {
        // On IndexedDB failure, fallback directly to network
        if (inFlightRequests.has(canonicalKey)) {
          inFlightRecord.doFetch = () => {
            inFlightRecord.inQueue = false
            activeFetches++
            fetch(url, { signal: controller.signal })
              .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.blob()
              })
              .then((blob) => {
                activeFetches--
                processQueue()
                resolveSuccess(blob, false)
              })
              .catch((err) => {
                activeFetches--
                processQueue()
                resolveError(err)
              })
          }
          if (activeFetches < MAX_CONCURRENT) {
            inFlightRecord.doFetch()
          } else {
            inFlightRecord.inQueue = true
            pendingQueue.push(inFlightRecord.doFetch)
          }
        }
      })

    return () => {
      isEffectActive = false
      inFlightRecord.subscribers.delete(notifySubscriber)
      if (inFlightRecord.subscribers.size === 0) {
        if (inFlightRecord.inQueue && inFlightRecord.doFetch) {
          const idx = pendingQueue.indexOf(inFlightRecord.doFetch)
          if (idx !== -1) pendingQueue.splice(idx, 1)
        } else {
          controller.abort()
        }
        inFlightRequests.delete(canonicalKey)
      }
      const entry = cache.get(canonicalKey)
      if (entry) {
        entry.refCount--
      }
    }
  }, [url, canonicalKey])

  return { imgUrl, loading, error, fromCache }
}
