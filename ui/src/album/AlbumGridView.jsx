import React, { useRef } from 'react'
import {
  Button,
  CircularProgress,
  GridList,
  GridListTile,
  Typography,
  GridListTileBar,
  LinearProgress,
  useMediaQuery,
} from '@material-ui/core'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import { alpha, makeStyles } from '@material-ui/core/styles'
import withWidth from '@material-ui/core/withWidth'
import { Link } from 'react-router-dom'
import { linkToRecord, useListContext } from 'react-admin'
import { withContentRect } from 'react-measure'
import { useRollChanged } from './useRollChanged'
import {
  AlbumContextMenu,
  PlayButton,
  ArtistLinkField,
  OverflowTooltip,
} from '../common'
import clsx from 'clsx'
import { AlbumDatesField } from './AlbumDatesField.jsx'
import { Artwork } from '../common/Artwork'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      margin: '16px 0',
      display: 'grid',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      maxHeight: 'calc(100vh - 105px)',
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
        paddingBottom: 0,
      },
      [theme.breakpoints.down('xs')]: {
        margin: '10px 0',
        flex: '1 1 auto',
        minHeight: 0,
        height: '100%',
        maxHeight: '100% !important',
        paddingBottom: 0,
      },
    },
    tileBar: {
      transition: 'all 150ms ease-out',
      opacity: 0,
      pointerEvents: 'none',
      textAlign: 'left',
      background:
        'linear-gradient(to top, rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.4) 70%,rgba(0,0,0,0) 100%)',
    },
    tileBarMobile: {
      textAlign: 'left',
      background:
        'linear-gradient(to top, rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.4) 70%,rgba(0,0,0,0) 100%)',
    },
    albumArtistName: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'left',
      fontSize: '1em',
    },
    albumName: {
      fontSize: '14px',
      color: theme.palette.type === 'dark' ? '#eee' : 'black',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    missingAlbum: {
      opacity: 0.3,
    },
    albumVersion: {
      fontSize: '12px',
      color: theme.palette.type === 'dark' ? '#c5c5c5' : '#696969',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    albumSubtitle: {
      fontSize: '12px',
      color: theme.palette.type === 'dark' ? '#c5c5c5' : '#696969',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    link: {
      position: 'relative',
      display: 'block',
      textDecoration: 'none',
      '&:hover $tileBar, &:focus-within $tileBar': {
        opacity: 1,
        pointerEvents: 'auto',
      },
    },
    albumLink: {
      position: 'relative',
      display: 'block',
      textDecoration: 'none',
    },
    albumContainer: {},
    albumPlayButton: { color: 'white' },
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
  }),
  { name: 'NDAlbumGridView' },
)

const useCoverStyles = makeStyles({
  coverContainer: {
    width: '100%',
    aspectRatio: '1',
    overflow: 'hidden',
  },
  cover: {
    display: 'inline-block',
    width: '100%',
    objectFit: 'contain',
    // The image fills this box absolutely, so it lends no height: a remount that has not been
    // re-measured yet would collapse the tile and blank the cover for a frame.
    aspectRatio: '1',
    height: (props) => props.height,
    transition: 'opacity 0.3s ease-in-out',
  },
})

const getColsForWidth = (width) => {
  if (width === 'xs') return 2
  if (width === 'sm') return 3
  if (width === 'md') return 4
  if (width === 'lg') return 6
  return 9
}

const Cover = withContentRect('bounds')(({
  record,
  measureRef,
  contentRect,
}) => {
  // Force height to be the same as the width determined by the GridList
  // noinspection JSSuspiciousNameCombination
  const classes = useCoverStyles({ height: contentRect.bounds.width })
  return (
    <div ref={measureRef} className={classes.coverContainer}>
      <Artwork
        record={record}
        square
        className={classes.cover}
        title={record.name}
      />
    </div>
  )
})

const AlbumGridTile = ({ showArtist, record, basePath, ...props }) => {
  const classes = useStyles()
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('md'), {
    noSsr: true,
  })
  if (!record) {
    return null
  }
  const computedClasses = clsx(
    classes.albumContainer,
    record.missing && classes.missingAlbum,
  )
  return (
    <div className={computedClasses}>
      <Link
        className={classes.link}
        to={linkToRecord(basePath, record.id, 'show')}
      >
        <Cover record={record} />
        <GridListTileBar
          className={isDesktop ? classes.tileBar : classes.tileBarMobile}
          subtitle={
            !record.missing && (
              <PlayButton
                className={classes.albumPlayButton}
                record={record}
                size="small"
              />
            )
          }
          actionIcon={<AlbumContextMenu record={record} color={'white'} />}
        />
      </Link>
      <Link
        className={classes.albumLink}
        to={linkToRecord(basePath, record.id, 'show')}
      >
        <span>
          <OverflowTooltip title={record.name}>
            <Typography className={classes.albumName}>{record.name}</Typography>
          </OverflowTooltip>
          {record.tags && record.tags['albumversion'] && (
            <Typography className={classes.albumVersion}>
              {record.tags['albumversion']}
            </Typography>
          )}
        </span>
      </Link>
      {showArtist ? (
        <ArtistLinkField record={record} className={classes.albumSubtitle} />
      ) : (
        <AlbumDatesField record={record} className={classes.albumSubtitle} />
      )}
    </div>
  )
}

const LoadedAlbumGrid = ({ ids, data, basePath, width }) => {
  const classes = useStyles()
  const isMobile = useMediaQuery('(max-width:959.95px)')
  const { filterValues, total, loading, perPage, setPerPage } = useListContext()
  const isArtistView = !!(filterValues && filterValues.artist_id)

  const handleShowMore = () => {
    if (loading || !setPerPage) return
    const currentCount = perPage || (ids ? ids.length : 25)
    setPerPage(currentCount + 25)
  }

  return (
    <div className={classes.root}>
      <GridList
        component={'div'}
        cellHeight={'auto'}
        cols={getColsForWidth(width)}
        spacing={20}
      >
        {ids.map((id) => (
          <GridListTile className={classes.gridListTile} key={id}>
            <AlbumGridTile
              record={data[id]}
              basePath={basePath}
              showArtist={!isArtistView}
            />
          </GridListTile>
        ))}
      </GridList>
      {total > ids.length && (
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
            {`Showing ${ids.length} of ${total} albums`}
          </Typography>
        </div>
      )}
      {ids.length >= total && total > 25 && (
        <div className={classes.showMoreContainer}>
          <Typography className={classes.showMoreCaption}>
            {`All ${total} albums loaded`}
          </Typography>
        </div>
      )}
    </div>
  )
}

const AlbumGridView = ({
  albumListType,
  loaded,
  loading,
  seed,
  shownSeed,
  ...props
}) => {
  // ArtistShow renders this grid too, with no roll to track, so own a ref when none is passed.
  const ownSeed = useRef(null)
  // A re-roll replaces every album, so the previous roll must not linger while it loads.
  const rerolling =
    useRollChanged(shownSeed ?? ownSeed, seed, loading) &&
    albumListType === 'random'
  const hide = rerolling || !props.data || !props.ids
  return hide ? (
    <LinearProgress aria-label="Loading albums" />
  ) : (
    <LoadedAlbumGrid {...props} />
  )
}

const AlbumGridViewWithWidth = withWidth()(AlbumGridView)

export default AlbumGridViewWithWidth
