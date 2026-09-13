import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import config from '../config'
import subsonic from '../subsonic'
import { resolveCastMedia, toCastReceiverUrl } from './castMedia'

vi.mock('../subsonic', () => ({
  default: {
    streamUrl: vi.fn((id, options = {}) => {
      const query = new URLSearchParams({ id: String(id), ...options })
      return `/rest/stream?${query.toString()}`
    }),
    getCoverArtUrl: vi.fn(() => ''),
  },
}))

describe('resolveCastMedia', () => {
  const originalBaseURL = config.baseURL
  const originalCastMediaBaseURL = config.castMediaBaseURL

  beforeEach(() => {
    config.baseURL = ''
    config.castMediaBaseURL = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    config.baseURL = originalBaseURL
    config.castMediaBaseURL = originalCastMediaBaseURL
  })

  it('always uses the authenticated MP3 stream contract for songs', async () => {
    const media = await resolveCastMedia({ trackId: 'song-1' })

    expect(subsonic.streamUrl).toHaveBeenCalledWith('song-1', {
      format: 'mp3',
      maxBitRate: 320,
      estimateContentLength: true,
    })
    expect(media.url).toContain('/rest/stream')
    expect(media.url).toContain('format=mp3')
    expect(media.url).toContain('maxBitRate=320')
    expect(media.contentType).toBe('audio/mpeg')
  })

  it('rebases Navidrome media onto the receiver-accessible URL', async () => {
    config.castMediaBaseURL = 'http://192.168.2.11:4533'

    const media = await resolveCastMedia({ trackId: 'song-2' })

    expect(media.url).toMatch(/^http:\/\/192\.168\.2\.11:4533\/rest\/stream\?/)
    expect(media.url).toContain('id=song-2')
  })

  it('supports matching application paths without duplicating them', () => {
    config.baseURL = '/music'
    config.castMediaBaseURL = 'http://navidrome.local:4533/music/'

    expect(toCastReceiverUrl('/music/rest/stream?id=song-3&format=mp3')).toBe(
      'http://navidrome.local:4533/music/rest/stream?id=song-3&format=mp3',
    )
  })

  it('does not rewrite an external radio stream', async () => {
    config.castMediaBaseURL = 'http://192.168.2.11:4533'

    const media = await resolveCastMedia({
      trackId: 'radio-1',
      isRadio: true,
      streamUrl: 'https://radio.example/live.mp3',
    })

    expect(media).toEqual({
      url: 'https://radio.example/live.mp3',
      contentType: 'audio/mpeg',
    })
  })

  it('rebases media in Android APK standalone wrapper when origin is appassets', () => {
    config.baseURL = 'https://bragi.lan'
    config.castMediaBaseURL = 'http://192.168.2.28:4533'

    const rewritten = toCastReceiverUrl(
      'https://bragi.lan/rest/stream?id=song-apk&format=mp3',
    )
    expect(rewritten).toBe(
      'http://192.168.2.28:4533/rest/stream?id=song-apk&format=mp3',
    )
  })

  it('rebases media in Android APK when stream URL is under appassets', () => {
    config.baseURL = 'https://bragi.lan'
    config.castMediaBaseURL = 'http://192.168.2.28:4533'

    const rewritten = toCastReceiverUrl(
      'https://appassets.androidplatform.net/rest/stream?id=song-assets&format=mp3',
    )
    expect(rewritten).toBe(
      'http://192.168.2.28:4533/rest/stream?id=song-assets&format=mp3',
    )
  })
})
