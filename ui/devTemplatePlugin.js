// The Go server replaces these template actions when it serves the embedded
// production UI. Vite serves the same source file directly in development, so
// replace them with safe development values before the browser parses it.
export function devTemplatePlugin(isStandalone = false, environment = process.env) {
  // Keep the browser's runtime config aligned with settings passed to the Go
  // backend by scripts/dev.ps1.
  const devAppConfig = JSON.stringify(
    JSON.stringify({
      castMediaBaseURL: environment.BR_CASTMEDIABASEURL || '',
      enableMediaFileMetadataEditing:
        environment.BR_ENABLEMEDIAFILEMETADATAEDITING === 'true',
    }),
  )

  return {
    name: 'bragi-dev-template',
    apply: isStandalone ? undefined : 'serve',
    enforce: 'pre',
    transformIndexHtml(html) {
      const transformedHtml = html
        .replace(/\{\{\s*\.Version\s*\}\}/g, '1.0.0')
        .replace(/\{\{\s*\.ShareURL\s*\}\}/g, '')
        .replace(/\{\{\s*\.ShareDescription\s*\}\}/g, '')
        .replace(/\{\{\s*\.ShareImageURL\s*\}\}/g, '')
        // config.js expects these globals to contain JSON strings, matching
        // html/template's JavaScript-context output in production.
        .replace(/\{\{\s*\.AppConfig\s*\}\}/g, devAppConfig)
        .replace(/\{\{\s*\.ShareInfo\s*\}\}/g, JSON.stringify('null'))
      return transformedHtml
    },
  }
}
