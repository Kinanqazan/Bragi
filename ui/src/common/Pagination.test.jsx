import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Pagination,
  MinimalPaginationActions,
  defaultLabelDisplayedRows,
} from './Pagination'

// stub RA's Pagination so a test can invoke the injected setPerPage, i.e.
// simulate an actual rows-per-page selection
vi.mock('react-admin', async () => {
  const React = await vi.importActual('react')
  return {
    Pagination: ({ setPerPage, actions: ActionsComponent }) =>
      React.createElement('div', null, [
        React.createElement(
          'button',
          { key: 'perPage', onClick: () => setPerPage(50) },
          'select 50',
        ),
        ActionsComponent &&
          React.createElement(ActionsComponent, {
            key: 'actions',
            page: 0,
            rowsPerPage: 10,
            count: 50,
            onPageChange: vi.fn(),
          }),
      ]),
    useListPaginationContext: vi.fn(),
    useTranslate: () => (key, options) =>
      options?._ ||
      (key === 'ra.navigation.prev'
        ? 'Previous'
        : key === 'ra.navigation.next'
          ? 'Next'
          : key),
  }
})

describe('Pagination', () => {
  let mockContext
  let setPerPage

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    setPerPage = vi.fn()
    const { useListPaginationContext } = await import('react-admin')
    mockContext = vi.mocked(useListPaginationContext)
  })

  const selectPerPage = () => fireEvent.click(screen.getByText('select 50'))

  it('persists the page size globally in localStorage', () => {
    mockContext.mockReturnValue({ perPage: 15, setPerPage })
    render(<Pagination />)
    selectPerPage()
    expect(localStorage.getItem('itemsPerPage')).toEqual('50')
    expect(setPerPage).toHaveBeenCalledWith(50)
  })

  it('does not persist a page size the user did not select', () => {
    mockContext.mockReturnValue({ perPage: 15, setPerPage })
    render(<Pagination />)
    expect(localStorage.getItem('itemsPerPage')).toBeNull()
  })
})

describe('defaultLabelDisplayedRows', () => {
  it('formats current page count over total', () => {
    expect(defaultLabelDisplayedRows({ from: 1, to: 10, count: 241 })).toEqual(
      '10 / 241',
    )
    expect(
      defaultLabelDisplayedRows({ from: 241, to: 241, count: 241 }),
    ).toEqual('1 / 241')
    expect(defaultLabelDisplayedRows({ from: 0, to: 0, count: 0 })).toEqual(
      '0 / 0',
    )
  })
})

describe('MinimalPaginationActions', () => {
  it('renders only icon arrow buttons without text', () => {
    const onPageChange = vi.fn()
    render(
      <MinimalPaginationActions
        page={1}
        rowsPerPage={10}
        count={50}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByLabelText('Previous')).toBeInTheDocument()
    expect(screen.getByLabelText('Next')).toBeInTheDocument()
    expect(screen.queryByText('Prev')).not.toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('disables previous button on first page and allows next navigation', () => {
    const onPageChange = vi.fn()
    render(
      <MinimalPaginationActions
        page={0}
        rowsPerPage={10}
        count={50}
        onPageChange={onPageChange}
      />,
    )

    const prevButton = screen.getByLabelText('Previous')
    const nextButton = screen.getByLabelText('Next')

    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    fireEvent.click(nextButton)
    expect(onPageChange).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('disables next button on last page and allows previous navigation', () => {
    const onPageChange = vi.fn()
    render(
      <MinimalPaginationActions
        page={4}
        rowsPerPage={10}
        count={50}
        onPageChange={onPageChange}
      />,
    )

    const prevButton = screen.getByLabelText('Previous')
    const nextButton = screen.getByLabelText('Next')

    expect(prevButton).not.toBeDisabled()
    expect(nextButton).toBeDisabled()

    fireEvent.click(prevButton)
    expect(onPageChange).toHaveBeenCalledWith(expect.anything(), 3)
  })

  it('renders empty container when there is only 1 page', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <MinimalPaginationActions
        page={0}
        rowsPerPage={10}
        count={8}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.queryByLabelText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next')).not.toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })
})


