import { describe, expect, it } from 'vitest'
import { devTemplatePlugin } from '../devTemplatePlugin'

describe('Vite development template configuration', () => {
  it('passes the server metadata-editing flag into the browser app config', () => {
    const plugin = devTemplatePlugin(false, {
      ND_ENABLEMEDIAFILEMETADATAEDITING: 'true',
    })
    const html = plugin.transformIndexHtml(
      '<script>window.__APP_CONFIG__ = {{ .AppConfig }}</script>',
    )

    expect(html).toContain('enableMediaFileMetadataEditing')
    expect(html).toContain('true')
  })
})
