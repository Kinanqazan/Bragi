import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { makeStyles } from '@material-ui/core/styles'
import { ArtistLinkField } from '../common'
import { songShowPath } from '../song/songNavigation'

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'block',
    minWidth: 0,
    color: 'inherit',
    textDecoration: 'none',
  },
  sharedRoot: {
    color: theme.palette.text.primary,
    pointerEvents: 'none',
  },
  title: {
    overflow: 'hidden',
    fontSize: '1.15rem',
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sharedTitleText: {
    fontSize: 'inherit',
  },
  sharedTitle: {
    position: 'fixed',
    zIndex: 1503,
    top: 0,
    left: 0,
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'auto',
    touchAction: 'none',
    transformOrigin: 'top left',
    willChange: 'transform',
  },
  sharedArtist: {
    position: 'fixed',
    zIndex: 1503,
    top: 0,
    left: 0,
    marginTop: 0,
    visibility: 'hidden',
    pointerEvents: 'auto',
    touchAction: 'none',
    transformOrigin: 'top left',
    willChange: 'transform',
  },
  titleLink: {
    display: 'block',
    minWidth: 0,
    color: 'inherit',
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  mobileTitleLink: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'none !important',
    },
  },
  artist: {
    marginTop: 4,
    overflow: 'hidden',
    color: theme.palette.text.secondary,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '& a': {
      color: 'inherit',
      textDecoration: 'none !important',
      '&:hover, &:focus, &:focus-visible, &:active': {
        textDecoration: 'none !important',
      },
    },
  },
}))

const TrackIdentity = ({
  track,
  mobile = false,
  onTitleClick,
  onArtistClick,
  shared = false,
  titleRef,
  artistRef,
  gestureHandlers,
}) => {
  const classes = useStyles()
  const location = useLocation()
  const song = track?.song || track
  if (!song?.title && !track?.title && !track?.name) return null

  const title = song.title || track.title || track.name || 'Nothing playing'
  const subtitle = song.tags?.subtitle
  const artist = song.artist || track.artist || track.singer
  const linkTo = songShowPath(song)

  const titleNode = (
    <div
      className={
        shared ? `${classes.title} ${classes.sharedTitleText}` : classes.title
      }
    >
      {title}
      {subtitle ? ` (${subtitle})` : ''}
    </div>
  )

  const artistNode = artist && (
    <div
      ref={artistRef}
      className={
        shared ? `${classes.artist} ${classes.sharedArtist}` : classes.artist
      }
    >
      <ArtistLinkField
        record={song}
        source="artist"
        onArtistClick={mobile ? onArtistClick : undefined}
      />
    </div>
  )

  const titleContent = linkTo ? (
    <Link
      className={
        mobile
          ? `${classes.titleLink} ${classes.mobileTitleLink}`
          : classes.titleLink
      }
      onClick={mobile ? onTitleClick : undefined}
      to={{
        pathname: linkTo,
        state: { returnTo: `${location.pathname}${location.search}` },
      }}
    >
      {titleNode}
    </Link>
  ) : (
    titleNode
  )

  return (
    <div
      className={
        shared ? `${classes.root} ${classes.sharedRoot}` : classes.root
      }
      {...(shared ? gestureHandlers : {})}
    >
      {shared ? (
        <div ref={titleRef} className={classes.sharedTitle}>
          {titleContent}
        </div>
      ) : (
        titleContent
      )}
      {artistNode}
    </div>
  )
}

export default TrackIdentity
