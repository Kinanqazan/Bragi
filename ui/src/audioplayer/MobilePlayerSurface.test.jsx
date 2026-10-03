import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { describe, expect, it } from 'vitest'
import { afterEach, beforeEach, vi } from 'vitest'

vi.mock('./ArtworkCarousel', () => ({ default: () => null }))
const artworkColorMocks = vi.hoisted(() => ({
  useArtworkColor: vi.fn(() => '#123456'),
}))

vi.mock('./artworkColor', () => artworkColorMocks)
vi.mock('./LyricsCanvas', () => ({ default: () => null }))
vi.mock('./MobilePlayerBar', () => ({
  default: ({
    rootRef,
    gestureHandlers,
    style,
    snapshot,
    commands,
    ambientColor,
    titleRef,
    artistRef,
  }) => (
    <aside
      ref={rootRef}
      data-testid="mock-mobile-player-bar"
      data-ambient-color={ambientColor}
      style={style}
      {...gestureHandlers}
    >
      <span ref={titleRef} data-testid="mini-title-anchor" aria-hidden="true" />
      <span
        ref={artistRef}
        data-testid="mini-artist-anchor"
        aria-hidden="true"
      />
      <button
        type="button"
        aria-label={snapshot.playing ? 'Pause' : 'Play'}
        onClick={snapshot.playing ? commands.pause : commands.play}
      />
    </aside>
  ),
}))
vi.mock('./PlayerControls', () => ({
  default: ({ snapshot, commands }) => (
    <button
      type="button"
      aria-label={snapshot.playing ? 'Pause' : 'Play'}
      onClick={snapshot.playing ? commands.pause : commands.play}
    />
  ),
}))
vi.mock('./ProgressBar', () => ({ default: () => null }))
vi.mock('./QueueDrawer', () => ({ default: () => null }))
vi.mock('./TrackIdentity', () => ({
  default: ({ shared, titleRef, artistRef, gestureHandlers, track }) =>
    shared ? (
      <div {...gestureHandlers}>
        <span ref={titleRef} data-testid="shared-title">
          {track.title}
        </span>
        <span ref={artistRef} data-testid="shared-artist">
          {track.artist}
        </span>
      </div>
    ) : null,
}))
vi.mock('./VolumeControl', () => ({ default: () => null }))
vi.mock('./PlayerToolbar', () => ({
  default: () => null,
  PlayerLoveButton: () => null,
}))

import { getTopBlendedColor } from './AmbientBackdrop'
import { getVerticalSwipeOffset } from './mobilePlayerGestures'
import { normalizeThemeColor } from '../useChangeThemeColor'
import MobilePlayerSurface from './MobilePlayerSurface'

const renderSurface = (
  onExpandedChange = vi.fn(),
  expanded = true,
  commands = {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
  },
  onClear = vi.fn(),
) => {
  const bridge = {
    snapshot: {
      currentTrack: { title: 'Test song', artist: 'Test artist' },
      currentTime: 10,
      currentIndex: 0,
      duration: 180,
      mode: 'order',
      playing: false,
    },
    commands,
    uiVolume: 1,
  }

  const surface = (isExpanded) => (
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <MobilePlayerSurface
          bridge={bridge}
          queue={[]}
          expanded={isExpanded}
          onExpandedChange={onExpandedChange}
          onClear={onClear}
        />
      </ThemeProvider>
    </MemoryRouter>
  )
  const view = render(surface(expanded))

  return {
    ...view,
    onExpandedChange,
    onClear,
    rerenderSurface: (isExpanded) => view.rerender(surface(isExpanded)),
  }
}

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

describe('MobilePlayerSurface gestures', () => {
  beforeEach(() => {
    const rect = (left, top, width, height) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function () {
        const testId = this.getAttribute('data-testid')
        const anchor = this.getAttribute('data-player-anchor')
        if (this.getAttribute('aria-label') === 'Full-screen player') {
          return rect(0, 0, 400, 800)
        }
        if (testId === 'mock-mobile-player-bar') return rect(10, 660, 380, 92)
        if (anchor === 'full-title') return rect(100, 68, 200, 24)
        if (anchor === 'full-artist') return rect(155, 96, 90, 20)
        if (testId === 'mini-title-anchor') return rect(118, 685, 180, 19)
        if (testId === 'mini-artist-anchor') return rect(118, 709, 180, 17)
        return rect(0, 0, 0, 0)
      },
    )
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('provides ambient artwork color to the backdrop and mobile player bar', () => {
    const { rerenderSurface } = renderSurface()

    expect(artworkColorMocks.useArtworkColor).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('mock-mobile-player-bar')).toHaveAttribute(
      'data-ambient-color',
      '#123456',
    )
    expect(document.querySelector('.nd-player-ambient-backdrop')).toHaveStyle(
      '--nd-player-ambient-color: #123456',
    )

    rerenderSurface(false)
    expect(screen.getByTestId('mock-mobile-player-bar')).toHaveAttribute(
      'data-ambient-color',
      '#123456',
    )
  })

  it('updates the notch color when an opening swipe starts moving', () => {
    document
      .querySelectorAll("meta[name='theme-color']")
      .forEach((element) => element.remove())
    const themeColor = document.createElement('meta')
    themeColor.setAttribute('name', 'theme-color')
    themeColor.setAttribute('content', '#303030')
    document.head.appendChild(themeColor)
    renderSurface(vi.fn(), false)
    const mini = screen.getByTestId('mock-mobile-player-bar')

    dispatchPointer(mini, 'pointerdown', {
      pointerId: 10,
      pointerType: 'touch',
      clientX: 100,
      clientY: 300,
    })
    dispatchPointer(mini, 'pointermove', {
      pointerId: 10,
      pointerType: 'touch',
      clientX: 100,
      clientY: 288,
    })

    expect(themeColor).toHaveAttribute(
      'content',
      normalizeThemeColor(getTopBlendedColor('#123456', false, '#fafafa')),
    )
  })

  it('restores the app notch color when a closing swipe starts moving', () => {
    document
      .querySelectorAll("meta[name='theme-color']")
      .forEach((element) => element.remove())
    const themeColor = document.createElement('meta')
    themeColor.setAttribute('name', 'theme-color')
    themeColor.setAttribute('content', '#303030')
    document.head.appendChild(themeColor)
    renderSurface(vi.fn(), true)
    const surface = screen.getByRole('region', { name: 'Full-screen player' })
    const fullscreenColor = normalizeThemeColor(
      getTopBlendedColor('#123456', false, '#fafafa'),
    )
    themeColor.setAttribute('content', fullscreenColor)

    dispatchPointer(surface, 'pointerdown', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(surface, 'pointermove', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: 100,
      clientY: 112,
    })

    expect(themeColor).toHaveAttribute('content', '#303030')
  })

  it('keeps the full-screen player from becoming scrollable', () => {
    renderSurface()

    const surface = screen.getByRole('region', { name: 'Full-screen player' })

    expect(getComputedStyle(surface).overflow).toBe('hidden')
  })

  it('collapses the full-screen player after a downward swipe', () => {
    const { onExpandedChange } = renderSurface()
    const frame = screen.getByTestId('shared-player-frame')
    const initialFrameTransform = frame.style.transform
    const surface = screen.getByRole('region', {
      name: 'Full-screen player',
      hidden: true,
    })
    expect(surface.style.touchAction).toBe('none')
    dispatchPointer(surface, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(surface, 'pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 106,
      clientY: 160,
    })
    dispatchPointer(surface, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 106,
      clientY: 160,
    })

    expect(surface.style.transform).toBe('none')
    expect(frame.style.transform).not.toBe(initialFrameTransform)
    expect(onExpandedChange).not.toHaveBeenCalled()
    dispatchPointer(frame, 'transitionend', { propertyName: 'transform' })

    expect(onExpandedChange).toHaveBeenCalledWith(false)
    expect(
      screen.queryByRole('button', { name: 'Collapse player' }),
    ).not.toBeInTheDocument()
  })

  it('moves one frame, title, and artist between both player sizes', () => {
    renderSurface()
    const surface = screen.getByRole('region', { name: 'Full-screen player' })
    const frame = screen.getByTestId('shared-player-frame')
    const title = screen.getByTestId('shared-title')
    const artist = screen.getByTestId('shared-artist')
    const initialTitle = title.style.transform
    const initialArtist = artist.style.transform

    dispatchPointer(surface, 'pointerdown', {
      pointerId: 30,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(surface, 'pointermove', {
      pointerId: 30,
      pointerType: 'touch',
      clientX: 100,
      clientY: 170,
    })
    dispatchPointer(surface, 'pointerup', {
      pointerId: 30,
      pointerType: 'touch',
      clientX: 100,
      clientY: 170,
    })

    expect(screen.getByTestId('shared-player-frame')).toBe(frame)
    expect(screen.getByTestId('shared-title')).toBe(title)
    expect(screen.getByTestId('shared-artist')).toBe(artist)
    expect(title).toHaveTextContent('Test song')
    expect(artist).toHaveTextContent('Test artist')
    expect(title.style.transform).not.toBe(initialTitle)
    expect(artist.style.transform).not.toBe(initialArtist)
    expect(
      document.querySelectorAll('.nd-player-ambient-backdrop'),
    ).toHaveLength(1)
  })

  it('keeps the dragged layer mounted until its snap animation completes', () => {
    const { onExpandedChange } = renderSurface()
    const frame = screen.getByTestId('shared-player-frame')
    const surface = screen.getByRole('region', { name: 'Full-screen player' })

    dispatchPointer(surface, 'pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(surface, 'pointermove', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 100,
      clientY: 260,
    })
    dispatchPointer(surface, 'pointerup', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 100,
      clientY: 260,
    })

    expect(frame.style.transition).toContain('cubic-bezier')
    expect(onExpandedChange).not.toHaveBeenCalled()

    dispatchPointer(frame, 'transitionend', { propertyName: 'transform' })

    expect(onExpandedChange).toHaveBeenCalledWith(false)
  })

  it('tracks vertical motion without stealing horizontal artwork swipes', () => {
    expect(
      getVerticalSwipeOffset(
        { clientX: 100, clientY: 100 },
        { clientX: 106, clientY: 160 },
      ),
    ).toBe(60)
    expect(
      getVerticalSwipeOffset(
        { clientX: 100, clientY: 100 },
        { clientX: 180, clientY: 150 },
      ),
    ).toBe(0)
  })

  it('animates the mini player into fullscreen after an upward swipe', () => {
    const onExpandedChange = vi.fn()
    renderSurface(onExpandedChange, false)
    const mini = screen.getByTestId('mock-mobile-player-bar')
    const frame = screen.getByTestId('shared-player-frame')

    dispatchPointer(mini, 'pointerdown', {
      pointerId: 4,
      pointerType: 'touch',
      clientX: 100,
      clientY: 300,
    })
    dispatchPointer(mini, 'pointermove', {
      pointerId: 4,
      pointerType: 'touch',
      clientX: 100,
      clientY: 240,
    })
    dispatchPointer(mini, 'pointerup', {
      pointerId: 4,
      pointerType: 'touch',
      clientX: 100,
      clientY: 240,
    })

    expect(frame.style.transition).toContain('cubic-bezier')
    expect(onExpandedChange).not.toHaveBeenCalled()
    dispatchPointer(frame, 'transitionend', { propertyName: 'transform' })

    expect(onExpandedChange).toHaveBeenCalledWith(true)
  })

  it('does not swallow the first play click after an upward swipe', () => {
    const onExpandedChange = vi.fn()
    const onPlay = vi.fn()
    renderSurface(onExpandedChange, false, {
      play: onPlay,
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
    })
    const frame = screen.getByTestId('shared-player-frame')
    const mini = screen.getByTestId('mock-mobile-player-bar')

    // The mini player owns the gesture until the fullscreen snap completes.
    dispatchPointer(mini, 'pointerdown', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 100,
      clientY: 300,
    })
    dispatchPointer(mini, 'pointermove', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 100,
      clientY: 240,
    })
    dispatchPointer(mini, 'pointerup', {
      pointerId: 5,
      pointerType: 'touch',
      clientX: 100,
      clientY: 240,
    })
    dispatchPointer(frame, 'transitionend', { propertyName: 'transform' })

    const play = screen.getByRole('button', { name: 'Play', hidden: true })
    play.click()

    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('does not swallow the first mini-player play click after a downward swipe', () => {
    const onExpandedChange = vi.fn()
    const onPlay = vi.fn()
    renderSurface(onExpandedChange, true, {
      play: onPlay,
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
    })
    const surface = screen.getByRole('region', {
      name: 'Full-screen player',
    })
    const frame = screen.getByTestId('shared-player-frame')
    const mini = screen.getByTestId('mock-mobile-player-bar')

    dispatchPointer(surface, 'pointerdown', {
      pointerId: 6,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(surface, 'pointermove', {
      pointerId: 6,
      pointerType: 'touch',
      clientX: 100,
      clientY: 160,
    })
    dispatchPointer(surface, 'pointerup', {
      pointerId: 6,
      pointerType: 'touch',
      clientX: 100,
      clientY: 160,
    })
    dispatchPointer(frame, 'transitionend', { propertyName: 'transform' })

    screen.getByRole('button', { name: 'Play' }).click()

    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('cancels a partial drag without collapsing', () => {
    const { onExpandedChange } = renderSurface()
    const frame = screen.getByTestId('shared-player-frame')
    const initialFrameTransform = frame.style.transform
    const surface = screen.getByRole('region', { name: 'Full-screen player' })

    dispatchPointer(surface, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    })
    dispatchPointer(surface, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 60,
    })
    dispatchPointer(surface, 'pointercancel', {
      pointerId: 2,
      pointerType: 'touch',
    })

    expect(onExpandedChange).not.toHaveBeenCalled()
    expect(frame.style.transform).toBe(initialFrameTransform)
  })

  it('does not classify short or upward motion as a downward swipe', () => {
    const start = { clientX: 100, clientY: 100 }
    expect(getVerticalSwipeOffset(start, { clientX: 100, clientY: 140 })).toBe(
      40,
    )
    expect(getVerticalSwipeOffset(start, { clientX: 100, clientY: 40 })).toBe(
      -60,
    )
    expect(getVerticalSwipeOffset(start, { clientX: 180, clientY: 150 })).toBe(
      0,
    )
  })

  it('closes the mini player after a downward swipe', () => {
    const onExpandedChange = vi.fn()
    const onClear = vi.fn()
    renderSurface(onExpandedChange, false, undefined, onClear)
    const mini = screen.getByTestId('mock-mobile-player-bar')

    dispatchPointer(mini, 'pointerdown', {
      pointerId: 20,
      pointerType: 'touch',
      clientX: 100,
      clientY: 200,
    })
    dispatchPointer(mini, 'pointermove', {
      pointerId: 20,
      pointerType: 'touch',
      clientX: 100,
      clientY: 260,
    })

    expect(mini.style.transform).toBe('translate3d(0, 60px, 0) scale(1)')
    expect(mini.style.opacity).toBe('1')

    dispatchPointer(mini, 'pointerup', {
      pointerId: 20,
      pointerType: 'touch',
      clientX: 100,
      clientY: 260,
    })

    expect(mini.style.transition).toContain('cubic-bezier')
    expect(mini.style.transform).toContain('calc(100% + 120px')
    expect(mini.style.opacity).toBe('0')
    expect(onClear).not.toHaveBeenCalled()

    dispatchPointer(mini, 'transitionend', { propertyName: 'transform' })

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onExpandedChange).not.toHaveBeenCalled()
  })

  it('resets the mini player without closing when downward drag is below threshold', () => {
    const onClear = vi.fn()
    renderSurface(vi.fn(), false, undefined, onClear)
    const mini = screen.getByTestId('mock-mobile-player-bar')

    dispatchPointer(mini, 'pointerdown', {
      pointerId: 21,
      pointerType: 'touch',
      clientX: 100,
      clientY: 200,
    })
    dispatchPointer(mini, 'pointermove', {
      pointerId: 21,
      pointerType: 'touch',
      clientX: 100,
      clientY: 220,
    })

    expect(mini.style.transform).toBe('translate3d(0, 20px, 0) scale(1)')

    dispatchPointer(mini, 'pointerup', {
      pointerId: 21,
      pointerType: 'touch',
      clientX: 100,
      clientY: 220,
    })

    expect(mini.style.transform).toBe('translate3d(0, 0%, 0) scale(1)')
    expect(mini.style.opacity).toBe('1')
    expect(onClear).not.toHaveBeenCalled()
  })

  it('cancels downward mini player drag on pointercancel without closing', () => {
    const onClear = vi.fn()
    renderSurface(vi.fn(), false, undefined, onClear)
    const mini = screen.getByTestId('mock-mobile-player-bar')

    dispatchPointer(mini, 'pointerdown', {
      pointerId: 22,
      pointerType: 'touch',
      clientX: 100,
      clientY: 200,
    })
    dispatchPointer(mini, 'pointermove', {
      pointerId: 22,
      pointerType: 'touch',
      clientX: 100,
      clientY: 250,
    })
    dispatchPointer(mini, 'pointercancel', {
      pointerId: 22,
      pointerType: 'touch',
    })

    expect(mini.style.transform).toBe('translate3d(0, 0%, 0) scale(1)')
    expect(mini.style.opacity).toBe('1')
    expect(onClear).not.toHaveBeenCalled()
  })
})
