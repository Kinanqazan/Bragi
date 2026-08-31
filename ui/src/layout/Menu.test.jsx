import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import { Provider } from 'react-redux'
import { createStore, combineReducers } from 'redux'
import { MemoryRouter } from 'react-router-dom'
import { useMediaQuery } from '@material-ui/core'
import { activityReducer } from '../reducers'
import Menu from './Menu'
import subsonic from '../subsonic'
import config from '../config'

let store

vi.mock('@material-ui/core', async () => {
  const actual = await import('@material-ui/core')
  return {
    ...actual,
    useMediaQuery: vi.fn(() => false),
  }
})

vi.mock('react-admin', () => ({
  useTranslate: () => (x, opts) => opts?._ || x,
  useNotify: () => vi.fn(),
  useGetIdentity: () => ({
    loaded: true,
    identity: { fullName: 'Test Admin', avatar: 'https://example.com/avatar.jpg' },
  }),
  usePermissions: () => ({ permissions: 'admin' }),
  getResources: () => [
    { name: 'song', icon: () => <div data-testid="icon-song" /> },
    { name: 'album', icon: () => <div data-testid="icon-album" /> },
    { name: 'artist', icon: () => <div data-testid="icon-artist" /> },
    { name: 'playlist', icon: () => <div data-testid="icon-playlist" /> },
    { name: 'user', icon: () => <div data-testid="icon-user" /> },
    {
      name: 'transcoding',
      hasList: true,
      options: { subMenu: 'settings', label: 'Transcoding' },
      icon: () => <div data-testid="icon-transcoding" />,
    },
  ],
  MenuItemLink: ({ to, primaryText, onClick }) => (
    <a href={to} onClick={onClick} data-testid={`link-${to}`}>
      {primaryText}
    </a>
  ),
}))

vi.mock('../common/LibrarySelector', () => ({
  default: () => <div data-testid="library-selector" />,
}))

vi.mock('../dialogs', () => ({
  AboutDialog: ({ open }) => (open ? <div data-testid="about-dialog" /> : null),
}))

vi.mock('../subsonic', () => ({
  default: {
    startScan: vi.fn(),
    getScanStatus: vi.fn().mockResolvedValue({
      json: {
        'subsonic-response': {
          scanStatus: {
            scanning: false,
            count: 100,
          },
        },
      },
    }),
  },
}))

vi.mock('../authProvider', () => ({
  default: {
    checkAuth: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../eventStream', () => ({
  startEventStream: vi.fn(),
}))

describe('<Menu />', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMediaQuery.mockReturnValue(false)
    config.devActivityPanel = true
    store = createStore(
      combineReducers({
        admin: (state = { ui: { sidebarOpen: true } }) => state,
        player: (state = { queue: [] }) => state,
        activity: activityReducer,
      }),
      {
        admin: { ui: { sidebarOpen: true } },
        player: { queue: [] },
        activity: {
          serverStart: { startTime: Date.now() - 60000, version: '0.50.0' },
          scanStatus: {
            scanning: false,
            folderCount: 1500,
            scanType: 'quick',
            elapsedTime: 12,
            error: '',
          },
        },
      },
    )
  })

  it('renders brand header with Bragi title and logo at the top left when sidebar is expanded', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByText('Bragi')).toBeInTheDocument()
    expect(screen.getByLabelText('Bragi')).toBeInTheDocument()
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument()
  })

  it('renders library items and bottom profile card when sidebar is expanded', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByTestId('library-selector')).toBeInTheDocument()
    expect(screen.getByText('Test Admin')).toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByLabelText('Sync / Quick scan')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings & Activity')).toBeInTheDocument()
  })

  it('renders menu links in correct desktop order (Genres and Moods under Artists, Playlist under Most Played)', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    const links = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'))

    expect(links).toEqual([
      '/song',
      '/artist',
      '/album/all',
      '/genres',
      '/moods',
      '/song/recentlyAdded',
      '/song/recentlyPlayed',
      '/song/mostPlayed',
      '/playlist',
    ])
  })

  it('renders menu links including playlist, recentlyAdded, and recentlyPlayed in mobile mode', () => {
    useMediaQuery.mockReturnValue(true)
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    const links = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'))

    expect(links).toEqual([
      '/song',
      '/artist',
      '/album/all',
      '/playlist',
      '/song/recentlyAdded',
      '/song/recentlyPlayed',
    ])
  })

  it('triggers quick scan when sync button is clicked', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    const syncButton = screen.getByLabelText('Sync / Quick scan')
    fireEvent.click(syncButton)
    expect(subsonic.startScan).toHaveBeenCalledWith({ fullScan: false })
  })

  it('opens unified popover menu with activity stats, settings, and full scan when card is clicked', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    const userCard = screen.getByLabelText('User profile & system settings')
    fireEvent.click(userCard)

    // Check popover content
    expect(screen.getByText('Server & Sync Status')).toBeInTheDocument()
    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.getByText('Quick Scan')).toBeInTheDocument()
    expect(screen.getByText('Full Scan')).toBeInTheDocument()
    expect(screen.getByText('Personal Settings')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText(/transcoding/i)).toBeInTheDocument()
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()

    // Trigger full scan from inside popover
    const fullScanButton = screen.getByText('Full Scan')
    fireEvent.click(fullScanButton)
    expect(subsonic.startScan).toHaveBeenCalledWith({ fullScan: true })
  })

  it('renders collapsed avatar button when sidebar is closed', () => {
    const closedStore = createStore(
      combineReducers({
        admin: (state = { ui: { sidebarOpen: false } }) => state,
        player: (state = { queue: [] }) => state,
        activity: activityReducer,
      }),
      {
        admin: { ui: { sidebarOpen: false } },
        player: { queue: [] },
        activity: {
          serverStart: { startTime: Date.now() - 60000 },
          scanStatus: { scanning: false },
        },
      },
    )

    render(
      <Provider store={closedStore}>
        <MemoryRouter>
          <Menu />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.queryByTestId('library-selector')).toBeNull()
    const avatarButton = screen.getByLabelText('User profile & system settings')
    expect(avatarButton).toBeInTheDocument()

    // Clicking collapsed avatar opens popover
    fireEvent.click(avatarButton)
    expect(screen.getByText('Personal Settings')).toBeInTheDocument()
  })
})
