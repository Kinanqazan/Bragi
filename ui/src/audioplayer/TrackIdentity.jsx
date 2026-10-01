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
  title: {
    overflow: 'hidden',
    fontSize: '1.15rem',
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  artist: {
    marginTop: 4,
    overflow: 'hidden',
    color: theme.palette.text.secondary,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '& a': {
      color: 'inherit',
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
}))

const TrackIdentity = ({ track }) => {
  const classes = useStyles()
  const location = useLocation()
  const song = track?.song || track
  if (!song?.title && !track?.title && !track?.name) return null

  const title = song.title || track.title || track.name || 'Nothing playing'
  const subtitle = song.tags?.subtitle
  const artist = song.artist || track.artist || track.singer
  const linkTo = songShowPath(song)

  const titleNode = (
    <div className={classes.title}>
      {title}
      {subtitle ? ` (${subtitle})` : ''}
    </div>
  )

  const artistNode = artist && (
    <div className={classes.artist}>
      <ArtistLinkField record={song} source="artist" />
    </div>
  )

  return (
    <div className={classes.root}>
      {linkTo ? (
        <Link
          className={classes.titleLink}
          to={{
            pathname: linkTo,
            state: { returnTo: `${location.pathname}${location.search}` },
          }}
        >
          {titleNode}
        </Link>
      ) : (
        titleNode
      )}
      {artistNode}
    </div>
  )
}

export default TrackIdentity

