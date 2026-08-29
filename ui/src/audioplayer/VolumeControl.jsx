import React, { useCallback, useEffect, useRef, useState } from 'react'
import VolumeDownIcon from '@material-ui/icons/VolumeDown'
import VolumeOffIcon from '@material-ui/icons/VolumeOff'
import VolumeUpIcon from '@material-ui/icons/VolumeUp'

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
  const toggleMute = () =>
    setValue(activeValue > 0 ? 0 : previousValue.current || 1)
  const Icon =
    activeValue === 0
      ? VolumeOffIcon
      : activeValue < 0.5
      ? VolumeDownIcon
      : VolumeUpIcon
  const percent = Math.min(100, Math.max(0, (activeValue || 0) * 100))

  const handlePointerDown = () => {
    isDraggingRef.current = true
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
    setDragValue(null)
  }

  const handleChange = (event) => {
    const next = Math.min(1, Math.max(0, Number(event.target.value) || 0))
    if (isDraggingRef.current) {
      setDragValue(next)
    }
    setValue(next)
  }

  useEffect(() => {
    if (dragValue === null) return undefined
    const handleRelease = () => {
      isDraggingRef.current = false
      setDragValue(null)
    }
    window.addEventListener('pointerup', handleRelease)
    window.addEventListener('pointercancel', handleRelease)
    return () => {
      window.removeEventListener('pointerup', handleRelease)
      window.removeEventListener('pointercancel', handleRelease)
    }
  }, [dragValue])

  return (
    <div className="nd-player-volume">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={activeValue ? 'Mute' : 'Unmute'}
      >
        <Icon />
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={activeValue}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onChange={handleChange}
        aria-label="Volume"
        style={{ '--progress-percent': `${percent}%` }}
      />
    </div>
  )
}

export default VolumeControl
