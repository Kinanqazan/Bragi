// Development only: this worker exists so the live Vite URL can be installed
// as a PWA. It deliberately has no precaching, Workbox imports, or navigation
// interception, so it cannot serve stale HMR assets or parse as the wrong
// service-worker type.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
