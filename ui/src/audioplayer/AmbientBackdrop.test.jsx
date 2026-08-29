import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, describe, expect, it } from 'vitest'
import AmbientBackdrop from './AmbientBackdrop'
import '../index.css'

describe('AmbientBackdrop', () => {
  afterEach(cleanup)

  it('uses a dark overlay so background maintains high contrast and readability', () => {
    render(
      <ThemeProvider theme={createTheme({ palette: { type: 'dark' } })}>
        <AmbientBackdrop cover="cover.jpg" color="#123456" />
      </ThemeProvider>,
    )

    const backdrop = document.querySelector('.nd-player-ambient-backdrop')

    expect(backdrop.style.getPropertyValue('--nd-player-ambient-overlay')).toBe(
      'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.75) 100%)',
    )
    expect(backdrop.style.getPropertyValue('--nd-player-ambient-color')).toBe(
      '#123456',
    )
  })

  it('keeps the mobile ambient backdrop optimized', () => {
    const mediaRule = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .find((rule) => rule.conditionText === '(max-width: 600px)')
    const mobileBackdropRule = Array.from(mediaRule.cssRules).find(
      (rule) => rule.selectorText === '.nd-player-ambient-backdrop',
    )

    expect(mobileBackdropRule.style.opacity).toBe('1')
  })
})
