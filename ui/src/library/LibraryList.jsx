import React from 'react'
import {
  Datagrid,
  Filter,
  SearchInput,
  SimpleList,
  TextField,
  NumberField,
  BooleanField,
} from 'react-admin'
import { makeStyles, useMediaQuery } from '@material-ui/core'
import { List, DateField, useResourceRefresh, SizeField } from '../common'
import LibraryListBulkActions from './LibraryListBulkActions'
import LibraryListActions from './LibraryListActions'
import LibraryActivitySummary from './LibraryActivitySummary'

const useStyles = makeStyles((theme) => ({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    width: '100%',
    height: '100%',
    minHeight: 0,
    '& > .MuiPaper-root': {
      borderRadius: 14,
    },
    '@media (max-width: 959.95px)': {
      gap: theme.spacing(1.25),
      height: 'auto',
      minHeight: 'min-content',
      overflow: 'visible',
      '& > :last-child': {
        flex: '0 0 auto',
        minHeight: 'min-content',
        height: 'auto !important',
        maxHeight: 'none !important',
        overflow: 'visible !important',
      },
    },
  },
}))

const LibraryFilter = (props) => (
  <Filter {...props} variant={'outlined'}>
    <SearchInput source="name" alwaysOn />
  </Filter>
)

const LibraryList = (props) => {
  const isXsmall = useMediaQuery((theme) => theme.breakpoints.down('xs'))
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('lg'))
  const classes = useStyles()
  useResourceRefresh('library')

  return (
    <div className={classes.page}>
      <LibraryActivitySummary />
      <List
        {...props}
        scrollablePhone
        sort={{ field: 'name', order: 'ASC' }}
        exporter={false}
        bulkActionButtons={!isXsmall && <LibraryListBulkActions />}
        filters={<LibraryFilter />}
        actions={<LibraryListActions />}
      >
        {isXsmall ? (
          <SimpleList
            primaryText={(record) => record.name}
            secondaryText={(record) => record.path}
          />
        ) : (
          <Datagrid rowClick="edit">
            <TextField source="name" />
            {isDesktop && <TextField source="path" />}
            <BooleanField source="defaultNewUsers" />
            <NumberField source="totalSongs" />
            <NumberField source="totalAlbums" />
            <NumberField source="totalMissingFiles" />
            <SizeField source="totalSize" />
            <DateField source="lastScanAt" sortByOrder={'DESC'} />
          </Datagrid>
        )}
      </List>
    </div>
  )
}

export default LibraryList
