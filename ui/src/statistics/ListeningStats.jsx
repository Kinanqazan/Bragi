import React, { useCallback, useEffect, useState } from 'react'
import {
  ButtonBase,
  CircularProgress,
  Typography,
  makeStyles,
} from '@material-ui/core'
import EqualizerRoundedIcon from '@material-ui/icons/EqualizerRounded'
import PlayArrowRoundedIcon from '@material-ui/icons/PlayArrowRounded'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { playTracks } from '../actions'
import { Artwork } from '../common/Artwork'
import { useRefreshOnEvents } from '../common/useRefreshOnEvents'
import config from '../config'
import { REST_URL } from '../consts'
import httpClient from '../dataProvider/httpClient'

const refreshEvents = ['song']

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
    padding: theme.spacing(0, 2),
    color: theme.palette.text.primary,
    [theme.breakpoints.up('md')]: {
      paddingLeft: theme.spacing(3),
      paddingRight: theme.spacing(3),
    },
    [theme.breakpoints.down('sm')]: {
      marginBottom: theme.spacing(10),
    },
  },
  songListDivider: {
    position: 'relative',
    marginTop: theme.spacing(3),
    paddingTop: theme.spacing(2),
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: theme.spacing(2),
      right: theme.spacing(2),
      borderTop: `1px solid ${
        theme.palette.type === 'dark'
          ? 'rgba(255,255,255,0.07)'
          : 'rgba(0,0,0,0.07)'
      }`,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2.25),
  },
  headingGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  headingIcon: {
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    color: theme.palette.primary.main,
    '& svg': { fontSize: 22 },
  },
  heading: {
    fontSize: '1.08rem',
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: '-0.025em',
  },
  period: {
    flexShrink: 0,
    color: theme.palette.text.secondary,
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  metric: {
    display: 'flex',
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(1.25, 0.5),
    borderRadius: 13,
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255,255,255,0.035)'
        : 'rgba(0,0,0,0.025)',
    border: `1px solid ${
      theme.palette.type === 'dark'
        ? 'rgba(255,255,255,0.045)'
        : 'rgba(0,0,0,0.05)'
    }`,
    textAlign: 'center',
  },
  metricValue: {
    display: 'block',
    overflow: 'hidden',
    fontSize: 'clamp(1.2rem, 4vw, 1.7rem)',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.045em',
    textOverflow: 'ellipsis',
  },
  metricLabel: {
    display: 'block',
    marginTop: theme.spacing(0.6),
    overflow: 'hidden',
    color: theme.palette.text.secondary,
    fontSize: '0.69rem',
    lineHeight: 1.25,
    fontWeight: 600,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    [theme.breakpoints.up('sm')]: { fontSize: '0.75rem' },
  },
  rankings: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    marginTop: theme.spacing(3.5),
  },
  section: { minWidth: 0 },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(1.1),
  },
  sectionTitle: {
    fontSize: '0.98rem',
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: '-0.015em',
  },
  carousel: {
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing(1.5),
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: theme.spacing(0.5, 0.25, 1),
    scrollBehavior: 'smooth',
    scrollSnapType: 'x mandatory',
    overscrollBehaviorX: 'contain',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  },
  trackCard: {
    display: 'flex',
    flex: '0 0 142px',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: 142,
    minWidth: 0,
    padding: 0,
    color: theme.palette.text.primary,
    textAlign: 'left',
    scrollSnapAlign: 'start',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.short,
    }),
    '&:hover': { transform: 'translateY(-2px)' },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 3,
      borderRadius: 12,
    },
    [theme.breakpoints.down('xs')]: {
      flexBasis: 130,
      width: 130,
    },
  },
  trackArtwork: {
    display: 'block',
    position: 'relative',
    width: '100%',
    height: 'auto',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: theme.palette.action.hover,
    boxShadow: theme.palette.type === 'dark'
      ? '0 7px 20px rgba(0,0,0,0.25)'
      : '0 5px 15px rgba(0,0,0,0.08)',
  },
  artworkImage: { width: '100%', height: '100%' },
  rank: {
    position: 'absolute',
    top: 7,
    left: 7,
    display: 'grid',
    placeItems: 'center',
    width: 25,
    height: 25,
    borderRadius: 8,
    color: '#fff',
    backgroundColor: 'rgba(10, 10, 12, 0.72)',
    fontSize: '0.68rem',
    fontWeight: 800,
    backdropFilter: 'blur(8px)',
  },
  playBadge: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    borderRadius: '50%',
    color: theme.palette.getContrastText(theme.palette.primary.main),
    backgroundColor: theme.palette.primary.main,
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
    '& svg': { fontSize: 21 },
  },
  trackInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0,
    padding: theme.spacing(1, 0.15, 0.35),
  },
  trackTitle: {
    width: '100%',
    overflow: 'hidden',
    fontSize: '0.79rem',
    lineHeight: 1.25,
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackArtist: {
    width: '100%',
    marginTop: 3,
    overflow: 'hidden',
    color: theme.palette.text.secondary,
    fontSize: '0.69rem',
    lineHeight: 1.2,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  plays: {
    marginTop: theme.spacing(0.7),
    color: theme.palette.text.secondary,
    fontSize: '0.66rem',
    lineHeight: 1,
    fontWeight: 600,
  },
  artistCard: {
    display: 'flex',
    flex: '0 0 128px',
    flexDirection: 'column',
    alignItems: 'center',
    width: 128,
    minWidth: 0,
    padding: 0,
    color: theme.palette.text.primary,
    textAlign: 'center',
    textDecoration: 'none',
    scrollSnapAlign: 'start',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.short,
    }),
    '&:hover': {
      transform: 'translateY(-2px)',
      textDecoration: 'none',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 3,
      borderRadius: 12,
    },
  },
  artistArtwork: {
    display: 'block',
    position: 'relative',
    width: 92,
    height: 92,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '50%',
    backgroundColor: theme.palette.action.hover,
    boxShadow: theme.palette.type === 'dark'
      ? '0 7px 20px rgba(0,0,0,0.25)'
      : '0 5px 15px rgba(0,0,0,0.08)',
    [theme.breakpoints.up('sm')]: { width: 100, height: 100 },
  },
  artistInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
    paddingTop: theme.spacing(1.1),
  },
  artistName: {
    width: '100%',
    overflow: 'hidden',
    fontSize: '0.78rem',
    lineHeight: 1.25,
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: theme.spacing(1.25, 0),
    color: theme.palette.text.secondary,
    fontSize: '0.82rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4, 0),
  },
}))

const formatCount = (value) => (Number(value) || 0).toLocaleString()

export const ListeningStats = ({
  showTitle = true,
  showSongListDivider = false,
}) => {
  const classes = useStyles()
  const rootClassName = `${classes.root} ${
    showSongListDivider ? classes.songListDivider : ''
  }`
  const dispatch = useDispatch()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refreshStats = useCallback(async () => {
    try {
      setError(false)
      const { json } = await httpClient(`${REST_URL}/listening-stats`)
      setStats(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  useRefreshOnEvents({ events: refreshEvents, onRefresh: refreshStats })

  const hasUnplayedStats =
    typeof stats?.unplayedTrackCount === 'number' &&
    Array.isArray(stats?.unplayedTrackList)

  const renderTrackCarousel = (tracks, label, emptyMessage, unplayed = false) => {
    if (!tracks?.length) {
      return <Typography className={classes.empty}>{emptyMessage}</Typography>
    }

    const trackData = Object.fromEntries(
      tracks.map((track) => [String(track.id), track]),
    )
    const trackIds = tracks.map((track) => String(track.id))

    return (
      <div
        className={classes.carousel}
        aria-label={`${label} carousel`}
        tabIndex={0}
      >
        {tracks.map((track, index) => (
          <ButtonBase
            className={classes.trackCard}
            key={track.id}
            focusRipple
            onClick={() => dispatch(playTracks(trackData, trackIds, track.id))}
            aria-label={`Play ${track.title} by ${track.artist}`}
          >
            <div className={classes.trackArtwork}>
              <Artwork
                record={{
                  ...track,
                  album: track.album || 'Unknown album',
                }}
                size={config.uiCoverArtSize || 300}
                square
                className={classes.artworkImage}
                title={track.title}
              />
              {!unplayed && <span className={classes.rank}>{index + 1}</span>}
              <span className={classes.playBadge}>
                <PlayArrowRoundedIcon />
              </span>
            </div>
            <div className={classes.trackInfo}>
              <Typography className={classes.trackTitle}>
                {track.title}
              </Typography>
              <Typography className={classes.trackArtist}>
                {track.artist || 'Unknown artist'}
              </Typography>
              <Typography className={classes.plays}>
                {unplayed
                  ? 'No recorded plays'
                  : `${formatCount(track.plays)} plays`}
              </Typography>
            </div>
          </ButtonBase>
        ))}
      </div>
    )
  }

  return (
    <section
      className={rootClassName}
      aria-label="Listening statistics"
    >
      <div className={classes.header}>
        <div className={classes.headingGroup}>
          <div className={classes.headingIcon}>
            <EqualizerRoundedIcon />
          </div>
          <Typography className={classes.heading} component="h2">
            {showTitle ? 'Listening stats' : 'Your listening'}
          </Typography>
        </div>
        <Typography className={classes.period}>Last 30 days</Typography>
      </div>

      {loading ? (
        <div className={classes.loading}>
          <CircularProgress size={25} />
        </div>
      ) : error ? (
        <Typography color="textSecondary">
          Listening stats could not be loaded.
        </Typography>
      ) : (
        <>
          <div className={classes.metrics}>
            <div className={classes.metric}>
              <Typography className={classes.metricValue}>
                {formatCount(stats?.plays)}
              </Typography>
              <Typography className={classes.metricLabel}>Plays</Typography>
            </div>
            <div className={classes.metric}>
              <Typography className={classes.metricValue}>
                {formatCount(stats?.uniqueTracks)}
              </Typography>
              <Typography className={classes.metricLabel}>
                Unique tracks
              </Typography>
            </div>
            <div className={classes.metric}>
              <Typography className={classes.metricValue}>
                {hasUnplayedStats
                  ? formatCount(stats.unplayedTrackCount)
                  : '—'}
              </Typography>
              <Typography className={classes.metricLabel}>
                Unplayed tracks
              </Typography>
            </div>
          </div>

          <div className={classes.rankings}>
            <section className={classes.section}>
              <div className={classes.sectionHeader}>
                <Typography className={classes.sectionTitle} component="h3">
                  Top tracks
                </Typography>
              </div>
              {renderTrackCarousel(
                stats?.topTracks,
                'Top tracks',
                'Your most played tracks will appear here.',
              )}
            </section>

            <section className={classes.section}>
              <div className={classes.sectionHeader}>
                <Typography className={classes.sectionTitle} component="h3">
                  Top artists
                </Typography>
              </div>
              {stats?.topArtists?.length ? (
                <div
                  className={classes.carousel}
                  aria-label="Top artists carousel"
                  tabIndex={0}
                >
                  {stats.topArtists.map((artist, index) => (
                    <ButtonBase
                      className={classes.artistCard}
                      key={artist.id}
                      component={Link}
                      to={`/artist/${artist.id}/show`}
                      aria-label={`Open artist ${artist.name}`}
                    >
                      <div className={classes.artistArtwork}>
                        <Artwork
                          record={artist}
                          size={config.uiCoverArtSize || 300}
                          className={classes.artworkImage}
                          title={artist.name}
                        />
                        <span className={classes.rank}>{index + 1}</span>
                      </div>
                      <div className={classes.artistInfo}>
                        <Typography className={classes.artistName}>
                          {artist.name}
                        </Typography>
                        <Typography className={classes.plays}>
                          {formatCount(artist.plays)} plays
                        </Typography>
                      </div>
                    </ButtonBase>
                  ))}
                </div>
              ) : (
                <Typography className={classes.empty}>
                  Artists you listen to will appear here.
                </Typography>
              )}
            </section>

            <section className={classes.section}>
              <div className={classes.sectionHeader}>
                <Typography className={classes.sectionTitle} component="h3">
                  Unplayed tracks
                </Typography>
              </div>
              {hasUnplayedStats ? (
                renderTrackCarousel(
                  stats.unplayedTrackList,
                  'Unplayed tracks',
                  'No unplayed tracks found.',
                  true,
                )
              ) : (
                <Typography className={classes.empty}>
                  Unplayed-track data is outdated. Restart the local dev server.
                </Typography>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  )
}

export default ListeningStats
