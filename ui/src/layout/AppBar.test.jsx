import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, beforeEach, vi } from 'vitest'
import { Provider } from 'react-redux'
import { createStore, combineReducers } from 'redux'
import { MemoryRouter, useHistory, useLocation } from 'react-router-dom'
import { useMediaQuery } from '@material-ui/core'
import { activityReducer } from '../reducers'
import AppBar from './AppBar'
import config from '../config'

let store

vi.mock('@material-ui/core', async () => {
  const actual = await import('@material-ui/core')
  return {
    ...actual,
    useMediaQuery: vi.fn(() => false),
    InputBase: ({ inputProps, ...props }) => (
      <input {...props} {...inputProps} />
    ),
  }
})

vi.mock('react-admin', () => ({
  AppBar: ({ userMenu }) => <div data-testid="appbar">{userMenu}</div>,
  useTranslate: () => (x, opts) => opts?._ || x,
  usePermissions: () => ({ permissions: 'admin' }),
  getResources: () => [],
  useDataProvider: () => ({ getList: vi.fn().mockResolvedValue({ data: [] }) }),
  useNotify: () => vi.fn(),
  useGetIdentity: () => ({
    identity: { fullName: 'Test User', avatar: '' },
    loaded: true,
  }),
  useGetList: () => ({ data: [], total: 0, loading: false }),
  useListContext: () => ({ filterValues: {}, setFilters: vi.fn() }),
  toggleSidebar: () => ({ type: 'TOGGLE_SIDEBAR' }),
  changeListParams: (resource, params) => ({
    type: 'RA/CRUD_CHANGE_LIST_PARAMS',
    payload: params,
    meta: { resource },
  }),
}))

vi.mock('./ActivityPanel', () => ({
  default: () => <div data-testid="activity-panel" />,
}))
vi.mock('./PersonalMenu', () => ({
  default: () => <div />,
}))
vi.mock('./UserMenu', () => ({
  default: ({ children }) => <div>{children}</div>,
}))
vi.mock('../dialogs/Dialogs', () => ({
  Dialogs: () => <div />,
}))
vi.mock('../dialogs', () => ({
  AboutDialog: () => <div />,
}))

describe('<AppBar />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMediaQuery.mockReturnValue(false)
    config.devActivityPanel = true
    store = createStore(combineReducers({ activity: activityReducer }), {})
  })

  it('renders clean desktop container without top appbar on desktop', () => {
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <AppBar />
        </MemoryRouter>
      </Provider>,
    )
    expect(screen.queryByPlaceholderText('Search your music')).toBeNull()
    expect(screen.queryByTestId('activity-panel')).toBeNull()
    expect(container.querySelector('#react-admin-title')).toBeInTheDocument()
  })

  it('renders mobile YouTube Music header and expands search on mobile screens on music pages', async () => {
    useMediaQuery.mockReturnValue(true) // isMobile = true
    const { fireEvent } = await import('@testing-library/react')
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/song']}>
          <AppBar />
        </MemoryRouter>
      </Provider>,
    )
    expect(screen.getByLabelText('Search your music')).toBeInTheDocument()
    expect(screen.getByLabelText('Cast to device')).toBeInTheDocument()
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
    expect(screen.getByLabelText('Bragi')).toBeInTheDocument()

    // Clicking search icon expands search input
    fireEvent.click(screen.getByLabelText('Search your music'))
    expect(screen.getByPlaceholderText('Search your music')).toBeInTheDocument()
  })

  it('keeps multi-character mobile searches intact while the filter is debounced', async () => {
    useMediaQuery.mockReturnValue(true)

    const LocationProbe = () => {
      const location = useLocation()
      return <output data-testid="location-search">{location.search}</output>
    }

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/song']}>
          <AppBar />
          <LocationProbe />
        </MemoryRouter>
      </Provider>,
    )

    fireEvent.click(screen.getByLabelText('Search your music'))
    const input = screen.getByPlaceholderText('Search your music')
    fireEvent.change(input, { target: { value: 't' } })
    fireEvent.change(input, { target: { value: 'th' } })
    fireEvent.change(input, { target: { value: 'the' } })

    expect(input).toHaveValue('the')

    await waitFor(() => {
      const params = new URLSearchParams(
        screen.getByTestId('location-search').textContent,
      )
      expect(params.get('displayedFilters')).toBe('{}')
      expect(params.get('filter')).toBe('{"title":"the"}')
      expect(params.get('order')).toBe('ASC')
      expect(params.get('page')).toBe('1')
      expect(params.get('perPage')).toBe('25')
      expect(params.get('sort')).toBe('random')
    })
  })

  it('hides mobile search pill on user and settings pages like personal, user, and player', () => {
    useMediaQuery.mockReturnValue(true) // isMobile = true
    const { unmount } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/personal']}>
          <AppBar />
        </MemoryRouter>
      </Provider>,
    )
    expect(screen.queryByPlaceholderText('Search your music')).toBeNull()
    unmount()

    const { unmount: unmountUser } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/user']}>
          <AppBar />
        </MemoryRouter>
      </Provider>,
    )
    expect(screen.queryByPlaceholderText('Search your music')).toBeNull()
    unmountUser()

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/player']}>
          <AppBar />
        </MemoryRouter>
      </Provider>,
    )
    expect(screen.queryByPlaceholderText('Search your music')).toBeNull()
  })

  it('restores the fixed header when navigating after it was hidden by scrolling', () => {
    useMediaQuery.mockReturnValue(true)

    const RouteControls = () => {
      const history = useHistory()

      return (
        <>
          <button onClick={() => history.push('/genres')}>Genres</button>
          <button onClick={() => history.push('/song')}>Songs</button>
          <div
            data-testid="scroll-source"
            style={{ height: 2000, overflow: 'auto' }}
          />
        </>
      )
    }

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/song']}>
          <AppBar />
          <RouteControls />
        </MemoryRouter>
      </Provider>,
    )

    const header = () =>
      screen.getByLabelText('Open menu').closest('.MuiAppBar-root')

    fireEvent.scroll(screen.getByTestId('scroll-source'), {
      target: { scrollTop: 100 },
    })
    expect(header().className).toMatch(/mobileAppBarHidden/)

    fireEvent.click(screen.getByRole('button', { name: 'Genres' }))
    expect(header().className).not.toMatch(/mobileAppBarHidden/)

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    expect(header().className).not.toMatch(/mobileAppBarHidden/)
  })
})
