import { describe, it, expect } from 'vitest'
import { albumViewReducer } from './albumView'
import { albumViewGrid, albumViewTable } from '../actions'

describe('albumViewReducer', () => {
  it('defaults to table view (grid: false)', () => {
    const state = albumViewReducer(undefined, { type: 'UNKNOWN' })
    expect(state).toEqual({ grid: false })
  })

  it('switches to grid view on ALBUM_MODE_GRID', () => {
    const state = albumViewReducer({ grid: false }, albumViewGrid())
    expect(state).toEqual({ grid: true })
  })

  it('switches to table view on ALBUM_MODE_TABLE', () => {
    const state = albumViewReducer({ grid: true }, albumViewTable())
    expect(state).toEqual({ grid: false })
  })
})
