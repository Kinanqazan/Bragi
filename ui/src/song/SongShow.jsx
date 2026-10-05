import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import CloseIcon from '@material-ui/icons/Close'
import CloudUploadIcon from '@material-ui/icons/CloudUpload'
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline'
import EditIcon from '@material-ui/icons/Edit'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import PhotoCameraIcon from '@material-ui/icons/PhotoCamera'
import SearchIcon from '@material-ui/icons/Search'
import SaveIcon from '@material-ui/icons/Save'
import StorageIcon from '@material-ui/icons/Storage'
import {
  ShowContextProvider,
  Title as RaTitle,
  useShowContext,
  useShowController,
  useNotify,
  usePermissions,
  useRefresh,
  useDataProvider,
} from 'react-admin'
import { useDispatch } from 'react-redux'
import { Prompt, useHistory, useLocation } from 'react-router-dom'
import { playTracks, updateTrackMetadata } from '../actions'
import config from '../config'
import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'
import { hasTimestampedLyrics, shiftLyricsTimestamps } from './lyricsTiming'
import {
  ArtistLinkField,
  Artwork,
  DurationField,
  LoveButton,
  Title,
  useScrollRestoration,
} from '../common'

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    [theme.breakpoints.down('xs')]: {
      paddingTop: theme.spacing(4),
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
      overscrollBehaviorY: 'contain',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      paddingBottom: 'calc(var(--nd-mobile-bottom-offset, 56px) + 16px)',
    },
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(3),
    },
  },
  backButton: {
    marginBottom: theme.spacing(2),
  },
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)',
    gap: theme.spacing(3),
    alignItems: 'start',
    maxWidth: 1440,
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)',
      gap: theme.spacing(2),
    },
    [theme.breakpoints.down('xs')]: {
      position: 'relative',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: theme.spacing(2),
    },
  },
  artwork: {
    width: '100%',
    height: '100%',
    borderRadius: theme.shape.borderRadius,
    background: theme.palette.action.hover,
  },
  coverFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    maxWidth: 300,
    overflow: 'hidden',
    borderRadius: theme.shape.borderRadius,
    [theme.breakpoints.down('xs')]: {
      maxWidth: 220,
      justifySelf: 'center',
      marginTop: 'calc(8px + env(safe-area-inset-top, 0px))',
    },
  },
  artworkPreview: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  artworkActions: {
    position: 'absolute',
    top: theme.spacing(1),
    left: theme.spacing(1),
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    padding: theme.spacing(0.25),
    borderRadius: 24,
    background: 'rgba(0, 0, 0, 0.58)',
    color: '#fff',
    '& .MuiIconButton-root': {
      color: 'inherit',
      width: 36,
      height: 36,
    },
  },
  artworkFileInput: {
    display: 'none',
  },
  playOverlay: {
    position: 'absolute',
    right: theme.spacing(1.5),
    bottom: theme.spacing(1.5),
    zIndex: 2,
  },
  playButton: {
    minHeight: 40,
    borderRadius: 24,
    boxShadow: theme.shadows[4],
  },
  playDuration: {
    marginLeft: theme.spacing(0.5),
    whiteSpace: 'nowrap',
  },
  details: {
    minWidth: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    [theme.breakpoints.down('xs')]: {
      flexWrap: 'wrap',
    },
  },
  title: {
    flex: '1 1 auto',
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontSize: '1.375rem',
  },
  titleActions: {
    display: 'flex',
    alignItems: 'center',
    flex: '0 0 auto',
    gap: theme.spacing(0.5),
    [theme.breakpoints.down('xs')]: {
      position: 'absolute',
      top: 'calc(8px + env(safe-area-inset-top, 0px))',
      right: 'calc((100% - 220px) / 2 - 56px)',
      zIndex: 3,
      flexDirection: 'column',
      gap: 0,
      width: 48,
      boxSizing: 'border-box',
      padding: theme.spacing(0.25),
      borderRadius: 24,
      background: theme.palette.background.paper,
      boxShadow: theme.shadows[2],
      '& button': {
        width: 40,
        height: 40,
        padding: theme.spacing(1),
      },
    },
  },
  artist: {
    marginTop: theme.spacing(0.5),
    fontSize: '1.15rem',
  },
  editActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    [theme.breakpoints.down('xs')]: {
      width: 'auto',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
    },
  },
  section: {
    marginTop: theme.spacing(3),
  },
  label: {
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(1),
  },
  chipList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  chip: {
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 16,
    background: theme.palette.action.hover,
  },
  unavailable: {
    padding: theme.spacing(3),
  },
  inlineInput: {
    display: 'inline-block',
    minWidth: 0,
    maxWidth: '100%',
    border: 0,
    borderBottom: '1px solid transparent',
    borderRadius: 0,
    outline: 0,
    padding: 0,
    background: 'transparent',
    color: theme.palette.text.primary,
    WebkitTextFillColor: theme.palette.text.primary,
    opacity: 1,
    font: 'inherit',
    '&:focus': {
      borderBottomColor: theme.palette.primary.main,
    },
  },
  titleInput: {
    width: '100%',
    overflowWrap: 'anywhere',
  },
  artistInput: {
    width: '100%',
  },
  editableChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    maxWidth: '100%',
    padding: theme.spacing(0.5, 1),
    borderRadius: 16,
    background: theme.palette.action.hover,
  },
  removeChip: {
    border: 0,
    padding: 0,
    background: 'transparent',
    color: theme.palette.text.secondary,
    font: 'inherit',
    lineHeight: 1,
    cursor: 'pointer',
  },
  addChip: {
    border: `1px dashed ${theme.palette.divider}`,
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 16,
    background: 'transparent',
    color: theme.palette.text.secondary,
    font: 'inherit',
    cursor: 'pointer',
  },
  refreshNotice: {
    marginTop: theme.spacing(2),
  },
  lyricsInput: {
    width: '100%',
    maxWidth: 480,
    height: 440,
    boxSizing: 'border-box',
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    font: 'inherit',
    resize: 'vertical',
  },
  lyricsTimingButton: {
    minWidth: 0,
    height: 32,
    padding: theme.spacing(0, 0.75),
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  },
  lyricsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  lyricsHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  lyricsTimingControls: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
  },
  lyricsActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    '& .MuiButton-root': {
      minWidth: 52,
      height: 40,
      padding: theme.spacing(0, 1),
    },
  },
  lyricsSearchTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing(1),
  },
  lyricsSearchResults: {
    display: 'grid',
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  lyricsSearchResult: {
    justifyContent: 'flex-start',
    textAlign: 'left',
    textTransform: 'none',
    padding: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
  },
  lyricsNotice: {
    marginTop: theme.spacing(1),
  },
  lyricsFileInput: {
    display: 'none',
  },
}))

const genreValuesFromRecord = (record) =>
  (record?.genres || [])
    .map((genre) => (typeof genre === 'string' ? genre : genre.name))
    .filter(Boolean)

const metadataDraftFromRecord = (record) => ({
  title: record.title || '',
  artist: record.artist || '',
  albumArtist: record.albumArtist || '',
  genres: genreValuesFromRecord(record),
  moods: [...(record.tags?.mood || [])],
})

const sameValues = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const EditableTagList = ({ kind, values, classes, onChange, onAdd, onRemove, suggestionsId }) => (
  <div className={classes.chipList}>
    {values.map((value, index) => (
      <div className={classes.editableChip} key={`${kind}-${index}`}>
        <input
          aria-label={`${kind} ${index + 1}`}
          className={classes.inlineInput}
          list={suggestionsId}
          maxLength={4096}
          style={{ width: `${Math.max(4, value.length + 1)}ch` }}
          value={value}
          onChange={(event) => onChange(index, event.target.value)}
        />
        <button
          aria-label={`Remove ${kind.toLowerCase()} ${index + 1}`}
          className={classes.removeChip}
          onClick={() => onRemove(index)}
          type="button"
        >
          ×
        </button>
      </div>
    ))}
    <button
      aria-label={`Add ${kind.toLowerCase()}`}
      className={classes.addChip}
      onClick={onAdd}
      type="button"
    >
      + Add
    </button>
  </div>
)

const SongShowLayout = (props) => {
  const { record, loading, error } = useShowContext(props)
  const classes = useStyles()
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const notify = useNotify()
  const refresh = useRefresh()
  const dataProvider = useDataProvider()
  const { permissions } = usePermissions()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [metadataSuggestions, setMetadataSuggestions] = useState({ artists: [], genres: [], moods: [] })
  const [draft, setDraft] = useState({
    title: '',
    artist: '',
    albumArtist: '',
    genres: [],
    moods: [],
  })
  const [localRecord, setLocalRecord] = useState(null)
  const [refreshError, setRefreshError] = useState('')
  const [lyricsFiles, setLyricsFiles] = useState({ txt: {}, lrc: {}, embedded: {} })
  const [lyricsDestination, setLyricsDestination] = useState('separate')
  const [lyricsDestinationMenuAnchor, setLyricsDestinationMenuAnchor] = useState(null)
  const [lyricsExtension, setLyricsExtension] = useState('.txt')
  const [lyricsDraft, setLyricsDraft] = useState('')
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsSaving, setLyricsSaving] = useState(false)
  const [lyricsDeleting, setLyricsDeleting] = useState(false)
  const [lyricsSearching, setLyricsSearching] = useState(false)
  const [lyricsSearchResults, setLyricsSearchResults] = useState(null)
  const [lyricsSearchOpen, setLyricsSearchOpen] = useState(false)
  const [lyricsSearchError, setLyricsSearchError] = useState('')
  const [lyricsSearchQuery, setLyricsSearchQuery] = useState('')
  const [lyricsRefreshing, setLyricsRefreshing] = useState(false)
  const [lyricsRefreshRequired, setLyricsRefreshRequired] = useState(false)
  const [lyricsRefreshError, setLyricsRefreshError] = useState('')
  const [lyricsError, setLyricsError] = useState('')
  const [artworkFile, setArtworkFile] = useState(null)
  const [artworkPreview, setArtworkPreview] = useState('')
  const [artworkSaving, setArtworkSaving] = useState(false)
  const artworkInputRef = useRef(null)

  useEffect(() => {
    if (!record) return
    setLocalRecord(record)
    setDraft(metadataDraftFromRecord(record))
  }, [record])

  const displayRecord = localRecord || record
  const canEdit = config.enableMediaFileMetadataEditing && permissions === 'admin'
  const recordId = displayRecord?.id
  const mediaFileId = displayRecord?.mediaFileId
  const changedFields = useMemo(() => {
    if (!displayRecord) return {}
    const changes = Object.fromEntries(
      ['title', 'artist', 'albumArtist']
        .filter((field) => draft[field] !== (displayRecord[field] || ''))
        .map((field) => [field, draft[field]]),
    )
    const currentGenres = genreValuesFromRecord(displayRecord)
    const nextGenres = draft.genres.map((value) => value.trim()).filter(Boolean)
    if (!sameValues(currentGenres, nextGenres)) changes.genres = nextGenres

    const currentMoods = displayRecord.tags?.mood || []
    const nextMoods = draft.moods.map((value) => value.trim()).filter(Boolean)
    if (!sameValues(currentMoods, nextMoods)) changes.moods = nextMoods
    return changes
  }, [draft, displayRecord])
  const hasUnsavedChanges = editing && Object.keys(changedFields).length > 0
  const lyricsKey = lyricsExtension.slice(1)
  const lyricsBaseline = lyricsDestination === 'embedded'
    ? lyricsFiles.embedded?.content || ''
    : lyricsFiles[lyricsKey]?.content || ''
  const lyricsHasTimestamps = hasTimestampedLyrics(lyricsDraft)
  const lyricsTimingChanged = lyricsHasTimestamps && lyricsOffsetMs !== 0
  const lyricsChanged = lyricsDraft !== lyricsBaseline || lyricsTimingChanged
  const hasAnyUnsavedChanges = hasUnsavedChanges || lyricsChanged || !!artworkFile

  useEffect(() => {
    if (!artworkPreview) return undefined
    return () => URL.revokeObjectURL(artworkPreview)
  }, [artworkPreview])

  useEffect(() => {
    if (!recordId || !canEdit) return undefined
    let active = true
    setLyricsLoading(true)
    const id = encodeURIComponent(mediaFileId || recordId)
    httpClient(`${REST_URL}/song/${id}/lyrics`)
      .then(({ json }) => {
        if (!active) return
        const files = { txt: json?.txt || {}, lrc: json?.lrc || {}, embedded: json?.embedded || {} }
        const extension = files.lrc.exists ? '.lrc' : '.txt'
        const destination = files.lrc.exists || files.txt.exists || !files.embedded.exists
          ? 'separate'
          : 'embedded'
        setLyricsFiles(files)
        setLyricsDestination(destination)
        setLyricsExtension(extension)
        setLyricsDraft(destination === 'embedded'
          ? files.embedded.content || ''
          : files[extension.slice(1)].content || '')
        setLyricsOffsetMs(0)
        setLyricsError('')
      })
      .catch((error) => {
        if (active) setLyricsError(error.message || 'Could not load lyrics.')
      })
      .finally(() => {
        if (active) setLyricsLoading(false)
      })
    return () => {
      active = false
    }
  }, [canEdit, recordId, mediaFileId])

  useEffect(() => {
    if (!hasAnyUnsavedChanges) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasAnyUnsavedChanges])

  useScrollRestoration(!!record?.id || !!error)

  const handleBack = () => {
    if (location.state?.returnTo && history.length > 1) {
      history.goBack()
      return
    }
    history.replace('/song')
  }

  const startEditing = () => {
    setDraft(metadataDraftFromRecord(displayRecord))
    setEditing(true)
    Promise.all([
      dataProvider.getList('artist', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'name', order: 'ASC' },
        filter: { missing: false },
      }),
      dataProvider.getList('genre', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'name', order: 'ASC' },
        filter: {},
      }),
      dataProvider.getList('tag', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'name', order: 'ASC' },
        filter: { missing: false },
      }),
    ]).then(([artists, genres, tags]) => {
      const names = (items) => [...new Set((items?.data || []).map((item) => item.name).filter(Boolean))]
      setMetadataSuggestions({
        artists: names(artists),
        genres: names(genres),
        moods: [...new Set((tags?.data || [])
          .filter((tag) => tag.tagName === 'mood')
          .map((tag) => tag.tagValue)
          .filter(Boolean))],
      })
    }).catch(() => {
      // Suggestions are optional; metadata editing remains available if a facet list fails.
    })
  }

  const updateTagDraft = (field, index, value) => {
    setDraft((current) => {
      const values = [...current[field]]
      values[index] = value
      return { ...current, [field]: values }
    })
  }

  const addTagDraft = (field) => {
    setDraft((current) => ({ ...current, [field]: [...current[field], ''] }))
  }

  const removeTagDraft = (field, index) => {
    setDraft((current) => ({
      ...current,
      [field]: current[field].filter((_, valueIndex) => valueIndex !== index),
    }))
  }

  const handleSave = async () => {
    if (!displayRecord || Object.keys(changedFields).length === 0) return
    setSaving(true)
    setRefreshError('')
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const { json } = await httpClient(`${REST_URL}/song/${id}/metadata`, {
        method: 'PUT',
        body: JSON.stringify(changedFields),
      })
      const optimistic = { ...displayRecord, ...changedFields }
      if (Object.hasOwn(changedFields, 'genres')) {
        optimistic.genres = changedFields.genres.map((name) => ({ name }))
      }
      if (Object.hasOwn(changedFields, 'moods')) {
        optimistic.tags = { ...displayRecord.tags, mood: changedFields.moods }
      }
      const updatedRecord = json.mediaFile || optimistic
      setLocalRecord(updatedRecord)
      dispatch(updateTrackMetadata(updatedRecord))
      setEditing(false)
      dataProvider.clearCache?.()
      if (json.refreshRequired) {
        setRefreshError(json.refreshError || 'The file was saved, but the library index has not refreshed yet.')
      } else {
        refresh()
      }
    } catch (saveError) {
      notify(saveError.message || 'Could not save song metadata.', {
        type: 'warning',
        multiLine: true,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    if (!displayRecord) return
    setRefreshing(true)
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const { json } = await httpClient(
        `${REST_URL}/song/${id}/metadata/refresh`,
        { method: 'POST' },
      )
      setLocalRecord(json.mediaFile)
      dispatch(updateTrackMetadata(json.mediaFile))
      setDraft(metadataDraftFromRecord(json.mediaFile))
      setRefreshError('')
      dataProvider.clearCache?.()
      refresh()
    } catch (error) {
      setRefreshError(error.message || 'The library refresh did not complete.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleArtworkSelection = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setArtworkFile(file)
    setArtworkPreview(URL.createObjectURL(file))
    setRefreshError('')
  }

  const handleArtworkCancel = () => {
    setArtworkFile(null)
    setArtworkPreview('')
  }

  const handleArtworkSave = async () => {
    if (!displayRecord || !artworkFile || artworkSaving) return
    setArtworkSaving(true)
    setRefreshError('')
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const formData = new FormData()
      formData.append('image', artworkFile)
      const { json } = await httpClient(`${REST_URL}/song/${id}/artwork`, {
        method: 'PUT',
        headers: new Headers({}),
        body: formData,
      })
      if (json.mediaFile) {
        setLocalRecord(json.mediaFile)
        dispatch(updateTrackMetadata(json.mediaFile))
      }
      setArtworkFile(null)
      setArtworkPreview('')
      dataProvider.clearCache?.()
      if (json.refreshRequired) {
        setRefreshError(json.refreshError || 'Artwork was saved, but the library index has not refreshed yet.')
      } else {
        refresh()
      }
    } catch (error) {
      notify(error.message || 'Could not save song artwork.', {
        type: 'warning',
        multiLine: true,
      })
    } finally {
      setArtworkSaving(false)
    }
  }

  const handleLyricsImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.lrc') && !fileName.endsWith('.txt')) {
      setLyricsError('Choose a .txt or .lrc lyrics file.')
      event.target.value = ''
      return
    }
    const extension = fileName.endsWith('.lrc') ? '.lrc' : '.txt'
    try {
      const content = await file.text()
      setLyricsExtension(extension)
      setLyricsDraft(content)
      setLyricsOffsetMs(0)
      setLyricsError('')
    } catch (error) {
      setLyricsError(error.message || 'Could not read the selected lyrics file.')
    } finally {
      event.target.value = ''
    }
  }

  const executeLyricsSearch = async (query) => {
    if (!displayRecord || lyricsSearching || lyricsSaving || lyricsDeleting || lyricsLoading) return
    const searchTerm = query.trim()
    if (!searchTerm) {
      setLyricsSearchResults([])
      setLyricsSearchError('')
      return
    }
    setLyricsSearching(true)
    setLyricsSearchResults(null)
    setLyricsSearchError('')
    setLyricsSearchOpen(true)
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const { json } = await httpClient(`${REST_URL}/song/${id}/lyrics/search?q=${encodeURIComponent(searchTerm)}`)
      setLyricsSearchResults(Array.isArray(json) ? json : [])
    } catch (error) {
      setLyricsSearchResults(null)
      setLyricsSearchError(error.message || 'Could not search for lyrics.')
    } finally {
      setLyricsSearching(false)
    }
  }

  const handleSearchLyrics = () => {
    if (!displayRecord || lyricsSearching || lyricsSaving || lyricsDeleting || lyricsLoading) return
    const query = [displayRecord.title, displayRecord.artist]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean)
      .join(' ')
    setLyricsSearchQuery(query)
    setLyricsSearchOpen(true)
    void executeLyricsSearch(query)
  }

  const handleSubmitLyricsSearch = (event) => {
    event.preventDefault()
    void executeLyricsSearch(lyricsSearchQuery)
  }

  const handleUseLyricsSearchResult = (result) => {
    const content = result.syncedLyrics || result.plainLyrics || ''
    setLyricsDraft(content)
    setLyricsOffsetMs(0)
    setLyricsDestination('embedded')
    setLyricsExtension(result.syncedLyrics ? '.lrc' : '.txt')
    setLyricsSearchOpen(false)
    setLyricsSearchResults(null)
    setLyricsSearchError('')
  }

  const handleSaveLyrics = async () => {
    if (!displayRecord || !lyricsChanged || lyricsSaving) return
    setLyricsSaving(true)
    setLyricsError('')
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const lyricsToSave = lyricsTimingChanged
        ? shiftLyricsTimestamps(lyricsDraft, lyricsOffsetMs)
        : lyricsDraft
      const endpoint = lyricsDestination === 'embedded'
        ? `${REST_URL}/song/${id}/lyrics/embedded`
        : `${REST_URL}/song/${id}/lyrics`
      const body = lyricsDestination === 'embedded'
        ? { content: lyricsToSave, expectedVersion: lyricsFiles.embedded?.version || '' }
        : {
            extension: lyricsExtension,
            content: lyricsToSave,
            expectedVersion: lyricsFiles[lyricsKey]?.version || '',
          }
      const { json } = await httpClient(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      const files = { txt: json?.txt || {}, lrc: json?.lrc || {}, embedded: json?.embedded || {} }
      setLyricsFiles(files)
      setLyricsDraft(lyricsDestination === 'embedded'
        ? files.embedded.content || lyricsToSave
        : files[lyricsKey].content || lyricsToSave)
      setLyricsOffsetMs(0)
      setLyricsRefreshRequired(Boolean(json?.refreshRequired))
      setLyricsRefreshError(json?.refreshError || '')
      setLyricsError('')
      if (json?.mediaFile) {
        setLocalRecord(json.mediaFile)
        dispatch(updateTrackMetadata(json.mediaFile))
      }
      dataProvider.clearCache?.()
      if (lyricsDestination !== 'embedded' || !json?.refreshRequired) {
        window.dispatchEvent(
          new CustomEvent('bragi:refresh-song-lyrics', { detail: { songId: id } }),
        )
      }
    } catch (error) {
      setLyricsError(error.message || 'Could not save lyrics.')
    } finally {
      setLyricsSaving(false)
    }
  }

  const handleCancelLyrics = () => {
    setLyricsDraft(lyricsBaseline)
    setLyricsOffsetMs(0)
    setLyricsError('')
  }

  const shiftLyricsByOneSecond = (offset) => {
    setLyricsOffsetMs((currentOffset) => currentOffset + offset)
    setLyricsError('')
  }

  const handleLyricsDestinationChange = (destination) => {
    if (!lyricsChanged) {
      setLyricsDraft(destination === 'embedded'
        ? lyricsFiles.embedded?.content || ''
        : lyricsFiles[lyricsKey]?.content || '')
      setLyricsOffsetMs(0)
    }
    setLyricsDestination(destination)
    setLyricsDestinationMenuAnchor(null)
    setLyricsError('')
  }

  const handleRetryLyricsRefresh = async () => {
    if (!displayRecord || lyricsRefreshing) return
    setLyricsRefreshing(true)
    setLyricsRefreshError('')
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const { json } = await httpClient(`${REST_URL}/song/${id}/metadata/refresh`, { method: 'POST' })
      setLocalRecord(json.mediaFile)
      dispatch(updateTrackMetadata(json.mediaFile))
      const { json: refreshedLyrics } = await httpClient(`${REST_URL}/song/${id}/lyrics`)
      const files = {
        txt: refreshedLyrics?.txt || {},
        lrc: refreshedLyrics?.lrc || {},
        embedded: refreshedLyrics?.embedded || {},
      }
      setLyricsFiles(files)
      setLyricsDraft(lyricsDestination === 'embedded'
        ? files.embedded.content || ''
        : files[lyricsKey]?.content || '')
      setLyricsOffsetMs(0)
      setLyricsRefreshRequired(false)
      dataProvider.clearCache?.()
      window.dispatchEvent(
        new CustomEvent('bragi:refresh-song-lyrics', { detail: { songId: id } }),
      )
    } catch (error) {
      setLyricsRefreshError(error.message || 'The library refresh did not complete.')
    } finally {
      setLyricsRefreshing(false)
    }
  }

  const handleDeleteLyrics = async () => {
    if (!displayRecord || lyricsDeleting || lyricsSaving) return
    const confirmed = window.confirm(
      'Delete the separate TXT and LRC lyrics files for this song? This discards unsaved lyrics edits; embedded lyrics, if available, can then show in the player.',
    )
    if (!confirmed) return
    setLyricsDeleting(true)
    setLyricsError('')
    try {
      const id = encodeURIComponent(displayRecord.mediaFileId || displayRecord.id)
      const { json } = await httpClient(`${REST_URL}/song/${id}/lyrics`, {
        method: 'DELETE',
        body: JSON.stringify({
          txtVersion: lyricsFiles.txt?.version || '',
          lrcVersion: lyricsFiles.lrc?.version || '',
        }),
      })
      const files = { txt: json?.txt || {}, lrc: json?.lrc || {}, embedded: json?.embedded || {} }
      setLyricsFiles(files)
      setLyricsExtension('.txt')
      setLyricsDraft('')
      setLyricsOffsetMs(0)
      setLyricsError('')
      dataProvider.clearCache?.()
      window.dispatchEvent(
        new CustomEvent('bragi:refresh-song-lyrics', { detail: { songId: id } }),
      )
    } catch (error) {
      setLyricsError(error.message || 'Could not delete separate lyrics.')
    } finally {
      setLyricsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className={classes.root}>
        <CircularProgress size={24} aria-label="Loading song" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className={classes.root}>
        <Button
          className={classes.backButton}
          onClick={handleBack}
          startIcon={<ArrowBackIcon />}
        >
          Back to songs
        </Button>
        <Paper className={classes.unavailable}>
          <Typography role="status" variant="body1">
            This song is unavailable or could not be loaded.
          </Typography>
        </Paper>
      </div>
    )
  }

  const moods = displayRecord.tags?.mood || []
  const genres = genreValuesFromRecord(displayRecord)

  return (
    <div className={classes.root}>
      <Prompt
        when={hasAnyUnsavedChanges}
        message="You have unsaved changes. Leave this page?"
      />
      <RaTitle title={<Title subTitle={displayRecord.title} />} />
      <Button
        className={classes.backButton}
        onClick={handleBack}
        startIcon={<ArrowBackIcon />}
      >
        Back
      </Button>
      <div className={classes.content}>
        <div className={classes.coverFrame} data-testid="cover-frame">
          <Artwork
            record={displayRecord}
            size={560}
            square
            className={classes.artwork}
            title={displayRecord.title}
          />
          {artworkPreview && (
            <img className={classes.artworkPreview} src={artworkPreview} alt="Artwork preview" />
          )}
          {canEdit && (
            <div className={classes.artworkActions} role="group" aria-label="Song artwork">
              <Tooltip title={artworkFile ? 'Choose another image' : 'Change song artwork'}>
                <span>
                  <IconButton
                    aria-label={artworkFile ? 'Choose another image' : 'Change song artwork'}
                    disabled={artworkSaving}
                    onClick={() => artworkInputRef.current?.click()}
                    size="small"
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                </span>
              </Tooltip>
              {artworkFile && (
                <>
                  <Tooltip title="Save artwork">
                    <span>
                      <IconButton
                        aria-label={artworkSaving ? 'Saving artwork' : 'Save artwork'}
                        color="primary"
                        disabled={artworkSaving}
                        onClick={handleArtworkSave}
                        size="small"
                      >
                        {artworkSaving ? <CircularProgress size={18} /> : <SaveIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancel artwork change">
                    <IconButton
                      aria-label="Cancel artwork change"
                      disabled={artworkSaving}
                      onClick={handleArtworkCancel}
                      size="small"
                    >
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </div>
          )}
          <input
            ref={artworkInputRef}
            className={classes.artworkFileInput}
            type="file"
            accept="image/*"
            aria-label="Choose song artwork"
            onChange={handleArtworkSelection}
          />
          <div className={classes.playOverlay} role="group" aria-label="Song playback">
            <Button
              className={classes.playButton}
              color="primary"
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={displayRecord.missing}
              onClick={() =>
                dispatch(playTracks({ [displayRecord.id]: displayRecord }, [displayRecord.id]))
              }
            >
              Play <span className={classes.playDuration}>
                (<DurationField record={displayRecord} source="duration" />)
              </span>
            </Button>
          </div>
        </div>
        <div className={classes.details} role="group" aria-label="Song metadata">
          {canEdit && !displayRecord.hasCoverArt && (
            <Typography color="textSecondary" component="p" variant="caption">
              No embedded cover is stored in this song. The displayed cover comes from shared disc, album, or folder artwork when available.
            </Typography>
          )}
          <div className={classes.titleRow}>
            <Typography className={classes.title} variant="h6" component="h1">
              {editing ? (
                <input
                  aria-label="Song title"
                  className={`${classes.inlineInput} ${classes.titleInput}`}
                  maxLength={4096}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                />
              ) : (
                displayRecord.title
              )}
            </Typography>
            <div className={classes.titleActions} role="group" aria-label="Song actions">
              <LoveButton
                resource="song"
                record={displayRecord}
                aria-label="Toggle favorite"
              />
              {editing ? (
                <div className={classes.editActions}>
                  <Tooltip title={saving ? 'Saving changes' : 'Save changes'}>
                    <span>
                      <IconButton
                        aria-label={saving ? 'Saving changes' : 'Save changes'}
                        color="primary"
                        disabled={saving || Object.keys(changedFields).length === 0}
                        onClick={handleSave}
                      >
                        <SaveIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <IconButton
                      aria-label="Cancel"
                      disabled={saving}
                      onClick={() => {
                        setDraft(metadataDraftFromRecord(displayRecord))
                        setEditing(false)
                      }}
                      size="small"
                    >
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                </div>
              ) : (
                canEdit && (
                  <Tooltip title="Edit metadata">
                    <IconButton aria-label="Edit metadata" onClick={startEditing}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )
              )}
            </div>
          </div>
          {editing && (
            <>
              <datalist id="artist-suggestions">
                {metadataSuggestions.artists.map((name) => <option key={name} value={name} />)}
              </datalist>
              <datalist id="genre-suggestions">
                {metadataSuggestions.genres.map((name) => <option key={name} value={name} />)}
              </datalist>
              <datalist id="mood-suggestions">
                {metadataSuggestions.moods.map((name) => <option key={name} value={name} />)}
              </datalist>
            </>
          )}
          <Typography className={classes.artist} color="textSecondary" component="div">
            {editing ? (
              <input
                aria-label="Artist"
                className={`${classes.inlineInput} ${classes.artistInput}`}
                list="artist-suggestions"
                maxLength={4096}
                placeholder="Unknown artist"
                value={draft.artist}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, artist: event.target.value }))
                }
              />
            ) : displayRecord.artist ? (
              <ArtistLinkField source="artist" record={displayRecord} limit={Infinity} />
            ) : (
              'Unknown artist'
            )}
          </Typography>
          <div className={classes.section}>
            <Typography component="div">
              <span className={classes.label}>Album artist</span>
              {editing ? (
                <input
                  aria-label="Album artist"
                  className={classes.inlineInput}
                  list="artist-suggestions"
                  maxLength={4096}
                  placeholder="Not set"
                  style={{ width: `${Math.max(7, (draft.albumArtist || '').length + 1)}ch` }}
                  value={draft.albumArtist}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, albumArtist: event.target.value }))
                  }
                />
              ) : (
                displayRecord.albumArtist || 'Not set'
              )}
            </Typography>
          </div>
          {refreshError && (
            <Typography className={classes.refreshNotice} role="status" color="textSecondary">
              The file was saved, but the library index still needs updating. {refreshError}{' '}
              <Button size="small" disabled={refreshing} onClick={handleRefresh}>
                {refreshing ? 'Refreshing…' : 'Retry library refresh'}
              </Button>
            </Typography>
          )}
          {!editing && genres.length > 0 && (
            <div className={classes.section}>
              <Typography variant="subtitle2">Genres</Typography>
              <div className={classes.chipList}>
                {genres.map((genre) => (
                  <Typography className={classes.chip} key={genre}>
                    {genre}
                  </Typography>
                ))}
              </div>
            </div>
          )}
          {editing && (
            <div className={classes.section}>
              <Typography variant="subtitle2">Genres</Typography>
              <EditableTagList
                kind="Genre"
                values={draft.genres}
                classes={classes}
                onChange={(index, value) => updateTagDraft('genres', index, value)}
                onAdd={() => addTagDraft('genres')}
                onRemove={(index) => removeTagDraft('genres', index)}
                suggestionsId="genre-suggestions"
              />
            </div>
          )}
          {!editing && moods.length > 0 && (
            <div className={classes.section}>
              <Typography variant="subtitle2">Moods</Typography>
              <div className={classes.chipList}>
                {moods.map((mood) => (
                  <Typography className={classes.chip} key={mood}>
                    {mood}
                  </Typography>
                ))}
              </div>
            </div>
          )}
          {editing && (
            <div className={classes.section}>
              <Typography variant="subtitle2">Moods</Typography>
              <EditableTagList
                kind="Mood"
                values={draft.moods}
                classes={classes}
                onChange={(index, value) => updateTagDraft('moods', index, value)}
                onAdd={() => addTagDraft('moods')}
                onRemove={(index) => removeTagDraft('moods', index)}
                suggestionsId="mood-suggestions"
              />
            </div>
          )}
          {canEdit && (
            <section className={classes.section} aria-labelledby="song-lyrics-heading">
              <div className={classes.lyricsHeader}>
                <div className={classes.lyricsHeaderTitle}>
                  <Typography id="song-lyrics-heading" variant="subtitle1">Lyrics</Typography>
                  {lyricsHasTimestamps && (
                    <div className={classes.lyricsTimingControls}>
                      <Tooltip title="Move lyrics earlier by 1 second">
                        <span>
                          <Button
                            aria-label="Shift lyrics earlier by 1 second"
                            className={classes.lyricsTimingButton}
                            disabled={lyricsSaving || lyricsDeleting || lyricsLoading}
                            onClick={() => shiftLyricsByOneSecond(-1000)}
                            size="small"
                          >
                            −1s
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move lyrics later by 1 second">
                        <span>
                          <Button
                            aria-label="Shift lyrics later by 1 second"
                            className={classes.lyricsTimingButton}
                            disabled={lyricsSaving || lyricsDeleting || lyricsLoading}
                            onClick={() => shiftLyricsByOneSecond(1000)}
                            size="small"
                          >
                            +1s
                          </Button>
                        </span>
                      </Tooltip>
                      {lyricsOffsetMs !== 0 && (
                        <Typography
                          aria-label={`Pending lyrics shift ${lyricsOffsetMs > 0 ? '+' : ''}${lyricsOffsetMs / 1000} seconds`}
                          component="span"
                          variant="caption"
                        >
                          {lyricsOffsetMs > 0 ? '+' : ''}{lyricsOffsetMs / 1000}s
                        </Typography>
                      )}
                    </div>
                  )}
                </div>
                <div className={classes.lyricsActions}>
                  <Tooltip title={`Lyrics storage: ${lyricsDestination === 'embedded' ? 'Inside music file' : 'Separate file'}`}>
                    <IconButton
                      aria-label={`Lyrics storage: ${lyricsDestination === 'embedded' ? 'Inside music file' : 'Separate file'}`}
                      aria-controls={lyricsDestinationMenuAnchor ? 'lyrics-storage-menu' : undefined}
                      aria-expanded={Boolean(lyricsDestinationMenuAnchor)}
                      aria-haspopup="menu"
                      onClick={(event) => setLyricsDestinationMenuAnchor(event.currentTarget)}
                      size="small"
                    >
                      <StorageIcon />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={lyricsDestinationMenuAnchor}
                    id="lyrics-storage-menu"
                    onClose={() => setLyricsDestinationMenuAnchor(null)}
                    open={Boolean(lyricsDestinationMenuAnchor)}
                  >
                    <MenuItem
                      onClick={() => handleLyricsDestinationChange('embedded')}
                      selected={lyricsDestination === 'embedded'}
                    >
                      Inside music file
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleLyricsDestinationChange('separate')}
                      selected={lyricsDestination === 'separate'}
                    >
                      Separate file
                    </MenuItem>
                  </Menu>
                  <Tooltip title="Choose a TXT or LRC lyrics file">
                    <IconButton aria-label="Choose lyrics file" component="label" size="small">
                      <CloudUploadIcon />
                      <input
                        className={classes.lyricsFileInput}
                        type="file"
                        accept=".txt,.lrc"
                        onChange={handleLyricsImport}
                      />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Search online lyrics">
                    <span>
                      <IconButton
                        aria-label="Search lyrics"
                        disabled={lyricsSearching || lyricsSaving || lyricsDeleting || lyricsLoading}
                        onClick={handleSearchLyrics}
                        size="small"
                      >
                        {lyricsSearching ? <CircularProgress size={18} /> : <SearchIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Save lyrics">
                    <span>
                      <IconButton
                        aria-label="Save lyrics"
                        color="primary"
                        disabled={!lyricsChanged || lyricsSaving || lyricsDeleting || lyricsLoading}
                        onClick={handleSaveLyrics}
                        size="small"
                      >
                        {lyricsSaving ? <CircularProgress size={18} /> : <SaveIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancel lyrics">
                    <span>
                      <IconButton
                        aria-label="Cancel lyrics"
                        disabled={!lyricsChanged || lyricsSaving || lyricsDeleting}
                        onClick={handleCancelLyrics}
                        size="small"
                      >
                        <CloseIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {lyricsDestination === 'separate' && (lyricsFiles.txt.exists || lyricsFiles.lrc.exists) && (
                    <Tooltip title="Delete separate lyrics">
                      <span>
                        <IconButton
                          aria-label="Delete lyrics"
                          color="secondary"
                          disabled={lyricsSaving || lyricsDeleting || lyricsLoading}
                          onClick={handleDeleteLyrics}
                          size="small"
                        >
                          {lyricsDeleting ? <CircularProgress size={18} /> : <DeleteOutlineIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>
              {lyricsLoading ? (
                <CircularProgress size={20} aria-label="Loading lyrics" />
              ) : (
                <>
                  {lyricsDestination === 'embedded' && (lyricsFiles.txt.exists || lyricsFiles.lrc.exists) && (
                    <Typography className={classes.lyricsNotice} color="textSecondary" role="status">
                      Separate TXT/LRC files take priority in the player. They will not be removed when saving embedded lyrics.
                    </Typography>
                  )}
                  <textarea
                    aria-label="Lyrics text"
                    className={classes.lyricsInput}
                    rows={8}
                    maxLength={1 << 20}
                    value={lyricsDraft}
                    onChange={(event) => {
                      const content = event.target.value
                      setLyricsDraft(content)
                      if (!hasTimestampedLyrics(content)) setLyricsOffsetMs(0)
                    }}
                  />
                  {lyricsError && <Typography role="alert" color="error">{lyricsError}</Typography>}
                  {lyricsRefreshRequired && (
                    <Typography className={classes.lyricsNotice} color="textSecondary" role="status">
                      Lyrics were saved in the music file, but the library refresh did not finish. {lyricsRefreshError}{' '}
                      <Button size="small" disabled={lyricsRefreshing} onClick={handleRetryLyricsRefresh}>
                        {lyricsRefreshing ? 'Refreshing…' : 'Retry library refresh'}
                      </Button>
                    </Typography>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>
      <Dialog
        aria-labelledby="song-lyrics-search-title"
        fullWidth
        maxWidth="sm"
        onClose={() => setLyricsSearchOpen(false)}
        open={lyricsSearchOpen}
        scroll="paper"
      >
        <DialogTitle id="song-lyrics-search-title" disableTypography className={classes.lyricsSearchTitle}>
          <Typography variant="h6">Search lyrics</Typography>
          <IconButton aria-label="Close lyrics search" onClick={() => setLyricsSearchOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            label="Song title"
            inputProps={{ 'aria-label': 'Song title' }}
            value={lyricsSearchQuery}
            onChange={(event) => setLyricsSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSubmitLyricsSearch(event)
            }}
            autoFocus
          />
          {lyricsSearching ? (
            <CircularProgress size={20} aria-label="Searching lyrics" />
          ) : lyricsSearchError ? (
            <Typography role="alert" color="error">{lyricsSearchError}</Typography>
          ) : lyricsSearchResults?.length === 0 ? (
            <Typography color="textSecondary" role="status">No lyrics found.</Typography>
          ) : (
            <div className={classes.lyricsSearchResults} role="group" aria-label="Lyrics search results">
              {lyricsSearchResults?.map((result) => {
                const label = `${result.trackName || 'Unknown track'} by ${result.artistName || 'Unknown artist'}`
                const detail = [result.albumName, Number.isFinite(result.duration) && result.duration > 0
                  ? `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}`
                  : '', result.syncedLyrics ? 'Synced' : 'Plain'].filter(Boolean).join(' · ')
                return (
                  <Button
                    key={result.id}
                    className={classes.lyricsSearchResult}
                    disabled={lyricsSaving || lyricsDeleting}
                    onClick={() => handleUseLyricsSearchResult(result)}
                    aria-label={`Use lyrics: ${label}`}
                  >
                    <span>
                      <strong>{label}</strong>
                      {detail && <><br /><Typography component="span" variant="caption" color="textSecondary">{detail}</Typography></>}
                    </span>
                  </Button>
                )
              })}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmitLyricsSearch} disabled={lyricsSearching || !lyricsSearchQuery.trim()}>Search</Button>
          <Button onClick={() => setLyricsSearchOpen(false)} disabled={lyricsSearching}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

const SongShow = (props) => {
  const controllerProps = useShowController(props)
  return (
    <ShowContextProvider value={controllerProps}>
      <SongShowLayout {...props} {...controllerProps} />
    </ShowContextProvider>
  )
}

export default SongShow
