import config from '../config'
import subsonic from '../subsonic'
import { trackIdOf } from '../audioplayer/trackModel'

const normalizePath = (path = '') => {
  const normalized = `/${String(path)}`.replace(/\/{2,}/g, '/')
  return normalized === '/' ? '' : normalized.replace(/\/$/, '')
}

const pathWithoutAppBase = (path) => {
  const appBase = normalizePath(config.baseURL)
  if (!appBase) return path
  if (path === appBase) return '/'
  return path.startsWith(`${appBase}/`) ? path.slice(appBase.length) : path
}

export const toCastReceiverUrl = (url) => {
  if (!url) return ''

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const senderUrl = new URL(url, origin)
  const receiverBaseValue = String(config.castMediaBaseURL || '').trim()

  const isAppAssets = senderUrl.hostname === 'appassets.androidplatform.net'
  const serverBase =
    config.baseURL ||
    (typeof window !== 'undefined' && window.BragiNative?.getServerUrl?.()) ||
    (typeof localStorage !== 'undefined' &&
      localStorage.getItem('bragi_server_url')) ||
    ''

  if (isAppAssets && serverBase) {
    const serverUrl = new URL(serverBase)
    senderUrl.protocol = serverUrl.protocol
    senderUrl.host = serverUrl.host
    return senderUrl.href
  }

  // External radio streams already identify their receiver-accessible host.
  // Only rebase URLs belonging to this Navidrome deployment.
  if (!receiverBaseValue || senderUrl.origin !== origin) {
    return senderUrl.href
  }

  const receiverUrl = new URL(receiverBaseValue)
  const receiverBasePath = normalizePath(receiverUrl.pathname)
  const mediaPath = pathWithoutAppBase(senderUrl.pathname)
  receiverUrl.pathname = `${receiverBasePath}${mediaPath || '/'}`
  receiverUrl.search = senderUrl.search
  receiverUrl.hash = ''
  return receiverUrl.href
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
