import React, { useMemo } from 'react'
import { useHistory } from 'react-router-dom'
import { useListContext, useTranslate } from 'react-admin'
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Typography,
  useMediaQuery,
  withWidth,
} from '@material-ui/core'
import { alpha, makeStyles } from '@material-ui/core/styles'
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward'
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import { useSelector } from 'react-redux'
import {
  ArtistContextMenu,
  Artwork,
  List,
  LoveButton,
  ModernFilterBar,
  RatingField,
  ToggleFieldsMenu,
  useGetHandleArtistClick,
  useResourceRefresh,
} from '../common'
import config from '../config'
import en from '../i18n/en.json'
import { formatBytes } from '../utils/index.js'
import { songFilterStyles } from '../song/SongList'

const useStyles = makeStyles((theme) => ({
  ...songFilterStyles(theme),
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
    maxHeight: 'calc(100vh - 105px)',
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
      flex: '1 1 auto',
      minHeight: 0,
      height: '100%',
      maxHeight: '100% !important',
    },
    [theme.breakpoints.down('xs')]: {
      flex: '1 1 auto',
      minHeight: 0,
      height: '100%',
      maxHeight: '100% !important',
    },
  },
  tableWrapper: {
    width: 'fit-content',
    minWidth: '100%',
    boxSizing: 'border-box',
    [theme.breakpoints.down('sm')]: {
      paddingBottom: 0,
    },
  },
  showMoreContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 16px',
    gap: 12,
    boxSizing: 'border-box',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      padding: '10px 16px 6px',
      gap: 4,
    },
  },
  showMoreButton: {
    borderRadius: '16px !important',
    height: '32px !important',
    minWidth: '120px !important',
    padding: '0 14px !important',
    textTransform: 'none !important',
    fontSize: '0.82rem !important',
    fontWeight: '600 !important',
    color: `${theme.palette.primary.main} !important`,
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255, 255, 255, 0.08) !important'
        : 'rgba(0, 0, 0, 0.05) !important',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.35)} !important`,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1) !important',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
    display: 'inline-flex !important',
    alignItems: 'center !important',
    justifyContent: 'center !important',
    gap: 6,
    WebkitTapHighlightColor: 'transparent',
    '&:hover': {
      backgroundColor: `${alpha(theme.palette.primary.main, 0.15)} !important`,
      borderColor: `${theme.palette.primary.main} !important`,
      transform: 'translateY(-1px)',
      boxShadow: '0 3px 8px rgba(0, 0, 0, 0.2) !important',
    },
    '&:active': {
      transform: 'scale(0.96)',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '1.1rem !important',
    },
  },
  showMoreCaption: {
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    fontWeight: 500,
    opacity: 0.8,
    lineHeight: 1.2,
    margin: 0,
    whiteSpace: 'nowrap',
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
    borderRadius: '50% !important',
    background: theme.palette.action.hover,
    '& img': {
      borderRadius: '50% !important',
    },
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
}))

const ArtistFilter = (props) => {
  const translate = useTranslate()
  const isNotSmall = useMediaQuery((theme) => theme.breakpoints.up('sm'))

  const roles = useMemo(() => {
    const rolesObj = en?.resources?.artist?.roles || {}
    const r = Object.keys(rolesObj).map((role) => ({
      id: role,
      name: translate(`resources.artist.roles.${role}`, {
        smart_count: 2,
      }),
    }))
    r.sort((a, b) => a.name.localeCompare(b.name))
    return r
  }, [translate])

  return (
    <ModernFilterBar resource="artist" searchSource="name" roles={roles} {...props}>
      {isNotSmall && <ToggleFieldsMenu resource="artist" />}
    </ModernFilterBar>
  )
}

const ALL_ARTIST_COLUMNS = [
  {
    id: 'albumCount',
    labelKey: 'resources.artist.fields.albumCount',
    defaultLabel: 'Albums',
    sortField: 'albumCount',
    defaultDesc: true,
    width: 'minmax(80px, 0.8fr)',
    defaultOn: true,
  },
  {
    id: 'songCount',
    labelKey: 'resources.artist.fields.songCount',
    defaultLabel: 'Songs',
    sortField: 'songCount',
    defaultDesc: true,
    width: 'minmax(80px, 0.8fr)',
    defaultOn: true,
  },
  {
    id: 'size',
    labelKey: 'resources.artist.fields.size',
    defaultLabel: 'Size',
    sortField: 'size',
    defaultDesc: true,
    width: 'minmax(90px, 0.9fr)',
    defaultOn: true,
  },
  {
    id: 'playCount',
    labelKey: 'resources.artist.fields.playCount',
    defaultLabel: 'Plays',
    sortField: 'playCount',
    defaultDesc: true,
    width: 'minmax(70px, 0.7fr)',
    defaultOn: false,
  },
  {
    id: 'rating',
    labelKey: 'resources.artist.fields.rating',
    defaultLabel: 'Rating',
    sortField: 'rating',
    defaultDesc: true,
    width: 'minmax(96px, 0.9fr)',
    defaultOn: false,
  },
]

const ArtistListView = ({ width, ...rest }) => {
  const { filterValues } = rest
  const classes = useStyles()
  const handleArtistLink = useGetHandleArtistClick(width)
  const history = useHistory()
  const translate = useTranslate()
  const isMobile = useMediaQuery('(max-width:959.95px)')
  const {
    data,
    ids,
    loading,
    total,
    currentSort,
    setSort,
    perPage,
    setPerPage,
  } = useListContext()
  useResourceRefresh('artist')

  const handleShowMore = () => {
    if (loading || !setPerPage) return
    const currentCount = perPage || (ids ? ids.length : 25)
    setPerPage(currentCount + 25)
  }

  const role = filterValues?.role
  const getCounter = (record, counter) => {
    if (!record) return undefined
    return role ? record?.stats?.[role]?.[counter] : record?.[counter]
  }
  const getAlbumCount = (record) => getCounter(record, 'albumCount') ?? 0
  const getSongCount = (record) => getCounter(record, 'songCount') ?? 0
  const getSize = (record) => {
    const size = getCounter(record, 'size')
    return size ? formatBytes(size) : '0 MB'
  }

  const toggleableSettings = useSelector(
    (state) => state.settings?.toggleableFields?.artist,
  )

  const activeColumns = useMemo(() => {
    return ALL_ARTIST_COLUMNS.filter((col) => {
      if (toggleableSettings && col.id in toggleableSettings) {
        return Boolean(toggleableSettings[col.id])
      }
      return col.defaultOn
    })
  }, [toggleableSettings])

  const artists = useMemo(
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

  const renderArtistColumnCell = (artist, colId) => {
    switch (colId) {
      case 'albumCount':
        return (
          <Typography
            className={`${classes.secondary} ${classes.desktopOnly}`}
            variant="body2"
          >
            {getAlbumCount(artist)}
          </Typography>
        )
      case 'songCount':
        return (
          <Typography
            className={`${classes.secondary} ${classes.desktopOnly}`}
            variant="body2"
          >
            {getSongCount(artist)}
          </Typography>
        )
      case 'size':
        return (
          <Typography
            className={`${classes.secondary} ${classes.desktopOnly}`}
            variant="body2"
          >
            {getSize(artist)}
          </Typography>
        )
      case 'playCount':
        return (
          <Typography
            className={`${classes.secondary} ${classes.desktopOnly}`}
            variant="body2"
          >
            {artist.playCount ?? 0}
          </Typography>
        )
      case 'rating':
        return (
          <div
            className={classes.desktopOnly}
            onClick={(e) => e.stopPropagation()}
          >
            {config.enableStarRating && (
              <RatingField
                record={artist}
                source="rating"
                resource="artist"
                size="small"
              />
            )}
          </div>
        )
      default:
        return null
    }
  }

  if (loading && artists.length === 0) return <LinearProgress />

  if (!loading && artists.length === 0 && total === 0) {
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
              <span>
                {translate('resources.artist.fields.name', { _: 'Artist' })}
              </span>
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
            {artists.map((artist) => (
              <div
                key={artist.id}
                className={`${classes.row} ${
                  artist.missing ? classes.missingRow : ''
                }`}
                style={{ gridTemplateColumns }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${artist.name}`}
                onClick={() => history.push(handleArtistLink(artist.id))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    history.push(handleArtistLink(artist.id))
                  }
                }}
              >
                <Artwork
                  className={classes.artwork}
                  record={artist}
                  size={84}
                  title={artist.name}
                />
                <div className={classes.titleCell}>
                  <Typography className={classes.title} variant="body2">
                    {artist.name}
                  </Typography>
                </div>
                {!isMobile &&
                  activeColumns.map((col) => (
                    <React.Fragment key={col.id}>
                      {renderArtistColumnCell(artist, col.id)}
                    </React.Fragment>
                  ))}
                <Box
                  className={classes.actionsCell}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                >
                  <ArtistContextMenu record={artist} resource="artist" />
                </Box>
              </div>
            ))}
          </div>
          {total > artists.length && (
            <div className={classes.showMoreContainer}>
              <Button
                className={classes.showMoreButton}
                onClick={handleShowMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <CircularProgress size={14} color="inherit" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <ExpandMoreIcon fontSize="small" />
                    <span>Show more</span>
                  </>
                )}
              </Button>
              <Typography className={classes.showMoreCaption}>
                {`Showing ${artists.length} of ${total} artists`}
              </Typography>
            </div>
          )}
          {artists.length >= total && total > 25 && (
            <div className={classes.showMoreContainer}>
              <Typography className={classes.showMoreCaption}>
                {`All ${total} artists loaded`}
              </Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ArtistList = (props) => {
  return (
    <List
      {...props}
      sort={{ field: 'name', order: 'ASC' }}
      exporter={false}
      bulkActionButtons={false}
      filters={<ArtistFilter />}
      filterDefaultValues={{ role: 'albumartist' }}
      actions={false}
    >
      <ArtistListView {...props} />
    </List>
  )
}

const ArtistListWithWidth = withWidth()(ArtistList)

export default ArtistListWithWidth
