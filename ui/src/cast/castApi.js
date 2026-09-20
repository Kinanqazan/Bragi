const CAST_SENDER_SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'
const CAST_SDK_TIMEOUT_MS = 10000
const CAST_REQUEST_TIMEOUT_MS = 10000
const CAST_SESSION_STORAGE_KEY = 'navidrome.cast.sessionId'
const CAST_SESSION_TIMESTAMP_KEY = 'navidrome.cast.sessionTimestamp'
const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 24 // 24 hours

const initialState = {
  available: false,
  initialized: false,
  castState: 'NO_DEVICES_AVAILABLE',
  sessionState: 'NO_SESSION',
  connected: false,
  deviceName: '',
  sessionId: '',
  error: null,
}

let state = { ...initialState }
let sdkPromise = null
let initializationPromise = null
let castContext = null
let explicitStopRequested = false
let hasObservedCastSession = false
const listeners = new Set()

const getWindow = () => (typeof window === 'undefined' ? undefined : window)

export const isNativeCastAvailable = () => {
  const currentWindow = getWindow()
  try {
    if (currentWindow?.BragiNative?.hasNativeCast?.()) return true
    if (typeof currentWindow?.BragiNative?.requestCastSession === 'function') return true
    if (currentWindow?.BragiNative) return true
    return false
  } catch {
    return false
  }
}

const hasCastFramework = () => {
  if (isNativeCastAvailable()) return true
  const currentWindow = getWindow()
  return Boolean(
    currentWindow?.cast?.framework?.CastContext &&
    currentWindow?.cast?.framework?.RemotePlayer &&
    currentWindow?.cast?.framework?.RemotePlayerController &&
    currentWindow?.chrome?.cast?.media,
  )
}

const notify = () => {
  listeners.forEach((listener) => listener({ ...state }))
}

const isConnectedSession = (sessionState) => {
  const sessionStates = getWindow()?.cast?.framework?.SessionState
  return (
    sessionState === sessionStates?.SESSION_STARTED ||
    sessionState === sessionStates?.SESSION_RESUMED ||
    sessionState === 'SESSION_STARTED' ||
    sessionState === 'SESSION_RESUMED'
  )
}

const getDeviceName = (session) => {
  const device = session?.getCastDevice?.()
  return device?.friendlyName || device?.deviceId || ''
}

const getSessionStorage = () => {
  try {
    return getWindow()?.localStorage || null
  } catch {
    return null
  }
}

const getSessionId = (session) => session?.getSessionId?.() || ''

const rememberCastSession = (sessionId) => {
  if (!sessionId) return
  try {
    const storage = getSessionStorage()
    storage?.setItem(CAST_SESSION_STORAGE_KEY, sessionId)
    storage?.setItem(CAST_SESSION_TIMESTAMP_KEY, String(Date.now()))
  } catch {
    // Storage can be disabled in private browsing or by a browser policy.
  }
}

const forgetCastSession = () => {
  try {
    const storage = getSessionStorage()
    storage?.removeItem(CAST_SESSION_STORAGE_KEY)
    storage?.removeItem(CAST_SESSION_TIMESTAMP_KEY)
  } catch {
    // Storage can be disabled in private browsing or by a browser policy.
  }
}

const getRememberedCastSession = () => {
  try {
    return getSessionStorage()?.getItem(CAST_SESSION_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

const syncState = () => {
  if (!castContext) return

  const sessionState = castContext.getSessionState?.() || 'NO_SESSION'
  const session = castContext.getCurrentSession?.()
  const sessionId = getSessionId(session)
  const hasSessionState = typeof castContext.getSessionState === 'function'
  const connected = hasSessionState
    ? isConnectedSession(sessionState)
    : Boolean(session)

  if (connected && sessionId && !explicitStopRequested) {
    hasObservedCastSession = true
    rememberCastSession(sessionId)
  } else if (
    explicitStopRequested ||
    (hasObservedCastSession && !connected)
  ) {
    forgetCastSession()
  }

  if (!connected) {
    explicitStopRequested = false
  }

  state = {
    ...state,
    castState: castContext.getCastState?.() || state.castState,
    sessionState,
    connected,
    deviceName: getDeviceName(session),
    sessionId: connected ? sessionId : '',
    error: null,
  }
  notify()
}

const handleCastEvent = () => syncState()

const resumeRememberedCastSession = () => {
  if (castContext?.getCurrentSession?.()) return

  const sessionId = getRememberedCastSession()
  const storage = getSessionStorage()
  const timestamp = Number(storage?.getItem(CAST_SESSION_TIMESTAMP_KEY) || 0)
  if (!sessionId || (timestamp && Date.now() - timestamp > MAX_SESSION_AGE_MS)) {
    forgetCastSession()
    return
  }

  const requestSessionById = getWindow()?.chrome?.cast?.requestSessionById
  if (typeof requestSessionById !== 'function') return

  try {
    const onSessionError = () => {
      if (getRememberedCastSession() === sessionId) forgetCastSession()
    }
    const result =
      requestSessionById.length > 1
        ? requestSessionById(sessionId, () => {}, onSessionError)
        : requestSessionById(sessionId)
    if (result && typeof result.catch === 'function') {
      result.catch(onSessionError)
    }
  } catch {
    if (getRememberedCastSession() === sessionId) forgetCastSession()
  }
}

export const getCastState = () => ({ ...state })

export const subscribeCastState = (listener) => {
  listeners.add(listener)
  listener({ ...state })
  return () => listeners.delete(listener)
}

export const loadCastSenderSdk = () => {
  if (isNativeCastAvailable()) return Promise.resolve(true)
  const currentWindow = getWindow()
  if (currentWindow?.BragiNative) return Promise.resolve(false)
  if (hasCastFramework()) return Promise.resolve(true)
  if (sdkPromise) return sdkPromise

  // Unit tests must not inject a third-party script or leave a discovery
  // timer open. The runtime is exercised through the adapter tests instead.
  if (import.meta.env?.MODE === 'test') return Promise.resolve(false)

  if (!currentWindow?.document) return Promise.resolve(false)

  sdkPromise = new Promise((resolve) => {
    let settled = false
    let timeoutId
    let pollId
    const previousCallback = currentWindow.__onGCastApiAvailable

    const finish = (available) => {
      if (settled) return
      settled = true
      currentWindow.clearTimeout(timeoutId)
      currentWindow.clearInterval(pollId)
      if (currentWindow.__onGCastApiAvailable === navidromeCallback) {
        currentWindow.__onGCastApiAvailable = previousCallback
      }
      if (available && hasCastFramework()) {
        resolve(true)
      } else {
        if (script.dataset.navidromeCastSdk === 'true') script.remove()
        sdkPromise = null
        resolve(false)
      }
    }

    const navidromeCallback = (isAvailable) => {
      if (typeof previousCallback === 'function') {
        try {
          previousCallback(isAvailable)
        } catch {
          // A host callback must not prevent Navidrome from initializing Cast.
        }
      }
      finish(Boolean(isAvailable))
    }
    currentWindow.__onGCastApiAvailable = navidromeCallback

    const existingScript = currentWindow.document.querySelector(
      'script[data-navidrome-cast-sdk="true"]',
    )
    const script =
      existingScript || currentWindow.document.createElement('script')

    const checkAvailability = () => {
      if (hasCastFramework()) finish(true)
    }

    script.addEventListener('load', checkAvailability, { once: true })
    script.addEventListener('error', () => finish(false), { once: true })

    if (!existingScript) {
      script.async = true
      script.src = CAST_SENDER_SDK_URL
      script.dataset.navidromeCastSdk = 'true'
      currentWindow.document.head?.appendChild(script)
    }

    // A cached or previously inserted SDK script may have fired its global
    // callback before this module installed one. Polling the public SDK shape
    // closes that refresh/HMR race without relying on a second script.
    pollId = currentWindow.setInterval(checkAvailability, 50)

    timeoutId = currentWindow.setTimeout(
      () => finish(false),
      CAST_SDK_TIMEOUT_MS,
    )
  })

  return sdkPromise
}

const initializeCastOnce = async () => {
  if (castContext) {
    syncState()
    return true
  }

  const currentWindow = getWindow()
  if (isNativeCastAvailable()) {
    let isConnected = false
    let deviceName = ''
    try {
      isConnected = Boolean(currentWindow.BragiNative.isCastConnected?.())
      deviceName = currentWindow.BragiNative.getCastDeviceName?.() || ''
    } catch (e) {
      isConnected = false
    }
    state = {
      ...state,
      available: true,
      initialized: true,
      error: null,
      castState: isConnected ? 'CONNECTED' : 'NOT_CONNECTED',
      sessionState: isConnected ? 'SESSION_STARTED' : 'NO_SESSION',
      connected: isConnected,
      deviceName,
    }
    const prevCastState = currentWindow.__bragiNativeCastState
    currentWindow.__bragiNativeCastState = (nativeState) => {
      if (typeof prevCastState === 'function') {
        try {
          prevCastState(nativeState)
        } catch (_e) {
          // Ignore errors from previous handler
        }
      }
      const connected = Boolean(nativeState?.connected)
      state = {
        ...state,
        available: true,
        initialized: true,
        error: null,
        castState: connected ? 'CONNECTED' : 'NOT_CONNECTED',
        sessionState: connected ? 'SESSION_STARTED' : 'SESSION_ENDED',
        connected,
        deviceName: nativeState?.deviceName || '',
        sessionId: nativeState?.sessionId || '',
      }
      notify()
    }
    notify()
    return true
  }

  const available = await loadCastSenderSdk()
  if (!available) {
    state = {
      ...state,
      error: 'Google Cast is unavailable in this browser.',
    }
    notify()
    return false
  }

  const framework = currentWindow.cast.framework
  const chromeCast = currentWindow.chrome.cast

  try {
    castContext = framework.CastContext.getInstance()
    castContext.setOptions({
      receiverApplicationId:
        chromeCast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
      autoJoinPolicy:
        chromeCast?.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped',
    })

    const eventTypes = framework.CastContextEventType || {}
    if (eventTypes.CAST_STATE_CHANGED) {
      castContext.addEventListener(
        eventTypes.CAST_STATE_CHANGED,
        handleCastEvent,
      )
    }
    if (eventTypes.SESSION_STATE_CHANGED) {
      castContext.addEventListener(
        eventTypes.SESSION_STATE_CHANGED,
        handleCastEvent,
      )
    }

    state = {
      ...state,
      available: true,
      initialized: true,
      error: null,
    }
    syncState()
    resumeRememberedCastSession()
    return true
  } catch (error) {
    castContext = null
    state = {
      ...state,
      error: error?.message || 'Google Cast could not be initialized.',
    }
    notify()
    return false
  }
}

export const initializeCast = () => {
  if (castContext) {
    syncState()
    return Promise.resolve(true)
  }
  if (initializationPromise) return initializationPromise

  initializationPromise = initializeCastOnce().then(
    (initialized) => {
      if (!initialized) initializationPromise = null
      return initialized
    },
    () => {
      initializationPromise = null
      return false
    },
  )
  return initializationPromise
}

export const requestCastSession = async (timeoutMs = CAST_REQUEST_TIMEOUT_MS) => {
  // A new explicit user request starts a fresh lifecycle even if a previous
  // end request has not emitted its final SESSION_ENDED event yet.
  explicitStopRequested = false

  const currentWindow = getWindow()
  if (isNativeCastAvailable()) {
    currentWindow.BragiNative.requestCastSession()
    return true
  }

  if (!castContext) {
    const initialized = await initializeCast()
    if (!initialized) throw new Error(state.error || 'Cast unavailable')
  }

  if (!state.connected && getRememberedCastSession()) {
    forgetCastSession()
  }

  // If a previous session is still lingering in Chrome's CastContext when the user
  // initiates a new Cast request, cleanly terminate it first so Chrome does not
  // reject the new session with a session_error collision.
  try {
    const existingSession = castContext?.getCurrentSession?.()
    if (existingSession) {
      castContext.endCurrentSession?.(false)
      syncState()
    }
  } catch {
    // Ignore teardown errors
  }

  const currentCastState = castContext?.getCastState?.()
  if (currentCastState === 'NO_DEVICES_AVAILABLE') {
    const err = new Error('No Cast devices available on this network')
    err.code = 'NO_DEVICES_AVAILABLE'
    throw err
  }

  let timerId
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error('Cast session request timed out')
      err.code = 'TIMEOUT'
      reject(err)
    }, timeoutMs)
  })

  try {
    const requestPromise = Promise.resolve(castContext.requestSession())
    return await Promise.race([requestPromise, timeoutPromise])
  } catch (err) {
    const code = err?.code || (typeof err === 'string' ? err : err?.message)
    if (String(code).toUpperCase() === 'SESSION_ERROR') {
      forgetCastSession()
    }
    throw err
  } finally {
    clearTimeout(timerId)
  }
}

let resumeLocalOnEnd = false

export const setResumeLocalOnEnd = (value) => {
  resumeLocalOnEnd = Boolean(value)
}

export const consumeResumeLocalOnEnd = () => {
  const value = resumeLocalOnEnd
  resumeLocalOnEnd = false
  return value
}

export const endCastSession = (stopCasting = true, options = {}) => {
  if (options?.resumeLocal) {
    resumeLocalOnEnd = true
  }
  // An explicit stop must not be automatically rejoined after a refresh.
  explicitStopRequested = true
  forgetCastSession()

  const currentWindow = getWindow()
  if (isNativeCastAvailable()) {
    currentWindow.BragiNative.endCastSession()
    return Promise.resolve(true)
  }

  const result = castContext?.endCurrentSession?.(stopCasting)
  if (result && typeof result.then === 'function') {
    return Promise.resolve(result).then(
      (value) => {
        syncState()
        forgetCastSession()
        return value
      },
      (error) => {
        explicitStopRequested = false
        syncState()
        throw error
      },
    )
  }
  syncState()
  forgetCastSession()
  return result
}

export const getCurrentCastSession = () =>
  castContext?.getCurrentSession?.() || null

export const getCastRuntime = () => {
  const currentWindow = getWindow()
  if (!currentWindow?.cast?.framework || !currentWindow?.chrome?.cast) {
    return null
  }
  return {
    framework: currentWindow.cast.framework,
    chrome: currentWindow.chrome,
  }
}

export const handleCastWakeUp = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return
  }
  if (castContext) {
    syncState()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', handleCastWakeUp)
  window.addEventListener('focus', handleCastWakeUp)
  window.addEventListener('online', handleCastWakeUp)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleCastWakeUp)
  }
}
