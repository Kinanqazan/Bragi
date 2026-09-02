import { describe, it, expect, beforeEach } from 'vitest'
import {
  defaultRowsPerPageOptions,
  getStoredPerPage,
  setStoredPerPage,
} from './perPageStore'

const options = [10, 25, 50, 100]

describe('perPageStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a global stored value', () => {
    setStoredPerPage(25)
    expect(getStoredPerPage()).toEqual(25)
    expect(localStorage.getItem('itemsPerPage')).toEqual('25')
  })

  it('stores values globally when passed with resource', () => {
    setStoredPerPage('song', 50)
    expect(getStoredPerPage()).toEqual(50)
  })

  it('returns the default 25 when nothing is stored', () => {
    expect(getStoredPerPage()).toEqual(25)
  })

  it('returns the fallback for garbage values', () => {
    localStorage.setItem('itemsPerPage', 'bogus')
    expect(getStoredPerPage(options, 10)).toEqual(10)
  })

  it('returns the fallback when the stored value is not a valid option', () => {
    setStoredPerPage(90)
    expect(getStoredPerPage([18, 36, 72], 18)).toEqual(18)
  })

  it('defaults the fallback to 25 when using default options', () => {
    expect(getStoredPerPage(defaultRowsPerPageOptions)).toEqual(25)
  })

  it('defaults the fallback to the first option when custom options do not include 25', () => {
    expect(getStoredPerPage([18, 36, 72])).toEqual(18)
  })
})

