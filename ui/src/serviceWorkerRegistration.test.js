import { describe, expect, it, vi } from 'vitest'
import { unregisterNonDevelopmentWorkers } from './serviceWorkerRegistration'

describe('service worker registration cleanup', () => {
  it('removes stale workers using the browser registration shape', async () => {
    const oldWorker = {
      active: { scriptURL: 'https://app.test/sw.js' },
      unregister: vi.fn(() => Promise.resolve(true)),
    }
    const developmentWorker = {
      active: { scriptURL: 'https://app.test/sw-dev.js?dev-sw' },
      unregister: vi.fn(() => Promise.resolve(true)),
    }
    const installingOldWorker = {
      installing: { scriptURL: 'https://app.test/sw.js' },
      unregister: vi.fn(() => Promise.resolve(true)),
    }

    await expect(
      unregisterNonDevelopmentWorkers({
        getRegistrations: () =>
          Promise.resolve([
            undefined,
            { active: undefined },
            oldWorker,
            developmentWorker,
            installingOldWorker,
          ]),
      }),
    ).resolves.toBeUndefined()

    expect(oldWorker.unregister).toHaveBeenCalledTimes(1)
    expect(installingOldWorker.unregister).toHaveBeenCalledTimes(1)
    expect(developmentWorker.unregister).not.toHaveBeenCalled()
  })
})
