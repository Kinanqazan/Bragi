import { useEffect, useRef } from 'react'

// Reorder only from the grip, leaving song rows available for scrolling,
// dismissing the drawer and swiping right to remove an entry.
export const useQueueReorder = (listRef, onReorder, suppressClick) => {
  const dragRef = useRef(null)
  const frameRef = useRef(null)

  const clear = () => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    const drag = dragRef.current
    if (!drag) return
    drag.row.style.removeProperty('transform')
    drag.row.removeAttribute('data-reordering')
    listRef.current?.querySelectorAll('[data-drop-before]').forEach((row) => {
      row.removeAttribute('data-drop-before')
    })
    listRef.current?.removeAttribute('data-drop-at-end')
    dragRef.current = null
  }

  useEffect(() => clear, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = () => {
    const drag = dragRef.current
    const list = listRef.current
    if (!drag || !list || !drag.active) return
    drag.row.style.transform = `translate3d(0, ${drag.clientY - drag.startY + list.scrollTop - drag.startScrollTop}px, 0)`
    const rows = Array.from(list.querySelectorAll('[data-queue-row]'))
    let before = null
    rows.forEach((row) => {
      row.removeAttribute('data-drop-before')
      if (row === drag.row || before) return
      const rect = row.getBoundingClientRect()
      if (drag.clientY < rect.top + rect.height / 2) before = row
    })
    drag.beforeUuid = before?.dataset.queueId ?? null
    before?.setAttribute('data-drop-before', 'true')
    if (before) list.removeAttribute('data-drop-at-end')
    else list.setAttribute('data-drop-at-end', 'true')
  }

  const autoScroll = () => {
    const drag = dragRef.current
    const list = listRef.current
    if (!drag?.active || !list) return
    const rect = list.getBoundingClientRect()
    const edge = 48
    const speed =
      drag.clientY < rect.top + edge
        ? -Math.min(12, (rect.top + edge - drag.clientY) / 4)
        : drag.clientY > rect.bottom - edge
          ? Math.min(12, (drag.clientY - rect.bottom + edge) / 4)
          : 0
    if (speed) {
      list.scrollTop += speed
      update()
    }
    frameRef.current = requestAnimationFrame(autoScroll)
  }

  const start = (event) => {
    const grip = event.target?.closest?.('[data-queue-reorder]')
    const row = grip?.closest('[data-queue-row]')
    if (!row?.dataset.queueId || !listRef.current) return false
    clear()
    dragRef.current = {
      row,
      pointerId: event.pointerId,
      startY: event.clientY,
      clientY: event.clientY,
      startScrollTop: listRef.current.scrollTop,
      active: false,
    }
    return true
  }

  const move = (event) => {
    const drag = dragRef.current
    if (!drag) return false
    if (event.pointerId !== drag.pointerId) return true
    drag.clientY = event.clientY
    if (!drag.active && Math.abs(event.clientY - drag.startY) >= 6) {
      drag.active = true
      drag.row.setAttribute('data-reordering', 'true')
      suppressClick()
      frameRef.current = requestAnimationFrame(autoScroll)
    }
    if (drag.active) {
      if (event.cancelable) event.preventDefault()
      update()
    }
    return true
  }

  const finish = (event, cancelled) => {
    const drag = dragRef.current
    if (!drag) return false
    if (event.pointerId !== drag.pointerId && !cancelled) return true
    if (drag.active && !cancelled) {
      if (event.cancelable) event.preventDefault()
      onReorder(drag.row.dataset.queueId, drag.beforeUuid)
    }
    clear()
    return true
  }

  return { start, move, finish }
}
