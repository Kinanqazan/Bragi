import { describe, expect, it } from 'vitest'
import {
  createCastMediaError,
  getCastErrorCode,
  sanitizeCastMediaUrl,
} from './castDiagnostics'

describe('Cast diagnostics', () => {
  it('preserves string error codes returned by loadMedia', () => {
    expect(getCastErrorCode('LOAD_MEDIA_FAILED')).toBe('LOAD_MEDIA_FAILED')
  })

  it('removes authentication and transcode tokens from media URLs', () => {
    const url =
      'https://bragi.lan/rest/getTranscodeStream?u=alice&t=secret&s=salt&transcodeParams=jwt-token&mediaId=song-1'

    expect(sanitizeCastMediaUrl(url)).toBe(
      'https://bragi.lan/rest/getTranscodeStream',
    )
  })

  it('creates a useful error without retaining sensitive query parameters', () => {
    const error = createCastMediaError(
      { code: 'LOAD_MEDIA_FAILED', message: 'receiver rejected media' },
      {
        mediaUrl:
          'https://bragi.lan/rest/stream?u=alice&t=secret&s=salt&id=song-1',
        contentType: 'audio/mpeg',
        deviceName: 'Kitchen Nest',
      },
    )

    expect(error.code).toBe('LOAD_MEDIA_FAILED')
    expect(error.publicMessage).toContain('Kitchen Nest')
    expect(error.publicMessage).toContain('https://bragi.lan/rest/stream')
    expect(error.publicMessage).not.toContain('secret')
    expect(error.publicMessage).not.toContain('salt')
    expect(error.publicMessage).not.toContain('song-1')
  })
})
