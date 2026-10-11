import React from 'react'
import PropTypes from 'prop-types'
import { IconButton } from '@material-ui/core'
import { useDispatch } from 'react-redux'
import { Button, useTranslate, useUnselectAll } from 'react-admin'
import PlaylistAddIcon from '@material-ui/icons/PlaylistAdd'
import { openAddToPlaylist } from '../actions'

export const AddToPlaylistButton = ({
  resource,
  selectedIds,
  className,
  compact = false,
}) => {
  const translate = useTranslate()
  const dispatch = useDispatch()
  const unselectAll = useUnselectAll()

  const handleClick = () => {
    dispatch(
      openAddToPlaylist({
        selectedIds,
        onSuccess: () => unselectAll(resource),
      }),
    )
  }

  const label = translate('resources.song.actions.addToPlaylist')
  if (compact) {
    return (
      <IconButton
        aria-label={label}
        title={label}
        onClick={handleClick}
        className={className}
      >
        <PlaylistAddIcon />
      </IconButton>
    )
  }

  return (
    <Button
      aria-controls="simple-menu"
      aria-haspopup="true"
      onClick={handleClick}
      className={className}
      label={label}
    >
      <PlaylistAddIcon />
    </Button>
  )
}

AddToPlaylistButton.propTypes = {
  resource: PropTypes.string.isRequired,
  selectedIds: PropTypes.arrayOf(PropTypes.string).isRequired,
}
