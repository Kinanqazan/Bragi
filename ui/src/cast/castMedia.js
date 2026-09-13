import config from '../config'
import subsonic from '../subsonic'
import { trackIdOf } from '../audioplayer/trackModel'

const normalizePath = (path = '') => {
  const normalized = `/${String(path)}`.replace(/\/{2,}/g, '/')
  return normalized === '/' ? '' : normalized.replace(/\/$/, '')
}

const getBasePathFromUrlOrPath = (value = '') => {
  if (!value) return ''
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const p = new URL(value).pathname.replace(/\/+$/, '')
      return p === '/' ? '' : p
    }
  } catch (e) {}
  return normalizePath(value)
}

const pathWithoutAppBase = (path, baseValue) => {
  const appBase = getBasePathFromUrlOrPath(baseValue)
  if (!appBase) return path
  if (path === appBase) return '/'
  return path.startsWith(`${appBase}/`) ? path.slice(appBase.length) : path
}

export const toCastReceiverUrl = (url) => {
  if (!url) return ''

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const senderUrl = new URL(url, origin)
  const receiverBaseValue = String(
    config.castMediaBaseURL ||
      (typeof window !== 'undefined' && window.__BRAGI_CAST_MEDIA_BASE_URL__) ||
      (typeof window !== 'undefined' &&
        window.BragiNative?.getCastMediaBaseUrl?.()) ||
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('bragi_cast_media_base_url')) ||
      '',
  ).trim()

  const isAppAssets = senderUrl.hostname === 'appassets.androidplatform.net'
  const serverBase =
    config.baseURL ||
    (typeof window !== 'undefined' && window.BragiNative?.getServerUrl?.()) ||
    (typeof localStorage !== 'undefined' &&
      localStorage.getItem('bragi_server_url')) ||
    ''

  let serverOrigin = ''
  if (serverBase) {
    try {
      serverOrigin = new URL(serverBase, origin).origin
    } catch (e) {}
  }

  // A track belongs to this Navidrome server if:
  // 1. Its origin matches window.location.origin (e.g. browser or PWA)
  // 2. Its origin matches serverBase origin (e.g. Android APK wrapper targeting https://bragi.lan)
  // 3. It was loaded from appassets (offline wrapper)
  // 4. Its path is a Subsonic rest endpoint (/rest/stream, /rest/getCoverArt, etc.)
  const isNavidromeMedia =
    senderUrl.origin === origin ||
    (serverOrigin && senderUrl.origin === serverOrigin) ||
    isAppAssets ||
    senderUrl.pathname.includes('/rest/stream') ||
    senderUrl.pathname.includes('/rest/getCoverArt')

  if (receiverBaseValue && isNavidromeMedia) {
    const receiverUrl = new URL(receiverBaseValue)
    const receiverBasePath = normalizePath(receiverUrl.pathname)
    const mediaPath = pathWithoutAppBase(senderUrl.pathname, serverBase || config.baseURL)
    receiverUrl.pathname = `${receiverBasePath}${mediaPath || '/'}`.replace(/\/{2,}/g, '/')
    receiverUrl.search = senderUrl.search
    receiverUrl.hash = ''
    return receiverUrl.href
  }

  if (isAppAssets && serverBase) {
    const serverUrl = new URL(serverBase)
    senderUrl.protocol = serverUrl.protocol
    senderUrl.host = serverUrl.host
    return senderUrl.href
  }

  return senderUrl.href
}

const mp3Media = (trackId) => ({
  url: toCastReceiverUrl(
    subsonic.streamUrl(trackId, {
      format: 'mp3',
      maxBitRate: 320,
      estimateContentLength: true,
    }),
  ),
  contentType: 'audio/mpeg',
})

export const resolveCastMedia = async (track) => {
  const trackId = trackIdOf(track)
  if (!trackId) throw new Error('Cannot cast a track without an ID')

  if (track.isRadio && track.streamUrl) {
    return {
      url: toCastReceiverUrl(track.streamUrl),
      contentType: track.contentType || 'audio/mpeg',
    }
  }

  // This is the deliberately conservative Cast contract: Navidrome's
  // authenticated Subsonic stream endpoint and universally supported MP3.
  // It avoids the browser-oriented getTranscodeStream negotiation path.
  return mp3Media(trackId)
}
