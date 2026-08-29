import { useSelector } from 'react-redux'
import { defaultRowsPerPageOptions, getStoredPerPage } from './perPageStore'

export const useAlbumsPerPage = () => {
  const sessionPerPage = useSelector(
    (state) => state?.admin.resources?.album?.list?.params?.perPage,
  )
  const perPage =
    typeof sessionPerPage === 'number' &&
    defaultRowsPerPageOptions.includes(sessionPerPage)
      ? sessionPerPage
      : getStoredPerPage()

  return [perPage, defaultRowsPerPageOptions]
}
