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
  })

  it('loads server feature flags', async () => {
    window.__APP_CONFIG__ = JSON.stringify({ enableMediaFileDeletion: true, baseURL: '/music' })
    const { default: config } = await import('./config.js')
    expect(config.enableMediaFileDeletion).toBe(true)
    expect(config.baseURL).toBe('/music')
  })
})
