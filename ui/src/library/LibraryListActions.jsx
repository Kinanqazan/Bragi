import React, { cloneElement } from 'react'
import { Button, makeStyles } from '@material-ui/core'
import { Link } from 'react-router-dom'
import {
  sanitizeListRestProps,
  TopToolbar,
  useTranslate,
} from 'react-admin'
import AddIcon from '@material-ui/icons/Add'
import LibraryScanButton from './LibraryScanButton'

const useStyles = makeStyles((theme) => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(1, 2, 0),
    boxSizing: 'border-box',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 1.5),
      gap: theme.spacing(0.75),
    },
  },
  scanGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
  },
  scanButton: {
    borderRadius: 7,
    textTransform: 'none',
    fontWeight: 600,
    [theme.breakpoints.down('sm')]: {
      minWidth: 0,
      padding: theme.spacing(0.5, 1),
      fontSize: '0.8rem',
    },
  },
  createButton: {
    marginLeft: 'auto !important',
    borderRadius: 9,
    textTransform: 'none',
    fontWeight: 600,
    [theme.breakpoints.down('sm')]: {
      minWidth: 0,
      padding: theme.spacing(0.75, 1.25),
      fontSize: '0.8rem',
    },
  },
}))

const LibraryListActions = ({
  className,
  filters,
  resource,
  basePath,
  showFilter,
  displayedFilters,
  filterValues,
  ...rest
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const createPath = `${basePath || `/${resource}`}/create`

  return (
    <TopToolbar
      className={`${className || ''} ${classes.toolbar}`}
      {...sanitizeListRestProps(rest)}
    >
      {filters &&
        cloneElement(filters, {
          resource,
          showFilter,
          displayedFilters,
          filterValues,
          context: 'button',
        })}
      <div className={classes.scanGroup}>
        <LibraryScanButton
          fullScan={false}
          className={classes.scanButton}
        />
        <LibraryScanButton
          fullScan={true}
          className={classes.scanButton}
        />
      </div>
      <Button
        component={Link}
        to={{ pathname: createPath, state: { _scrollToTop: true } }}
        className={classes.createButton}
        color="primary"
        size="small"
        startIcon={<AddIcon />}
      >
        {translate('ra.action.create', { _: 'Create' })}
      </Button>
    </TopToolbar>
  )
}

export default LibraryListActions
