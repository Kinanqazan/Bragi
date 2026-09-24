import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  makeStyles,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  Switch,
  TextField,
  IconButton,
} from '@material-ui/core'
import { alpha } from '@material-ui/core/styles'
import Autocomplete from '@material-ui/lab/Autocomplete'
import FilterListIcon from '@material-ui/icons/FilterList'
import CloseIcon from '@material-ui/icons/Close'
import LibraryAddOutlinedIcon from '@material-ui/icons/LibraryAddOutlined'
import LibraryAddIcon from '@material-ui/icons/LibraryAdd'
import {
  MdTrendingUp,
  MdShuffle,
  MdFavorite,
  MdFavoriteBorder,
} from 'react-icons/md'
import { useHistory, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  useListContext,
  useTranslate,
  useDataProvider,
  useNotify,
  useGetList,
  changeListParams,
} from 'react-admin'
import clsx from 'clsx'
import { playTracks } from '../actions'
import config from '../config'
import songLists from '../song/songLists'
import { createSongListResetAction } from '../song/songListNavigation'

const EMPTY_FILTERS = {}

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === 'dark'
  const primaryColor = theme.palette.primary?.main || '#2196f3'
  const primaryContrast = theme.palette.primary?.contrastText || '#ffffff'
  const shadowColor = theme.palette.common?.black || '#000000'

  return {
    container: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    },
    // Tags and Genres Carousel Row
    tagsRow: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': {
        display: 'none !important',
      },
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
      padding: '4px 0 8px 0',
      gap: 8,
      userSelect: 'none',
      position: 'relative',
    },
    // The Quick Actions Row: Fixed 4 icon buttons with generous spacing
    quickActionsRow: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      margin: '14px 0 24px 0',
      padding: 0,
      boxSizing: 'border-box',
    },
    actionBtn: {
      flex: '0 1 22%',
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      cursor: 'pointer',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
      color: theme.palette.text.primary,
      border: isDark
        ? '1px solid rgba(255, 255, 255, 0.08)'
        : '1px solid rgba(0, 0, 0, 0.06)',
      position: 'relative',
      '&:active': {
        transform: 'scale(0.93)',
      },
      '& svg': {
        fontSize: 22,
        flexShrink: 0,
      },
    },
    actionBtnActive: {
      backgroundColor: isDark
        ? '#ffffff !important'
        : `${primaryColor} !important`,
      color: isDark ? '#0f0f14 !important' : `${primaryContrast} !important`,
      borderColor: isDark ? '#ffffff !important' : `${primaryColor} !important`,
      boxShadow: isDark
        ? '0 3px 12px rgba(0, 0, 0, 0.35)'
        : '0 3px 10px rgba(0, 0, 0, 0.15)',
    },
    shuffleActionBtn: {
      backgroundColor: isDark
        ? alpha(primaryColor, 0.16)
        : alpha(primaryColor, 0.08),
      color: primaryColor,
      borderColor: alpha(primaryColor, isDark ? 0.28 : 0.2),
      '&:hover': {
        backgroundColor: isDark
          ? alpha(primaryColor, 0.24)
          : alpha(primaryColor, 0.14),
        borderColor: alpha(primaryColor, isDark ? 0.42 : 0.32),
      },
    },
    tagChip: {
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      padding: '0 16px',
      borderRadius: 18,
      fontSize: '0.88rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.06)',
      color: isDark ? '#f2f2f2' : '#222222',
      border: isDark
        ? '1px solid rgba(255, 255, 255, 0.08)'
        : '1px solid rgba(0, 0, 0, 0.06)',
      position: 'relative',
      '&:active': {
        transform: 'scale(0.94)',
      },
    },
    tagChipActive: {
      backgroundColor: isDark
        ? '#ffffff !important'
        : `${primaryColor} !important`,
      color: isDark ? '#0f0f14 !important' : `${primaryContrast} !important`,
      fontWeight: '600 !important',
      border: 'none !important',
      boxShadow: isDark
        ? '0 2px 10px rgba(0, 0, 0, 0.35)'
        : '0 2px 8px rgba(0, 0, 0, 0.15)',
    },
    filterIconChip: {
      padding: '0 10px',
      gap: 4,
    },
    filterBadge: {
      backgroundColor: theme.palette.error?.main || '#f44336',
      color: '#ffffff',
      fontSize: '0.68rem',
      fontWeight: 700,
      width: 16,
      height: 16,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    // Filter Dialog Styles
    dialogPaper: {
      backgroundColor: isDark ? '#1a1a24' : '#ffffff',
      backgroundImage: 'none',
      borderRadius: 16,
      margin: 16,
      maxHeight: 'calc(100% - 32px)',
    },
    dialogTitle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px 8px',
      '& h2': {
        fontSize: '1.15rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      },
    },
    dialogContent: {
      padding: '8px 20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    dialogItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    itemLabel: {
      fontSize: '0.82rem',
      fontWeight: 600,
      color: theme.palette.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    fieldInput: {
      width: '100%',
    },
  }
})

export const MobileQuickActions = ({ resource = 'song' }) => {
  const classes = useStyles()
  const history = useHistory()
  const location = useLocation()
  const dispatch = useDispatch()
  const translate = useTranslate()
  const dataProvider = useDataProvider()
  const notify = useNotify()

  const listContext = useListContext()
  const contextFilterValues = listContext?.filterValues
  const displayedFilters = listContext?.displayedFilters
  const setFilters = listContext?.setFilters

  const isRecentlyAdded = location.pathname.includes('/song/recentlyAdded')
  const isMostPlayed = location.pathname.includes('/song/mostPlayed')

  const reduxFilters = useSelector(
    (state) =>
      state.admin?.resources?.song?.list?.params?.filter || EMPTY_FILTERS,
  )

  const urlFilters = useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    const filterParam = searchParams.get('filter')
    if (filterParam) {
      try {
        return JSON.parse(filterParam)
      } catch {
        return {}
      }
    }
    return {}
  }, [location.search])

  const filterValues = useMemo(
    () => contextFilterValues || urlFilters || reduxFilters || EMPTY_FILTERS,
    [contextFilterValues, urlFilters, reduxFilters],
  )

  const isFilterStarred = Boolean(filterValues?.starred)
  const [optimisticStarred, setOptimisticStarred] = useState(null)
  const isStarred =
    optimisticStarred !== null ? optimisticStarred : isFilterStarred

  useEffect(() => {
    setOptimisticStarred(null)
  }, [filterValues?.starred])

  const [dialogOpen, setDialogOpen] = useState(false)

  // Fetch Genres
  const { data: genresData } = useGetList(
    'genre',
    { page: 1, perPage: 100 },
    { field: 'name', order: 'ASC' },
    {},
    { enabled: true },
  )
  const genreList = useMemo(
    () => (genresData ? Object.values(genresData) : []),
    [genresData],
  )

  // Fetch Moods
  const { data: moodsData } = useGetList(
    'tag',
    { page: 1, perPage: 100 },
    { field: 'tagValue', order: 'ASC' },
    { tag_name: 'mood' },
    { enabled: true },
  )
  const moodList = useMemo(
    () => (moodsData ? Object.values(moodsData) : []),
    [moodsData],
  )

  // Update active filters in Redux, URL, and ListContext
  const handleFilterChange = useCallback(
    (field, value) => {
      const newFilters = { ...filterValues }
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete newFilters[field]
      } else {
        newFilters[field] = value
      }

      if (field === 'starred') {
        setOptimisticStarred(Boolean(value))
      }

      if (setFilters) {
        setFilters(newFilters, displayedFilters, false)
      }

      dispatch(
        changeListParams('song', {
          filter: newFilters,
        }),
      )

      const targetPath = location.pathname.startsWith('/song')
        ? location.pathname
        : '/song'
      const searchParams = new URLSearchParams(location.search)
      if (Object.keys(newFilters).length > 0) {
        searchParams.set('filter', JSON.stringify(newFilters))
      } else {
        searchParams.delete('filter')
      }
      const serializedSearch = searchParams.toString()
      const newQueryString = serializedSearch ? `?${serializedSearch}` : ''

      history.replace(`${targetPath}${newQueryString}`)
    },
    [
      filterValues,
      setFilters,
      displayedFilters,
      dispatch,
      history,
      location.pathname,
      location.search,
    ],
  )

  // Toggle Recently Added songs list
  const handleToggleRecentlyAdded = useCallback(() => {
    if (isRecentlyAdded) {
      dispatch(createSongListResetAction())
      history.push('/song')
    } else {
      const params = songLists?.recentlyAdded?.params
        ? `?${songLists.recentlyAdded.params}`
        : ''
      history.push(`/song/recentlyAdded${params}`)
    }
  }, [isRecentlyAdded, dispatch, history])

  // Toggle Most Played songs list
  const handleToggleMostPlayed = useCallback(() => {
    if (isMostPlayed) {
      dispatch(createSongListResetAction())
      history.push('/song')
    } else {
      const params = songLists?.mostPlayed?.params
        ? `?${songLists.mostPlayed.params}`
        : ''
      history.push(`/song/mostPlayed${params}`)
    }
  }, [isMostPlayed, dispatch, history])

  // Shuffle All songs
  const handleShuffleAll = useCallback(() => {
    dataProvider
      .getList('song', {
        pagination: { page: 1, perPage: 500 },
        sort: { field: 'random', order: 'ASC' },
        filter: { ...filterValues, missing: false },
      })
      .then((res) => {
        const data = {}
        res.data.forEach((song) => {
          data[song.id] = song
        })
        dispatch(playTracks(data))
      })
      .catch(() => {
        notify('ra.page.error', 'warning')
      })
  }, [dataProvider, filterValues, dispatch, notify])

  const handleClearAll = useCallback(() => {
    const userFacetKeys = [
      'starred',
      'genre_id',
      'mood',
      'releasetype',
      'role',
      'year',
    ]
    const newFilters = { ...filterValues }
    userFacetKeys.forEach((key) => {
      delete newFilters[key]
    })
    setOptimisticStarred(false)
    if (setFilters) {
      setFilters(newFilters, displayedFilters, false)
    }
    dispatch(changeListParams('song', { filter: newFilters }))
    const targetPath = location.pathname.startsWith('/song')
      ? location.pathname
      : '/song'
    history.replace(targetPath)
  }, [
    filterValues,
    setFilters,
    displayedFilters,
    dispatch,
    history,
    location.pathname,
  ])

  // Count active dialog filters
  const activeCount = useMemo(() => {
    const userFacetKeys = ['genre_id', 'mood', 'releasetype', 'role', 'year']
    let count = 0
    userFacetKeys.forEach((key) => {
      const val = filterValues?.[key]
      if (val !== undefined && val !== '' && val !== null) {
        if (Array.isArray(val)) {
          if (val.length > 0) count += 1
        } else {
          count += 1
        }
      }
    })
    return count
  }, [filterValues])

  // Tags list: Automatically taken from existing moods and genres from songs in the app
  const tags = useMemo(() => {
    const list = []

    // 1. Existing moods from songs in the library
    moodList.forEach((m) => {
      const val = m.tagValue || m.name || m.id
      if (val) {
        list.push({
          id: `mood-${m.id || val}`,
          label: val,
          type: 'mood',
          value: val,
        })
      }
    })

    // 2. Existing genres from songs in the library
    genreList.forEach((genre) => {
      if (genre.name) {
        list.push({
          id: `genre-${genre.id}`,
          label: genre.name,
          type: 'genre',
          genreId: genre.id,
        })
      }
    })

    return list
  }, [moodList, genreList])

  const isTagActive = useCallback(
    (tag) => {
      if (tag.type === 'mood') {
        const currentMood = filterValues?.mood
        if (Array.isArray(currentMood)) {
          return currentMood.includes(tag.value)
        }
        return currentMood === tag.value
      }
      if (tag.type === 'genre') {
        const currentGenre = filterValues?.genre_id
        if (Array.isArray(currentGenre)) {
          return currentGenre.includes(tag.genreId)
        }
        return currentGenre === tag.genreId
      }
      return false
    },
    [filterValues],
  )

  const handleTagClick = useCallback(
    (tag) => {
      const active = isTagActive(tag)
      if (tag.type === 'mood') {
        handleFilterChange('mood', active ? undefined : tag.value)
      } else if (tag.type === 'genre') {
        handleFilterChange('genre_id', active ? undefined : [tag.genreId])
      }
    },
    [isTagActive, handleFilterChange],
  )

  return (
    <div className={classes.container}>
      {/* 1. Moods and Genres Tag Carousel (on top) */}
      {tags.length > 0 && (
        <div
          className={classes.tagsRow}
          role="region"
          aria-label="Moods and genres tags"
        >
          {tags.map((tag) => {
            const active = isTagActive(tag)
            return (
              <div
                key={tag.id}
                className={clsx(
                  classes.tagChip,
                  active && classes.tagChipActive,
                )}
                onClick={() => handleTagClick(tag)}
                role="button"
                tabIndex={0}
                aria-pressed={active}
              >
                <span>{tag.label}</span>
              </div>
            )
          })}

        </div>
      )}

      {/* 2. Fixed Quick Action Icon Buttons (Recently Added, Most Played, Favorites, Shuffle) */}
      <div
        className={classes.quickActionsRow}
        role="region"
        aria-label="Quick song actions"
      >
        {/* Button 1: Recently Added */}
        <div
          className={clsx(
            classes.actionBtn,
            isRecentlyAdded && classes.actionBtnActive,
          )}
          onClick={handleToggleRecentlyAdded}
          role="button"
          tabIndex={0}
          aria-pressed={isRecentlyAdded}
          aria-label={translate('resources.song.lists.recentlyAdded', {
            _: 'Recently Added',
          })}
          title={translate('resources.song.lists.recentlyAdded', {
            _: 'Recently Added',
          })}
        >
          {isRecentlyAdded ? (
            <LibraryAddIcon style={{ fontSize: 22 }} />
          ) : (
            <LibraryAddOutlinedIcon style={{ fontSize: 22 }} />
          )}
        </div>

        {/* Button 2: Most Played */}
        <div
          className={clsx(
            classes.actionBtn,
            isMostPlayed && classes.actionBtnActive,
          )}
          onClick={handleToggleMostPlayed}
          role="button"
          tabIndex={0}
          aria-pressed={isMostPlayed}
          aria-label={translate('resources.song.lists.mostPlayed', {
            _: 'Most Played',
          })}
          title={translate('resources.song.lists.mostPlayed', {
            _: 'Most Played',
          })}
        >
          <MdTrendingUp size={22} />
        </div>

        {/* Button 3: Favorites */}
        <div
          className={clsx(
            classes.actionBtn,
            isStarred && classes.actionBtnActive,
          )}
          onClick={() =>
            handleFilterChange('starred', isStarred ? undefined : true)
          }
          role="button"
          tabIndex={0}
          aria-pressed={isStarred}
          aria-label={
            isStarred
              ? translate('resources.song.actions.showAll', {
                  _: 'Show all',
                })
              : translate('resources.song.lists.starred', {
                  _: 'Favorites',
                })
          }
          title={
            isStarred
              ? translate('resources.song.actions.showAll', {
                  _: 'Show all',
                })
              : translate('resources.song.lists.starred', {
                  _: 'Favorites',
                })
          }
        >
          {isStarred ? (
            <MdFavorite size={22} />
          ) : (
            <MdFavoriteBorder size={22} />
          )}
        </div>

        {/* Button 4: Shuffle */}
        <div
          className={clsx(classes.actionBtn, classes.shuffleActionBtn)}
          onClick={handleShuffleAll}
          role="button"
          tabIndex={0}
          aria-label="Shuffle all"
          title="Shuffle"
        >
          <MdShuffle size={22} />
        </div>
      </div>

      {/* Advanced Filter Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: classes.dialogPaper }}
      >
        <DialogTitle className={classes.dialogTitle} disableTypography>
          <Typography variant="h6">Filters</Typography>
          <IconButton
            size="small"
            onClick={() => setDialogOpen(false)}
            aria-label="Close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          {config.enableFavourites && (
            <FormControl className={classes.dialogItem}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(filterValues?.starred)}
                    onChange={(e) =>
                      handleFilterChange(
                        'starred',
                        e.target.checked ? true : undefined,
                      )
                    }
                    color="primary"
                  />
                }
                label="Only Favorites (Starred)"
              />
            </FormControl>
          )}

          {genreList.length > 0 && (
            <div className={classes.dialogItem}>
              <Typography className={classes.itemLabel}>Genre</Typography>
              <Autocomplete
                multiple
                size="small"
                options={genreList}
                getOptionLabel={(option) => option.name || option.id || ''}
                value={
                  genreList.filter((g) =>
                    (filterValues?.genre_id || []).includes(g.id),
                  ) || []
                }
                onChange={(_, newValue) => {
                  const ids = newValue.map((v) => v.id)
                  handleFilterChange(
                    'genre_id',
                    ids.length > 0 ? ids : undefined,
                  )
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    placeholder={
                      (filterValues?.genre_id || []).length === 0
                        ? 'Select genres...'
                        : ''
                    }
                    className={classes.fieldInput}
                  />
                )}
              />
            </div>
          )}

          {moodList.length > 0 && (
            <div className={classes.dialogItem}>
              <Typography className={classes.itemLabel}>Mood</Typography>
              <Autocomplete
                multiple
                size="small"
                options={moodList}
                getOptionLabel={(option) =>
                  option.tagValue || option.name || option.id || ''
                }
                value={
                  moodList.filter((m) =>
                    (filterValues?.mood || []).includes(m.tagValue || m.id),
                  ) || []
                }
                onChange={(_, newValue) => {
                  const values = newValue.map((v) => v.tagValue || v.id)
                  handleFilterChange(
                    'mood',
                    values.length > 0 ? values : undefined,
                  )
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    placeholder={
                      (filterValues?.mood || []).length === 0
                        ? 'Select moods...'
                        : ''
                    }
                    className={classes.fieldInput}
                  />
                )}
              />
            </div>
          )}
        </DialogContent>
        <DialogActions style={{ padding: '12px 20px 16px' }}>
          {activeCount > 0 && (
            <Button onClick={handleClearAll} color="secondary">
              Clear All
            </Button>
          )}
          <Button
            onClick={() => setDialogOpen(false)}
            color="primary"
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default MobileQuickActions
