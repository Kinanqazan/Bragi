import React from 'react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import MobileQuickActions from './MobileQuickActions'
import { createSongListResetAction } from '../song/songListNavigation'

const { useGetListMock, filterState, setFiltersMock } = vi.hoisted(() => {
  const state = { current: {} }
  const setFilters = vi.fn((nextFilters) => {
    state.current = nextFilters
  })

  return {
    useGetListMock: vi.fn(),
    filterState: state,
    setFiltersMock: setFilters,
  }
})

vi.mock('react-admin', async () => {
  const actual = await vi.importActual('react-admin')

  return {
    ...actual,
    useDataProvider: () => ({ getList: vi.fn() }),
    useGetList: (...args) => useGetListMock(...args),
    useListContext: () => ({
      filterValues: filterState.current,
      setFilters: setFiltersMock,
    }),
    useNotify: () => vi.fn(),
    useTranslate: () => (key, options) => options?._ || key,
  }
})

const initialState = {
  admin: {
    resources: {
      song: {
        list: {
          params: {
            filter: {},
          },
        },
      },
    },
  },
}

const touch = (target, type, x = 100, y = 100) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
    clientX: { value: x },
    clientY: { value: y },
  })
  fireEvent(target, event)
}

describe('<MobileQuickActions />', () => {
  beforeEach(() => {
    filterState.current = {}
    setFiltersMock.mockClear()
    useGetListMock.mockImplementation((resource) => ({
      data:
        resource === 'genre'
          ? { 'genre-1': { id: 'genre-1', name: 'Rock' } }
          : {},
      loading: false,
    }))
  })

  it('activates Recently Added and Favorites on the first touch without a browser click', () => {
    const store = createStore(() => initialState)
    const history = createMemoryHistory({ initialEntries: ['/song'] })
    const onNavigate = vi.fn()
    history.listen(onNavigate)
    render(
      <Provider store={store}>
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <Router history={history}>
            <MobileQuickActions />
          </Router>
        </ThemeProvider>
      </Provider>,
    )
    const recent = screen.getByRole('button', { name: 'Recently Added' })
    touch(recent, 'pointerdown')
    touch(recent, 'pointerup')
    expect(history.location.pathname).toBe('/song/recentlyAdded')
    fireEvent.click(recent, { detail: 1 })
    expect(onNavigate).toHaveBeenCalledTimes(1)

    const favorites = screen.getByRole('button', { name: 'Favorites' })
    touch(favorites, 'pointerdown')
    touch(favorites, 'pointerup')
    expect(setFiltersMock).toHaveBeenCalledTimes(1)
    expect(setFiltersMock.mock.calls[0][0]).toEqual({ starred: true })
    fireEvent.click(favorites, { detail: 1 })
    expect(setFiltersMock).toHaveBeenCalledTimes(1)
  })

  it('does not activate a tag when swiping or cancelling its touch', () => {
    const store = createStore(() => initialState)
    const history = createMemoryHistory({ initialEntries: ['/song'] })
    render(
      <Provider store={store}>
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <Router history={history}>
            <MobileQuickActions />
          </Router>
        </ThemeProvider>
      </Provider>,
    )
    const rock = screen.getByRole('button', { name: 'Rock' })
    touch(rock, 'pointerdown')
    touch(rock, 'pointermove', 135)
    touch(rock, 'pointerup')
    touch(rock, 'pointerdown')
    touch(rock, 'pointercancel')
    touch(rock, 'pointerup')
    expect(setFiltersMock).not.toHaveBeenCalled()
  })

  it('clears special-list params before returning to the song route', () => {
    const actions = []
    const store = createStore((state = initialState, action) => {
      if (action.type !== '@@redux/INIT') actions.push(action)
      return state
    })
    const history = createMemoryHistory({
      initialEntries: ['/song/mostPlayed?sort=play_count&order=DESC&filter={}'],
    })

    render(
      <Provider store={store}>
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <Router history={history}>
            <MobileQuickActions />
          </Router>
        </ThemeProvider>
      </Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Most Played' }))

    expect(history.location.pathname).toBe('/song')
    expect(actions).toContainEqual(createSongListResetAction())
  })

  it('preserves special-list sorting when adding a filter', () => {
    const store = createStore(() => initialState)
    const history = createMemoryHistory({
      initialEntries: ['/song/mostPlayed?sort=play_count&order=DESC&filter={}'],
    })

    render(
      <Provider store={store}>
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <Router history={history}>
            <MobileQuickActions />
          </Router>
        </ThemeProvider>
      </Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rock' }))

    const searchParams = new URLSearchParams(history.location.search)
    expect(history.location.pathname).toBe('/song/mostPlayed')
    expect(searchParams.get('sort')).toBe('play_count')
    expect(searchParams.get('order')).toBe('DESC')
    expect(JSON.parse(searchParams.get('filter'))).toEqual({
      genre_id: ['genre-1'],
    })
  })

  it('does not render an underline when a genre is selected in the carousel', () => {
    const store = createStore(() => initialState)
    const history = createMemoryHistory({ initialEntries: ['/song'] })

    render(
      <Provider store={store}>
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <Router history={history}>
            <MobileQuickActions />
          </Router>
        </ThemeProvider>
      </Provider>,
    )

    const genre = screen.getByRole('button', { name: 'Rock' })
    fireEvent.click(genre)

    expect(genre).toHaveAttribute('aria-pressed', 'true')
    expect(
      genre.querySelector('[class*="activeIndicator"]'),
    ).not.toBeInTheDocument()
  })

  it('does not render a filter button in the genres and moods carousel', () => {
    const store = createStore(() => initialState)
    const history = createMemoryHistory({ initialEntries: ['/song'] })

    render(
      <Provider store={store}>
        <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
          <Router history={history}>
            <MobileQuickActions />
          </Router>
        </ThemeProvider>
      </Provider>,
    )

    expect(
      screen.queryByRole('button', { name: 'Open filter dialog' }),
    ).not.toBeInTheDocument()
  })
})
