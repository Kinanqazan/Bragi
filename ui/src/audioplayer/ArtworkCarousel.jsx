import React, { useEffect, useMemo, useRef, useState } from 'react'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import { isLoopingPlayMode } from './carouselPolicy'
import { useTheme } from '@material-ui/core/styles'
import { useImageUrl } from '../common/useImageUrl'

const CarouselSlideImage = ({ cover, title }) => {
  const { imgUrl } = useImageUrl(cover)
  return (
    <img
      src={imgUrl || cover}
      alt={title || ''}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      draggable={false}
    />
  )
}

export const ArtworkCarousel = ({
  queue = [],
  playIndex = 0,
  currentTrack,
  playMode = 'all',
  commands,
}) => {
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const animationTimeoutRef = useRef(null)
  const theme = useTheme()
  const rootRef = useRef(null)
  const offsetRef = useRef(0)
  const frameRef = useRef(null)
  const drag = useRef({ startX: 0, startY: 0, active: false, x: 0, isH: null })

  const setOffsetWithFrame = (value) => {
    offsetRef.current = value
    if (frameRef.current != null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      rootRef.current?.style.setProperty(
        '--nd-carousel-offset',
        `${offsetRef.current}px`,
      )
    })
  }

  const commitOffset = (value) => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    offsetRef.current = value
    rootRef.current?.style.setProperty('--nd-carousel-offset', `${value}px`)
    setOffset(value)
  }

  const idx = useMemo(() => {
    if (!queue.length) return 0
    const boundedPlayIndex = Math.max(
      0,
      Math.min(Number.isInteger(playIndex) ? playIndex : 0, queue.length - 1),
    )
    const currentAtPlayIndex = queue[boundedPlayIndex]
    if (
      !currentTrack ||
      (currentTrack.uuid && currentAtPlayIndex?.uuid === currentTrack.uuid) ||
      (currentTrack.trackId &&
        currentAtPlayIndex?.trackId === currentTrack.trackId) ||
      (currentTrack.id &&
        (currentAtPlayIndex?.id === currentTrack.id ||
          currentAtPlayIndex?.trackId === currentTrack.id))
    ) {
      return boundedPlayIndex
    }

    const i = queue.findIndex(
      (t) =>
        (currentTrack?.uuid && t.uuid === currentTrack.uuid) ||
        (currentTrack?.trackId && t.trackId === currentTrack.trackId) ||
        (currentTrack?.id &&
          (t.id === currentTrack.id || t.trackId === currentTrack.id)),
    )
    return i !== -1 ? i : boundedPlayIndex
  }, [queue, currentTrack, playIndex])

  const loop = isLoopingPlayMode(playMode)
  const prev =
    idx > 0
      ? queue[idx - 1]
      : loop && queue.length > 1
        ? queue[queue.length - 1]
        : null
  const next =
    idx < queue.length - 1
      ? queue[idx + 1]
      : loop && queue.length > 1
        ? queue[0]
        : null
  const current = queue[idx] || currentTrack

  useEffect(() => {
    commitOffset(0)
    offsetRef.current = 0
    setAnimating(false)
    if (animationTimeoutRef.current != null) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }
  }, [idx, currentTrack?.uuid, currentTrack?.trackId, currentTrack?.id])

  useEffect(() => {
    rootRef.current?.style.setProperty('--nd-carousel-offset', `${offset}px`)
  }, [offset])

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      if (animationTimeoutRef.current != null) {
        clearTimeout(animationTimeoutRef.current)
      }
    },
    [],
  )

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      active: true,
      x: 0,
      isH: null,
    }
    setAnimating(false)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (d.isH === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      d.isH = Math.abs(dx) > Math.abs(dy)
    }
    if (!d.isH) return
    d.x = (dx > 0 && !prev) || (dx < 0 && !next) ? dx * 0.25 : dx
    setOffsetWithFrame(d.x)
  }

  const onPointerUp = () => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    if (!d.isH) return commitOffset(0)

    const width = rootRef.current?.offsetWidth || 350

    if (animating) return
    const nextAction = commands?.next
    const previousAction = commands?.previous
    if (d.x < -45 && next && nextAction) {
      setAnimating(true)
      commitOffset(-width)
      animationTimeoutRef.current = setTimeout(() => {
        animationTimeoutRef.current = null
        nextAction()
      }, 190)
    } else if (d.x > 45 && prev && previousAction) {
      setAnimating(true)
      commitOffset(width)
      animationTimeoutRef.current = setTimeout(() => {
        animationTimeoutRef.current = null
        previousAction()
      }, 190)
    } else {
      setAnimating(true)
      commitOffset(0)
    }
  }

  const slides = [
    { item: prev, pos: -1 },
    { item: current, pos: 0 },
    { item: next, pos: 1 },
  ].filter((s) => s.item)

  return (
    <div
      ref={rootRef}
      className="nd-artwork-carousel"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        borderRadius: 'inherit',
        touchAction: 'pan-y',
        cursor: 'grab',
        zIndex: 2,
        userSelect: 'none',
        '--nd-carousel-offset': `${offset}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {slides.map(({ item, pos }) => (
        <div
          key={`${pos}-${item?.uuid || item?.trackId || item?.id || 'empty'}`}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            overflow: 'hidden',
            backgroundColor: theme.palette.background.default,
            pointerEvents: 'none',
            transition: animating
              ? 'transform 220ms cubic-bezier(0.2, 0.85, 0.3, 1)'
              : 'none',
            transform: `translate3d(calc(${pos * 100}% + var(--nd-carousel-offset)), 0, 0)`,
          }}
        >
          {item?.cover ? (
            <CarouselSlideImage
              cover={item.cover}
              title={item?.title || ''}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.palette.action.hover,
                color: theme.palette.text.disabled,
              }}
            >
              <MusicNoteIcon style={{ fontSize: 56 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default ArtworkCarousel
