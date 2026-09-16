import React, { useCallback, useState } from 'react'
import throttle from 'lodash.throttle'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const ProgressBar = ({ snapshot, commands }) => {
  const duration = Number.isFinite(snapshot.duration) ? snapshot.duration : 0
  const currentTime = Math.min(duration || Infinity, snapshot.currentTime || 0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState(0)

  // Throttle live seeking during active drags so rapid touch/mouse movement
  // doesn't barrage the playback engine / Cast channel with in-flight seeks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledSeek = useCallback(
    throttle(
      (time) => {
        commands?.seek?.(time)
      },
      150,
      { leading: false, trailing: true },
    ),
    [commands],
  )

  const handlePointerDown = useCallback((event) => {
    setIsDragging(true)
    setDragValue(Number(event.target.value))
  }, [])

  const onChange = useCallback(
    (event) => {
      const targetTime = Number(event.target.value)
      setDragValue(targetTime)
      if (isDragging) {
        throttledSeek(targetTime)
      } else {
        commands?.seek?.(targetTime)
      }
    },
    [commands, isDragging, throttledSeek],
  )

  const handlePointerUp = useCallback(
    (event) => {
      setIsDragging(false)
      throttledSeek.cancel?.()
      const targetTime = Number(event.target.value)
      commands?.seek?.(targetTime)
    },
    [commands, throttledSeek],
  )

  const effectiveTime = isDragging ? dragValue : currentTime
  const percent = duration > 0 ? (effectiveTime / duration) * 100 : 0

  return (
    <div className="nd-player-progress">
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={duration ? effectiveTime : 0}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        onChange={onChange}
        disabled={!duration}
        aria-label="Seek"
        style={{ '--progress-percent': `${percent}%` }}
      />
      <div className="nd-player-progress-time">
        <span aria-hidden="true">{formatTime(effectiveTime)}</span>
        <span aria-hidden="true">{formatTime(duration)}</span>
      </div>
    </div>
  )
}

export default ProgressBar
