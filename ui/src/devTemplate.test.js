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

  it('ignores former Navidrome-prefixed settings', () => {
    const plugin = devTemplatePlugin(false, {
      ND_ENABLEMEDIAFILEMETADATAEDITING: 'true',
      ND_CASTMEDIABASEURL: 'http://192.168.1.21:4533',
    })
    const html = plugin.transformIndexHtml(
      '<script>window.__APP_CONFIG__ = {{ .AppConfig }}</script>',
    )

    expect(html).not.toContain('true}')
    expect(html).not.toContain('http://192.168.1.21:4533')
  })
})
