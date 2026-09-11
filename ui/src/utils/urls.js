import config from '../config'

export const baseUrl = (path) => {
  if (!path) return ''
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path
  }
  const base = (config.baseURL || '').replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  if (!base) {
    return `/${cleanPath}`
  }
  return `${base}/${cleanPath}`
}

export const shareUrl = (path) => {
  if (config.shareURL !== '') {
    const base = config.shareURL || ''
    const parts = [base]
    parts.push(path.replace(/^\//, ''))
    return parts.join('/')
  }
  return baseUrl(path)
}

export const sharePlayerUrl = (id) => {
  const url = new URL(
    shareUrl(config.publicBaseUrl + '/' + id),
    window.location.href,
  )
  return url.href
}

export const shareStreamUrl = (id) => {
  return shareUrl(config.publicBaseUrl + '/s/' + id)
}

export const shareDownloadUrl = (id) => {
  return shareUrl(config.publicBaseUrl + '/d/' + id)
}

export const shareCoverUrl = (id, square) => {
  return shareUrl(
    config.publicBaseUrl +
      '/img/' +
      id +
      '?size=300' +
      (square ? '&square=true' : ''),
  )
}

export const docsUrl = (path) => `https://www.navidrome.org${path}`

export const isLastFmURL = (url) => {
  try {
    const parsed = new URL(url)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'last.fm' || parsed.hostname.endsWith('.last.fm')) &&
      parsed.pathname.startsWith('/music/')
    )
  } catch (e) {
    return false
  }
}
