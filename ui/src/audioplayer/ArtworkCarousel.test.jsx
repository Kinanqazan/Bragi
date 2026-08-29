import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLoopingPlayMode } from './carouselPolicy'
import ArtworkCarousel from './ArtworkCarousel'

const track = (uuid, title) => ({
  uuid,
  trackId: uuid,
  title,
  cover: `cover:${uuid}`,
})

const renderCarousel = (props) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <ArtworkCarousel {...props} />
    </ThemeProvider>,
  )

const dispatchPointer = (element, type, properties) => {
  const event = new Event(type, { bubbles: true })
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, { value }]),
    ),
  )
  element.dispatchEvent(event)
}

const swipeLeft = (root) => {
  dispatchPointer(root, 'pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 240,
    clientY: 100,
  })
  dispatchPointer(root, 'pointermove', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 140,
    clientY: 100,
  })
  dispatchPointer(root, 'pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 140,
    clientY: 100,
  })
}

describe('ArtworkCarousel', () => {
  afterEach(cleanup)

  it('recognizes the native engine repeat-all mode', () => {
    expect(isLoopingPlayMode('orderLoop')).toBe(true)
  })

  it('resets a partially swiped artwork when the selected queue is replaced', () => {
    const firstQueue = [track('a', 'A'), track('b', 'B')]
    const commands = { next: vi.fn(), previous: vi.fn() }
    const view = renderCarousel({
      queue: firstQueue,
      playIndex: 0,
      currentTrack: firstQueue[0],
      commands,
    })
    const root = view.container.querySelector('.nd-artwork-carousel')
    Object.defineProperty(root, 'offsetWidth', {
      configurable: true,
      value: 400,
    })

    swipeLeft(root)
    expect(root.style.getPropertyValue('--nd-carousel-offset')).toBe('-400px')

    const replacementQueue = [track('a', 'A'), track('b', 'B')]
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ArtworkCarousel
          queue={replacementQueue}
          playIndex={1}
          currentTrack={replacementQueue[1]}
          commands={commands}
        />
      </ThemeProvider>,
    )

    expect(root.style.getPropertyValue('--nd-carousel-offset')).toBe('0px')
  })

  it('correctly displays artwork for repeated songs at later queue positions', () => {
    const queueWithDuplicates = [
      track('uuid-1', 'Track A'),
      track('uuid-2', 'Track B'),
      { uuid: 'uuid-3', trackId: 'uuid-1', title: 'Track A (Repeat)', cover: 'cover:uuid-1' },
    ]
    const commands = { next: vi.fn(), previous: vi.fn() }
    const view = renderCarousel({
      queue: queueWithDuplicates,
      playIndex: 2,
      currentTrack: queueWithDuplicates[2],
      commands,
    })

    const images = view.container.querySelectorAll('img')
    // Active slide (pos 0) should be the 3rd track
    const activeImage = Array.from(images).find(
      (img) => img.parentElement.style.transform.includes('calc(0%'),
    )
    expect(activeImage).toBeTruthy()
    expect(activeImage.alt).toBe('Track A (Repeat)')
  })
})
