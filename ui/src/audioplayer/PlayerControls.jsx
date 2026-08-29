import React from 'react'
import IconButton from '@material-ui/core/IconButton'
import PauseIcon from '@material-ui/icons/Pause'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import SkipNextIcon from '@material-ui/icons/SkipNext'
import SkipPreviousIcon from '@material-ui/icons/SkipPrevious'
import QueueMusicIcon from '@material-ui/icons/QueueMusic'
import LyricsIcon from '@material-ui/icons/LibraryMusic'
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { useImmediateControlPress } from './controlPress'
import CastButton from '../cast/CastButton'

const useStyles = makeStyles((theme) => ({
  primaryBtn: {
    backgroundColor: `${theme.palette.primary.main} !important`,
    color: `${theme.palette.primary.contrastText || '#ffffff'} !important`,
    '&:hover': {
      backgroundColor: `${theme.palette.primary.main} !important`,
      filter: 'brightness(1.1)',
    },
  },
}))

const PlayerControls = ({
  snapshot,
  commands,
  onQueue,
  onLyrics,
  favoriteButton,
  showCast = true,
  compact = false,
  isolateGestures = false,
}) => {
  const classes = useStyles()
  const playbackPress = useImmediateControlPress(
    snapshot.playing ? commands.pause : commands.play,
    isolateGestures,
  )

  return (
    <div
      className={clsx('nd-player-controls', {
        'nd-player-controls-compact': compact,
      })}
    >
      <div className="nd-player-controls-primary">
        <IconButton
          onClick={commands.previous}
          aria-label="Previous track"
          className="nd-player-btn-prev"
        >
          <SkipPreviousIcon />
        </IconButton>
        <IconButton
          {...playbackPress}
          disableRipple
          aria-label={snapshot.playing ? 'Pause' : 'Play'}
          className={clsx('nd-player-primary-control', classes.primaryBtn)}
        >
          {snapshot.loading ? (
            <span className="nd-player-loading" aria-label="Loading" />
          ) : snapshot.playing ? (
            <PauseIcon />
          ) : (
            <PlayArrowIcon />
          )}
        </IconButton>
        <IconButton
          onClick={commands.next}
          aria-label="Next track"
          className="nd-player-btn-next"
        >
          <SkipNextIcon />
        </IconButton>
      </div>

      <div className="nd-player-controls-secondary">
        {favoriteButton && (
          <span className="nd-player-secondary-item">{favoriteButton}</span>
        )}
        {showCast && <CastButton className="nd-player-btn-secondary" />}
        {onLyrics && (
          <IconButton
            onClick={onLyrics}
            aria-label="Open lyrics"
            className="nd-player-btn-secondary"
          >
            <LyricsIcon />
          </IconButton>
        )}
        {onQueue && (
          <IconButton
            onClick={onQueue}
            aria-label="Open queue"
            className="nd-player-btn-secondary"
          >
            <QueueMusicIcon />
          </IconButton>
        )}
      </div>
    </div>
  )
}

export default PlayerControls
