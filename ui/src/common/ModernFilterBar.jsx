import React, { useState, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useHistory } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import clsx from 'clsx'
import {
  Filter,
  SearchInput,
  useListContext,
  useTranslate,
  useGetList,
  useDataProvider,
  useNotify,
} from 'react-admin'
import {
  IconButton,
  Popover,
  Switch,
  TextField,
  MenuItem,
  FormControl,
  Select,
  Typography,
  Button,
  useMediaQuery,
} from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import { makeStyles } from '@material-ui/core/styles'
import { alpha } from '@material-ui/core/styles'
import FilterListIcon from '@material-ui/icons/FilterList'
import FavoriteIcon from '@material-ui/icons/Favorite'
import FavoriteBorderIcon from '@material-ui/icons/FavoriteBorder'
import CloseIcon from '@material-ui/icons/Close'
import { MdTrendingUp, MdShuffle, MdHistory } from 'react-icons/md'
import { playTracks } from '../actions'
import config from '../config'

// eslint-disable-next-line react-refresh/only-export-components
export const modernFilterStyles = (theme) => {
  const isDark = theme.palette.type === 'dark'
  const controlBackground = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.05)'
  const controlHoverBackground = isDark
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(0, 0, 0, 0.09)'
  const controlBorder = isDark
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(0, 0, 0, 0.16)'
  const controlHoverBorder = isDark
    ? 'rgba(255, 255, 255, 0.28)'
    : 'rgba(0, 0, 0, 0.28)'
  const subtleText = theme.palette.text.secondary || theme.palette.text.primary
  const primaryColor = theme.palette.primary?.main || '#2196f3'
  const primaryContrast = theme.palette.primary?.contrastText || '#ffffff'
  const shadowColor = theme.palette.common?.black || '#000000'

  return {
    toolbarRoot: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      marginBottom: theme.spacing(1.5),
      paddingTop: 0,
      paddingLeft: 0,
      paddingRight: 0,
      minHeight: 38,
      height: 38,
      gap: theme.spacing(1),
      boxSizing: 'border-box',
      [theme.breakpoints.down('sm')]: {
        display: 'none !important',
      },
    },
    // Mobile Quick Action Circle Buttons at the top of scrollable content
    mobileQuickActionsRow: {
      display: 'none',
      [theme.breakpoints.down('sm')]: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        margin: '8px 0 16px 0',
        padding: '6px 0 2px 0',
        boxSizing: 'border-box',
      },
    },
    quickActionItem: {
      flex: '1 1 0%',
      maxWidth: '25%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      transition: 'transform 0.15s ease',
      padding: '4px 0',
      overflow: 'visible',
      '&:active': {
        transform: 'scale(0.92)',
      },
    },
    quickActionCircle: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 2px 8px ${alpha(shadowColor, isDark ? 0.25 : 0.08)}`,
      transition: 'all 0.2s ease',
      border: `1px solid ${alpha(primaryColor, isDark ? 0.22 : 0.18)}`,
      backgroundColor: isDark
        ? alpha(primaryColor, 0.12)
        : alpha(primaryColor, 0.08),
      color: primaryColor,
      position: 'relative',
      '&:hover': {
        backgroundColor: isDark
          ? alpha(primaryColor, 0.2)
          : alpha(primaryColor, 0.15),
        borderColor: alpha(primaryColor, 0.4),
      },
    },
    filterCircle: {
      backgroundColor: isDark
        ? alpha(primaryColor, 0.12)
        : alpha(primaryColor, 0.08),
      color: primaryColor,
    },
    filterCircleActive: {
      backgroundColor: `${primaryColor} !important`,
      color: `${primaryContrast} !important`,
      boxShadow: `0 2px 10px ${alpha(primaryColor, 0.45)} !important`,
      borderColor: `${primaryColor} !important`,
    },
    mostPlayedCircle: {
      backgroundColor: isDark
        ? alpha(primaryColor, 0.12)
        : alpha(primaryColor, 0.08),
      color: primaryColor,
    },
    historyCircle: {
      backgroundColor: isDark
        ? alpha(primaryColor, 0.12)
        : alpha(primaryColor, 0.08),
      color: primaryColor,
    },
    shuffleCircle: {
      backgroundColor: isDark
        ? alpha(primaryColor, 0.12)
        : alpha(primaryColor, 0.08),
      color: primaryColor,
    },
    quickActionLabel: {
      fontSize: '0.72rem',
      fontWeight: 500,
      marginTop: 5,
      color: theme.palette.text.secondary,
      letterSpacing: '0.01em',
      textAlign: 'center',
    },
    leftGroup: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      flex: '0 0 auto',
      minWidth: 0,
      height: 36,
      minHeight: 36,
      maxHeight: 36,
      boxSizing: 'border-box',
      '& .RaFilter-root, & [class*="RaFilter-root"]': {
        margin: '0 !important',
        padding: '0 !important',
        display: 'inline-flex !important',
        alignItems: 'center !important',
        height: '36px !important',
        minHeight: '36px !important',
        maxHeight: '36px !important',
        boxSizing: 'border-box !important',
      },
      '& form': {
        display: 'inline-flex !important',
        flexDirection: 'row !important',
        alignItems: 'center !important',
        flexWrap: 'nowrap !important',
        margin: '0 !important',
        padding: '0 !important',
        minHeight: '36px !important',
        maxHeight: '36px !important',
        height: '36px !important',
        boxSizing: 'border-box !important',
      },
      '& .filter-field': {
        display: 'inline-flex !important',
        alignItems: 'center !important',
        margin: '0 !important',
        padding: '0 !important',
        height: '36px !important',
        minHeight: '36px !important',
        maxHeight: '36px !important',
        boxSizing: 'border-box !important',
      },
      '& .filter-field > div:last-child:not(:first-child)': {
        display: 'none !important',
      },
      '& form > div:last-child:not(.filter-field)': {
        display: 'none !important',
      },
      '& .RaFilterForm-clearfix, & [class*="clearfix"]': {
        display: 'none !important',
      },
    },
    searchInput: {
      width: '130px !important',
      maxWidth: '130px !important',
      minWidth: '100px !important',
      flex: '0 0 130px !important',
      margin: '0 !important',
      padding: '0 !important',
      height: '36px !important',
      minHeight: '36px !important',
      maxHeight: '36px !important',
      boxSizing: 'border-box !important',
      display: 'inline-flex !important',
      alignItems: 'center !important',
      verticalAlign: 'middle !important',
      '& .MuiFormControl-root': {
        margin: '0 !important',
        padding: '0 !important',
        width: '100% !important',
        height: '36px !important',
        minHeight: '36px !important',
        maxHeight: '36px !important',
        boxSizing: 'border-box !important',
        display: 'inline-flex !important',
        justifyContent: 'center !important',
        verticalAlign: 'middle !important',
      },
      '& .MuiInputBase-root, & .MuiOutlinedInput-root, & .MuiFilledInput-root':
        {
          height: '36px !important',
          minHeight: '36px !important',
          maxHeight: '36px !important',
          borderRadius: '18px !important',
          backgroundColor: `${controlBackground} !important`,
          border: `1px solid ${controlBorder} !important`,
          paddingLeft: '10px !important',
          paddingRight: '8px !important',
          boxSizing: 'border-box !important',
          display: 'inline-flex !important',
          alignItems: 'center !important',
          verticalAlign: 'middle !important',
          '& fieldset': {
            border: 'none !important',
            display: 'none !important',
          },
          '&.Mui-focused': {
            backgroundColor: `${controlHoverBackground} !important`,
            borderColor: `${controlHoverBorder} !important`,
            boxShadow: `0 0 0 2px ${controlBorder}`,
          },
        },
      '& .MuiInputBase-input': {
        fontSize: '0.85rem !important',
        padding: '0 4px !important',
        height: '100% !important',
        minHeight: 'auto !important',
        boxSizing: 'border-box !important',
        color: theme.palette.text.primary,
      },
      '& input': {
        fontSize: '0.85rem !important',
        padding: '0 4px !important',
        height: '100% !important',
        minHeight: 'auto !important',
        boxSizing: 'border-box !important',
        color: `${theme.palette.text.primary} !important`,
      },
      '& .MuiInputAdornment-root': {
        marginRight: '2px !important',
        marginLeft: '0 !important',
        height: 'auto !important',
        display: 'inline-flex !important',
        alignItems: 'center !important',
      },
      '& .MuiInputAdornment-root svg': {
        fontSize: '1.15rem !important',
        color: `${subtleText} !important`,
      },
    },
    filterButton: {
      width: '36px !important',
      height: '36px !important',
      minWidth: '36px !important',
      maxWidth: '36px !important',
      minHeight: '36px !important',
      maxHeight: '36px !important',
      borderRadius: '18px !important',
      backgroundColor: `${controlBackground} !important`,
      border: `1px solid ${controlBorder} !important`,
      color: `${theme.palette.text.primary} !important`,
      padding: '0 !important',
      margin: '0 !important',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
      display: 'inline-flex !important',
      alignItems: 'center !important',
      justifyContent: 'center !important',
      verticalAlign: 'middle !important',
      flexShrink: 0,
      boxSizing: 'border-box !important',
      boxShadow: 'none !important',
      position: 'relative',
      '&:hover': {
        backgroundColor: `${controlHoverBackground} !important`,
        borderColor: `${controlHoverBorder} !important`,
        transform: 'translateY(-1px)',
      },
      '& svg': {
        fontSize: '1.2rem !important',
        color: `${theme.palette.text.primary} !important`,
      },
    },
    filterButtonActive: {
      backgroundColor: `${isDark ? 'rgba(79, 140, 255, 0.2)' : 'rgba(25, 118, 210, 0.12)'} !important`,
      borderColor: `${theme.palette.primary?.main || '#2196f3'} !important`,
      color: `${theme.palette.primary?.main || '#2196f3'} !important`,
      '& svg': {
        color: `${theme.palette.primary?.main || '#2196f3'} !important`,
      },
    },
    favoriteToggleButton: {
      width: '36px !important',
      height: '36px !important',
      minWidth: '36px !important',
      maxWidth: '36px !important',
      minHeight: '36px !important',
      maxHeight: '36px !important',
      borderRadius: '18px !important',
      backgroundColor: `${controlBackground} !important`,
      border: `1px solid ${controlBorder} !important`,
      color: `${theme.palette.text.primary} !important`,
      padding: '0 !important',
      margin: '0 !important',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
      display: 'inline-flex !important',
      alignItems: 'center !important',
      justifyContent: 'center !important',
      verticalAlign: 'middle !important',
      flexShrink: 0,
      boxSizing: 'border-box !important',
      boxShadow: 'none !important',
      position: 'relative',
      '&:hover': {
        backgroundColor: `${controlHoverBackground} !important`,
        borderColor: `${controlHoverBorder} !important`,
        transform: 'translateY(-1px)',
        color: '#e91e63 !important',
        '& svg': {
          color: '#e91e63 !important',
        },
      },
      '& svg': {
        fontSize: '1.2rem !important',
        color: `${theme.palette.text.primary} !important`,
      },
    },
    favoriteToggleButtonActive: {
      backgroundColor: `${isDark ? 'rgba(233, 30, 99, 0.16)' : 'rgba(233, 30, 99, 0.1)'} !important`,
      borderColor: 'rgba(233, 30, 99, 0.45) !important',
      color: '#e91e63 !important',
      '& svg': {
        color: '#e91e63 !important',
      },
      '&:hover': {
        backgroundColor: `${isDark ? 'rgba(233, 30, 99, 0.24)' : 'rgba(233, 30, 99, 0.16)'} !important`,
        borderColor: '#e91e63 !important',
        color: '#e91e63 !important',
        '& svg': {
          color: '#e91e63 !important',
        },
      },
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.palette.primary?.main || '#2196f3',
      color: theme.palette.primary?.contrastText || '#fff',
      fontSize: '0.68rem',
      fontWeight: 700,
      padding: '0 4px',
    },
    rightGroup: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      flex: '0 0 auto',
      marginLeft: 'auto',
      marginRight: theme.spacing(2),
      height: 36,
      minHeight: 36,
      maxHeight: 36,
      boxSizing: 'border-box',
      '& .RaTopToolbar-root, & [class*="RaTopToolbar-root"]': {
        padding: '0 !important',
        margin: '0 !important',
        minHeight: '36px !important',
        maxHeight: '36px !important',
        height: '36px !important',
        display: 'inline-flex !important',
        alignItems: 'center !important',
        gap: theme.spacing(1),
        boxSizing: 'border-box',
      },
      '& .MuiButton-root': {
        minHeight: '36px !important',
        maxHeight: '36px !important',
        height: '36px !important',
        padding: '0 12px !important',
        borderRadius: '18px !important',
        fontSize: '0.82rem !important',
        fontWeight: '600 !important',
        textTransform: 'none !important',
        backgroundColor: `${controlBackground} !important`,
        border: `1px solid ${controlBorder} !important`,
        color: `${theme.palette.text.primary} !important`,
        boxShadow: 'none !important',
        boxSizing: 'border-box !important',
        display: 'inline-flex !important',
        alignItems: 'center !important',
        justifyContent: 'center !important',
        gap: '4px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
        '&:hover': {
          backgroundColor: `${controlHoverBackground} !important`,
          borderColor: `${controlHoverBorder} !important`,
          transform: 'translateY(-1px)',
        },
        '& svg': {
          fontSize: '1.1rem !important',
        },
      },
    },
    // Filter Popover & Vertical List styling
    filterPopoverPaper: {
      width: 320,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'min(500px, 80vh)',
      borderRadius: 16,
      backgroundColor: isDark
        ? 'rgba(28, 28, 30, 0.96)'
        : 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
      boxShadow: isDark
        ? '0 12px 36px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.3)'
        : '0 12px 36px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    popoverHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1.25, 1.5),
      borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
    },
    headerTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      fontWeight: 600,
      fontSize: '0.88rem',
      color: theme.palette.text.primary,
    },
    clearAllButton: {
      textTransform: 'none !important',
      fontSize: '0.72rem !important',
      fontWeight: '600 !important',
      padding: '2px 8px !important',
      minWidth: 'auto !important',
      borderRadius: '10px !important',
      backgroundColor: isDark
        ? 'rgba(255, 82, 82, 0.12) !important'
        : 'rgba(211, 47, 47, 0.08) !important',
      color: isDark ? '#ff7b7b !important' : '#d32f2f !important',
      border: isDark
        ? '1px solid rgba(255, 82, 82, 0.3) !important'
        : '1px solid rgba(211, 47, 47, 0.3) !important',
      boxShadow: 'none !important',
      '&:hover': {
        backgroundColor: isDark
          ? 'rgba(255, 82, 82, 0.25) !important'
          : 'rgba(211, 47, 47, 0.16) !important',
        color: isDark ? '#ffffff !important' : '#b71c1c !important',
      },
    },
    verticalList: {
      padding: theme.spacing(1.25, 1.5),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.25),
      overflowY: 'auto',
      scrollbarWidth: 'thin',
    },
    verticalItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      width: '100%',
    },
    toggleItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      padding: theme.spacing(0.25, 0),
    },
    toggleLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      fontSize: '0.82rem',
      fontWeight: 500,
    },
    itemLabel: {
      fontSize: '0.72rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: subtleText,
    },
    fieldInput: {
      width: '100%',
      '& .MuiOutlinedInput-root': {
        borderRadius: 8,
        backgroundColor: controlBackground,
        fontSize: '0.82rem',
      },
      '& .MuiSelect-select': {
        padding: '7px 10px',
        fontSize: '0.82rem',
      },
      '& .MuiOutlinedInput-input': {
        padding: '7px 10px',
        fontSize: '0.82rem',
      },
    },
  }
}

const useStyles = makeStyles(modernFilterStyles)

export const ModernFilterBar = ({
  resource,
  searchSource = 'name',
  searchPlaceholder,
  permanentFilter,
  roles = [],
  children,
  ...props
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const history = useHistory()
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'))

  const listContext = useListContext()
  const { filterValues, setFilters, displayedFilters, basePath } = listContext

  const [anchorEl, setAnchorEl] = useState(null)
  const isFilterOpen = Boolean(anchorEl)

  // Determine current year for year range
  const currentYear = new Date().getFullYear()

  // Fetch genres if needed
  const shouldFetchGenres =
    (resource === 'song' || resource === 'album') && isFilterOpen
  const { data: genresData } = useGetList(
    'genre',
    { page: 1, perPage: 100 },
    { field: 'name', order: 'ASC' },
    {},
    { enabled: shouldFetchGenres },
  )
  const genreList = useMemo(
    () => (genresData ? Object.values(genresData) : []),
    [genresData],
  )

  // Fetch moods if needed
  const shouldFetchMoods =
    (resource === 'song' || resource === 'album') && isFilterOpen
  const { data: moodsData } = useGetList(
    'tag',
    { page: 1, perPage: 100 },
    { field: 'tagValue', order: 'ASC' },
    { tag_name: 'mood' },
    { enabled: shouldFetchMoods },
  )
  const moodList = useMemo(
    () => (moodsData ? Object.values(moodsData) : []),
    [moodsData],
  )

  // Fetch release types if album
  const shouldFetchReleaseTypes = resource === 'album' && isFilterOpen
  const { data: releaseTypesData } = useGetList(
    'tag',
    { page: 1, perPage: 100 },
    { field: 'tagValue', order: 'ASC' },
    { tag_name: 'releasetype' },
    { enabled: shouldFetchReleaseTypes },
  )
  const releaseTypeList = useMemo(
    () => (releaseTypesData ? Object.values(releaseTypesData) : []),
    [releaseTypesData],
  )

  // Calculate active facet filter count (explicit user filters in the popover menu)
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

  const handleClearAll = useCallback(() => {
    const userFacetKeys = ['genre_id', 'mood', 'releasetype', 'role', 'year']
    const newFilters = { ...filterValues }
    userFacetKeys.forEach((key) => {
      delete newFilters[key]
    })
    setFilters(newFilters, displayedFilters, false)
    if (Object.keys(newFilters).length === 0 && history && basePath) {
      history.replace(basePath)
    }
  }, [filterValues, setFilters, displayedFilters, history, basePath])

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
      setFilters(newFilters, displayedFilters, false)
      if (Object.keys(newFilters).length === 0 && history && basePath) {
        history.replace(basePath)
      }
    },
    [filterValues, setFilters, displayedFilters, history, basePath],
  )

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

  // On mobile screens, ModernFilterBar is replaced by MobileQuickActions rendered at the top of the content
  if (isMobile) {
    return null
  }

  // Don't render if react-admin requests 'button' context
  if (props.context === 'button') {
    return null
  }

  const hasFilterOptions =
    resource === 'song' ||
    resource === 'album' ||
    resource === 'artist' ||
    resource === 'playlist'

  return (
    <>
      {/* Desktop Toolbar */}
      <div className={classes.toolbarRoot}>
        <div className={classes.leftGroup}>
          <Filter
            {...props}
            variant="outlined"
            classes={{ form: classes.filterForm }}
          >
            <SearchInput
              id="search"
              key={searchSource}
              source={searchSource}
              alwaysOn
              className={classes.searchInput}
              placeholder={
                searchPlaceholder ||
                translate('ra.action.search') ||
                'Search...'
              }
            />
          </Filter>

          {config.enableFavourites && (
            <IconButton
              className={clsx(
                classes.favoriteToggleButton,
                Boolean(filterValues?.starred) &&
                  classes.favoriteToggleButtonActive,
              )}
              onClick={() =>
                handleFilterChange(
                  'starred',
                  filterValues?.starred ? undefined : true,
                )
              }
              aria-label={filterValues?.starred ? 'Show all' : 'Favorites only'}
              title={filterValues?.starred ? 'Show all' : 'Favorites only'}
            >
              {filterValues?.starred ? (
                <FavoriteIcon fontSize="small" style={{ color: '#e91e63' }} />
              ) : (
                <FavoriteBorderIcon fontSize="small" />
              )}
            </IconButton>
          )}

          {hasFilterOptions && (
            <IconButton
              className={clsx(
                classes.filterButton,
                activeCount > 0 && classes.filterButtonActive,
              )}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label="Filters"
            >
              <FilterListIcon fontSize="small" />
              {activeCount > 0 && (
                <span className={classes.badge}>{activeCount}</span>
              )}
            </IconButton>
          )}
        </div>

        <div className={classes.rightGroup}>{children}</div>
      </div>

      {/* Filter Menu Dialog/Popover (Vertical List) */}
      <Popover
        open={isFilterOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        classes={{ paper: classes.filterPopoverPaper }}
      >
        <div className={classes.popoverHeader}>
          <div className={classes.headerTitle}>
            <FilterListIcon fontSize="small" />
            <span>Filters</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {activeCount > 0 && (
              <Button
                size="small"
                className={classes.clearAllButton}
                onClick={handleClearAll}
              >
                Clear all
              </Button>
            )}
            <IconButton
              size="small"
              onClick={() => setAnchorEl(null)}
              aria-label="Close filters"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
        </div>

        <div className={classes.verticalList}>
          {/* Role Filter (for Artists) */}
          {resource === 'artist' && roles.length > 0 && (
            <div className={classes.verticalItem}>
              <Typography className={classes.itemLabel}>Role</Typography>
              <FormControl
                variant="outlined"
                size="small"
                className={classes.fieldInput}
              >
                <Select
                  value={filterValues?.role || ''}
                  onChange={(e) =>
                    handleFilterChange('role', e.target.value || undefined)
                  }
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>-- All Roles --</em>
                  </MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          )}

          {/* Genre Filter (for Songs and Albums) */}
          {(resource === 'song' || resource === 'album') && (
            <div className={classes.verticalItem}>
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

          {/* Mood Filter (for Songs and Albums) */}
          {(resource === 'song' || resource === 'album') &&
            moodList.length > 0 && (
              <div className={classes.verticalItem}>
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

          {/* Release Type Filter (for Albums) */}
          {resource === 'album' && releaseTypeList.length > 0 && (
            <div className={classes.verticalItem}>
              <Typography className={classes.itemLabel}>
                Release Type
              </Typography>
              <FormControl
                variant="outlined"
                size="small"
                className={classes.fieldInput}
              >
                <Select
                  value={filterValues?.releasetype || ''}
                  onChange={(e) =>
                    handleFilterChange(
                      'releasetype',
                      e.target.value || undefined,
                    )
                  }
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>-- All Release Types --</em>
                  </MenuItem>
                  {releaseTypeList.map((type) => (
                    <MenuItem
                      key={type.id || type.tagValue}
                      value={type.tagValue}
                    >
                      {type.tagValue}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          )}

          {/* Year Filter (for Albums) */}
          {resource === 'album' && (
            <div className={classes.verticalItem}>
              <Typography className={classes.itemLabel}>Year</Typography>
              <TextField
                variant="outlined"
                size="small"
                type="number"
                value={filterValues?.year || ''}
                onChange={(e) =>
                  handleFilterChange(
                    'year',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="e.g. 2024"
                className={classes.fieldInput}
              />
            </div>
          )}
        </div>
      </Popover>
    </>
  )
}

ModernFilterBar.propTypes = {
  resource: PropTypes.string.isRequired,
  searchSource: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  roles: PropTypes.array,
  children: PropTypes.node,
}

export default ModernFilterBar
