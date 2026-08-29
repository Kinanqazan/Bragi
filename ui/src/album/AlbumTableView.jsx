import React, { useMemo } from 'react'
import { useHistory } from 'react-router-dom'
import { useListContext, useTranslate } from 'react-admin'
import {
  Box,
  Chip,
  LinearProgress,
  Typography,
  useMediaQuery,
} from '@material-ui/core'
import { alpha, makeStyles } from '@material-ui/core/styles'
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward'
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward'
import { useSelector } from 'react-redux'
import {
  AlbumContextMenu,
  ArtistLinkField,
  Artwork,
  DateField,
  DurationField,
  LoveButton,
  RangeField,
  RatingField,
  SizeField,
} from '../common'
import config from '../config'

const useStyles = makeStyles((theme) => {
  return {
    root: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    },
    tableContainer: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      maxHeight: 'calc(100vh - 150px)',
      overflowX: 'auto',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': {
        display: 'none !important',
        width: '0 !important',
        height: '0 !important',
      },
      [theme.breakpoints.down('sm')]: {
        maxHeight: 'calc(100vh - var(--nd-mobile-bottom-offset, 200px) - 72px)',
      },
      [theme.breakpoints.down('xs')]: {
        maxHeight: 'calc(100vh - var(--nd-mobile-bottom-offset, 200px) - 68px)',
      },
    },
    tableWrapper: {
      width: 'fit-content',
      minWidth: '100%',
      boxSizing: 'border-box',
      [theme.breakpoints.down('sm')]: {
        paddingBottom: 72,
      },
    },
    headerRow: {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.palette.background.default,
      display: 'grid',
      alignItems: 'center',
      gap: 16,
      minHeight: 38,
      padding: theme.spacing(0.5, 1.5, 0.5, 1),
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
      color: theme.palette.text.secondary,
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      userSelect: 'none',
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(0.5, 1, 0.5, 1),
        gap: 16,
      },
    },
    headerCell: {
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer',
      gap: 3,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      transition: 'color 0.15s ease',
      '&:hover': {
        color: theme.palette.text.primary,
      },
    },
    headerCellActive: {
      color: `${theme.palette.primary.main} !important`,
    },
    sortIcon: {
      fontSize: 13,
    },
    row: {
      display: 'grid',
      alignItems: 'center',
      gap: 16,
      minHeight: 68,
      padding: theme.spacing(0.75, 1.5, 0.75, 1),
      borderRadius: 0,
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      transition: theme.transitions.create(['background-color', 'transform'], {
        duration: theme.transitions.duration.shortest,
      }),
      '&:last-child': { borderBottom: 0 },
      '@media (hover: hover)': {
        '&:hover': { background: alpha(theme.palette.action.hover, 0.6) },
      },
      '&:has($actionsCell:hover)': {
        background: 'transparent',
      },
      '&:has($actionsCell:focus-within)': {
        background: 'transparent',
      },
      '&:has([aria-expanded="true"])': {
        background: 'transparent',
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: -2,
      },
      [theme.breakpoints.down('sm')]: {
        gap: 16,
        minHeight: 68,
        padding: theme.spacing(0.75, 1, 0.75, 1),
      },
    },
    missingRow: {
      opacity: 0.35,
    },
    artwork: {
      width: 56,
      height: 56,
      borderRadius: 8,
      background: theme.palette.action.hover,
    },
    titleCell: {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      paddingLeft: 2,
    },
    title: {
      overflow: 'hidden',
      fontWeight: 600,
      fontSize: '0.9rem',
      lineHeight: 1.3,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    secondary: {
      overflow: 'hidden',
      color: theme.palette.text.secondary,
      fontSize: '0.85rem',
      lineHeight: 1.3,
      marginTop: 2,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    desktopOnly: { [theme.breakpoints.down('sm')]: { display: 'none' } },
    facetChip: {
      maxWidth: '100%',
      height: 22,
      fontSize: '0.75rem',
      background: theme.palette.action.hover,
    },
    actionsCell: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      '& .MuiIconButton-root': {
        padding: 8,
        '& .MuiSvgIcon-root': {
          fontSize: '1.5rem !important',
        },
      },
    },
    empty: { padding: theme.spacing(6, 2), textAlign: 'center' },
  }
})

const ALL_ALBUM_COLUMNS = [
  {
    id: 'artist',
    labelKey: 'resources.album.fields.artist',
    defaultLabel: 'Artist',
    sortField: 'albumArtist',
    width: 'minmax(120px, 1.2fr)',
    defaultOn: true,
  },
  {
    id: 'year',
    labelKey: 'resources.album.fields.year',
    defaultLabel: 'Year',
    sortField: 'max_year',
    defaultDesc: true,
    width: 'minmax(80px, 0.8fr)',
    defaultOn: true,
  },
  {
    id: 'songCount',
    labelKey: 'resources.album.fields.songCount',
    defaultLabel: 'Songs',
    sortField: 'songCount',
    defaultDesc: true,
    width: 'minmax(80px, 0.8fr)',
    defaultOn: true,
  },
  {
    id: 'duration',
    labelKey: 'resources.album.fields.duration',
    defaultLabel: 'Time',
    sortField: 'duration',
    width: 'minmax(70px, 0.6fr)',
    defaultOn: false,
  },
  {
    id: 'playCount',
    labelKey: 'resources.album.fields.playCount',
    defaultLabel: 'Plays',
    sortField: 'playCount',
    defaultDesc: true,
    width: 'minmax(70px, 0.6fr)',
    defaultOn: false,
  },
  {
    id: 'rating',
    labelKey: 'resources.album.fields.rating',
    defaultLabel: 'Rating',
    sortField: 'rating',
    defaultDesc: true,
    width: 'minmax(96px, 0.8fr)',
    defaultOn: false,
  },
  {
    id: 'size',
    labelKey: 'resources.album.fields.size',
    defaultLabel: 'Size',
    sortField: 'size',
    defaultDesc: true,
    width: 'minmax(80px, 0.7fr)',
    defaultOn: false,
  },
  {
    id: 'mood',
    labelKey: 'resources.album.fields.mood',
    defaultLabel: 'Mood',
    sortField: 'mood',
    width: 'minmax(80px, 0.7fr)',
    defaultOn: false,
  },
  {
    id: 'createdAt',
    labelKey: 'resources.album.fields.createdAt',
    defaultLabel: 'Date Added',
    sortField: 'createdAt',
    defaultDesc: true,
    width: 'minmax(90px, 0.8fr)',
    defaultOn: false,
  },
]

const renderAlbumColumnCell = (album, colId, classes) => {
  switch (colId) {
    case 'artist':
      return (
        <div
          className={`${classes.secondary} ${classes.desktopOnly}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ArtistLinkField record={album} source="albumArtist" />
        </div>
      )
    case 'year':
      return (
        <Typography
          className={`${classes.secondary} ${classes.desktopOnly}`}
          variant="body2"
        >
          <RangeField record={album} source="year" sortBy="max_year" />
        </Typography>
      )
    case 'songCount':
      return (
        <Typography
          className={`${classes.secondary} ${classes.desktopOnly}`}
          variant="body2"
        >
          {album.songCount ?? 0}
        </Typography>
      )
    case 'duration':
      return (
        <Typography
          className={`${classes.secondary} ${classes.desktopOnly}`}
          variant="caption"
        >
          <DurationField record={album} source="duration" />
        </Typography>
      )
    case 'playCount':
      return (
        <Typography
          className={`${classes.secondary} ${classes.desktopOnly}`}
          variant="body2"
        >
          {album.playCount ?? 0}
        </Typography>
      )
    case 'size':
      return (
        <Typography
          className={`${classes.secondary} ${classes.desktopOnly}`}
          variant="body2"
        >
          <SizeField record={album} source="size" />
        </Typography>
      )
    case 'mood': {
      const mood = album.tags?.mood?.[0]
      return (
        <div className={classes.desktopOnly}>
          {mood ? (
            <Chip className={classes.facetChip} label={mood} size="small" />
          ) : null}
        </div>
      )
    }
    case 'rating':
      return (
        <div
          className={classes.desktopOnly}
          onClick={(e) => e.stopPropagation()}
        >
          {config.enableStarRating && (
            <RatingField
              record={album}
              source="rating"
              resource="album"
              size="small"
            />
          )}
        </div>
      )
    case 'createdAt':
      return (
        <Typography
          className={`${classes.secondary} ${classes.desktopOnly}`}
          variant="caption"
        >
          <DateField record={album} source="createdAt" showTime />
        </Typography>
      )
    default:
      return null
  }
}

export const AlbumTableView = () => {
  const classes = useStyles()
  const history = useHistory()
  const translate = useTranslate()
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'))
  const { data, ids, loading, total, currentSort, setSort } = useListContext()

  const toggleableSettings = useSelector(
    (state) => state.settings?.toggleableFields?.album,
  )

  const activeColumns = useMemo(() => {
    return ALL_ALBUM_COLUMNS.filter((col) => {
      if (toggleableSettings && col.id in toggleableSettings) {
        return Boolean(toggleableSettings[col.id])
      }
      return col.defaultOn
    })
  }, [toggleableSettings])

  const albums = useMemo(
    () => (ids || []).map((id) => data?.[id]).filter(Boolean),
    [data, ids],
  )

  const gridTemplateColumns = useMemo(() => {
    if (isMobile) {
      return '56px minmax(0, 1fr) auto'
    }
    const cols = [
      '56px',
      'minmax(140px, 1.4fr)',
      ...activeColumns.map((col) => col.width),
      '76px',
    ]
    return cols.join(' ')
  }, [isMobile, activeColumns])

  const handleSort =
    (field, defaultDesc = false) =>
    (e) => {
      e.stopPropagation()
      if (!setSort) return
      const firstOrder = defaultDesc ? 'DESC' : 'ASC'
      const secondOrder = defaultDesc ? 'ASC' : 'DESC'

      if (currentSort?.field !== field) {
        setSort(field, firstOrder)
      } else if (currentSort.order === firstOrder) {
        setSort(field, secondOrder)
      } else {
        setSort('name', 'ASC')
      }
    }

  const renderSortIndicator = (field) => {
    if (currentSort?.field !== field) return null
    return currentSort.order === 'DESC' ? (
      <ArrowDownwardIcon className={classes.sortIcon} />
    ) : (
      <ArrowUpwardIcon className={classes.sortIcon} />
    )
  }

  if (loading && albums.length === 0) return <LinearProgress />

  if (!loading && albums.length === 0 && total === 0) {
    return (
      <Typography className={classes.empty} color="textSecondary">
        {translate('ra.navigation.no_results')}
      </Typography>
    )
  }

  return (
    <div className={classes.root}>
      <div className={classes.tableContainer}>
        <div className={classes.tableWrapper}>
          <div
            className={classes.headerRow}
            style={{ gridTemplateColumns }}
            role="row"
          >
            <div />
            <div
              className={`${classes.headerCell} ${
                currentSort?.field === 'name' ? classes.headerCellActive : ''
              }`}
              onClick={handleSort('name')}
            >
              <span>{translate('resources.album.fields.name', { _: 'Album' })}</span>
              {renderSortIndicator('name')}
            </div>
            {!isMobile &&
              activeColumns.map((col) => (
                <div
                  key={col.id}
                  className={`${classes.headerCell} ${classes.desktopOnly} ${
                    currentSort?.field === col.sortField
                      ? classes.headerCellActive
                      : ''
                  }`}
                  onClick={handleSort(col.sortField, col.defaultDesc)}
                >
                  <span>
                    {translate(col.labelKey, { _: col.defaultLabel })}
                  </span>
                  {renderSortIndicator(col.sortField)}
                </div>
              ))}
            <div />
          </div>

          <div>
            {albums.map((album) => (
              <div
                key={album.id}
                className={`${classes.row} ${album.missing ? classes.missingRow : ''}`}
                style={{ gridTemplateColumns }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${album.name}`}
                onClick={() => history.push(`/album/${album.id}/show`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    history.push(`/album/${album.id}/show`)
                  }
                }}
              >
                <Artwork
                  className={classes.artwork}
                  record={album}
                  size={84}
                  square
                  title={album.name}
                />
                <div className={classes.titleCell}>
                  <Typography className={classes.title} variant="body2">
                    {album.name}
                  </Typography>
                  <Typography className={classes.secondary} variant="caption">
                    {album.albumArtist || album.artist || 'Unknown artist'}
                  </Typography>
                </div>
                {!isMobile &&
                  activeColumns.map((col) => (
                    <React.Fragment key={col.id}>
                      {renderAlbumColumnCell(album, col.id, classes)}
                    </React.Fragment>
                  ))}
                <Box
                  className={classes.actionsCell}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                >
                  <AlbumContextMenu record={album} resource="album" />
                </Box>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlbumTableView
