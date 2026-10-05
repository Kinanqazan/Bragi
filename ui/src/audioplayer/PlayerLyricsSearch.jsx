import React, { useRef, useState } from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import CloseIcon from '@material-ui/icons/Close'
import SearchIcon from '@material-ui/icons/Search'
import { usePermissions } from 'react-admin'
import config from '../config'
import { REST_URL } from '../consts'
import { httpClient } from '../dataProvider'

const useStyles = makeStyles((theme) => ({
  emptySearch: {
    marginTop: theme.spacing(1),
    pointerEvents: 'auto',
  },
  searchButton: {
    color: '#fff',
    background: 'rgba(255, 255, 255, 0.12)',
    width: 56,
    height: 56,
    '& .MuiSvgIcon-root': { fontSize: 32 },
    '&:hover': { background: 'rgba(255, 255, 255, 0.2)' },
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing(1),
  },
  results: {
    display: 'grid',
    gap: theme.spacing(1),
  },
  query: {
    marginBottom: theme.spacing(2),
  },
  result: {
    display: 'block',
    width: '100%',
    padding: theme.spacing(1.25),
    textAlign: 'left',
    textTransform: 'none',
    border: `1px solid ${theme.palette.divider}`,
  },
}))

const PlayerLyricsSearch = ({
  songId,
  searchTitle = '',
  searchArtist = '',
  onLyricsPreview,
}) => {
  const classes = useStyles()
  const { permissions } = usePermissions()
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const searchRequestId = useRef(0)
  const defaultQuery = [searchTitle, searchArtist]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')

  const closeDialog = () => {
    if (searching) return
    setOpen(false)
    setError('')
  }

  const search = async (searchQuery) => {
    const requestId = ++searchRequestId.current
    const searchTerm = searchQuery.trim()
    setOpen(true)
    setQuery(searchQuery)
    setSearching(true)
    setResults(null)
    setError('')
    if (!searchTerm) {
      setResults([])
      setSearching(false)
      return
    }
    try {
      const id = encodeURIComponent(songId)
      const { json } = await httpClient(
        `${REST_URL}/song/${id}/lyrics/search?q=${encodeURIComponent(searchTerm)}`,
      )
      if (searchRequestId.current === requestId) {
        setResults(Array.isArray(json) ? json : [])
      }
    } catch (searchError) {
      if (searchRequestId.current === requestId) {
        setError(searchError.message || 'Could not search for lyrics.')
      }
    } finally {
      if (searchRequestId.current === requestId) {
        setSearching(false)
      }
    }
  }

  const openSearch = (event) => {
    event.stopPropagation()
    void search(defaultQuery)
  }

  const submitSearch = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    void search(query)
  }

  const selectLyrics = (result, event) => {
    event.stopPropagation()
    const content = result.syncedLyrics || result.plainLyrics || ''
    if (!content) return
    setOpen(false)
    onLyricsPreview(content)
  }

  if (
    !songId ||
    !config.enableMediaFileMetadataEditing ||
    permissions !== 'admin'
  ) {
    return null
  }

  return (
    <>
      <div className={classes.emptySearch}>
        <IconButton
          aria-label="Search lyrics"
          className={classes.searchButton}
          onClick={openSearch}
          size="small"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <SearchIcon />
        </IconButton>
      </div>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={closeDialog}
        PaperProps={{
          onClick: (event) => event.stopPropagation(),
          onPointerDown: (event) => event.stopPropagation(),
        }}
        scroll="paper"
      >
        <DialogTitle disableTypography className={classes.title}>
          <Typography variant="h6">Search lyrics</Typography>
          <IconButton
            aria-label="Close lyrics search"
            onClick={closeDialog}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            className={classes.query}
            fullWidth
            label="Song title"
            inputProps={{ 'aria-label': 'Song title' }}
            value={query}
            onChange={(event) => {
              searchRequestId.current += 1
              setQuery(event.target.value)
              setResults(null)
              setError('')
              setSearching(false)
            }}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') submitSearch(event)
            }}
            autoFocus
          />
          {searching ? (
            <CircularProgress size={22} aria-label="Searching lyrics" />
          ) : error ? (
            <Typography color="error" role="alert">
              {error}
            </Typography>
          ) : results?.length === 0 ? (
            <Typography color="textSecondary" role="status">
              No lyrics found.
            </Typography>
          ) : (
            <div
              className={classes.results}
              role="group"
              aria-label="Lyrics search results"
            >
              {results?.map((result) => {
                const label = `${result.trackName || 'Unknown track'} by ${result.artistName || 'Unknown artist'}`
                const detail = [
                  result.albumName,
                  Number.isFinite(result.duration) && result.duration > 0
                    ? `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}`
                    : '',
                  result.syncedLyrics ? 'Synced' : 'Plain',
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <Button
                    key={result.id}
                    className={classes.result}
                    onClick={(event) => selectLyrics(result, event)}
                    aria-label={`Load lyrics: ${label}`}
                  >
                    <strong>{label}</strong>
                    {detail && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="textSecondary"
                      >
                        {detail}
                      </Typography>
                    )}
                  </Button>
                )
              })}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={submitSearch} disabled={searching || !query.trim()}>
            Search
          </Button>
          <Button onClick={closeDialog} disabled={searching}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default PlayerLyricsSearch
