// These defaults are only used in development mode. When bundled in the app,
// the __APP_CONFIG__ object is dynamically filled by the ServeIndex function,
// in the /server/app/serve_index.go
const defaultConfig = {
  version: 'dev',
  firstTime: false,
  baseURL: '',
  castMediaBaseURL: '',
  variousArtistsId: '63sqASlAfjbGMuLP4JhnZU', // See consts.VariousArtistsID in consts.go
  loginBackgroundURL: '',
  maxSidebarPlaylists: 100,
  enableTranscodingConfig: true,
  enableDownloads: true,
  enableMediaFileDeletion: false,
  enableFavourites: true,
  losslessFormats: 'FLAC,WAV,ALAC,DSF',
  welcomeMessage: '',
  gaTrackingId: '',
  devActivityPanel: true,
  enableStarRating: true,
  defaultTheme: 'Dark',
  defaultLanguage: '',
  defaultUIVolume: 100,
  uiSearchDebounceMs: 300,
  uiCoverArtSize: 600,
  enableUserEditing: true,
  enableArtworkUpload: true,
  enableSharing: false,
  shareURL: '',
  defaultDownloadableShare: true,
  devSidebarPlaylists: true,
  lastFMEnabled: true,
  listenBrainzEnabled: true,
  enableExternalServices: true,
  enableCoverAnimation: true,
  playbackReportIntervalMs: 60000,
  devShowArtistPage: true,
  devUIShowConfig: true,
  devNewEventStream: false,
  enableReplayGain: true,
  defaultDownsamplingFormat: 'opus',
  publicBaseUrl: '/share',
  separator: '/',
  enableInspect: true,
  pluginsEnabled: true,
}

let config

try {
  const appConfig = JSON.parse(window.__APP_CONFIG__)
  config = {
    ...defaultConfig,
    ...appConfig,
  }
} catch (e) {
  config = { ...defaultConfig }
}

// Bind native Android server address and Cast receiver base if running inside APK wrapper
if (typeof window !== 'undefined') {
  let nativeServer = ''
  let castMediaBase = ''
  try {
    if (window.__BRAGI_SERVER_URL__) {
      nativeServer = window.__BRAGI_SERVER_URL__
    } else if (
      window.BragiNative &&
      typeof window.BragiNative.getServerUrl === 'function'
    ) {
      nativeServer = window.BragiNative.getServerUrl()
    } else if (localStorage.getItem('bragi_server_url')) {
      nativeServer = localStorage.getItem('bragi_server_url')
    }

    if (window.__BRAGI_CAST_MEDIA_BASE_URL__) {
      castMediaBase = window.__BRAGI_CAST_MEDIA_BASE_URL__
    } else if (
      window.BragiNative &&
      typeof window.BragiNative.getCastMediaBaseUrl === 'function'
    ) {
      castMediaBase = window.BragiNative.getCastMediaBaseUrl()
    } else if (localStorage.getItem('bragi_cast_media_base_url')) {
      castMediaBase = localStorage.getItem('bragi_cast_media_base_url')
    }
  } catch (e) {}

  if (nativeServer) {
    const cleanUrl = nativeServer.trim().replace(/\/+$/, '')
    config.baseURL = cleanUrl
    try {
      localStorage.setItem('bragi_server_url', cleanUrl)
    } catch (e) {}
  }

  if (castMediaBase) {
    const cleanCastUrl = castMediaBase.trim().replace(/\/+$/, '')
    config.castMediaBaseURL = cleanCastUrl
    try {
      localStorage.setItem('bragi_cast_media_base_url', cleanCastUrl)
    } catch (e) {}
  }

  window.__bragiSetCastMediaBaseUrl = (url) => {
    if (!url) return
    const clean = url.trim().replace(/\/+$/, '')
    config.castMediaBaseURL = clean
    try {
      localStorage.setItem('bragi_cast_media_base_url', clean)
    } catch (e) {}
  }
}

export const setServerUrl = (url) => {
  if (!url) return
  const cleanUrl = url.trim().replace(/\/+$/, '')
  config.baseURL = cleanUrl
  try {
    localStorage.setItem('bragi_server_url', cleanUrl)
  } catch (e) {}
}

export let shareInfo

try {
  shareInfo = JSON.parse(window.__SHARE_INFO__)
} catch (e) {
  shareInfo = null
}

export default config
