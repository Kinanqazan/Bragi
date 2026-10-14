import React, { useCallback, useEffect, useRef, useState } from 'react'
import VolumeUpRoundedIcon from '@material-ui/icons/VolumeUpRounded'

const VolumeControl = ({ value = 1, onChange }) => {
  const previousValue = useRef(value || 1)
  const [dragValue, setDragValue] = useState(null)
  const isDraggingRef = useRef(false)

  const setValue = useCallback(
    (next) => {
      const normalized = Math.min(1, Math.max(0, Number(next) || 0))
      if (normalized > 0) previousValue.current = normalized
      onChange?.(normalized)
    },
    [onChange],
  )

  const activeValue = dragValue ?? value
  const toggleMute = (event) => {
    event?.currentTarget?.blur?.()
    setValue(activeValue > 0 ? 0 : previousValue.current || 1)
  }
  const percent = Math.min(100, Math.max(0, (activeValue || 0) * 100))

  const handlePointerDown = (event) => {
    event.stopPropagation?.()
    isDraggingRef.current = true
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId)
    } catch {
      // Ignore browsers that do not support pointer capture
    }
  }

  const handleChange = (event) => {
    const next = Math.min(1, Math.max(0, Number(event.target.value) || 0))
    if (isDraggingRef.current) {
      setDragValue(next)
    }
    setValue(next)
  }

  useEffect(() => {
    const handleRelease = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setDragValue(null)
      }
    }
    window.addEventListener('pointerup', handleRelease)
    window.addEventListener('pointercancel', handleRelease)
    return () => {
      window.removeEventListener('pointerup', handleRelease)
      window.removeEventListener('pointercancel', handleRelease)
    }
  }, [])

  return (
    <div className="nd-player-volume">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={activeValue ? 'Mute' : 'Unmute'}
        className={activeValue === 0 ? 'nd-player-volume-muted' : undefined}
      >
        <VolumeUpRoundedIcon />
      </button>
      <div className="nd-player-volume-meter">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeValue}
          onPointerDown={handlePointerDown}
          onTouchStart={(e) => e.stopPropagation?.()}
          onChange={handleChange}
          aria-label="Volume"
          aria-valuetext={`${Math.round(percent)}%`}
        />
        <div className="nd-player-volume-segments" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => {
            const segmentFill = Math.min(
              100,
              Math.max(0, percent - index * 10) * 10,
            )
            return (
              <span
                key={index}
                style={{ '--segment-fill': `${segmentFill}%` }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default VolumeControl
