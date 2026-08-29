import React from 'react'
import IconButton from '@material-ui/core/IconButton'
import PauseRoundedIcon from '@material-ui/icons/PauseRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import { makeStyles } from '@material-ui/core/styles'
import AmbientBackdrop from './AmbientBackdrop'
import { useImmediateControlPress } from './controlPress'

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'fixed',
    right: 'max(10px, env(safe-area-inset-right))',
    bottom: 'calc(80px + env(safe-area-inset-bottom))',
    left: 'max(10px, env(safe-area-inset-left))',
    zIndex: 1350,
    display: 'flex',
    alignItems: 'center',
    height: 92,
    borderRadius: 18,
    overflow: 'hidden',
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    '--nd-player-surface': theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[8],
    touchAction: 'none',
    transform: 'translateZ(0)',
    isolation: 'isolate',
  },
  openButton: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flex: 1,
    height: '100%',
    minWidth: 0,
    alignItems: 'center',
    padding: 0,
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
  },
  cover: { width: 92, height: '100%', objectFit: 'cover' },
  emptyCover: {
    width: 92,
    height: '100%',
    background: theme.palette.action.hover,
  },
  details: {
    minWidth: 0,
    flex: 1,
    padding: theme.spacing(0, 2),
    transform: 'translateY(-3px)',
  },
  title: {
    display: 'block',
    overflow: 'hidden',
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  artist: {
    display: 'block',
    overflow: 'hidden',
    marginTop: 3,
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playButton: {
    position: 'relative',
    zIndex: 1,
    flex: '0 0 64px',
    width: 64,
    height: 64,
    marginRight: theme.spacing(1.5),
    padding: 0,
    color: `${theme.palette.primary.contrastText || '#ffffff'} !important`,
    backgroundColor: `${theme.palette.primary.main} !important`,
    borderRadius: '50%',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
    transition:
      'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
    '&:hover': {
      backgroundColor: `${theme.palette.primary.main} !important`,
      filter: 'brightness(1.1)',
      transform: 'scale(1.06)',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.36)',
    },
    '&:active': { transform: 'scale(0.94)' },
    '& svg': { fontSize: 36 },
  },
  progressTrack: {
    position: 'absolute',
    zIndex: 1,
    right: 0,
    bottom: 0,
    left: 0,
    height: 3,
    background: theme.palette.action.hover,
  },
  progress: { height: '100%', background: theme.palette.primary.main },
}))

const MobilePlayerBar = ({
  snapshot,
  commands,
  cover,
  ambientColor,
  title,
  artist,
  onOpen,
  rootRef,
  gestureHandlers,
  style: customStyle,
}) => {
  const classes = useStyles()
  const playbackPress = useImmediateControlPress(
    snapshot.playing ? commands.pause : commands.play,
    Boolean(gestureHandlers),
  )
  const duration = snapshot.duration || 0
  const progress = duration ? (snapshot.currentTime / duration) * 100 : 0

  return (
    <aside
      ref={rootRef}
      className={classes.root}
      aria-label="Now playing"
      style={customStyle}
      {...gestureHandlers}
    >
      <AmbientBackdrop cover={cover} color={ambientColor} />
      <div className={classes.progressTrack} aria-hidden="true">
        <div className={classes.progress} style={{ width: `${progress}%` }} />
      </div>
      <button
        type="button"
        className={classes.openButton}
        onClick={onOpen}
        aria-label={`Open full-screen player${title ? ` for ${title}` : ''}`}
      >
        {cover ? (
          <img className={classes.cover} src={cover} alt="" />
        ) : (
          <span className={classes.emptyCover} />
        )}
        <span className={classes.details}>
          <span className={classes.title}>{title || 'Now playing'}</span>
          {artist && <span className={classes.artist}>{artist}</span>}
        </span>
      </button>
      <IconButton
        className={classes.playButton}
        {...playbackPress}
        disableRipple
        aria-label={snapshot.playing ? 'Pause' : 'Play'}
      >
        {snapshot.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
      </IconButton>
    </aside>
  )
}

export default MobilePlayerBar
