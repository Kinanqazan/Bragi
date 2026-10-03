import React from 'react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { Router, Route, Switch } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import { createTheme, ThemeProvider } from '@material-ui/core/styles'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GenrePage, MoodPage } from './MusicFacetPage'
import MobileQuickActions from '../common/MobileQuickActions'
import { ModernFilterBar } from '../common/ModernFilterBar'

vi.mock('react-admin', async () => {
  const actual = await vi.importActual('react-admin')
  const { useHistory, useLocation } = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Filter: () => null,
    SearchInput: () => null,
    useDataProvider: () => ({ getList: vi.fn() }),
    useNotify: () => vi.fn(),
    useTranslate: () => (key, options) => options?._ || key,
    useListContext: () => {
      const history = useHistory()
      const location = useLocation()
      return {
        basePath: '/song',
        filterValues: JSON.parse(
          new URLSearchParams(location.search).get('filter') || '{}',
        ),
        displayedFilters: {},
        setFilters: (filter) => {
          history.replace(
            `/song?filter=${encodeURIComponent(JSON.stringify(filter))}`,
          )
        },
      }
    },
    useGetList: (resource, pagination, sort, filter) => {
      const item =
        resource === 'genre'
          ? { id: 'genre-1', name: 'Rock', songCount: 5 }
          : filter?.tag_name === 'mood'
            ? { id: 'mood-1', tagValue: 'Chill', songCount: 5 }
            : null
      return {
        ids: item ? [item.id] : [],
        data: item ? { [item.id]: item } : {},
        loading: false,
      }
    },
  }
})

describe.each([
  ['mobile', MobileQuickActions],
  ['desktop', ModernFilterBar],
])('%s song carousel facet navigation', (layout, Toolbar) => {
  it.each([
    ['mood', MoodPage, 'Chill', 'mood', 'mood-1'],
    ['genre', GenrePage, 'Rock', 'genre_id', 'genre-1'],
  ])(
    'highlights the selected %s after navigating from its page',
    (kind, Page, label, field, id) => {
      const history = createMemoryHistory({ initialEntries: [`/${kind}`] })
      const store = createStore(() => ({}))
      render(
        <Provider store={store}>
          <ThemeProvider theme={createTheme()}>
            <Router history={history}>
              <Switch>
                <Route path="/song">
                  <Toolbar resource="song" />
                </Route>
                <Route>
                  <Page />
                </Route>
              </Switch>
            </Router>
          </ThemeProvider>
        </Provider>,
      )

      fireEvent.click(screen.getByRole('button', { name: `${label} 5` }))
      expect(history.location.pathname).toBe('/song')
      const chip = screen.getByRole('button', { name: label })
      expect(chip).toHaveAttribute('aria-pressed', 'true')
      expect(chip.className).toMatch(/(?:tagChipActive|facetChipActive)/)

      fireEvent.click(chip)
      expect(chip).toHaveAttribute('aria-pressed', 'false')
      fireEvent.click(chip)
      expect(chip).toHaveAttribute('aria-pressed', 'true')
      expect(
        JSON.parse(new URLSearchParams(history.location.search).get('filter')),
      ).toEqual({ [field]: [id] })

      if (layout === 'desktop' && kind === 'mood') {
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
        expect(
          within(screen.getByText('Mood').parentElement).getByText(label),
        ).toBeInTheDocument()
      }
    },
  )
})
