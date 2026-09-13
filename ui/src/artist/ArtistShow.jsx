import { useState, useEffect } from 'react'
import { useMediaQuery, withWidth } from '@material-ui/core'
import {
  useShowController,
  ShowContextProvider,
  useRecordContext,
  useShowContext,
  ReferenceManyField,
  Title as RaTitle,
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
      },
      [theme.breakpoints.down('xs')]: {
        flex: '1 1 auto',
        minHeight: 0,
        height: '100%',
        maxHeight: '100% !important',
      },
    },
    actions: {
      width: '100%',
      justifyContent: 'flex-start',
      display: 'flex',
      paddingTop: '0.25em',
      paddingBottom: '0.25em',
      paddingLeft: '1em',
      paddingRight: '1em',
      flexWrap: 'wrap',
      overflowX: 'auto',
      [theme.breakpoints.down('xs')]: {
        paddingLeft: '0.5em',
        paddingRight: '0.5em',
        gap: '0.5em',
        justifyContent: 'space-around',
      },
    },
    actionsContainer: {
      paddingLeft: '.75rem',
      [theme.breakpoints.down('xs')]: {
        padding: '.5rem',
      },
    },
  }),
  {
    name: 'NDArtistShow',
  },
)

const ArtistDetails = (props) => {
  const record = useRecordContext(props)
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('sm'), {
    noSsr: true,
  })
  const [artistInfo, setArtistInfo] = useState()

  const biography = artistInfo?.biography || record.biography

  useEffect(() => {
    subsonic
      .getArtistInfo(record.id)
      .then((resp) => resp.json['subsonic-response'])
      .then((data) => {
        if (data.status === 'ok') {
          setArtistInfo(data.artistInfo)
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('error on artist page', e)
      })
  }, [record.id])

  const Component = isDesktop ? DesktopArtistDetails : MobileArtistDetails
  return (
    <Component artistInfo={artistInfo} record={record} biography={biography} />
  )
}

const ArtistShowLayout = (props) => {
  const showContext = useShowContext(props)
  const record = useRecordContext()
  const classes = useStyles()
  useResourceRefresh('artist', 'song')
  useScrollRestoration(!!record?.id)

  const perPage = getStoredPerPage()

  return (
    <>
      {record && <RaTitle title={<Title subTitle={record.name} />} />}
      <div className={classes.container}>
        {record && <ArtistDetails />}
        {record && (
          <div className={classes.actionsContainer}>
            <ArtistActions record={record} className={classes.actions} />
          </div>
        )}
        {record && (
          <ReferenceManyField
            {...showContext}
            addLabel={false}
            reference="song"
            target="artist_id"
            sort={{ field: 'album', order: 'ASC' }}
            filter={{ artist_id: record?.id }}
            perPage={perPage}
            pagination={<Pagination />}
          >
            <ModernSongList scrollable={false} />
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
