const prefix = '[DEBUG-player-1005]'
// Exercise the normal animation path even when the host requests reduced motion.
const originalMatchMedia = window.matchMedia.bind(window)
const diagnosticOptions = new URL(location.href).searchParams
// Optional CSS-only comparison: make all player gesture targets own touch
// manipulation, including nested clipping/scroll containers.
if (diagnosticOptions.has('strict-player-touch')) {
  const touchPolicy = document.createElement('style')
  touchPolicy.textContent = `
    [data-player-artwork], [data-player-artwork] *,
    [data-player-shared-control], [data-player-shared-control] *,
    [aria-label="Now playing"], [aria-label="Now playing"] *,
    [aria-label="Full-screen player"], [aria-label="Full-screen player"] *,
    [class*="sharedRoot"] * { touch-action: none !important; }
  `
  document.head.append(touchPolicy)
}
if (diagnosticOptions.has('normal-motion'))
  window.matchMedia = (query) =>
    originalMatchMedia(
      query === '(prefers-reduced-motion: reduce)' ? '(max-width: 0px)' : query,
    )
const enableCssMotion = () => {
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules)
        if (rule.media?.mediaText === '(prefers-reduced-motion: reduce)')
          rule.media.mediaText = '(max-width: 0px)'
    } catch {}
  }
}
if (diagnosticOptions.has('normal-motion')) {
  new MutationObserver(enableCssMotion).observe(document.head, {
    childList: true,
    subtree: true,
  })
  enableCssMotion()
}
const started = performance.now()
const label = (e) =>
  e
    ? `${e.tagName}:${e.getAttribute?.('aria-label') || e.getAttribute?.('data-testid') || (typeof e.className === 'string' ? e.className : '')}`
    : null
const records = []
const log = (kind, data) => {
  const record = {
    kind,
    at: +(performance.now() - started).toFixed(1),
    ...data,
  }
  records.push(record)
  if (records.length > 500) records.shift()
  console.log(prefix, JSON.stringify(record))
}
if (new URL(location.href).searchParams.has('capture'))
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target.closest?.(
        '[data-player-shared-control], [data-player-artwork], [class*="sharedTitle"], [class*="sharedArtist"], [aria-label="Now playing"], [aria-label="Full-screen player"]',
      )
      if (target) target.setPointerCapture(event.pointerId)
    },
    true,
  )
if (new URL(location.href).searchParams.has('capture'))
  document.addEventListener(
    'dragstart',
    (event) => event.preventDefault(),
    true,
  )
const state = () => {
  const play = document.querySelector('[data-player-shared-control]')
  const full = document.querySelector('[aria-label="Full-screen player"]')
  const frame = document.querySelector('[data-testid="shared-player-frame"]')
  if (!play) return { missing: true }
  if (diagnosticOptions.has('passive'))
    return {
      play: play.getAttribute('aria-label'),
      fullHidden: full?.getAttribute('aria-hidden'),
      layoutReads: false,
    }
  const r = play.getBoundingClientRect()
  const f = frame.getBoundingClientRect()
  return {
    play: play.getAttribute('aria-label'),
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    hit: document
      .elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      .slice(0, 6)
      .map(label),
    fullHidden: full.getAttribute('aria-hidden'),
    fullPointer: getComputedStyle(full).pointerEvents,
    frame: { y: f.y, h: f.height },
    transition: frame.style.transition,
  }
}
// These capture-phase records avoid layout reads and include covering elements
// outside the player, plus controls which stop propagation before document.
const activeInputs = new Map()
// Optional investigation only: trace input cancellation, and independently
// bypass cancellation of a completed vertical player swipe. The app entry and
// packaged APK do not load this file.
if (
  diagnosticOptions.has('trace-cancel') ||
  diagnosticOptions.has('no-swipe-cancel')
) {
  const originalPreventDefault = Event.prototype.preventDefault
  Event.prototype.preventDefault = function (...args) {
    const input = activeInputs.get(this.pointerId)
    const deltaX = input ? this.clientX - input.x : 0
    const deltaY = input ? this.clientY - input.y : 0
    const isPlayer = Boolean(
      this.target?.closest?.(
        '[data-player-shared-control], [data-player-artwork], [aria-label="Full-screen player"], [aria-label="Now playing"], [class*="sharedRoot"]',
      ),
    )
    const skip =
      diagnosticOptions.has('no-swipe-cancel') &&
      this.type === 'pointerup' &&
      this.pointerType === 'touch' &&
      isPlayer &&
      Math.abs(deltaY) >= 48 &&
      Math.abs(deltaY) > Math.abs(deltaX)
    if (['pointerup', 'touchend', 'click'].includes(this.type))
      log('default-cancel', {
        event: this.type,
        target: label(this.target),
        id: this.pointerId,
        travel: input?.distance,
        deltaX,
        deltaY,
        skipped: skip,
        stack: new Error().stack?.split('\n').slice(1, 8),
      })
    if (!skip) return originalPreventDefault.apply(this, args)
  }
  for (const name of ['stopPropagation', 'stopImmediatePropagation']) {
    const original = Event.prototype[name]
    Event.prototype[name] = function (...args) {
      if (this.type === 'click')
        log('click-propagation', {
          method: name,
          target: label(this.target),
          id: this.pointerId,
          stack: new Error().stack?.split('\n').slice(1, 8),
        })
      return original.apply(this, args)
    }
  }
}
if (diagnosticOptions.has('trace-cancel'))
  window.addEventListener(
    'click',
    (event) => {
      if (event.target.closest?.('[data-player-diagnostic-ui]')) return
      log('window-click', {
        target: label(event.target),
        id: event.pointerId,
        trusted: event.isTrusted,
      })
    },
    true,
  )
document.addEventListener(
  'pointermove',
  (event) => {
    const input = activeInputs.get(event.pointerId)
    if (!input) return
    input.distance = Math.max(
      input.distance,
      Math.hypot(event.clientX - input.x, event.clientY - input.y),
    )
  },
  true,
)
for (const kind of ['pointerdown', 'pointerup', 'pointercancel', 'click'])
  document.addEventListener(
    kind,
    (event) => {
      if (event.target.closest?.('[data-player-diagnostic-ui]')) return
      if (kind === 'pointerdown')
        activeInputs.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          target: label(event.target),
          at: performance.now(),
          distance: 0,
        })
      const input = activeInputs.get(event.pointerId)
      log('input-capture', {
        event: kind,
        target: label(event.target),
        pointer: event.pointerType,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        downTarget: input?.target,
        travel: input?.distance,
        elapsed: input ? performance.now() - input.at : undefined,
        play: document
          .querySelector('[data-player-shared-control]')
          ?.getAttribute('aria-label'),
        fullHidden: document
          .querySelector('[aria-label="Full-screen player"]')
          ?.getAttribute('aria-hidden'),
      })
      if (kind === 'click' || kind === 'pointercancel')
        activeInputs.delete(event.pointerId)
    },
    true,
  )
let inputStart = 0
for (const type of [
  'pointerdown',
  'pointerup',
  'pointercancel',
  'click',
  'gotpointercapture',
  'lostpointercapture',
]) {
  document.addEventListener(
    type,
    (event) => {
      if (
        !event.target.closest?.(
          '[data-player-shared-control], [data-player-artwork], [aria-label="Full-screen player"], [aria-label="Now playing"], [class*="sharedRoot"]',
        )
      )
        return
      if (type === 'pointerdown') inputStart = performance.now()
      log(type, {
        target: label(event.target),
        pointer: event.pointerType,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        elapsed: +(performance.now() - inputStart).toFixed(1),
        prevented: event.defaultPrevented,
        state: state(),
      })
      if (type === 'pointerup') {
        const released = performance.now()
        for (const delay of [0, 50, 150, 300, 500, 1000, 3000])
          setTimeout(
            () =>
              log('after-up', {
                requested: delay,
                elapsed: +(performance.now() - released).toFixed(1),
                state: state(),
              }),
            delay,
          )
      }
    },
    false,
  )
}
for (const type of [
  'transitionrun',
  'transitionstart',
  'transitionend',
  'transitioncancel',
])
  document.addEventListener(type, (e) => {
    if (
      e.target.matches(
        '[data-testid="shared-player-frame"], [data-player-shared-control]',
      )
    )
      log(type, {
        target: label(e.target),
        property: e.propertyName,
        seconds: e.elapsedTime,
        state: state(),
      })
  })
for (const name of ['play', 'pause']) {
  const original = HTMLMediaElement.prototype[name]
  HTMLMediaElement.prototype[name] = function (...args) {
    log(`audio.${name}`, { state: state() })
    const at = performance.now()
    const result = original.apply(this, args)
    result?.then?.(
      () => log(`audio.${name}.resolved`, { elapsed: performance.now() - at }),
      (e) =>
        log(`audio.${name}.rejected`, {
          elapsed: performance.now() - at,
          error: e.name,
        }),
    )
    return result
  }
}
for (const kind of ['play', 'playing', 'pause', 'waiting', 'canplay', 'error'])
  document.addEventListener(
    kind,
    (event) => {
      if (event.target instanceof HTMLMediaElement)
        log(`media.${kind}`, {
          paused: event.target.paused,
          ready: event.target.readyState,
          time: event.target.currentTime,
          state: state(),
        })
    },
    true,
  )
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (e.duration > 50)
        log('longtask', { start: e.startTime, duration: e.duration })
  }).observe({ type: 'longtask', buffered: true })
} catch {}
let lastFrame = performance.now()
const tick = (now) => {
  if (now - lastFrame > 100) log('frame-gap', { duration: now - lastFrame })
  lastFrame = now
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
const environment = () => ({
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  nativeReducedMotion: originalMatchMedia('(prefers-reduced-motion: reduce)')
    .matches,
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  forcedMotion: diagnosticOptions.has('normal-motion'),
  forcedCapture: diagnosticOptions.has('capture'),
  traceCancellation: diagnosticOptions.has('trace-cancel'),
  bypassSwipeCancellation: diagnosticOptions.has('no-swipe-cancel'),
  strictPlayerTouch: diagnosticOptions.has('strict-player-touch'),
  layoutReads: !diagnosticOptions.has('passive'),
  viewport: { width: innerWidth, height: innerHeight },
  origin: location.origin,
  path: location.pathname,
  scripts: [...document.scripts]
    .filter((s) => s.type === 'module' && s.src)
    .map((s) => s.src),
  serviceWorker: navigator.serviceWorker?.controller?.scriptURL || null,
})
log('environment', environment())
const reportButton = document.createElement('button')
reportButton.setAttribute('data-player-diagnostic-ui', 'true')
reportButton.textContent = 'Show diagnostics'
reportButton.style.cssText =
  'position:fixed;top:4px;left:4px;z-index:99999;font:11px sans-serif;padding:5px;background:#eee;color:#111;border:1px solid #888;border-radius:4px'
reportButton.addEventListener('click', () => {
  const report = document.createElement('div')
  report.setAttribute('data-player-diagnostic-ui', 'true')
  report.style.cssText =
    'position:fixed;inset:10px;z-index:100000;background:#fff;color:#111;padding:12px;display:flex;flex-direction:column;gap:8px'
  const close = document.createElement('button')
  close.textContent = 'Close report'
  close.onclick = () => report.remove()
  const download = document.createElement('button')
  download.textContent = 'Download diagnostic report'
  const body = JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      environment: environment(),
      records,
    },
    null,
    2,
  )
  download.onclick = () => {
    const url = URL.createObjectURL(
      new Blob([body], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'bragi-player-diagnostics.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const text = document.createElement('textarea')
  text.value = body
  text.readOnly = true
  text.style.cssText = 'width:100%;flex:1;min-height:0;font:11px monospace'
  report.append(close, download, text)
  document.body.append(report)
})
document.body.append(reportButton)
