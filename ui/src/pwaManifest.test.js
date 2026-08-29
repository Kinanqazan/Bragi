import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createPwaManifest } from './pwaManifest'

describe('PWA manifest', () => {
  it('uses the installable app route and stable identity in development', () => {
    const manifest = createPwaManifest({ development: true })

    expect(manifest).toMatchObject({
      id: '/app/',
      start_url: '/app/#/song',
      scope: '/app/',
    })
  })

  it('keeps production URLs relative for base-URL deployments', () => {
    const manifest = createPwaManifest({ development: false })

    expect(manifest.start_url).toBe('./')
    expect(manifest).not.toHaveProperty('id')
    expect(manifest).not.toHaveProperty('scope')
  })

  it('leaves manifest-link injection to the PWA plugin', () => {
    const sourceHtml = readFileSync(
      resolve(process.cwd(), 'index.html'),
      'utf8',
    )

    expect(sourceHtml).not.toMatch(/<link[^>]+rel=["']manifest["']/i)
  })
})
