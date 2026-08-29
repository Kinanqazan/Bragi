import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import ArtworkCarousel from './ArtworkCarousel'
import LyricsCanvas from './LyricsCanvas'
import PlayerControls from './PlayerControls'
import ProgressBar from './ProgressBar'
import QueueDrawer from './QueueDrawer'
import VolumeControl from './VolumeControl'
import PlayerToolbar, { PlayerLoveButton } from './PlayerToolbar'
import TrackIdentity from './TrackIdentity'
import AmbientBackdrop from './AmbientBackdrop'

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column',
    width: 'var(--nd-player-width, 480px)',
    padding: theme.spacing(10, 3, 3),
    boxSizing: 'border-box',
    color: theme.palette.text.primary,
    background: theme.palette.background.paper,
    borderLeft: `1px solid ${theme.palette.divider}`,
    overflowY: 'auto',
    isolation: 'isolate',
    '--nd-player-muted': theme.palette.text.secondary,
    '--nd-player-surface': theme.palette.background.paper,
    '--nd-player-accent': theme.palette.primary.main,
  },
  headerInfo: {
    position: 'relative',
    zIndex: 1,
    minWidth: 0,
    marginBottom: 14,
    textAlign: 'center',
    padding: '0 8px',
  },
  artwork: {
    position: 'relative',
    zIndex: 1,
    width: 'min(100%, 44vh)',
    aspectRatio: '1',
    margin: '0 auto 16px',
    borderRadius: 12,
    overflow: 'hidden',
    background: theme.palette.action.hover,
  },
  progress: { position: 'relative', zIndex: 1, width: '100%' },
  controls: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'center',
    marginTop: 16,
  },
  volume: { position: 'relative', zIndex: 1, marginTop: 28 },
  error: {
    position: 'relative',
    zIndex: 1,
    marginTop: 12,
    color: theme.palette.error.main,
    textAlign: 'center',
    fontSize: '0.85rem',
  },
  retry: {
    marginLeft: 8,
    padding: '4px 10px',
    color: 'inherit',
    background: 'transparent',
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: 4,
    cursor: 'pointer',
  },
}))

const DesktopPlayer = ({ bridge, queue, onClear }) => {
  const classes = useStyles()
  const [queueOpen, setQueueOpen] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const { snapshot, commands, uiVolume } = bridge
  const track = snapshot.currentTrack || {}

  return (
    <section className={classes.root} aria-label="Desktop player">
      <AmbientBackdrop cover={track.cover} />
      <PlayerToolbar
        id={track.trackId}
        isRadio={track.isRadio}
        showLove={false}
      />
      <div className={classes.headerInfo}>
        <TrackIdentity track={track} />
      </div>
      <div className={classes.artwork}>
        {lyricsOpen ? (
          <LyricsCanvas
            currentTime={snapshot.currentTime}
            lyric={track.lyric || track.song?.lyrics || ''}
            cover={track.cover}
            onClose={() => setLyricsOpen(false)}
            onSeek={commands.seek}
          />
        ) : (
          <ArtworkCarousel
            queue={queue}
            playIndex={snapshot.currentIndex}
            currentTrack={track}
            playMode={snapshot.mode}
            commands={commands}
          />
        )}
      </div>
      <div className={classes.progress}>
        <ProgressBar snapshot={snapshot} commands={commands} />
      </div>
      <div className={classes.controls}>
        <PlayerControls
          snapshot={snapshot}
          commands={commands}
          onQueue={() => setQueueOpen(true)}
          onLyrics={() => setLyricsOpen((open) => !open)}
          favoriteButton={
            <PlayerLoveButton id={track.trackId} isRadio={track.isRadio} />
          }
        />
      </div>
      <div className={classes.volume}>
        <VolumeControl value={uiVolume} onChange={commands.setVolume} />
      </div>
      {snapshot.error && (
        <div className={classes.error} role="alert">
          {snapshot.error.publicMessage || 'Unable to play this track.'}
          <button
            type="button"
            className={classes.retry}
            onClick={commands.play}
          >
            Retry
          </button>
        </div>
      )}
      {queueOpen && (
        <QueueDrawer
          queue={queue}
          currentIndex={snapshot.currentIndex}
          commands={commands}
          onClose={() => setQueueOpen(false)}
          onClear={onClear}
        />
      )}
    </section>
  )
}

export default DesktopPlayer
