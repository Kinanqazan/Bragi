export const PLAY_MODE_ORDER = 'order'
export const PLAY_MODE_REPEAT_ALL = 'orderLoop'
export const PLAY_MODE_REPEAT_ONE = 'singleLoop'
export const PLAY_MODE_SHUFFLE = 'shufflePlay'

export const normalizePlayMode = (mode) => {
  if (
    mode === PLAY_MODE_REPEAT_ALL ||
    mode === PLAY_MODE_REPEAT_ONE ||
    mode === PLAY_MODE_SHUFFLE ||
    mode === PLAY_MODE_ORDER
  ) {
    return mode
  }
  // The legacy player calls its repeating mode "all" in a few persisted
  // snapshots. Keep those queues understandable during migration.
  return mode === 'all' ? PLAY_MODE_REPEAT_ALL : PLAY_MODE_ORDER
}

const readOptions = (currentIndexOrOptions, length, mode, random) => {
  if (typeof currentIndexOrOptions === 'object') {
    return {
      currentIndex: currentIndexOrOptions.currentIndex,
      length: currentIndexOrOptions.length,
      mode: currentIndexOrOptions.mode,
      random: currentIndexOrOptions.random,
      manual: currentIndexOrOptions.manual,
    }
  }
  return { currentIndex: currentIndexOrOptions, length, mode, random }
}

export const getNextIndex = (
  currentIndexOrOptions,
  length,
  mode,
  random = Math.random,
) => {
  const options = readOptions(currentIndexOrOptions, length, mode, random)
  const count = Number.isFinite(options.length) ? options.length : 0
  if (count === 0) return -1

  const current = Math.max(-1, Math.min(count - 1, options.currentIndex ?? -1))
  const normalized = normalizePlayMode(options.mode)
  if (!options.manual && normalized === PLAY_MODE_REPEAT_ONE && current >= 0)
    return current
  if (normalized === PLAY_MODE_SHUFFLE && count > 1) {
    const choices = Array.from({ length: count }, (_, index) => index).filter(
      (index) => index !== current,
    )
    return choices[
      Math.floor((options.random || Math.random)() * choices.length)
    ]
  }
  if (current < count - 1) return current + 1
  return normalized === PLAY_MODE_REPEAT_ALL ? 0 : -1
}

export const getPreviousIndex = (
  currentIndexOrOptions,
  length,
  mode,
  random = Math.random,
) => {
  const options = readOptions(currentIndexOrOptions, length, mode, random)
  const count = Number.isFinite(options.length) ? options.length : 0
  if (count === 0) return -1

  const current = Math.max(-1, Math.min(count - 1, options.currentIndex ?? 0))
  const normalized = normalizePlayMode(options.mode)
  if (!options.manual && normalized === PLAY_MODE_REPEAT_ONE && current >= 0)
    return current
  if (normalized === PLAY_MODE_SHUFFLE && count > 1) {
    const choices = Array.from({ length: count }, (_, index) => index).filter(
      (index) => index !== current,
    )
    return choices[
      Math.floor((options.random || Math.random)() * choices.length)
    ]
  }
  if (current > 0) return current - 1
  return normalized === PLAY_MODE_REPEAT_ALL ? count - 1 : -1
}

export const createQueuePolicy = (random = Math.random) => {
  let currentIndex = -1
  let length = 0
  let mode = PLAY_MODE_ORDER

  return {
    setQueue(nextLength, nextIndex = currentIndex) {
      length = Math.max(0, nextLength || 0)
      currentIndex = length
        ? Math.max(0, Math.min(length - 1, nextIndex ?? 0))
        : -1
    },
    setMode(nextMode) {
      mode = normalizePlayMode(nextMode)
    },
    getMode: () => mode,
    getIndex: () => currentIndex,
    next({ manual = false } = {}) {
      const nextIndex = getNextIndex({
        currentIndex,
        length,
        mode,
        random,
        manual,
      })
      if (nextIndex >= 0) currentIndex = nextIndex
      return nextIndex
    },
    previous({ manual = false } = {}) {
      const previousIndex = getPreviousIndex({
        currentIndex,
        length,
        mode,
        random,
        manual,
      })
      if (previousIndex >= 0) currentIndex = previousIndex
      return previousIndex
    },
  }
}
