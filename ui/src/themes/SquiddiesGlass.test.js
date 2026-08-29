import { describe, expect, it } from 'vitest'
import theme from './SquiddiesGlass'

describe('SquiddiesGlass theme', () => {
  it('keeps the keyframes used by the album-details surface', () => {
    expect(theme.player.stylesheet).toContain('@keyframes gradientFlow')
  })
})
