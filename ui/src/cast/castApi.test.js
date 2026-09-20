import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Cast sender SDK loading', () => {
  let castApi

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('MODE', 'development')
    document.head.innerHTML = ''
    localStorage.clear()
    delete window.cast
    delete window.chrome
    castApi = await import('./castApi')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('removes a failed SDK script so a later attempt can recover', async () => {
    const firstAttempt = castApi.loadCastSenderSdk()
    const firstScript = document.querySelector(
      'script[data-navidrome-cast-sdk="true"]',
    )
    expect(firstScript).not.toBeNull()

    firstScript.dispatchEvent(new Event('error'))
    await expect(firstAttempt).resolves.toBe(false)
    expect(document.contains(firstScript)).toBe(false)

    const secondAttempt = castApi.loadCastSenderSdk()
    const secondScript = document.querySelector(
      'script[data-navidrome-cast-sdk="true"]',
    )
    expect(secondScript).not.toBe(firstScript)

    secondScript.dispatchEvent(new Event('error'))
    await expect(secondAttempt).resolves.toBe(false)
  })

  it('remembers an active session and attempts to rejoin it after refresh', async () => {
    let currentSession = {
      getSessionId: () => 'cast-session-1',
      getCastDevice: () => ({ friendlyName: 'Enki' }),
    }
    const requestSessionById = vi.fn()
    const castContext = {
      addEventListener: vi.fn(),
      getCastState: () => 'CONNECTED',
      getCurrentSession: () => currentSession,
      getSessionState: () => 'SESSION_STARTED',
      setOptions: vi.fn(),
    }
    window.cast = {
      framework: {
        CastContext: { getInstance: () => castContext },
        RemotePlayer: class RemotePlayer {},
        RemotePlayerController: class RemotePlayerController {},
        CastContextEventType: {},
      },
    }
    window.chrome = {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: 'ORIGIN_SCOPED' },
        media: { DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845' },
        requestSessionById,
      },
    }

    await castApi.initializeCast()
    expect(localStorage.getItem('navidrome.cast.sessionId')).toBe(
      'cast-session-1',
    )

    currentSession = null
    vi.resetModules()
    castApi = await import('./castApi')
    await castApi.initializeCast()

    expect(requestSessionById).toHaveBeenCalledWith('cast-session-1')
  })

  it('keeps a remembered session while Cast is initially reporting no session', async () => {
    localStorage.setItem('navidrome.cast.sessionId', 'cast-session-1')
    const requestSessionById = vi.fn()
    const castContext = {
      addEventListener: vi.fn(),
      getCastState: () => 'NOT_CONNECTED',
      getCurrentSession: () => null,
      getSessionState: () => 'NO_SESSION',
      setOptions: vi.fn(),
    }
    window.cast = {
      framework: {
        CastContext: { getInstance: () => castContext },
        RemotePlayer: class RemotePlayer {},
        RemotePlayerController: class RemotePlayerController {},
        CastContextEventType: {},
      },
    }
    window.chrome = {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: 'ORIGIN_SCOPED' },
        media: { DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845' },
        requestSessionById,
      },
    }

    await castApi.initializeCast()

    expect(requestSessionById).toHaveBeenCalledWith('cast-session-1')
  })

  it('does not restore an explicitly stopped session', async () => {
    let session = {
      getSessionId: () => 'cast-session-1',
      getCastDevice: () => ({ friendlyName: 'Enki' }),
    }
    const castContext = {
      addEventListener: vi.fn(),
      endCurrentSession: vi.fn(() => {
        session = null
      }),
      getCastState: () => (session ? 'CONNECTED' : 'NOT_CONNECTED'),
      getCurrentSession: () => session,
      getSessionState: () => (session ? 'SESSION_STARTED' : 'NO_SESSION'),
      setOptions: vi.fn(),
    }
    window.cast = {
      framework: {
        CastContext: { getInstance: () => castContext },
        RemotePlayer: class RemotePlayer {},
        RemotePlayerController: class RemotePlayerController {},
        CastContextEventType: {},
      },
    }
    window.chrome = {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: 'ORIGIN_SCOPED' },
        media: { DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845' },
      },
    }

    vi.resetModules()
    castApi = await import('./castApi')
    await castApi.initializeCast()
    expect(localStorage.getItem('navidrome.cast.sessionId')).toBe(
      'cast-session-1',
    )

    await castApi.endCastSession(true)
    expect(castContext.endCurrentSession).toHaveBeenCalledWith(true)
    expect(localStorage.getItem('navidrome.cast.sessionId')).toBeNull()
  })

  it('rejects with TIMEOUT when castContext.requestSession hangs', async () => {
    const castContext = {
      addEventListener: vi.fn(),
      getCastState: () => 'NOT_CONNECTED',
      getCurrentSession: () => null,
      getSessionState: () => 'NO_SESSION',
      setOptions: vi.fn(),
      requestSession: vi.fn(() => new Promise(() => {})),
    }
    window.cast = {
      framework: {
        CastContext: { getInstance: () => castContext },
        RemotePlayer: class RemotePlayer {},
        RemotePlayerController: class RemotePlayerController {},
        CastContextEventType: {},
      },
    }
    window.chrome = {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: 'ORIGIN_SCOPED' },
        media: { DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845' },
      },
    }

    vi.resetModules()
    castApi = await import('./castApi')
    await castApi.initializeCast()

    await expect(castApi.requestCastSession(50)).rejects.toMatchObject({
      code: 'TIMEOUT',
    })
  })

  it('discards an expired session from localStorage (>24h)', async () => {
    localStorage.setItem('navidrome.cast.sessionId', 'old-session-id')
    localStorage.setItem(
      'navidrome.cast.sessionTimestamp',
      String(Date.now() - 1000 * 60 * 60 * 25), // 25 hours ago
    )
    const requestSessionById = vi.fn()
    const castContext = {
      addEventListener: vi.fn(),
      getCastState: () => 'NOT_CONNECTED',
      getCurrentSession: () => null,
      getSessionState: () => 'NO_SESSION',
      setOptions: vi.fn(),
    }
    window.cast = {
      framework: {
        CastContext: { getInstance: () => castContext },
        RemotePlayer: class RemotePlayer {},
        RemotePlayerController: class RemotePlayerController {},
        CastContextEventType: {},
      },
    }
    window.chrome = {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: 'ORIGIN_SCOPED' },
        media: { DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845' },
        requestSessionById,
      },
    }

    vi.resetModules()
    castApi = await import('./castApi')
    await castApi.initializeCast()

    expect(requestSessionById).not.toHaveBeenCalled()
    expect(localStorage.getItem('navidrome.cast.sessionId')).toBeNull()
  })

  it('detects native Cast and does not inject web SDK in Android WebView', async () => {
    window.BragiNative = {
      hasNativeCast: () => true,
      requestCastSession: vi.fn(),
    }
    vi.resetModules()
    castApi = await import('./castApi')

    expect(castApi.isNativeCastAvailable()).toBe(true)
    const result = await castApi.loadCastSenderSdk()
    expect(result).toBe(true)
    expect(document.querySelector('script[data-navidrome-cast-sdk="true"]')).toBeNull()

    await castApi.requestCastSession()
    expect(window.BragiNative.requestCastSession).toHaveBeenCalled()

    delete window.BragiNative
  })

  it('falls back to BragiNative requestCastSession even if hasNativeCast returns false', async () => {
    window.BragiNative = {
      hasNativeCast: () => false,
      requestCastSession: vi.fn(),
    }
    vi.resetModules()
    castApi = await import('./castApi')

    expect(castApi.isNativeCastAvailable()).toBe(true)
    await castApi.requestCastSession()
    expect(window.BragiNative.requestCastSession).toHaveBeenCalled()

    delete window.BragiNative
  })
})
