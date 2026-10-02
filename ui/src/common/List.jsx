import React from 'react'
import { List as RAList } from 'react-admin'
import { makeStyles, useMediaQuery } from '@material-ui/core'
import config from '../config'
import { Pagination } from './Pagination'
import { defaultRowsPerPageOptions, getStoredPerPage } from './perPageStore'
import { Title } from './index'

const useStyles = makeStyles((theme) => ({
  root: {
    [theme.breakpoints.down('sm')]: {
      margin: '0 !important',
      padding: '0 !important',
      marginTop: '0 !important',
      paddingTop: '0 !important',
      boxShadow: 'none !important',
      border: 'none !important',
      display: 'flex !important',
      flexDirection: 'column !important',
      flex: '1 1 auto !important',
      minHeight: '0 !important',
      height: '100% !important',
      maxHeight: '100% !important',
      overflow: 'hidden !important',
    },
    '&.scrollablePhoneList': {
      '@media (max-width: 959.95px)': {
        flex: '0 0 auto !important',
        height: 'auto !important',
        maxHeight: 'none !important',
        overflow: 'visible !important',
      },
    },
  },
  content: {
    [theme.breakpoints.down('sm')]: {
      margin: '0 !important',
      padding: '0 !important',
      marginTop: '0 !important',
      paddingTop: '0 !important',
      marginBottom: '0 !important',
      boxShadow: 'none !important',
      border: 'none !important',
      backgroundColor: 'transparent !important',
      display: 'flex !important',
      flexDirection: 'column !important',
      flex: '1 1 auto !important',
      minHeight: '0 !important',
      height: '100% !important',
      maxHeight: '100% !important',
      overflow: 'hidden !important',
    },
    '&.scrollablePhoneList': {
      '@media (max-width: 959.95px)': {
        flex: '0 0 auto !important',
        height: 'auto !important',
        maxHeight: 'none !important',
        overflow: 'visible !important',
      },
    },
  },
  main: {
    [theme.breakpoints.down('sm')]: {
      margin: '0 !important',
      padding: '0 !important',
      marginTop: '0 !important',
      paddingTop: '0 !important',
      backgroundColor: 'transparent !important',
      display: 'flex !important',
      flexDirection: 'column !important',
      flex: '1 1 auto !important',
      minHeight: '0 !important',
      height: '100% !important',
      maxHeight: '100% !important',
      overflow: 'hidden !important',
    },
    '&.scrollablePhoneList': {
      '@media (max-width: 959.95px)': {
        flex: '0 0 auto !important',
        height: 'auto !important',
        maxHeight: 'none !important',
        overflow: 'visible !important',
      },
    },
  },
  actions: {
    [theme.breakpoints.down('sm')]: {
      display: 'none !important',
    },
  },
}))

export const List = (props) => {
  const {
    resource,
    classes: classesProp,
    filters,
    scrollablePhone = false,
    ...rest
  } = props
  const classes = useStyles()
  const isMobile = useMediaQuery('(max-width:959.95px)')
  const phoneScrollClass = scrollablePhone ? ' scrollablePhoneList' : ''

  return (
    <RAList
      title={
        <Title
          subTitle={`resources.${resource}.name`}
          args={{ smart_count: 2 }}
        />
      }
      debounce={config.uiSearchDebounceMs}
      perPage={getStoredPerPage()}
      pagination={<Pagination />}
      filters={isMobile ? undefined : filters}
      classes={{
        root: `${classes.root}${phoneScrollClass}`,
        content: `${classes.content}${phoneScrollClass}`,
        main: `${classes.main}${phoneScrollClass}`,
        actions: classes.actions,
        ...classesProp,
      }}
      {...rest}
    />
  )
}
