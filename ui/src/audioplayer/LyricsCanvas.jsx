import React, { useEffect, useMemo, useRef } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import clsx from 'clsx'
import { useArtworkColor } from './artworkColor'

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    borderRadius: 'inherit',
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 14px',
    overflowY: 'auto',
    overflowX: 'hidden',
    zIndex: 10,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    cursor: 'pointer',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  contentContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    padding: '40% 0',
  },
  emptyContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyIcon: {
    fontSize: '36px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  emptyText: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '0.02em',
  },
  emptySubtext: {
    fontSize: '0.92rem',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  line: {
    fontSize: '1.4rem',
    fontWeight: 600,
    lineHeight: 1.45,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.45)',
    opacity: 0.6,
    transform: 'scale(0.94)',
    transformOrigin: 'center center',
    transition:
      'transform 0.38s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.38s cubic-bezier(0.25, 1, 0.5, 1), color 0.38s ease, text-shadow 0.38s ease',
    padding: '6px 14px',
    borderRadius: '10px',
    willChange: 'transform, opacity',
    '&:hover': {
      color: 'rgba(255, 255, 255, 0.85)',
      opacity: 0.9,
    },
  },
  activeLine: {
    color: '#ffffff !important',
    opacity: '1 !important',
    transform: 'scale(1.08) !important',
    textShadow: `0 2px 20px var(--lyrics-glow-color, ${theme.palette.primary.main})`,
  },
}))

function parseLrc(rawLyric) {
  if (!rawLyric || typeof rawLyric !== 'string') return []
  const lines = rawLyric.split('\n')
  const parsed = []
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/

  for (const line of lines) {
    const match = line.match(timeRegex)
    if (match) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const ms = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10)
      const time = min * 60 + sec + ms / 1000
      const text = match[4].trim()
      if (text) {
        parsed.push({ time, text })
      }
    } else if (line.trim() && !line.startsWith('[')) {
      parsed.push({ time: -1, text: line.trim() })
    }
  }
  return parsed
}

export const LyricsCanvas = ({
  currentTime = 0,
  lyric,
  cover,
  glowColor,
  onClose,
  onSeek,
}) => {
  const classes = useStyles()
  const scrollRef = useRef(null)
  const activeLineRef = useRef(null)
  const extractedColor = useArtworkColor(cover)
  const activeGlowColor = glowColor || extractedColor || undefined

  const parsedLines = useMemo(() => parseLrc(lyric), [lyric])
  const isSynced = useMemo(
    () => parsedLines.some((l) => l.time >= 0),
    [parsedLines],
  )

  // Determine active lyric index
  const activeIndex = useMemo(() => {
    if (!isSynced || parsedLines.length === 0) return -1
    let idx = -1
    for (let i = 0; i < parsedLines.length; i++) {
      if (parsedLines[i].time <= currentTime + 0.2) {
        idx = i
      } else {
        break
      }
    }
    return idx
  }, [isSynced, parsedLines, currentTime])

  // Smooth auto-scroll to keep active line centered
  useEffect(() => {
    if (activeLineRef.current && scrollRef.current) {
      const container = scrollRef.current
      const line = activeLineRef.current
      const targetScrollTop =
        line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        })
      } else {
        container.scrollTop = Math.max(0, targetScrollTop)
      }
    }
  }, [activeIndex])

  const handleClick = (e) => {
    e.stopPropagation()
    if (onClose) onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick(e)
  }

  const handleLineClick = (e, line) => {
    e.stopPropagation()
    if (onSeek && line.time >= 0) {
      onSeek(line.time)
    }
  }

  if (parsedLines.length === 0) {
    return (
      <div
        className={clsx(classes.root, 'nd-lyrics-canvas')}
        style={{
          '--lyrics-glow-color': activeGlowColor,
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Lyrics overlay, click to close"
      >
        <div className={classes.emptyContainer}>
          <MusicNoteIcon className={classes.emptyIcon} />
          <span className={classes.emptyText}>No lyrics available</span>
          <span className={classes.emptySubtext}>
            Tap to view album artwork
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={clsx(classes.root, 'nd-lyrics-canvas')}
      style={{
        '--lyrics-glow-color': activeGlowColor,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Lyrics canvas, tap to return to artwork"
    >
      <div className={classes.contentContainer}>
        {parsedLines.map((line, idx) => {
          const isActive = idx === activeIndex
          return (
            <div
              key={`${line.time}-${idx}`}
              ref={isActive ? activeLineRef : null}
              className={clsx(classes.line, {
                [classes.activeLine]: isActive,
              })}
              onClick={(e) => handleLineClick(e, line)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && line.time >= 0)
                  handleLineClick(e, line)
              }}
              role={line.time >= 0 ? 'button' : undefined}
              tabIndex={line.time >= 0 ? 0 : undefined}
            >
              {line.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LyricsCanvas
