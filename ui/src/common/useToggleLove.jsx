import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataProvider, useNotify } from 'react-admin'
import { useDispatch } from 'react-redux'
import subsonic from '../subsonic'

const CRUD_UPDATE_OPTIMISTIC = 'RA/CRUD_UPDATE_OPTIMISTIC'
const UPDATE = 'UPDATE'

export const useToggleLove = (resource, rawRecord = {}) => {
  const record = rawRecord || {}
  const [loading, setLoading] = useState(false)
  const notify = useNotify()
  const dispatch = useDispatch()

  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const dataProvider = useDataProvider()

  const refreshRecord = useCallback(() => {
    dataProvider.clearCache?.()
    const promises = []

    // Always refresh the original resource
    const params = { id: record.id }
    if (record.playlistId) {
      params.filter = { playlist_id: record.playlistId }
    }
    promises.push(dataProvider.getOne(resource, params))

    // If we have a mediaFileId, also refresh the song
    if (record.mediaFileId) {
      promises.push(dataProvider.getOne('song', { id: record.mediaFileId }))
    }

    Promise.all(promises)
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.log('Error encountered: ' + e)
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false)
        }
      })
  }, [
    dataProvider,
    record?.mediaFileId,
    record?.id,
    record?.playlistId,
    resource,
  ])

  const toggleLove = () => {
    if (!record.id) return
    const prevStarred = Boolean(record.starred)
    const prevStarredAt = record.starredAt
    const nextStarred = !prevStarred
    const nextStarredAt = nextStarred ? new Date().toISOString() : null
    const toggle = prevStarred ? subsonic.unstar : subsonic.star
    const id = record.mediaFileId || record.id

    const applyOptimistic = (starred, starredAt) => {
      dispatch({
        type: CRUD_UPDATE_OPTIMISTIC,
        payload: { id: record.id, data: { starred, starredAt } },
        meta: { resource, fetch: UPDATE, optimistic: true },
      })
      if (record.mediaFileId && resource !== 'song') {
        dispatch({
          type: CRUD_UPDATE_OPTIMISTIC,
          payload: { id: record.mediaFileId, data: { starred, starredAt } },
          meta: { resource: 'song', fetch: UPDATE, optimistic: true },
        })
      }
    }

    applyOptimistic(nextStarred, nextStarredAt)

    setLoading(true)
    toggle(id)
      .then(refreshRecord)
      .catch((e) => {
        applyOptimistic(prevStarred, prevStarredAt)
        // eslint-disable-next-line no-console
        console.log('Error toggling love: ', e)
        notify('ra.page.error', 'warning')
        if (mountedRef.current) {
          setLoading(false)
        }
      })
  }

  return [toggleLove, loading]
}
