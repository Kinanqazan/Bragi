import React from 'react'
import { Provider, useSelector } from 'react-redux'
import { createStore } from 'redux'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTheme, ThemeProvider } from '@material-ui/core/styles'
import QueueDrawer from './QueueDrawer'
import { MOBILE_BACKGROUND_COLOR } from '../consts'
import { openSaveQueueDialog, currentPlaying, playTracks } from '../actions'
import { playerReducer } from '../reducers/playerReducer'

vi.mock('../common/Artwork', () => ({
  Artwork: ({ record, size, className }) => (
    <div
      className={className}
      data-testid="queue-artwork"
      data-song-id={record.id}
      data-size={size}
    />
  ),
}))

const makeStore = () => createStore((state = {}) => state)
const fireTouch = (target, type, clientY, clientX = 80) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const touch = { identifier: 1, clientX, clientY }
  Object.defineProperties(event, {
    touches: {
      value: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
    },
    changedTouches: { value: [touch] },
  })
  fireEvent(target, event)
  return event
}
const renderQueue = (onClose = vi.fn(), commands = { select: vi.fn() }) => {
  render(
    <Provider store={makeStore()}>
      <QueueDrawer
        queue={[{ trackId: '1', title: 'First song' }]}
        commands={commands}
        onClose={onClose}
      />
    </Provider>,
  )
  const drawer = screen.getByLabelText('Playback queue')
  vi.spyOn(drawer, 'getBoundingClientRect').mockReturnValue({ height: 500 })
  return {
    drawer,
    row: screen.getByRole('button', { name: 'First song' }),
    onClose,
    commands,
  }
}
const renderRemovableQueue = (snapshot = { playing: true }) => {
  let player = playerReducer(
    undefined,
    playTracks(
      {
        a: { id: 'a', title: 'A' },
        b: { id: 'b', title: 'B' },
        c: { id: 'c', title: 'C' },
      },
      undefined,
      'b',
    ),
  )
  player = playerReducer(player, currentPlaying(player.queue[1]))
  const store = createStore(
    (state, action) => ({ player: playerReducer(state.player, action) }),
    { player },
  )
  const commands = { select: vi.fn() }
  const onClose = vi.fn()
  const LiveQueue = () => {
    const state = useSelector((state) => state.player)
    return (
      <QueueDrawer
        queue={state.queue}
        currentIndex={state.playIndex ?? state.savedPlayIndex}
        snapshot={snapshot}
        commands={commands}
        onClose={onClose}
      />
    )
  }
  render(
    <Provider store={store}>
      <LiveQueue />
    </Provider>,
  )
  return {
    store,
    commands,
    onClose,
    drawer: screen.getByLabelText('Playback queue'),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('QueueDrawer', () => {
  it.each([true, false])(
    'preserves playback intent=%s when removing a song during loading',
    (playbackIntent) => {
      const { store } = renderRemovableQueue({
        playing: false,
        loading: true,
        playbackIntent,
      })
      fireEvent.keyDown(
        screen.getByRole('button', { name: 'B', exact: true }),
        { key: 'Delete' },
      )
      expect(store.getState().player.autoPlay).toBe(playbackIntent)
    },
  )

  it('scrolls a long list near its edge while keeping the held row under the finger', () => {
    let nextFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame = callback
      return 1
    })
    const { drawer } = renderRemovableQueue()
    const list = drawer.querySelector('ol')
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 280,
    })
    const rows = Array.from(list.children)
    rows.forEach((row, index) =>
      vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => ({
        top: 100 + index * 60 - list.scrollTop,
        height: 60,
      })),
    )
    const grip = screen.getByRole('button', { name: 'Reorder A' })
    fireTouch(grip, 'touchstart', 130)
    fireTouch(grip, 'touchmove', 265)
    nextFrame()
    expect(list.scrollTop).toBe(8.25)
    expect(rows[0].style.transform).toBe('translate3d(0, 143.25px, 0)')
    fireTouch(grip, 'touchcancel', 265)
    expect(rows[0].style.transform).toBe('')
  })

  it('uses song-page artwork thumbnails and keyboard reorder without selecting a song', () => {
    const { store, commands } = renderRemovableQueue()
    expect(
      screen.getAllByTestId('queue-artwork').map((art) => art.dataset.songId),
    ).toEqual(['a', 'b', 'c'])
    expect(screen.getAllByTestId('queue-artwork')[0]).toHaveAttribute(
      'data-size',
      '84',
    )
    const grip = screen.getByRole('button', { name: 'Reorder B' })
    fireEvent.keyDown(grip, { key: 'ArrowDown' })
    expect(store.getState().player.queue.map((track) => track.trackId)).toEqual(
      ['a', 'c', 'b'],
    )
    expect(store.getState().player.savedPlayIndex).toBe(2)
    fireEvent.keyDown(grip, { key: 'ArrowUp' })
    expect(store.getState().player.queue.map((track) => track.trackId)).toEqual(
      ['a', 'b', 'c'],
    )
    expect(commands.select).not.toHaveBeenCalled()
  })

  it.each(['touchend', 'touchcancel'])(
    'follows a touch reorder handle and commits only on release (%s)',
    (end) => {
      const { store, drawer, commands, onClose } = renderRemovableQueue()
      const list = drawer.querySelector('ol')
      vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 500,
      })
      const rows = Array.from(list.children)
      rows.forEach((row, index) =>
        vi
          .spyOn(row, 'getBoundingClientRect')
          .mockReturnValue({ top: 100 + index * 60, height: 60 }),
      )
      const grip = screen.getByRole('button', { name: 'Reorder A' })
      fireTouch(grip, 'touchstart', 130)
      const move = fireTouch(grip, 'touchmove', 280)
      expect(move.defaultPrevented).toBe(true)
      expect(rows[0].style.transform).toBe('translate3d(0, 150px, 0)')
      expect(drawer.style.transform).toBe('')
      expect(
        store.getState().player.queue.map((track) => track.trackId),
      ).toEqual(['a', 'b', 'c'])
      fireTouch(grip, end, 280)
      expect(
        store.getState().player.queue.map((track) => track.trackId),
      ).toEqual(end === 'touchend' ? ['b', 'c', 'a'] : ['a', 'b', 'c'])
      expect(rows[0].style.transform).toBe('')
      fireEvent.click(screen.getByRole('button', { name: 'B' }), { detail: 1 })
      expect(commands.select).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    },
  )

  it('collapses an expanded drawer before dismissing it', () => {
    const { drawer, row, onClose } = renderQueue()
    fireTouch(row, 'touchstart', 200)
    fireTouch(row, 'touchmove', 100)
    fireTouch(row, 'touchend', 100)
    vi.spyOn(drawer, 'getBoundingClientRect').mockReturnValue({
      height: window.innerHeight - 8,
    })
    fireTouch(row, 'touchstart', 200)
    fireTouch(row, 'touchmove', 300)
    fireTouch(row, 'touchend', 300)
    expect(drawer).not.toHaveClass('is-expanded')
    expect(drawer.style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancels removal when a second finger touches the drawer', () => {
    const { store } = renderRemovableQueue()
    const row = screen.getByRole('button', { name: 'A' })
    fireTouch(row, 'touchstart', 200, 40)
    fireTouch(row, 'touchmove', 200, 180)
    const event = new Event('touchstart', { bubbles: true, cancelable: true })
    Object.defineProperties(event, {
      touches: { value: [{ identifier: 1 }, { identifier: 2 }] },
      changedTouches: { value: [{ identifier: 2, clientX: 80, clientY: 200 }] },
    })
    fireEvent(row, event)
    fireTouch(row, 'touchend', 200, 180)
    expect(store.getState().player.queue).toHaveLength(3)
    expect(row.closest('[data-queue-track]').style.transform).toBe('')
  })

  it('keeps desktop colors and provides a visible close control', () => {
    const onClose = vi.fn()
    render(
      <Provider store={makeStore()}>
        <QueueDrawer mobile={false} onClose={onClose} />
      </Provider>,
    )
    const drawer = screen.getByLabelText('Playback queue')
    expect(drawer).toHaveClass('is-desktop')
    expect(drawer.style.getPropertyValue('--nd-player-surface')).toBe(
      createTheme().palette.background.paper,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close queue' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('tracks a right swipe and removes that row without playing it or moving the drawer', () => {
    const { store, commands, onClose, drawer } = renderRemovableQueue()
    const row = screen.getByRole('button', { name: 'A' })
    fireTouch(row, 'touchstart', 200, 40)
    fireTouch(row, 'touchmove', 205, 180)
    expect(row.closest('[data-queue-track]').style.transform).toBe(
      'translate3d(140px, 0, 0)',
    )
    expect(drawer.style.transform).toBe('')
    expect(store.getState().player.queue).toHaveLength(3)
    fireTouch(row, 'touchend', 205, 180)
    expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument()
    expect(store.getState().player.queue.map((track) => track.trackId)).toEqual(
      ['b', 'c'],
    )
    expect(store.getState().player.savedPlayIndex).toBe(0)
    const nextRow = screen.getByRole('button', { name: 'B' })
    fireEvent.click(nextRow, { detail: 1 })
    expect(commands.select).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    fireTouch(nextRow, 'touchstart', 200, 40)
    fireTouch(nextRow, 'touchend', 200, 40)
    fireEvent.click(nextRow, { detail: 1 })
    expect(commands.select).toHaveBeenCalledWith(0)
  })

  it('keeps songs after a short, leftward, or cancelled horizontal swipe', () => {
    const { store } = renderRemovableQueue()
    const row = screen.getByRole('button', { name: 'A' })
    for (const [deltaX, type] of [
      [35, 'touchend'],
      [-140, 'touchend'],
      [140, 'touchcancel'],
    ]) {
      fireTouch(row, 'touchstart', 200, 160)
      fireTouch(row, 'touchmove', 200, 160 + deltaX)
      fireTouch(row, type, 200, 160 + deltaX)
      expect(store.getState().player.queue).toHaveLength(3)
      expect(row.closest('[data-queue-track]').style.transform).toBe('')
    }
  })

  it('selects a queue item without bubbling into player controls', () => {
    const commands = {
      select: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
    }
    const parentClick = vi.fn()
    const onClear = vi.fn()
    const store = makeStore()
    const dispatch = vi.spyOn(store, 'dispatch')
    const activeTheme = createTheme({
      palette: {
        type: 'light',
        primary: { main: '#6b3fa0' },
        background: { default: '#0d0d0f', paper: '#fffaf2' },
        text: { primary: '#262033', secondary: '#5f566d' },
      },
    })

    render(
      <Provider store={store}>
        <ThemeProvider theme={activeTheme}>
          <div onClick={parentClick}>
            <QueueDrawer
              queue={[{ trackId: 'track-1', title: 'Next song' }]}
              currentIndex={0}
              snapshot={{ playing: false }}
              commands={commands}
              onClear={onClear}
              onClose={vi.fn()}
            />
          </div>
        </ThemeProvider>
      </Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^next song$/i }))

    expect(commands.select).toHaveBeenCalledWith(0)
    expect(commands.play).not.toHaveBeenCalled()
    expect(parentClick).not.toHaveBeenCalled()
    const drawer = screen.getByLabelText('Playback queue')
    const expectedTextColor = document.createElement('span')
    expectedTextColor.style.color = '#f5f5f5'
    expect(drawer.style.color).toBe(expectedTextColor.style.color)
    expect(drawer.style.getPropertyValue('--nd-player-surface')).toBe(
      MOBILE_BACKGROUND_COLOR,
    )
    expect(drawer.style.getPropertyValue('--nd-player-accent')).toBe(
      activeTheme.palette.primary.main,
    )
    expect(screen.getByLabelText('Queue controls')).toBeInTheDocument()
    expect(screen.queryByText('Now playing')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Close queue' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save queue' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save queue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear queue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(dispatch).toHaveBeenCalledWith(openSaveQueueDialog())
    expect(onClear).toHaveBeenCalledOnce()
    expect(commands.play).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('follows a downward touch from a song row and animates closed only after release', () => {
    vi.useFakeTimers()
    const { drawer, row, onClose, commands } = renderQueue()
    fireTouch(row, 'touchstart', 100)
    const move = fireTouch(row, 'touchmove', 220)
    expect(move.defaultPrevented).toBe(true)
    expect(drawer.style.animation).toBe('none')
    expect(drawer.style.transform).toBe('translate3d(0, 120px, 0)')
    expect(onClose).not.toHaveBeenCalled()
    fireTouch(row, 'touchend', 220)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(row, { detail: 1 })
    expect(commands.select).not.toHaveBeenCalled()
    vi.advanceTimersByTime(260)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('tracks an upward touch from the list and expands the sheet', () => {
    const { drawer, row } = renderQueue()
    fireTouch(row, 'touchstart', 200)
    fireTouch(row, 'touchmove', 100)
    expect(drawer.style.height).toBe('600px')
    expect(drawer.style.transform).toBe('translate3d(0, 0, 0)')
    fireTouch(row, 'touchend', 100)
    expect(drawer).toHaveClass('is-expanded')
  })

  it('preserves native list scrolling while there are earlier songs above the finger', () => {
    const { drawer, row, onClose } = renderQueue()
    drawer.querySelector('ol').scrollTop = 150
    fireTouch(row, 'touchstart', 100)
    const move = fireTouch(row, 'touchmove', 220)
    expect(move.defaultPrevented).toBe(false)
    expect(drawer.style.transform).toBe('')
    fireTouch(row, 'touchend', 220)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores the sheet on touch cancellation and permits the next song tap', () => {
    const { drawer, row, onClose, commands } = renderQueue()
    fireTouch(row, 'touchstart', 100)
    fireTouch(row, 'touchmove', 220)
    fireTouch(row, 'touchcancel', 220)
    expect(drawer.style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()
    fireTouch(row, 'touchstart', 100)
    fireTouch(row, 'touchend', 100)
    fireEvent.click(row)
    expect(commands.select).toHaveBeenCalledWith(0)
  })
})
