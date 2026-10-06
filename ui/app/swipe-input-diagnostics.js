// [DEBUG-player-1005] Standalone browser gesture experiment; no app imports.
const started = performance.now()
const pad = document.querySelector('#pad')
const button = document.querySelector('#tap')
const animate = document.querySelector('#animate')
const nativeMode = document.querySelector('#native-mode')
const status = document.querySelector('#status')
const records = []
const pointers = new Map()
const touches = new Map()
let releases = 0
let clicks = 0
let raised = false
const targetLabel = (target) => target?.closest?.('[id]')?.id || target?.tagName
const log = (kind, data = {}) => {
  records.push({
    kind,
    at: +(performance.now() - started).toFixed(1),
    animate: animate.checked,
    nativeMode: nativeMode.value,
    ...data,
  })
  if (records.length > 500) records.shift()
}
const updateStatus = () => {
  status.textContent = `Button tap releases: ${releases}\nButton clicks: ${clicks}`
}
for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) {
  window.addEventListener(type, (event) => {
    const target = targetLabel(event.target)
    if (type === 'pointerdown')
      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        target,
        distance: 0,
      })
    const input = pointers.get(event.pointerId)
    log('input', {
      event: type,
      target,
      id: event.pointerId,
      pointer: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      travel: input?.distance,
      prevented: event.defaultPrevented,
      trusted: event.isTrusted,
    })
    if (type === 'pointerup' && target === 'tap') {
      releases++
      updateStatus()
    }
    if (type === 'click' || type === 'pointercancel')
      pointers.delete(event.pointerId)
  }, true)
}
window.addEventListener('pointermove', (event) => {
  const input = pointers.get(event.pointerId)
  if (input)
    input.distance = Math.max(input.distance, Math.hypot(event.clientX - input.x, event.clientY - input.y))
}, { capture: true, passive: true })
const handleTouchStart = (event) => {
  for (const touch of event.changedTouches)
    touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
  log('touch', { event: event.type, target: targetLabel(event.target), prevented: event.defaultPrevented })
}
const handleTouchMove = (event) => {
  for (const touch of event.changedTouches) {
    const input = touches.get(touch.identifier)
    if (!input) continue
    const dx = touch.clientX - input.x
    const dy = touch.clientY - input.y
    if (nativeMode.value === 'cancel' && Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
      event.preventDefault()
      if (!input.canceled) {
        input.canceled = true
        log('native-move-cancel', { prevented: event.defaultPrevented, cancelable: event.cancelable, dx, dy })
      }
    }
  }
}
const handleTouchEnd = (event) => {
    log('touch', { event: event.type, target: targetLabel(event.target), prevented: event.defaultPrevented })
    for (const touch of event.changedTouches) touches.delete(touch.identifier)
}
let nativeListeners = false
nativeMode.addEventListener('change', () => {
  const enabled = nativeMode.value !== 'default'
  // Observe and cancel modes have identical listener registration. Browser
  // default has no native touch listeners, keeping the initial case minimal.
  if (enabled !== nativeListeners) {
    const method = enabled ? 'addEventListener' : 'removeEventListener'
    pad[method]('touchstart', handleTouchStart, { passive: true })
    pad[method]('touchmove', handleTouchMove, { passive: false })
    pad[method]('touchend', handleTouchEnd, { passive: true })
    pad[method]('touchcancel', handleTouchEnd, { passive: true })
    nativeListeners = enabled
    touches.clear()
  }
  log('mode-change')
})
pad.addEventListener('pointerup', (event) => {
  const input = pointers.get(event.pointerId)
  if (!animate.checked || !input || input.distance < 48) return
  raised = !raised
  pad.style.transition = 'transform 190ms ease-out'
  pad.style.transform = `translateY(${raised ? 36 : 0}px)`
  log('animation-start')
})
pad.addEventListener('transitionend', () => log('animation-end'))
window.addEventListener('scroll', (event) => log('scroll', { target: targetLabel(event.target) }), { capture: true, passive: true })
button.addEventListener('click', () => {
  clicks++
  button.textContent = `Tap after swipe — ${clicks} clicks`
  updateStatus()
})
animate.addEventListener('change', () => log('mode-change'))
document.querySelector('#download').addEventListener('click', () => {
  const report = {
    capturedAt: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      viewport: { width: innerWidth, height: innerHeight },
      origin: location.origin,
      path: location.pathname,
      appLoaded: false,
      scripts: [...document.scripts].filter((script) => script.src).map((script) => script.src),
    },
    buttonReleases: releases,
    buttonClicks: clicks,
    records,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'bragi-swipe-input-diagnostics.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
