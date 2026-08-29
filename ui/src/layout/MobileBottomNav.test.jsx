import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import MobileBottomNav from './MobileBottomNav'

vi.mock('react-admin', () => ({
  useTranslate: () => (key, options) => options?._ || key,
}))

describe('<MobileBottomNav />', () => {
  it('renders navigation links for songs, artists, genres, and moods', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Songs' })).toHaveAttribute(
      'href',
      '/song',
    )
    expect(screen.getByRole('link', { name: 'Artists' })).toHaveAttribute(
      'href',
      '/artist',
    )
    expect(screen.getByRole('link', { name: 'Genres' })).toHaveAttribute(
      'href',
      '/genres',
    )
    expect(screen.getByRole('link', { name: 'Moods' })).toHaveAttribute(
      'href',
      '/moods',
    )
  })

  it('highlights the active tab matching the current route', () => {
    render(
      <MemoryRouter initialEntries={['/song']}>
        <MobileBottomNav />
      </MemoryRouter>,
    )

    const activeLink = screen.getByRole('link', { name: 'Songs' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
    expect(activeLink.className).toContain('navItemActive')

    const inactiveLink = screen.getByRole('link', { name: 'Artists' })
    expect(inactiveLink).not.toHaveAttribute('aria-current')
    expect(inactiveLink.className).not.toContain('navItemActive')
  })

  it('returns directly to Songs after visiting multiple bottom tabs', () => {
    const history = createMemoryHistory({ initialEntries: ['/song'] })
    render(
      <Router history={history}>
        <MobileBottomNav />
      </Router>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Artists' }))
    fireEvent.click(screen.getByRole('link', { name: 'Genres' }))
    fireEvent.click(screen.getByRole('link', { name: 'Moods' }))

    expect(history.location.pathname).toBe('/moods')
    history.goBack()
    expect(history.location.pathname).toBe('/song')
  })
})
