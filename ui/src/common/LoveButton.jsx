import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import FavoriteIcon from '@material-ui/icons/Favorite'
import FavoriteBorderIcon from '@material-ui/icons/FavoriteBorder'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { useToggleLove } from './useToggleLove'
import { useRecordContext } from 'react-admin'
import config from '../config'
import { isDateSet } from '../utils/validations'
import { useImmediateControlPress } from '../audioplayer/controlPress'

const useStyles = makeStyles(
  {
    love: {
      color: (props) => props.color,
      visibility: (props) =>
        props.visible === false
          ? 'hidden'
          : props.loved
            ? 'visible'
            : 'inherit',
    },
  },
  { name: 'NDLoveButton' },
)

export const LoveButton = ({
  resource,
  color,
  visible,
  size,
  component: Button,
  addLabel,
  disabled,
  immediateTouch = false,
  className,
  record: recordProp,
  ...rest
}) => {
  const record = useRecordContext({ record: recordProp }) || {}
  const classes = useStyles({ color, visible, loved: record.starred })
  const [toggleLove, loading] = useToggleLove(resource, record)
  const loveableSong = resource === 'song' || resource === 'playlistTrack'

  const handleToggleLove = useCallback(
    (e) => {
      e?.preventDefault?.()
      toggleLove()
      e?.stopPropagation?.()
    },
    [toggleLove],
  )
  const immediatePress = useImmediateControlPress(handleToggleLove, {
    stopPropagation: true,
    preventDefaultOnClick: true,
  })

  if (!loveableSong || !config.enableFavourites) {
    return <></>
  }
  return (
    <Button
      size={'small'}
      disabled={disabled || loading || record.missing}
      className={clsx(classes.love, className)}
      title={
        isDateSet(record.starredAt)
          ? new Date(record.starredAt).toLocaleString()
          : undefined
      }
      {...(immediateTouch
        ? immediatePress
        : { onClick: handleToggleLove })}
      {...rest}
    >
      {record.starred ? (
        <FavoriteIcon fontSize={size} />
      ) : (
        <FavoriteBorderIcon fontSize={size} />
      )}
    </Button>
  )
}

LoveButton.propTypes = {
  resource: PropTypes.oneOf(['song', 'playlistTrack']).isRequired,
  record: PropTypes.object,
  visible: PropTypes.bool,
  color: PropTypes.string,
  size: PropTypes.string,
  component: PropTypes.object,
  disabled: PropTypes.bool,
  immediateTouch: PropTypes.bool,
}

LoveButton.defaultProps = {
  addLabel: true,
  visible: true,
  size: 'small',
  color: 'inherit',
  component: IconButton,
  disabled: false,
}
