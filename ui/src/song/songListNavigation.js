import { changeListParams } from 'react-admin'
import { getStoredPerPage } from '../common/perPageStore'

export const getDefaultSongListParams = () => ({
  sort: 'random',
  order: 'ASC',
  page: 1,
  perPage: getStoredPerPage(),
  filter: {},
})

export const createSongListResetAction = () =>
  changeListParams('song', getDefaultSongListParams())
