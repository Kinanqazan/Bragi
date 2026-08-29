import {
  PLAYER_ADD_TRACKS,
  PLAYER_CLEAR_QUEUE,
  PLAYER_CURRENT,
  PLAYER_PLAY_NEXT,
  PLAYER_PLAY_TRACKS,
  PLAYER_SET_MODE,
  PLAYER_SET_TRACK,
  PLAYER_SET_VOLUME,
} from '../actions'
import config from '../config'
import { toQueueTrack } from '../audioplayer/trackModel'

const initialState = {
  queue: [],
  current: {},
  clear: false,
  volume: config.defaultUIVolume / 100,
  savedPlayIndex: 0,
}

const tracksFromData = (data = {}) =>
  Object.keys(data).map((id) => toQueueTrack(data[id]))

const reduceClearQueue = () => ({ ...initialState, clear: true })

const reducePlayTracks = (state, { data, id }) => {
  let playIndex = 0
  const selectedId = id == null ? null : String(id)
  const queue = Object.keys(data).map((key, index) => {
    if (selectedId !== null && key === selectedId) playIndex = index
    return toQueueTrack(data[key])
  })
  return {
    ...state,
    queue,
    playIndex,
    clear: true,
    autoPlay: true,
    current: {},
  }
}

const reduceSetTrack = (state, { data }) => ({
  ...state,
  queue: [toQueueTrack(data)],
  playIndex: 0,
  clear: true,
  autoPlay: true,
  current: {},
})

const reduceAddTracks = (state, { data }) => ({
  ...state,
  queue: [...state.queue, ...tracksFromData(data)],
  clear: false,
})

const reducePlayNext = (state, { data }) => {
  const newTracks = tracksFromData(data)
  const current = state.current || {}
  const newQueue = []
  let foundCurrent = false

  state.queue.forEach((item) => {
    newQueue.push(item)
    if (item.uuid === current.uuid) {
      foundCurrent = true
      newQueue.push(...newTracks)
    }
  })
  if (!foundCurrent) newQueue.push(...newTracks)

  return { ...state, queue: newQueue, clear: false }
}

const reduceSetVolume = (state, { data: { volume } }) => ({
  ...state,
  volume,
})

const reduceCurrent = (state, { data }) => {
  const current = data?.ended ? {} : data || {}
  const savedPlayIndex = current.uuid
    ? state.queue.findIndex((item) => item.uuid === current.uuid)
    : state.queue.findIndex((item) => item.trackId === current.trackId)
  const resolvedIndex =
    savedPlayIndex < 0 ? state.savedPlayIndex : savedPlayIndex
  const pending =
    state.playIndex != null &&
    savedPlayIndex >= 0 &&
    savedPlayIndex !== state.playIndex

  return {
    ...state,
    current,
    playIndex: pending ? state.playIndex : undefined,
    clear: pending ? state.clear : false,
    autoPlay: pending ? state.autoPlay : false,
    savedPlayIndex: pending ? state.savedPlayIndex : Math.max(0, resolvedIndex),
    volume: data?.volume ?? state.volume,
  }
}

const reduceMode = (state, { data: { mode } }) => ({
  ...state,
  mode,
})

export const playerReducer = (previousState = initialState, payload) => {
  switch (payload.type) {
    case PLAYER_CLEAR_QUEUE:
      return reduceClearQueue()
    case PLAYER_PLAY_TRACKS:
      return reducePlayTracks(previousState, payload)
    case PLAYER_SET_TRACK:
      return reduceSetTrack(previousState, payload)
    case PLAYER_ADD_TRACKS:
      return reduceAddTracks(previousState, payload)
    case PLAYER_PLAY_NEXT:
      return reducePlayNext(previousState, payload)
    case PLAYER_SET_VOLUME:
      return reduceSetVolume(previousState, payload)
    case PLAYER_CURRENT:
      return reduceCurrent(previousState, payload)
    case PLAYER_SET_MODE:
      return reduceMode(previousState, payload)
    default:
      return previousState
  }
}
