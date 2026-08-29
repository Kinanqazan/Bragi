import React, { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import CloseIcon from '@material-ui/icons/Close'
import { openSaveQueueDialog } from '../actions'

const QueueDrawer = ({
  queue = [],
  currentIndex = -1,
  commands,
  onClose,
  onClear,
}) => {
  const dispatch = useDispatch()
  const drawerRef = useRef(null)

  useEffect(() => {
    drawerRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside
      ref={drawerRef}
      className="nd-player-queue-drawer"
      aria-label="Playback queue"
      tabIndex={-1}
    >
      <header>
        <h2>Queue</h2>
        <button type="button" onClick={onClose} aria-label="Close queue">
          <CloseIcon />
        </button>
      </header>
      <ol>
        {queue.map((track, index) => (
          <li key={track.uuid || track.trackId || index}>
            <button
              type="button"
              className={index === currentIndex ? 'is-current' : ''}
              aria-current={index === currentIndex ? 'true' : undefined}
              onClick={() => commands.select(index)}
            >
              <span>
                {track.title || track.name || track.song?.title || 'Untitled'}
              </span>
              <small>
                {track.artist || track.singer || track.song?.artist || ''}
              </small>
            </button>
          </li>
        ))}
      </ol>
      {queue.length > 0 && (
        <button type="button" onClick={() => dispatch(openSaveQueueDialog())}>
          Save queue
        </button>
      )}
      {onClear && (
        <button type="button" onClick={onClear}>
          Clear queue
        </button>
      )}
    </aside>
  )
}

export default QueueDrawer
