import React from 'react'
import { Notification as RANotification, getNotification } from 'react-admin'
import { useSelector } from 'react-redux'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) => ({
  centeredContent: {
    borderRadius: 14,
    padding: theme.spacing(1, 2),
    minWidth: 0,
    boxShadow: theme.shadows[8],
  },
}))

const Notification = (props) => {
  const classes = useStyles()
  const notification = useSelector(getNotification)
  const centered = notification?.message === 'message.mediaFileDeleted'
  return (
    <RANotification
      {...props}
      className={centered ? classes.centeredContent : undefined}
      style={
        centered
          ? {
              top: '50%',
              bottom: 'auto',
              left: '50%',
              right: 'auto',
              transform: 'translate(-50%, -50%)',
              width: 'max-content',
              maxWidth: 'calc(100% - 32px)',
            }
          : undefined
      }
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    />
  )
}

export default Notification
