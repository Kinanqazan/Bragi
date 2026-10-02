import React from 'react'
import { IconButton } from '@material-ui/core'
import { useDataProvider, useNotify, useTranslate } from 'react-admin'
import { useDispatch } from 'react-redux'
import ShuffleIcon from '@material-ui/icons/Shuffle'
import { playTracks } from '../actions'
import PropTypes from 'prop-types'

export const ShuffleAllButton = ({ filters }) => {
  const translate = useTranslate()
  const dataProvider = useDataProvider()
  const dispatch = useDispatch()
  const notify = useNotify()
  filters = { ...filters, missing: false }

  const handleOnClick = () => {
    dataProvider
      .getList('song', {
        pagination: { page: 1, perPage: -1 },
        sort: { field: 'random', order: 'ASC' },
        filter: filters,
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
  }

  return (
    <IconButton
      onClick={handleOnClick}
      className="shuffleAllButton"
      aria-label={translate('resources.song.actions.shuffleAll')}
    >
      <ShuffleIcon />
    </IconButton>
  )
}

ShuffleAllButton.propTypes = {
  filters: PropTypes.object,
}
ShuffleAllButton.defaultProps = {
  filters: {},
}
