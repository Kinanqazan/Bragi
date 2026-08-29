import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SelectItemsPerPage } from './SelectItemsPerPage'

vi.mock('react-admin', () => ({
  SelectInput: ({ label, defaultValue, choices, onChange }) => (
    <div>
      <label htmlFor="itemsPerPage-select">{label}</label>
      <select
        id="itemsPerPage-select"
        data-testid="itemsPerPage-select"
        defaultValue={defaultValue}
        onChange={onChange}
      >
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  ),
  useTranslate: () => (key, options) => options?._ || key,
}))

describe('SelectItemsPerPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders choices and saves selection to itemsPerPage', () => {
    render(<SelectItemsPerPage />)

    const select = screen.getByTestId('itemsPerPage-select')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()

    fireEvent.change(select, { target: { value: '25' } })
    expect(localStorage.getItem('itemsPerPage')).toBe('25')
  })
})
