export function createPwaManifest({ development = false } = {}) {
  return {
    name: 'Bragi',
    short_name: 'Bragi',
    description:
      'Bragi, a modern music collection server and streamer',
    categories: ['music', 'entertainment'],
    display: 'standalone',
    ...(development
      ? {
          id: '/app/',
          start_url: '/app/#/song',
          scope: '/app/',
        }
      : { start_url: './' }),
    background_color: '#303030',
    theme_color: '#303030',
    icons: [
      {
        src: './android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: './android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
