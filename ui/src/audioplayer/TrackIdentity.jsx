import React from 'react'
import { Link } from 'react-router-dom'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'block',
    minWidth: 0,
    color: 'inherit',
    textDecoration: 'none',
  },
  title: {
    overflow: 'hidden',
    fontSize: '1.15rem',
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  artist: {
    marginTop: 4,
    overflow: 'hidden',
    color: theme.palette.text.secondary,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

const TrackIdentity = ({ track, mobile = false }) => {
  const classes = useStyles()
  const song = track?.song || track
  if (!song?.title && !track?.title && !track?.name) return null

  const title = song.title || track.title || track.name || 'Nothing playing'
  const subtitle = song.tags?.subtitle
  const artist = song.artist || track.artist || track.singer
  const linkTo = song.playlistId
    ? `/playlist/${song.playlistId}/show`
    : song.albumId
      ? `/album/${song.albumId}/show`
      : null

  const content = (
    <>
      <div className={classes.title}>
        {title}
        {subtitle ? ` (${subtitle})` : ''}
      </div>
      {artist && <div className={classes.artist}>{artist}</div>}
    </>
  )

  return linkTo && !mobile ? (
    <Link className={classes.root} to={linkTo}>
      {content}
    </Link>
  ) : (
    <div className={classes.root}>{content}</div>
  )
}

export default TrackIdentity
