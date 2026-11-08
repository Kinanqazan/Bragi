import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@material-ui/core/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import YouTubeKeySettings from './YouTubeKeySettings'
import { httpClient } from '../dataProvider'

vi.mock('../dataProvider', () => ({ httpClient: vi.fn() }))

describe('YouTubeKeySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('explains the feature and saves and removes a personal key', async () => {
    httpClient.mockImplementation((url, options) =>
      Promise.resolve({
        json:
          options?.method === 'DELETE'
            ? { configured: false }
            : {
                configured: options?.method === 'PUT',
                serverConfigured: false,
              },
      }),
    )
    render(
      <ThemeProvider theme={createTheme()}>
        <YouTubeKeySettings />
      </ThemeProvider>,
    )
    expect(
      await screen.findByText('No API key configured.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('YouTube Data API key'), {
      target: { value: 'test-key' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save API key' }))
    expect(
      await screen.findByText('Your API key is saved.'),
    ).toBeInTheDocument()
    expect(httpClient).toHaveBeenCalledWith(
      '/api/listenbrainz/youtube-key',
      expect.objectContaining({ method: 'PUT', body: '{"key":"test-key"}' }),
    )
    expect(screen.getByLabelText('Replace API key')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Remove API key' }))
    await waitFor(() =>
      expect(screen.getByText('No API key configured.')).toBeInTheDocument(),
    )
  })
})
