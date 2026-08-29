const eventNames = [
  'play',
  'playing',
  'pause',
  'timeupdate',
  'ended',
  'error',
  'loadedmetadata',
  'durationchange',
  'progress',
  'waiting',
  'canplay',
]

export const createAudioElementAdapter = (audioElement) => {
  if (!audioElement) throw new Error('An audio element is required')

  return {
    element: audioElement,
    get src() {
      return audioElement.src
    },
    set src(value) {
      audioElement.src = value || ''
    },
    get currentTime() {
      return audioElement.currentTime
    },
    set currentTime(value) {
      audioElement.currentTime = value
    },
    get duration() {
      return audioElement.duration
    },
    get paused() {
      return audioElement.paused
    },
    get ended() {
      return audioElement.ended
    },
    get volume() {
      return audioElement.volume
    },
    set volume(value) {
      audioElement.volume = value
    },
    get playbackRate() {
      return audioElement.playbackRate
    },
    get buffered() {
      return audioElement.buffered
    },
    play: () => audioElement.play(),
    pause: () => audioElement.pause(),
    load: () => audioElement.load(),
    addEventListener: (name, listener) =>
      audioElement.addEventListener(name, listener),
    removeEventListener: (name, listener) =>
      audioElement.removeEventListener(name, listener),
    setCrossOrigin: (value) => {
      audioElement.crossOrigin = value
    },
  }
}

const makeTimeRanges = (ranges) => ({
  length: ranges.length,
  start: (index) => ranges[index][0],
  end: (index) => ranges[index][1],
})

// A deterministic adapter for engine tests. It intentionally models only the
// browser audio contract used by PlaybackEngine.
export const createMemoryAudioElementAdapter = (options = {}) => {
  const listeners = new Map(eventNames.map((name) => [name, new Set()]))
  let src = ''
  let currentTime = 0
  let duration = Number.isFinite(options.duration) ? options.duration : NaN
  let volume = options.volume ?? 1
  let playbackRate = 1
  let paused = true
  let ended = false
  let bufferedRanges = []
  let playImplementation = options.playImplementation

  const emit = (name, detail) => {
    const event = detail || { type: name, target: adapter }
    listeners.get(name)?.forEach((listener) => listener(event))
  }

  const adapter = {
    get src() {
      return src
    },
    set src(value) {
      src = value || ''
      currentTime = 0
      ended = false
    },
    get currentTime() {
      return currentTime
    },
    set currentTime(value) {
      currentTime = Number.isFinite(value) ? value : 0
    },
    get duration() {
      return duration
    },
    get paused() {
      return paused
    },
    get ended() {
      return ended
    },
    get volume() {
      return volume
    },
    set volume(value) {
      volume = value
    },
    get playbackRate() {
      return playbackRate
    },
    get buffered() {
      return makeTimeRanges(bufferedRanges)
    },
    play: () => {
      if (playImplementation) return playImplementation()
      paused = false
      ended = false
      emit('play')
      return Promise.resolve()
    },
    pause: () => {
      paused = true
      emit('pause')
    },
    load: () => undefined,
    addEventListener: (name, listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(listener)
    },
    removeEventListener: (name, listener) => {
      listeners.get(name)?.delete(listener)
    },
    setCrossOrigin: () => undefined,
    emit,
    setDuration: (value) => {
      duration = value
      emit('loadedmetadata')
      emit('durationchange')
    },
    setBuffered: (ranges) => {
      bufferedRanges = ranges
      emit('progress')
    },
    setPlayImplementation: (implementation) => {
      playImplementation = implementation
    },
    setPaused: (value) => {
      paused = value
    },
    setEnded: (value) => {
      ended = value
    },
    listenerCount: (name) => listeners.get(name)?.size || 0,
  }

  return adapter
}

export const AUDIO_EVENT_NAMES = eventNames
