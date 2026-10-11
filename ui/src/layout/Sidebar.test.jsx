import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@material-ui/core/styles'
import { useMediaQuery } from '@material-ui/core'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { setSidebarVisibility } from 'react-admin'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  useMediaQuery: vi.fn(() => true),
}))

vi.mock('react-admin', async () => ({
  ...(await vi.importActual('react-admin')),
  Sidebar: ({ children }) => (
    <aside data-testid="desktop-sidebar">{children}</aside>
  ),
}))

const Menu = ({ sidebarOpen }) => (
  <div>{sidebarOpen ? 'Expanded menu' : 'Collapsed menu'}</div>
)

const renderSidebar = (open = false) => {
  const store = createStore(
    (state = { admin: { ui: { sidebarOpen: open } } }, action) =>
      action.type === setSidebarVisibility(true).type
        ? { admin: { ui: { sidebarOpen: action.payload } } }
        : state,
  )
  const onClick = vi.fn()
  const view = render(
    <Provider store={store}>
      <ThemeProvider
        theme={createTheme({
          sidebar: { width: 240 },
          zIndex: { modal: 1500 },
        })}
      >
        <button onClick={onClick}>App control</button>
        <input aria-label="Search" />
        <div role="slider" aria-label="Seek" />
        <div className="nd-artwork-carousel">Artwork</div>
        <Sidebar>
          <Menu />
        </Sidebar>
      </ThemeProvider>
    </Provider>,
  )
  const paper = document.querySelector('[aria-label="Navigation"]')
  if (paper) {
    vi.spyOn(paper, 'getBoundingClientRect').mockReturnValue({ width: 240 })
  }
  return {
    ...view,
    store,
    paper,
    control: view.getByText('App control'),
    onClick,
  }
}

const pointer = (element, type, x, y = 300, extras = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries({
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: y,
        ...extras,
      }).map(([key, value]) => [key, { value }]),
    ),
  )
  act(() => {
    element.dispatchEvent(event)
  })
  return event
}

const tick = (ms = 20) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const isOpen = (store) => store.getState().admin.ui.sidebarOpen

describe('Sidebar swipes', () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(true)
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      setTimeout(callback, 16),
    )
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(clearTimeout)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('tracks partial movement from the middle of the app without committing Redux', () => {
    const { control, paper, store } = renderSidebar()
    pointer(control, 'pointerdown', 180)
    tick()
    pointer(control, 'pointermove', 240)
    tick()
    expect(paper.style.transform).toBe('translate3d(-75%, 0, 0)')
    expect(paper.style.transition).toBe('none')
    expect(isOpen(store)).toBe(false)
    expect(screen.getByText('Expanded menu')).toBeVisible()
    pointer(document, 'pointermove', 300)
    tick()
    expect(paper.style.transform).toBe('translate3d(-50%, 0, 0)')
    pointer(document, 'pointermove', 210)
    tick()
    expect(paper.style.transform).toBe('translate3d(-87.5%, 0, 0)')
  })

  it('snaps a small held swipe shut and leaves the app usable', () => {
    const { control, paper, store, onClick } = renderSidebar()
    pointer(control, 'pointerdown', 180)
    tick()
    pointer(control, 'pointermove', 240)
    tick(150)
    pointer(document, 'pointerup', 240)
    expect(paper.style.transform).toBe('translate3d(-100%, 0, 0)')
    expect(paper.style.transition).toContain('cubic-bezier')
    expect(isOpen(store)).toBe(false)
    // Suppress the synthetic click caused by this swipe, but accept a fresh tap.
    fireEvent.click(control, { detail: 1 })
    expect(onClick).not.toHaveBeenCalled()
    pointer(control, 'pointerdown', 240)
    pointer(control, 'pointerup', 240)
    fireEvent.click(control, { detail: 1 })
    expect(onClick).toHaveBeenCalledOnce()
    tick(300)
    expect(paper).not.toBeVisible()
  })

  it('opens beyond halfway even after the finger pauses', () => {
    const { control, paper, store } = renderSidebar()
    pointer(control, 'pointerdown', 100)
    tick(300)
    pointer(control, 'pointermove', 250)
    tick(150)
    pointer(document, 'pointerup', 250)
    expect(isOpen(store)).toBe(true)
    expect(paper.style.transform).toBe('translate3d(0%, 0, 0)')
  })

  it('opens with a short fast flick', () => {
    const { control, store } = renderSidebar()
    pointer(control, 'pointerdown', 200)
    tick(20)
    pointer(control, 'pointermove', 235)
    pointer(document, 'pointerup', 235)
    expect(isOpen(store)).toBe(true)
  })

  it('reverses immediately after dragging past the fully open edge', () => {
    const { control, paper } = renderSidebar()
    pointer(control, 'pointerdown', 20)
    pointer(control, 'pointermove', 370)
    tick()
    expect(paper.style.transform).toBe('translate3d(0%, 0, 0)')
    pointer(document, 'pointermove', 310)
    tick()
    expect(paper.style.transform).toBe('translate3d(-25%, 0, 0)')
  })

  it('continues an interrupted snap from the visible position', () => {
    const { control, paper, store } = renderSidebar(true)
    act(() => {
      store.dispatch(setSidebarVisibility(false))
    })
    // A real browser returns the interpolated transform during its CSS snap.
    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      element === paper
        ? { transform: 'matrix(1, 0, 0, 1, -120, 0)' }
        : getComputedStyle(element),
    )
    pointer(paper, 'pointerdown', 80)
    pointer(paper, 'pointermove', 104)
    tick()
    expect(paper.style.transform).toBe('translate3d(-40%, 0, 0)')
    pointer(document, 'pointercancel', 104)
    expect(isOpen(store)).toBe(false)
  })

  it('closes from the backdrop as soon as the finger moves left', () => {
    const { paper, store } = renderSidebar(true)
    const backdrop = document.querySelector('.MuiBackdrop-root')
    pointer(backdrop, 'pointerdown', 370)
    tick(300)
    pointer(backdrop, 'pointermove', 310)
    tick()
    expect(paper.style.transform).toBe('translate3d(-25%, 0, 0)')
    pointer(backdrop, 'pointermove', 190)
    tick(150)
    pointer(document, 'pointerup', 190)
    expect(isOpen(store)).toBe(false)
    expect(paper).toBeVisible()
    tick(300)
    expect(paper).not.toBeVisible()
  })

  it('cancels a swipe back to its original state', () => {
    const { control, paper, store } = renderSidebar()
    pointer(control, 'pointerdown', 100)
    pointer(control, 'pointermove', 280)
    tick()
    pointer(document, 'pointercancel', 280)
    expect(isOpen(store)).toBe(false)
    expect(paper.style.transform).toBe('translate3d(-100%, 0, 0)')
    tick(300)
    expect(paper).not.toBeVisible()
  })

  it('leaves vertical scrolling and ordinary taps alone', () => {
    const { control, paper, store, onClick } = renderSidebar()
    pointer(control, 'pointerdown', 200)
    expect(pointer(control, 'pointermove', 205, 380).defaultPrevented).toBe(
      false,
    )
    pointer(control, 'pointermove', 350, 390)
    pointer(control, 'pointerup', 350, 390)
    expect(isOpen(store)).toBe(false)
    expect(paper).not.toBeVisible()
    pointer(control, 'pointerdown', 200)
    pointer(control, 'pointermove', 203)
    pointer(control, 'pointerup', 203)
    fireEvent.click(control, { detail: 1 })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it.each(['Search', 'Seek', 'Artwork'])(
    'preserves the %s interaction',
    (label) => {
      const { paper, store } = renderSidebar()
      const target =
        label === 'Artwork'
          ? screen.getByText(label)
          : screen.getByLabelText(label)
      pointer(target, 'pointerdown', 100)
      expect(pointer(target, 'pointermove', 280).defaultPrevented).toBe(false)
      pointer(target, 'pointerup', 280)
      expect(isOpen(store)).toBe(false)
      expect(paper).not.toBeVisible()
    },
  )

  it('honors button opening, Escape, and outside taps with an animated close', () => {
    const { store, paper } = renderSidebar()
    act(() => {
      store.dispatch(setSidebarVisibility(true))
    })
    expect(paper).toBeVisible()
    expect(paper.style.transition).toContain('transform')
    tick(300)
    fireEvent.keyDown(paper, { key: 'Escape' })
    expect(isOpen(store)).toBe(false)
    tick(300)
    expect(paper).not.toBeVisible()
    act(() => {
      store.dispatch(setSidebarVisibility(true))
    })
    tick(300)
    fireEvent.click(document.querySelector('.MuiBackdrop-root'))
    expect(isOpen(store)).toBe(false)
  })

  it('ignores other pointers and unwinds a second touch', () => {
    const { control, paper, store } = renderSidebar()
    pointer(control, 'pointerdown', 100)
    pointer(control, 'pointermove', 250, 300, { pointerId: 2 })
    expect(paper).not.toBeVisible()
    pointer(control, 'pointermove', 250)
    tick()
    pointer(control, 'pointerdown', 250, 300, {
      pointerId: 2,
      isPrimary: false,
    })
    pointer(document, 'pointerup', 250)
    expect(isOpen(store)).toBe(false)
    expect(paper.style.transform).toBe('translate3d(-100%, 0, 0)')
  })

  it('leaves horizontal scroll containers in control of their swipe', () => {
    const { control, paper } = renderSidebar()
    control.parentElement.style.overflowX = 'auto'
    Object.defineProperties(control.parentElement, {
      scrollWidth: { value: 500 },
      clientWidth: { value: 390 },
    })
    pointer(control, 'pointerdown', 100)
    expect(pointer(control, 'pointermove', 280).defaultPrevented).toBe(false)
    pointer(control, 'pointerup', 280)
    expect(paper).not.toBeVisible()
  })

  it('respects reduced motion and removes gesture listeners when unmounted', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    const { control, paper, store, unmount } = renderSidebar()
    act(() => {
      store.dispatch(setSidebarVisibility(true))
    })
    expect(paper.style.transition).toContain('0ms')
    act(() => {
      store.dispatch(setSidebarVisibility(false))
    })
    tick(0)
    expect(paper).not.toBeVisible()
    unmount()
    expect(pointer(control, 'pointermove', 280).defaultPrevented).toBe(false)
    vi.unstubAllGlobals()
  })

  it('keeps the desktop sidebar and its normal controls', () => {
    useMediaQuery.mockReturnValue(false)
    const { control, store } = renderSidebar()
    expect(screen.getByTestId('desktop-sidebar')).toBeVisible()
    pointer(control, 'pointerdown', 100)
    pointer(control, 'pointermove', 280)
    pointer(control, 'pointerup', 280)
    expect(isOpen(store)).toBe(false)
    expect(document.querySelector('[aria-label="Navigation"]')).toBeNull()
  })
})
