const getOrigin = () =>
  typeof window === 'undefined' ? 'http://localhost' : window.location.origin

export const sanitizeCastMediaUrl = (url) => {
  if (!url) return ''

  try {
    const parsed = new URL(url, getOrigin())
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return '[invalid media URL]'
  }
}

export const getCastErrorCode = (error) => {
  // CastSession.loadMedia() may reject with a chrome.cast.ErrorCode value
  // directly instead of a chrome.cast.Error object.
  if (typeof error === 'string' || typeof error === 'number') {
    return String(error) || 'UNKNOWN'
  }
  const code = error?.code || error?.errorCode || error?.details?.code
  return code ? String(code) : 'UNKNOWN'
}

export const createCastMediaError = (error, details = {}) => {
  const code = getCastErrorCode(error)
  const mediaUrl = sanitizeCastMediaUrl(details.mediaUrl)
  const deviceName = details.deviceName || 'Cast device'
  const contentType = details.contentType || 'unknown'
  const publicMessage = [
    `Unable to play on ${deviceName} (${code}).`,
    mediaUrl
      ? `Receiver media URL: ${mediaUrl}.`
      : 'The receiver could not load the media URL.',
    `Media type: ${contentType}.`,
  ].join(' ')

  const diagnostic = new Error(publicMessage)
  diagnostic.name = 'CastMediaError'
  diagnostic.code = code
  diagnostic.publicMessage = publicMessage
  diagnostic.mediaUrl = mediaUrl
  diagnostic.contentType = contentType
  diagnostic.deviceName = deviceName
  diagnostic.phase = details.phase || error?.phase || 'unknown'
  return diagnostic
}

export const logCastMediaFailure = (error, details = {}) => {
  // Cast failures are otherwise invisible because the receiver runs outside
  // the sender page. Keep this one structured log as the debugging boundary.
  // eslint-disable-next-line no-console
  console.error('[Navidrome Cast] Media load failed', {
    code: error?.code || getCastErrorCode(error),
    mediaUrl: error?.mediaUrl || sanitizeCastMediaUrl(details.mediaUrl),
    contentType: error?.contentType || details.contentType || 'unknown',
    deviceName: error?.deviceName || details.deviceName || 'Cast device',
    phase: error?.phase || details.phase || 'unknown',
  })
}
