import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

describe('runtime server configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    window.__APP_CONFIG__ = JSON.stringify({ castMediaBaseURL: '' })
    window.__SHARE_INFO__ = 'null'
  })

  afterEach(() => {
    delete window.__APP_CONFIG__
    delete window.__SHARE_INFO__
    delete window.BragiNative
  })

  it('merges server feature flags exposed by the Android bridge', async () => {
    window.BragiNative = {
      getServerUrl: () => 'https://bragi.example',
      getServerConfig: () =>
        JSON.stringify({
          enableMediaFileDeletion: true,
          baseURL: '/music',
        }),
    }

    const { default: config } = await import('./config.js')

    expect(config.enableMediaFileDeletion).toBe(true)
    // The native server origin still takes precedence for API requests.
    expect(config.baseURL).toBe('https://bragi.example')
  })
})
