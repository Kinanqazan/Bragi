import React, { useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  Pagination as RAPagination,
  useListPaginationContext,
  useTranslate,
} from 'react-admin'
import { IconButton, makeStyles, useTheme } from '@material-ui/core'
import ChevronLeft from '@material-ui/icons/ChevronLeft'
import ChevronRight from '@material-ui/icons/ChevronRight'
import { setStoredPerPage } from './perPageStore'

const useStyles = makeStyles(
  (theme) => ({
    actions: {
      flexShrink: 0,
      color: theme.palette.text.secondary,
      marginLeft: 12,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    },
    root: {
      display: 'flex',
      justifyContent: 'center',
      '& .MuiTablePagination-toolbar': {
        justifyContent: 'center',
        paddingLeft: 0,
        paddingRight: 0,
      },
      '& .MuiTablePagination-spacer': {
        display: 'none',
      },
    },
    toolbar: {
      justifyContent: 'center',
    },
    spacer: {
      display: 'none',
    },
  }),
  { name: 'RaPaginationActions' },
)

// eslint-disable-next-line react-refresh/only-export-components
export const defaultLabelDisplayedRows = ({ from, to, count }) => {
  if (count <= 0) return '0 / 0'
  const currentCount = to - from + 1
  return `${currentCount} / ${count}`
}

export const MinimalPaginationActions = (props) => {
  const {
    page,
    rowsPerPage,
    count,
    onPageChange,
    color = 'primary',
    size = 'small',
  } = props
  const classes = useStyles(props)
  const translate = useTranslate()
  const theme = useTheme()

  const nbPages = Math.ceil(count / rowsPerPage) || 1

  if (nbPages <= 1) {
    return <div className={classes.actions} />
  }

  const prevPage = (event) => {
    if (page === 0) {
      return
    }
    onPageChange(event, page - 1)
  }

  const nextPage = (event) => {
    if (page >= nbPages - 1) {
      return
    }
    onPageChange(event, page + 1)
  }

  return (
    <div className={classes.actions}>
      <IconButton
        color={color}
        size={size}
        key="prev"
        disabled={page === 0}
        onClick={prevPage}
        className="previous-page"
        aria-label={translate('ra.navigation.prev', { _: 'Previous' })}
      >
        {theme.direction === 'rtl' ? <ChevronRight /> : <ChevronLeft />}
      </IconButton>
      <IconButton
        color={color}
        size={size}
        key="next"
        disabled={page >= nbPages - 1}
        onClick={nextPage}
        className="next-page"
        aria-label={translate('ra.navigation.next', { _: 'Next' })}
      >
        {theme.direction === 'rtl' ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>
    </div>
  )
}

MinimalPaginationActions.propTypes = {
  count: PropTypes.number,
  onPageChange: PropTypes.func,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  color: PropTypes.string,
  size: PropTypes.string,
}

const emptyRowsPerPageOptions = []

export const Pagination = ({
  rowsPerPageOptions = emptyRowsPerPageOptions,
  actions = MinimalPaginationActions,
  labelDisplayedRows = defaultLabelDisplayedRows,
  classes: classesProp,
  className,
  ...props
}) => {
  const classes = useStyles()
  const { setPerPage } = useListPaginationContext()
  const handleSetPerPage = useCallback(
    (value) => {
      setStoredPerPage(value)
      setPerPage(value)
    },
    [setPerPage],
  )
  return (
    <RAPagination
      rowsPerPageOptions={rowsPerPageOptions}
      actions={actions}
      labelDisplayedRows={labelDisplayedRows}
      className={className ? `${classes.root} ${className}` : classes.root}
      classes={{
        toolbar: classes.toolbar,
        spacer: classes.spacer,
        ...classesProp,
      }}
      {...props}
      setPerPage={handleSetPerPage}
    />
  )
}

Pagination.propTypes = {
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  actions: PropTypes.elementType,
  labelDisplayedRows: PropTypes.func,
}


