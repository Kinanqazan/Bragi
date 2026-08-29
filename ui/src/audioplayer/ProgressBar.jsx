import React, { useCallback } from 'react'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const ProgressBar = ({ snapshot, commands }) => {
  const duration = Number.isFinite(snapshot.duration) ? snapshot.duration : 0
  const currentTime = Math.min(duration || Infinity, snapshot.currentTime || 0)
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0
  const onChange = useCallback(
    (event) => commands.seek(Number(event.target.value)),
    [commands],
  )

  return (
    <div className="nd-player-progress">
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={duration ? currentTime : 0}
        onChange={onChange}
        disabled={!duration}
        aria-label="Seek"
        style={{ '--progress-percent': `${percent}%` }}
      />
      <div className="nd-player-progress-time">
        <span aria-hidden="true">{formatTime(currentTime)}</span>
        <span aria-hidden="true">{formatTime(duration)}</span>
      </div>
    </div>
  )
}

export default ProgressBar
