import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'
import { unregisterNonDevelopmentWorkers } from './serviceWorkerRegistration'
import { initializeCast } from './cast/castApi'

initializeCast().catch(() => undefined)

const isNativeApp = typeof window !== 'undefined' && Boolean(window.BragiNative)
const devPwaEnabled = import.meta.env.VITE_ENABLE_DEV_PWA === 'true'

if (isNativeApp) {
  // In the native Android APK, the service worker is not used (assets are either
  // bundled in the APK or served dynamically via Vite HMR in live dev mode).
  // Skipping registration also prevents Chromium SSL certificate errors when
  // connecting via local reverse proxies (e.g. self-signed certs).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister())
    }).catch(() => undefined)
  }
} else if (import.meta.env.PROD) {
  registerSW({ immediate: true })
} else if (devPwaEnabled) {
  // Replace a previously installed production worker before registering
  // Vite's network-first development worker. Otherwise the old worker can
  // continue serving a cached bundle while HMR is trying to update it.
  unregisterNonDevelopmentWorkers(navigator.serviceWorker)
    .catch(() => undefined)
    .then(() => registerSW({ immediate: true }))
    .catch(() => undefined)
} else if ('serviceWorker' in navigator) {
  // Normal Vite development stays service-worker free so HMR cannot be served
  // from an old cache. The live test script opts in when PWA installation is
  // needed.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

ReactDOM.render(<App />, document.getElementById('root'))
