import React, { Fragment } from 'react'
import { addTracks, playNext, playTracks } from '../actions'
import { RiPlayList2Fill, RiPlayListAddFill } from 'react-icons/ri'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import { BatchPlayButton } from './index'
import { AddToPlaylistButton } from './AddToPlaylistButton'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) => ({
  button: {
    color: theme.palette.type === 'dark' ? 'white' : undefined,
  },
}))

export const SongBulkActions = (props) => {
  const classes = useStyles()
  return (
    <Fragment>
      <BatchPlayButton
        {...props}
        action={playTracks}
        label={'resources.song.actions.playNow'}
        icon={<PlayArrowIcon />}
        className={classes.button}
        compact={props.compact}
      />
      <BatchPlayButton
        {...props}
        action={playNext}
        label={'resources.song.actions.playNext'}
        icon={<RiPlayList2Fill />}
        className={classes.button}
        compact={props.compact}
      />
      <BatchPlayButton
        {...props}
        action={addTracks}
        label={'resources.song.actions.addToQueue'}
        icon={<RiPlayListAddFill />}
        className={classes.button}
        compact={props.compact}
      />
      <AddToPlaylistButton
        {...props}
        className={classes.button}
        compact={props.compact}
      />
    </Fragment>
  )
}
