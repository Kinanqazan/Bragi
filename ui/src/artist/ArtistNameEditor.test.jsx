import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Router, Route } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { createMemoryHistory } from 'history'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ArtistNameEditor from './ArtistNameEditor'

const mocks = vi.hoisted(() => ({
  clearCache: vi.fn(),
  notify: vi.fn(),
  httpClient: vi.fn(),
}))

vi.mock('react-admin', () => ({
  Button: ({ label, ...props }) => <button {...props}>{label}</button>,
  useDataProvider: () => ({ clearCache: mocks.clearCache }),
  useNotify: () => mocks.notify,
  usePermissions: () => ({ permissions: 'admin' }),
}))

vi.mock('../config', () => ({
  default: { enableMediaFileMetadataEditing: true },
}))
vi.mock('../dataProvider', () => ({ httpClient: mocks.httpClient }))

const renderEditor = () => {
  const record = { id: 'artist-1', name: 'Old name' }
  const history = createMemoryHistory({ initialEntries: ['/artist/artist-1/show'] })
  const Host = () => {
    const [name, setName] = useState(record.name)
    return (
      <>
        <span>{name}</span>
        <ArtistNameEditor record={{ ...record, name }} onSaved={setName} />
      </>
    )
  }

  return {
    ...render(
      <Router history={history}>
      <ThemeProvider theme={createTheme()}>
        <Route
          path="/artist/:id/show"
          render={({ match }) => <Host key={match.params.id} />}
        />
      </ThemeProvider>
      </Router>,
    ),
    history,
  }
}

describe('ArtistNameEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates the display name without changing the artist identity', async () => {
    mocks.httpClient.mockResolvedValue({
      json: { id: 'artist-1', name: 'New name', artistId: 'artist-2', updatedSongs: 1 },
    })
    const { history } = renderEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Edit artist name' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'New name' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ra.action.save' }))

    expect(await screen.findByText('New name')).toBeInTheDocument()
    expect(history.location.pathname).toBe('/artist/artist-1/show')
  })

  it('uses the current react-admin notification options and a translated success key', async () => {
    mocks.httpClient.mockResolvedValue({
      json: { id: 'artist-1', name: 'New name' },
    })
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Edit artist name' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'New name' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ra.action.save' }))

    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        'resources.artist.notifications.displayNameUpdated',
        { type: 'info' },
      ),
    )
  })
})
