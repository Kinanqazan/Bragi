import React from 'react'
import PropTypes from 'prop-types'
import { IconButton } from '@material-ui/core'
import {
  Button,
  useDataProvider,
  useTranslate,
  useUnselectAll,
  useNotify,
} from 'react-admin'
import { useDispatch } from 'react-redux'
import recordsToMap from './recordsToMap'

export const BatchPlayButton = ({
  resource,
  selectedIds,
  action,
  label,
  icon,
  className,
  compact = false,
}) => {
  const dispatch = useDispatch()
  const translate = useTranslate()
  const dataProvider = useDataProvider()
  const unselectAll = useUnselectAll()
  const notify = useNotify()

  const addToQueue = () => {
    dataProvider
      .getMany(resource, { ids: selectedIds })
      .then((response) => {
        // Add tracks to a map for easy lookup by ID, needed for the next step
        const tracks = recordsToMap(response.data)
        // Add the tracks to the queue in the selection order
        dispatch(action(tracks, selectedIds))
      })
      .catch(() => {
        notify('ra.page.error', 'warning')
      })
    unselectAll(resource)
  }

  const caption = translate(label)
  if (compact) {
    return (
      <IconButton
        aria-label={caption}
        title={caption}
        onClick={addToQueue}
        className={className}
      >
        {icon}
      </IconButton>
    )
  }

  return (
    <Button
      aria-label={caption}
      onClick={addToQueue}
      label={caption}
      className={className}
    >
      {icon}
    </Button>
  )
}

BatchPlayButton.propTypes = {
  action: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.object.isRequired,
  compact: PropTypes.bool,
}
