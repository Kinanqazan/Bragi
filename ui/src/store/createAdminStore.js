import {
  applyMiddleware,
  combineReducers,
  compose,
  legacy_createStore as createStore,
} from 'redux'
import { routerMiddleware, connectRouter } from 'connected-react-router'
import createSagaMiddleware from 'redux-saga'
import { all, fork } from 'redux-saga/effects'
import { adminReducer, adminSaga, USER_LOGOUT } from 'react-admin'
import { loadState, saveState } from './persistState'
import { normalizePersistedTrack } from '../audioplayer/trackModel'

const createAdminStore = ({
  authProvider,
  dataProvider,
  history,
  customReducers = {},
}) => {
  const reducer = combineReducers({
    admin: adminReducer,
    router: connectRouter(history),
    ...customReducers,
  })
  const resettableAppReducer = (state, action) =>
    reducer(action.type !== USER_LOGOUT ? state : undefined, action)

  const saga = function* rootSaga() {
    yield all([adminSaga(dataProvider, authProvider)].map(fork))
  }
  const sagaMiddleware = createSagaMiddleware()

  const composeEnhancers =
    (process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined' &&
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ &&
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        trace: true,
        traceLimit: 25,
      })) ||
    compose

  const persistedState = loadState()
  if (persistedState?.player?.queue) {
    persistedState.player.queue = persistedState.player.queue.map(
      normalizePersistedTrack,
    )
  }
  if (Number.isInteger(persistedState?.player?.savedPlayIndex)) {
    persistedState.player.playIndex = persistedState.player.savedPlayIndex
  }
  const store = createStore(
    resettableAppReducer,
    persistedState,
    composeEnhancers(
      applyMiddleware(sagaMiddleware, routerMiddleware(history)),
    ),
  )

  dataProvider.setStateGetter?.(store.getState)

  const getPersistedReferences = (state) => ({
    theme: state.theme,
    library: state.library,
    queue: state.player?.queue,
    volume: state.player?.volume,
    savedPlayIndex: state.player?.savedPlayIndex,
    albumView: state.albumView,
    settings: state.settings,
  })
  let lastPersistedReferences = getPersistedReferences(store.getState())

  store.subscribe(() => {
    const state = store.getState()
    const player = state.player
    const hasPersistedChange =
      state.theme !== lastPersistedReferences.theme ||
      state.library !== lastPersistedReferences.library ||
      player?.queue !== lastPersistedReferences.queue ||
      player?.volume !== lastPersistedReferences.volume ||
      player?.savedPlayIndex !== lastPersistedReferences.savedPlayIndex ||
      state.albumView !== lastPersistedReferences.albumView ||
      state.settings !== lastPersistedReferences.settings
    if (!hasPersistedChange) return

    const nextReferences = getPersistedReferences(state)
    const saved = saveState({
      theme: nextReferences.theme,
      library: nextReferences.library,
      player: {
        queue: nextReferences.queue,
        volume: nextReferences.volume,
        savedPlayIndex: nextReferences.savedPlayIndex,
      },
      albumView: nextReferences.albumView,
      settings: nextReferences.settings,
    })
    if (saved) lastPersistedReferences = nextReferences
  })

  sagaMiddleware.run(saga)
  return store
}

export default createAdminStore
