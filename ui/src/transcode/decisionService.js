import { jwtDecode } from 'jwt-decode'
import subsonic from '../subsonic'
import { baseUrl } from '../utils'

// Decode the exp claim from a JWT token (no signature verification needed client-side).
// The JWT token is meant to be opaque to the client, we are only allowing ourselves to do
// this here because the UI is tightly integrated with the server; normally we would
// need to rely on the getTranscodeStream returning an error on stale tokens.
export function decodeJwtExp(token) {
  try {
    if (!token) return null
    const payload = jwtDecode(token)
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export function createDecisionService(fetchFn) {
  const cache = new Map()
  const pending = new Map()
  const invalidationVersions = new Map()
  let prefetchChain = Promise.resolve()
  let currentProfile = null

  function isFresh(entry) {
    const exp = decodeJwtExp(entry.decision?.transcodeParams)
    if (exp == null) return false
    // exp is in seconds, Date.now() in milliseconds; 60s buffer avoids mid-request expiry
    return Date.now() < (exp - 60) * 1000
  }

  function setProfile(profile) {
    if (currentProfile !== profile) {
      invalidateAll()
    }
    currentProfile = profile
  }

  function getProfile() {
    return currentProfile
  }

  function getDecision(songId, browserProfile) {
    const profile = browserProfile || currentProfile
    if (!profile) return null

    const cached = cache.get(songId)
    if (cached && isFresh(cached)) {
      return cached.decision
    }

    const existingRequest = pending.get(songId)
    if (existingRequest) return existingRequest

    const version = invalidationVersions.get(songId) || 0
    let request
    request = Promise.resolve()
      .then(() => fetchFn(songId, profile))
      .then((decision) => {
        // An invalidated request may still resolve. Do not allow stale work to
        // repopulate the cache after the caller explicitly invalidated it.
        if (
          (invalidationVersions.get(songId) || 0) === version &&
          pending.get(songId) === request
        ) {
          cache.set(songId, { decision })
        }
        return decision
      })
      .finally(() => {
        if (pending.get(songId) === request) pending.delete(songId)
      })

    pending.set(songId, request)
    return request
  }

  async function prefetchDecisions(songIds, browserProfile) {
    const profile = browserProfile || currentProfile
    if (!profile) return

    const uniqueIds = [...new Set(songIds)].filter(Boolean)
    const run = async () => {
      for (const id of uniqueIds) {
        const entry = cache.get(id)
        if (entry && isFresh(entry)) continue

        // getDecision owns the pending-request map, so a foreground request
        // and a background prefetch for the same track share one request.
        await getDecision(id, profile).catch(() => undefined)
      }
    }

    // Serialize prefetch batches globally. Foreground getDecision calls do not
    // wait for this chain and can still start immediately.
    prefetchChain = prefetchChain.then(run, run)
    await prefetchChain
  }

  function invalidate(songId) {
    if (songId) {
      invalidationVersions.set(
        songId,
        (invalidationVersions.get(songId) || 0) + 1,
      )
      pending.delete(songId)
      cache.delete(songId)
    } else {
      invalidateAll()
    }
  }

  function invalidateAll() {
    cache.clear()
    for (const songId of pending.keys()) {
      invalidationVersions.set(
        songId,
        (invalidationVersions.get(songId) || 0) + 1,
      )
    }
    pending.clear()
  }

  function buildStreamUrl(songId, transcodeParams, offset) {
    const params = {
      mediaId: songId,
      mediaType: 'song',
      transcodeParams,
      ts: true,
    }
    if (offset != null && offset > 0) {
      params.offset = Math.floor(offset)
    }
    return baseUrl(subsonic.url('getTranscodeStream', null, params))
  }

  async function resolveStreamUrl(songId, offset) {
    const decision = await getDecision(songId)
    const roundedOffset =
      offset != null && offset > 0 ? Math.floor(offset) : undefined
    if (!decision?.transcodeParams) {
      return baseUrl(
        subsonic.streamUrl(
          songId,
          roundedOffset ? { offset: roundedOffset } : undefined,
        ),
      )
    }
    return buildStreamUrl(songId, decision.transcodeParams, roundedOffset)
  }

  function getCachedDecision(songId) {
    const entry = cache.get(songId)
    if (entry && isFresh(entry)) {
      return entry.decision
    }
    return null
  }

  return {
    getDecision,
    getCachedDecision,
    prefetchDecisions,
    resolveStreamUrl,
    invalidate,
    invalidateAll,
    buildStreamUrl,
    setProfile,
    getProfile,
  }
}
