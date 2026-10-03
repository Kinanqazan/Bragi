import { describe, expect, it } from 'vitest'
import { devTemplatePlugin } from '../devTemplatePlugin'

describe('Vite development template configuration', () => {
  it('passes Bragi-prefixed server settings into the browser app config', () => {
    const plugin = devTemplatePlugin(false, {
      BR_ENABLEMEDIAFILEMETADATAEDITING: 'true',
      BR_CASTMEDIABASEURL: 'http://192.168.1.20:4533',
    })
    const html = plugin.transformIndexHtml(
      '<script>window.__APP_CONFIG__ = {{ .AppConfig }}</script>',
    )

    expect(html).toContain('enableMediaFileMetadataEditing')
    expect(html).toContain('true')
    expect(html).toContain('http://192.168.1.20:4533')
  })

  it('continues to accept legacy Navidrome-prefixed settings', () => {
    const plugin = devTemplatePlugin(false, {
      ND_ENABLEMEDIAFILEMETADATAEDITING: 'true',
      ND_CASTMEDIABASEURL: 'http://192.168.1.21:4533',
    })
    const html = plugin.transformIndexHtml(
      '<script>window.__APP_CONFIG__ = {{ .AppConfig }}</script>',
    )

    expect(html).toContain('true')
    expect(html).toContain('http://192.168.1.21:4533')
  })

  it('prefers Bragi-prefixed settings when both prefixes are set', () => {
    const plugin = devTemplatePlugin(false, {
      BR_ENABLEMEDIAFILEMETADATAEDITING: 'false',
      ND_ENABLEMEDIAFILEMETADATAEDITING: 'true',
    })
    const html = plugin.transformIndexHtml(
      '<script>window.__APP_CONFIG__ = {{ .AppConfig }}</script>',
    )

    expect(html).toContain('false}')
    expect(html).not.toContain('true}')
  })
})
