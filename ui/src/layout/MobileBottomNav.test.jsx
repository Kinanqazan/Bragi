import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Router } from 'react-router-dom'
import { createHashHistory, createMemoryHistory } from 'history'
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

  it('changes the page and its highlight together without fading selection colors', () => {
    const history = createMemoryHistory({ initialEntries: ['/song'] })
    render(
      <Router history={history}>
        <MobileBottomNav />
        <Route
          render={({ location }) => (
            <output aria-label="Current page">{location.pathname}</output>
          )}
        />
      </Router>,
    )

    for (const [label, path] of [
      ['Artists', '/artist'],
      ['Genres', '/genres'],
      ['Moods', '/moods'],
      ['Songs', '/song'],
      ['Genres', '/genres'],
    ]) {
      const link = screen.getByRole('link', { name: label })
      fireEvent.click(link)

      expect(history.location.pathname).toBe(path)
      expect(screen.getByLabelText('Current page')).toHaveTextContent(path)
      expect(link).toHaveAttribute('aria-current', 'page')
      expect(
        screen
          .getAllByRole('link')
          .filter((item) => item.hasAttribute('aria-current')),
      ).toEqual([link])

      // Color/background transitions leave the selected tab visually behind
      // the route even though aria-current has already changed.
      for (const element of [link, link.firstElementChild]) {
        expect(window.getComputedStyle(element).transition).not.toMatch(
          /\b(all|color|background(?:-color)?)\b/,
        )
      }
    }
  })

  it('keeps the highlight in sync when hash-history tabs return to Songs', async () => {
    window.history.replaceState(null, '', '#/song')
    const history = createHashHistory()
    render(
      <Router history={history}>
        <MobileBottomNav />
      </Router>,
    )

    for (const [label, path] of [
      ['Artists', '/artist'],
      ['Genres', '/genres'],
      ['Moods', '/moods'],
      ['Songs', '/song'],
    ]) {
      const link = screen.getByRole('link', { name: label })
      fireEvent.click(link)
      await waitFor(() => {
        expect(history.location.pathname).toBe(path)
        expect(link).toHaveAttribute('aria-current', 'page')
      })
    }
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

  it('navigates through the browser click after a touch release', () => {
    const history = createMemoryHistory({ initialEntries: ['/song'] })
    const onChange = vi.fn()
    history.listen(onChange)
    render(
      <Router history={history}>
        <div onPointerUpCapture={(event) => event.preventDefault()}>
          <MobileBottomNav />
        </div>
      </Router>,
    )

    const artists = screen.getByRole('link', { name: 'Artists' })
    fireEvent.pointerUp(artists, { pointerType: 'touch', button: 0 })
    expect(history.location.pathname).toBe('/song')

    fireEvent.click(artists)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(history.location.pathname).toBe('/artist')
  })
})
