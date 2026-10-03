import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { describe, expect, it, vi } from 'vitest'
import ArtistShow from './ArtistShow'

const mocks = vi.hoisted(() => ({
  useResourceRefresh: vi.fn(),
  refresh: vi.fn(),
  record: { id: 'artist-1', name: 'Artist' },
}))

vi.mock('@material-ui/core', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, withWidth: () => (Component) => Component }
})

vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useShowController: () => ({}),
    useRefresh: () => mocks.refresh,
    ShowContextProvider: ({ children }) => children,
    useRecordContext: () => mocks.record,
    useShowContext: () => ({}),
    ReferenceManyField: () => null,
    Title: () => null,
  }
})

vi.mock('../common/index.js', () => ({
  Pagination: () => null,
  useResourceRefresh: mocks.useResourceRefresh,
  useScrollRestoration: vi.fn(),
  Title: () => null,
}))
vi.mock('../song/ModernSongList', () => ({ ModernSongList: () => null }))
vi.mock('./MobileArtistDetails', () => ({ default: () => null }))
vi.mock('./DesktopArtistDetails', () => ({ default: () => null }))
vi.mock('./ArtistActions', () => ({ default: () => null }))
vi.mock('../common/perPageStore', () => ({ getStoredPerPage: () => 25 }))

describe('ArtistShow refresh scope', () => {
  it('refreshes linked songs after a display-name override', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <ArtistShow />
      </ThemeProvider>,
    )

    expect(mocks.useResourceRefresh).toHaveBeenCalledWith('song')
  })
})
