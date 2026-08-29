export const unregisterNonDevelopmentWorkers = async (serviceWorker) => {
  if (typeof serviceWorker?.getRegistrations !== 'function') return

  const registrations = await serviceWorker.getRegistrations()
  if (!Array.isArray(registrations)) return

  await Promise.all(
    registrations
      .filter((registration) => {
        const scriptURLs = [
          registration?.active?.scriptURL,
          registration?.waiting?.scriptURL,
          registration?.installing?.scriptURL,
        ].filter((scriptURL) => typeof scriptURL === 'string')

        return scriptURLs.some((scriptURL) => !scriptURL.includes('/sw-dev.js'))
      })
      .map((registration) => registration.unregister?.()),
  )
}
