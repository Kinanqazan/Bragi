import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  TextField,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import EqualizerIcon from '@material-ui/icons/Equalizer'
import { openListenBrainzTokenDialog, playTracks } from '../actions'
import { ListenBrainzTokenDialog } from '../dialogs'
import { httpClient } from '../dataProvider'

const useStyles = makeStyles((theme) => ({
  root: {
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    touchAction: 'pan-y pinch-zoom',
    boxSizing: 'border-box',
    padding: theme.spacing(3),
    paddingBottom: theme.spacing(12),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(1),
      paddingTop:
        'calc(var(--nd-mobile-top-offset, calc(env(safe-area-inset-top, 0px) + 82px)) + 16px)',
      paddingBottom: theme.spacing(12),
    },
  },
  content: { maxWidth: 1000, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3),
  },
  heading: { fontWeight: 800 },
  statsButton: {
    borderRadius: 10,
    textTransform: 'none',
    lineHeight: 1,
    '& .MuiButton-label': { display: 'inline-flex', alignItems: 'center' },
    '& .MuiButton-startIcon': { display: 'inline-flex', alignItems: 'center' },
  },
  muted: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
  track: { flex: 1, minWidth: 0 },
  trackButton: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: theme.spacing(1.5),
    border: 0,
    padding: 0,
    color: 'inherit',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: 6,
    objectFit: 'cover',
    flexShrink: 0,
    background: theme.palette.action.hover,
  },
  artworkPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 6,
    flexShrink: 0,
    background: theme.palette.action.hover,
    display: 'grid',
    placeItems: 'center',
    color: theme.palette.text.secondary,
  },
  trackTitle: { fontWeight: 600, overflowWrap: 'anywhere' },
  actions: { display: 'flex', flexShrink: 0 },
}))

const getId = (identifier = '') => identifier.split('/').pop()
const searchURL = (track) => {
  const query = [track.creator, track.title].filter(Boolean).join(' ')
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const artworkURL = (track) => {
  const id =
    track.extension?.['https://musicbrainz.org/doc/jspf#track']
      ?.additional_metadata?.caa_release_mbid
  return uuidPattern.test(id || '')
    ? `https://coverartarchive.org/release/${id}/front-250`
    : ''
}

function TrackArtwork({ track, classes }) {
  const [failed, setFailed] = useState(false)
  const src = artworkURL(track)
  return src && !failed ? (
    <img
      className={classes.artwork}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={classes.artworkPlaceholder}>
      <MusicNoteIcon />
    </span>
  )
}

export default function ForYouPage() {
  const classes = useStyles()
  const dispatch = useDispatch()
  const [state, setState] = useState({ loading: true })
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [manualCopy, setManualCopy] = useState('')
  const linkCache = React.useRef(new Map())

  const resolveLink = async (track) => {
    const id = getId(track.identifier?.[0])
    if (!uuidPattern.test(id)) return ''
    if (!linkCache.current.has(id)) {
      const request = httpClient(`/api/listenbrainz/recording/${id}/youtube`)
        .then(({ json }) => json.url || '')
        .catch((error) => {
          linkCache.current.delete(id)
          throw error
        })
      linkCache.current.set(id, request)
    }
    return linkCache.current.get(id)
  }

  const openTrack = async (track) => {
    const popup = !window.BragiNative ? window.open('', '_blank') : null
    let direct
    try {
      direct = await resolveLink(track)
    } catch (error) {
      popup?.close()
      setNotice(
        error?.status === 404
          ? 'Restart the Bragi server to enable song links.'
          : 'Could not look up the song link. Try again.',
      )
      return
    }
    const url = direct || searchURL(track)
    if (window.BragiNative?.openExternalUrl)
      window.BragiNative.openExternalUrl(url)
    else if (window.BragiNative) window.location.assign(url)
    else if (popup) {
      popup.opener = null
      popup.location.href = url
    } else window.open(url, '_blank', 'noopener,noreferrer')
    if (!direct)
      setNotice('No direct link was found. Opened YouTube Music search.')
  }

  const copyLink = async (track) => {
    let direct
    try {
      direct = await resolveLink(track)
    } catch (error) {
      setNotice(
        error?.status === 404
          ? 'Restart the Bragi server to enable song links.'
          : 'Could not look up the song link. Try again.',
      )
      return
    }
    if (!direct) {
      setNotice('No direct song link was found for this recording.')
      return
    }
    const url = direct
    const message = 'Song link copied'
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(url)
      setNotice(message)
    } catch {
      setManualCopy(url)
      setNotice('Copy the song link below')
    }
  }

  useEffect(() => {
    let active = true
    setState({ loading: true })
    httpClient('/api/listenbrainz/recommendations')
      .then(async ({ json }) => {
        if (!json.linked) return json
        const ids = [
          ...new Set(
            (json.playlists || [])
              .map(({ playlist }) => getId(playlist?.identifier))
              .filter(Boolean),
          ),
        ]
        const results = await Promise.allSettled(
          ids.map((id) =>
            httpClient(
              `/api/listenbrainz/recommendations/${encodeURIComponent(id)}`,
            ),
          ),
        )
        const seen = new Set()
        const tracks = []
        results.forEach((result) => {
          if (result.status !== 'fulfilled') return
          for (const track of result.value.json.playlist?.track || []) {
            const id = track.identifier?.[0]
            if (id && seen.has(id)) continue
            if (id) seen.add(id)
            tracks.push(track)
          }
        })
        return {
          linked: true,
          user: json.user,
          tracks,
          partialError: results.some((result) => result.status === 'rejected'),
        }
      })
      .then((result) => {
        if (active) setState(result)
      })
      .catch((error) => {
        if (active) setState({ error: true, status: error?.status })
      })
    return () => {
      active = false
    }
  }, [revision])

  const onLinked = useCallback((linked) => {
    if (linked) setRevision((value) => value + 1)
  }, [])

  const retry = () => setRevision((value) => value + 1)
  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <div className={classes.header}>
          <Typography variant="h4" component="h1" className={classes.heading}>
            For You
          </Typography>
          {state.user && (
            <Button
              component="a"
              className={classes.statsButton}
              variant="contained"
              color="primary"
              href={`https://listenbrainz.org/user/${encodeURIComponent(state.user)}/stats/`}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<EqualizerIcon />}
              onClick={(event) => {
                if (window.BragiNative?.openExternalUrl) {
                  event.preventDefault()
                  window.BragiNative.openExternalUrl(event.currentTarget.href)
                }
              }}
            >
              Open Stats
            </Button>
          )}
        </div>
        {state.loading && (
          <CircularProgress size={28} aria-label="Loading recommendations" />
        )}
        {state.error && (
          <>
            <Typography>
              Could not load recommendations from ListenBrainz.
            </Typography>
            {state.status === 404 && (
              <Typography color="textSecondary">
                The Bragi server may need to be updated or restarted to enable
                recommendations.
              </Typography>
            )}
            <Button onClick={retry}>Try again</Button>
            <Button onClick={() => dispatch(openListenBrainzTokenDialog())}>
              Connect ListenBrainz
            </Button>
          </>
        )}
        {!state.loading && !state.error && state.linked === false && (
          <>
            <Typography className={classes.muted}>
              Connect ListenBrainz to see your recommendations here.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => dispatch(openListenBrainzTokenDialog())}
            >
              Connect ListenBrainz
            </Button>
          </>
        )}
        {state.linked && !state.loading && (
          <>
            {state.partialError && (
              <>
                <Typography>
                  Some recommendations could not be loaded.
                </Typography>
                <Button onClick={retry}>Try again</Button>
              </>
            )}
            {!state.tracks?.length && !state.partialError && (
              <Typography>
                No recommendations are available yet. ListenBrainz generates
                them from your listening history.
              </Typography>
            )}
            {state.tracks?.map((track, index) => (
              <div className={classes.row} key={`${index}-${track.title}`}>
                <button
                  type="button"
                  className={classes.trackButton}
                  onClick={() => openTrack(track)}
                  aria-label={`Open ${track.title} in YouTube Music`}
                >
                  <TrackArtwork track={track} classes={classes} />
                  <span className={classes.track}>
                    <Typography
                      component="span"
                      display="block"
                      className={classes.trackTitle}
                    >
                      {track.title || 'Unknown track'}
                    </Typography>
                    <Typography
                      component="span"
                      display="block"
                      variant="body2"
                      color="textSecondary"
                    >
                      {track.creator}
                    </Typography>
                  </span>
                </button>
                <div className={classes.actions}>
                  {track.library && (
                    <IconButton
                      aria-label={`Play ${track.title} in Bragi`}
                      onClick={() =>
                        dispatch(
                          playTracks({ [track.library.id]: track.library }, [
                            track.library.id,
                          ]),
                        )
                      }
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  )}
                  <IconButton
                    aria-label={`Copy link for ${track.title}`}
                    title="Copy song link"
                    onClick={() => copyLink(track)}
                  >
                    <FileCopyOutlinedIcon />
                  </IconButton>
                </div>
              </div>
            ))}
          </>
        )}
        <ListenBrainzTokenDialog setLinked={onLinked} />
        <Snackbar
          open={Boolean(notice)}
          autoHideDuration={4000}
          onClose={() => setNotice('')}
          message={notice}
        />
        <Dialog
          open={Boolean(manualCopy)}
          onClose={() => setManualCopy('')}
          fullWidth
        >
          <DialogTitle>Copy link</DialogTitle>
          <DialogContent>
            <TextField
              value={manualCopy}
              fullWidth
              InputProps={{ readOnly: true }}
              onFocus={(event) => event.target.select()}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManualCopy('')}>Close</Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  )
}
