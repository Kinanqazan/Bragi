import React, { cloneElement } from 'react'
import { makeStyles } from '@material-ui/core'
import { sanitizeListRestProps, TopToolbar, CreateButton } from 'react-admin'
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
  },
  createButton: {
    marginLeft: 'auto !important',
    borderRadius: 9,
    textTransform: 'none',
    fontWeight: 600,
  },
}))

const LibraryListActions = ({
  className,
  filters,
  resource,
  showFilter,
  displayedFilters,
  filterValues,
  ...rest
}) => {
  const classes = useStyles()

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
      <CreateButton className={classes.createButton} />
    </TopToolbar>
  )
}

export default LibraryListActions
