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
    right: 0,
    bottom: 'calc(55px + env(safe-area-inset-bottom))',
    left: 0,
    paddingRight: 'env(safe-area-inset-right, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    zIndex: 1350,
    display: 'flex',
    alignItems: 'center',
    height: 104,
    borderRadius: 0,
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
    height: 'calc(100% + 2px)',
    minWidth: 0,
    alignItems: 'center',
    marginTop: -1,
    marginBottom: -1,
    marginLeft: -1,
    padding: 0,
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 0.12s ease-out, opacity 0.12s ease-out',
    '&:active': {
      transform: 'scale(0.985)',
      opacity: 0.92,
    },
  },
  cover: {
    display: 'block',
    flex: '0 0 104px',
    width: 104,
    height: '100%',
    objectFit: 'cover',
    borderRadius: 4,
  },
  emptyCover: {
    display: 'block',
    flex: '0 0 104px',
    width: 104,
    height: '100%',
    background: theme.palette.action.hover,
  },
  details: {
    minWidth: 0,
    flex: 1,
    padding: theme.spacing(0, 2),
    transform: 'translateY(-5px)',
  },
  title: {
    display: 'block',
    overflow: 'hidden',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'inherit',
    textDecoration: 'none',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  artist: {
    display: 'block',
    overflow: 'hidden',
    marginTop: 3,
    color: theme.palette.text.secondary,
    fontSize: '1rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playSlot: {
    flex: '0 0 64px',
    width: 64,
    height: 64,
    marginRight: theme.spacing(1.5),
    visibility: 'hidden',
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
  cover,
  ambientColor,
  title,
  artist,
  onOpen,
  progress,
  snapshot,
  commands,
  sharedPlayback = false,
  sharedIdentity = false,
  rootRef,
  artworkRef,
  playRef,
  titleRef,
  artistRef,
  progressTrackRef,
  gestureHandlers,
  style: customStyle,
}) => {
  const classes = useStyles()
  const playbackPress = useImmediateControlPress(
    snapshot?.playing ? commands?.pause : commands?.play,
    Boolean(gestureHandlers),
  )
  const duration = snapshot?.duration || 0
  const progressPercent =
    progress ?? (duration ? (snapshot.currentTime / duration) * 100 : 0)
  return (
    <aside
      ref={rootRef}
      className={classes.root}
      aria-label="Now playing"
      style={customStyle}
      {...gestureHandlers}
    >
      {!sharedPlayback && (
        <AmbientBackdrop cover={cover} color={ambientColor} />
      )}
      <div
        ref={progressTrackRef}
        className={classes.progressTrack}
        aria-hidden="true"
      >
        <div
          className={classes.progress}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div
        role="button"
        tabIndex={0}
        className={classes.openButton}
        onClick={(event) => {
          event.currentTarget?.blur()
          onOpen?.()
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen?.()
          }
        }}
        aria-label={`Open full-screen player${title ? ` for ${title}` : ''}`}
      >
        {sharedPlayback ? (
          cover ? (
            <span
              ref={artworkRef}
              className={classes.cover}
              style={{ visibility: 'hidden' }}
              aria-hidden="true"
            />
          ) : (
            <span
              ref={artworkRef}
              className={classes.emptyCover}
              style={{ visibility: 'hidden' }}
              aria-hidden="true"
            />
          )
        ) : cover ? (
          <img className={classes.cover} src={cover} alt="" />
        ) : (
          <span className={classes.emptyCover} />
        )}
        <span className={classes.details}>
          <span
            ref={titleRef}
            className={classes.title}
            style={sharedIdentity ? { visibility: 'hidden' } : undefined}
            aria-hidden={sharedIdentity || undefined}
          >
            {title || 'Now playing'}
          </span>
          {artist && (
            <span
              ref={artistRef}
              className={classes.artist}
              style={sharedIdentity ? { visibility: 'hidden' } : undefined}
              aria-hidden={sharedIdentity || undefined}
            >
              {artist}
            </span>
          )}
        </span>
      </div>
      {sharedPlayback ? (
        <span ref={playRef} className={classes.playSlot} aria-hidden="true" />
      ) : (
        <IconButton
          className={classes.playButton}
          {...playbackPress}
          disableRipple
          aria-label={snapshot?.playing ? 'Pause' : 'Play'}
        >
          {snapshot?.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
      )}
    </aside>
  )
}

export default MobilePlayerBar
