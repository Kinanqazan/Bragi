import { withStyles } from '@material-ui/core/styles'
import MuiDialogTitle from '@material-ui/core/DialogTitle'
import Typography from '@material-ui/core/Typography'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import React from 'react'

const styles = (theme) => ({
  root: {
    margin: 0,
    padding: theme.spacing(2),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  titleWithBack: {
    paddingLeft: theme.spacing(7),
  },
  backButton: {
    position: 'absolute',
    left: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
})

export const DialogTitle = withStyles(styles)((props) => {
  const { children, classes, onClose, onBack, ...other } = props
  return (
    <MuiDialogTitle
      disableTypography
      className={`${classes.root} ${onBack ? classes.titleWithBack : ''}`}
      {...other}
    >
      <Typography variant="h5">{children}</Typography>
      {onBack && (
        <IconButton
          aria-label="Back to Songs"
          className={classes.backButton}
          onClick={onBack}
        >
          <ArrowBackIcon />
        </IconButton>
      )}
      <IconButton
        aria-label="close"
        className={classes.closeButton}
        onClick={onClose}
      >
        <CloseIcon />
      </IconButton>
    </MuiDialogTitle>
  )
})
