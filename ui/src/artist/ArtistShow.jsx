import { useState, useEffect } from 'react'
import { useMediaQuery, withWidth } from '@material-ui/core'
import {
  useShowController,
  ShowContextProvider,
  useRecordContext,
  useShowContext,
  ReferenceManyField,
  Title as RaTitle,
  useRefresh,
} from 'react-admin'
import subsonic from '../subsonic'
import { ModernSongList } from '../song/ModernSongList'
import MobileArtistDetails from './MobileArtistDetails'
import DesktopArtistDetails from './DesktopArtistDetails'
import {
  Pagination,
  useResourceRefresh,
  useScrollRestoration,
  Title,
} from '../common/index.js'
import ArtistActions from './ArtistActions'
import { makeStyles } from '@material-ui/core'
import { getStoredPerPage } from '../common/perPageStore'

const useStyles = makeStyles(
  (theme) => ({
    container: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      maxHeight: 'calc(100vh - 150px)',
      overflowX: 'auto',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      boxSizing: 'border-box',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': {
        display: 'none !important',
        width: '0 !important',
        height: '0 !important',
      },
      [theme.breakpoints.down('sm')]: {
        flex: '1 1 auto',
        minHeight: 0,
        height: '100%',
        maxHeight: '100% !important',
        paddingTop: 'var(--nd-mobile-top-offset, 82px)',
        paddingBottom: 'calc(var(--nd-mobile-bottom-offset, 80px) + 24px)',
      },
      [theme.breakpoints.down('xs')]: {
        flex: '1 1 auto',
        minHeight: 0,
        height: '100%',
        maxHeight: '100% !important',
        paddingTop: 'var(--nd-mobile-top-offset, 82px)',
        paddingBottom: 'calc(var(--nd-mobile-bottom-offset, 80px) + 24px)',
      },
    },
    actions: {
      width: '100%',
      justifyContent: 'flex-start',
      display: 'flex',
      padding: '0.25em 1em !important',
      minHeight: '0 !important',
      height: 'auto !important',
      alignItems: 'center',
      flexWrap: 'wrap',
      overflowX: 'auto',
      '&& > button': {
        marginTop: '0 !important',
        marginBottom: '0 !important',
      },
      [theme.breakpoints.down('xs')]: {
        padding: '0 0.5em !important',
        gap: '0.5em',
        justifyContent: 'space-around',
      },
    },
    actionsContainer: {
      paddingLeft: '.75rem',
      marginTop: 0,
      [theme.breakpoints.down('xs')]: {
        padding: '.5rem',
        marginTop: '0.25rem',
      },
    },
  }),
  {
    name: 'NDArtistShow',
  },
)

const ArtistDetails = ({ onNameSaved, ...props }) => {
  const record = useRecordContext(props)
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('sm'), {
    noSsr: true,
  })
  const [artistInfo, setArtistInfo] = useState()

  const biography = artistInfo?.biography || record.biography

  useEffect(() => {
    let active = true
    subsonic
      .getArtistInfo(record.id)
      .then((resp) => resp.json['subsonic-response'])
      .then((data) => {
        if (active && data.status === 'ok') {
          setArtistInfo(data.artistInfo)
        }
      })
      .catch((e) => {
        if (!active) return
        // eslint-disable-next-line no-console
        console.error('error on artist page', e)
      })
    return () => { active = false }
  }, [record.id])

  const Component = isDesktop ? DesktopArtistDetails : MobileArtistDetails
  return (
    <Component
      artistInfo={artistInfo}
      record={record}
      biography={biography}
      onNameSaved={onNameSaved}
    />
  )
}

const ArtistShowLayout = (props) => {
  const showContext = useShowContext(props)
  const record = useRecordContext()
  const [displayName, setDisplayName] = useState('')
  const [refreshAfterRename, setRefreshAfterRename] = useState(false)
  const classes = useStyles()
  const refresh = useRefresh()
  useResourceRefresh('song')
  useScrollRestoration(!!record?.id)

  const perPage = getStoredPerPage()

  useEffect(() => {
    setDisplayName(record?.name || '')
  }, [record?.id, record?.name])

  useEffect(() => {
    if (!refreshAfterRename) return
    setRefreshAfterRename(false)
    refresh()
  }, [refreshAfterRename, refresh])

  const displayRecord = record ? { ...record, name: displayName || record.name } : null

  return (
    <>
      {displayRecord && <RaTitle title={<Title subTitle={displayRecord.name} />} />}
      <div className={classes.container}>
        {displayRecord && (
          <ArtistDetails
            record={displayRecord}
            onNameSaved={(name) => {
              setDisplayName(name)
              setRefreshAfterRename(true)
            }}
          />
        )}
        {displayRecord && (
          <div className={classes.actionsContainer}>
            <ArtistActions record={displayRecord} className={classes.actions} />
          </div>
        )}
        {displayRecord && (
          <ReferenceManyField
            {...showContext}
            addLabel={false}
            reference="song"
            target="artist_id"
            sort={{ field: 'album', order: 'ASC' }}
            filter={{ artist_id: displayRecord.id }}
            perPage={perPage}
            pagination={<Pagination />}
          >
            <ModernSongList scrollable={false} showQuickActions={false} />
          </ReferenceManyField>
        )}
      </div>
    </>
  )
}

const ArtistShow = withWidth()((props) => {
  const controllerProps = useShowController(props)
  return (
    <ShowContextProvider value={controllerProps}>
      <ArtistShowLayout {...controllerProps} />
    </ShowContextProvider>
  )
})

export default ArtistShow
