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

  const senderUrl = new URL(url, window.location.origin)
  const receiverBaseValue = String(config.castMediaBaseURL || '').trim()

  // External radio streams already identify their receiver-accessible host.
  // Only rebase URLs belonging to this Navidrome deployment.
  if (!receiverBaseValue || senderUrl.origin !== window.location.origin) {
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
    subsonic.streamUrl(trackId, { format: 'mp3', maxBitRate: 320 }),
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
