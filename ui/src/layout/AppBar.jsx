import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toggleSidebar, changeListParams, useTranslate } from 'react-admin'
import { MdClose } from 'react-icons/md'
import MenuIcon from '@material-ui/icons/Menu'
import SearchIcon from '@material-ui/icons/Search'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import BragiLogo from '../icons/BragiLogo'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useLocation } from 'react-router-dom'
import {
  makeStyles,
  useMediaQuery,
  IconButton,
  InputBase,
  ClickAwayListener,
  Typography,
  AppBar as MuiAppBar,
} from '@material-ui/core'
import { alpha } from '@material-ui/core/styles'
import { Dialogs } from '../dialogs/Dialogs'
import CastButton from '../cast/CastButton'
import { MOBILE_BACKGROUND_COLOR } from '../consts'
import { getStoredPerPage } from '../common/perPageStore'
import { createSongListResetAction } from '../song/songListNavigation'

const useStyles = makeStyles(
  (theme) => {
    const isDark = theme.palette.type === 'dark'
    return {
      appBar: {
        paddingTop: 'env(safe-area-inset-top)',
        backgroundColor: `${theme.palette.background.default} !important`,
        color: `${theme.palette.text.primary} !important`,
        boxShadow: 'none !important',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)} !important`,
        position: 'fixed !important',
        top: 0,
        left: 0,
        right: 0,
        zIndex: `${theme.zIndex.drawer + 1} !important`,
        '& .MuiToolbar-root': {
          backgroundColor: `${theme.palette.background.default} !important`,
          color: `${theme.palette.text.primary} !important`,
          paddingRight: `${theme.spacing(1)}px !important`,
          paddingLeft: `${theme.spacing(1)}px !important`,
          minHeight: '48px !important',
          height: '48px !important',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflow: 'hidden',
          '& #react-admin-title': {
            minWidth: 0,
            flex: '1 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '1.05rem',
            fontWeight: 600,
          },
        },
        '& .RaLoadingIndicator-loadedIcon, & [class*="RaLoadingIndicator"], & .RaLoadingIndicator-loader':
          {
            flexShrink: '0 !important',
            display: 'inline-flex !important',
            visibility: 'visible !important',
            color: 'inherit',
          },
        '& .RaUserMenu-user, & [class*="UserMenu"], & [class*="RaUserMenu"]': {
          flexShrink: '0 !important',
          display: 'inline-flex !important',
          visibility: 'visible !important',
          color: 'inherit',
        },
      },
      // The fade and controls share this fixed layer so controls paint above it.
      mobileAppBar: {
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        paddingLeft: '16px',
        paddingRight: '16px',
        background: 'transparent !important',
        backgroundColor: 'transparent !important',
        color: `${theme.palette.text.primary} !important`,
        boxShadow: 'none !important',
        border: 'none !important',
        borderBottom: 'none !important',
        position: 'fixed !important',
        top: 0,
        left: 0,
        right: 0,
        zIndex: `${theme.zIndex.modal - 2} !important`,
        width: '100vw',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'fixed',
          zIndex: 0,
          top: 0,
          right: 0,
          left: 0,
          height: 'calc(env(safe-area-inset-top, 0px) + 112px)',
          pointerEvents: 'none',
          background: `linear-gradient(
            to bottom,
            #000 0,
            rgba(0, 0, 0, 0.93) calc(env(safe-area-inset-top, 0px) + 8px),
            rgba(0, 0, 0, 0.67) calc(env(safe-area-inset-top, 0px) + 32px),
            rgba(0, 0, 0, 0.28) calc(env(safe-area-inset-top, 0px) + 64px),
            transparent 100%
          )`,
        },
      },
      mobileBackBar: {
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 8,
        paddingLeft: 8,
        paddingRight: 16,
        backgroundColor: `${MOBILE_BACKGROUND_COLOR} !important`,
        color: `${theme.palette.text.primary} !important`,
        boxSizing: 'border-box',
      },
      mobileBackRow: {
        display: 'flex',
        alignItems: 'center',
        minHeight: 48,
        gap: 8,
      },
      mobileBackTitle: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '1.05rem',
        fontWeight: 600,
      },
      topRow: {
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: 56,
        minHeight: 56,
        boxSizing: 'border-box',
        willChange: 'opacity, transform',
      },
      rightGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      },
      leftGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      },
      mobileBrandLogo: {
        width: 32,
        height: 32,
        flexShrink: 0,
        color: theme.brandColor || theme.palette.primary.main,
        filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25))',
      },
      menuBrandPill: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 48,
        padding: '0 10px 0 4px',
        borderRadius: 24,
        backgroundColor: '#242424',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.22)',
        boxSizing: 'border-box',
        flexShrink: 0,
      },
      floatingActionButton: {
        width: 64,
        height: 48,
        padding: 0,
        borderRadius: 24,
        color: '#f5f5f5',
        backgroundColor: '#242424',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.22)',
        '&:hover': {
          backgroundColor: '#323232',
        },
      },
      headerIconButton: {
        padding: 8,
        color: theme.palette.text.primary,
        flexShrink: 0,
        '&:hover': {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.06)',
        },
      },
      // Expanded Search Input Row
      expandedSearchRow: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        height: 46,
        borderRadius: 23,
        backgroundColor: '#242424',
        padding: '0 4px',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        '& .MuiIconButton-root': {
          color: '#f5f5f5',
        },
      },
      expandedSearchInput: {
        flex: 1,
        minWidth: 0,
        marginLeft: 8,
        marginRight: 8,
        fontSize: '1rem',
        color: '#f5f5f5',
        '& input': {
          padding: '8px 0',
          color: '#f5f5f5 !important',
          '&::placeholder': {
            color: 'rgba(245, 245, 245, 0.68)',
            opacity: 0.85,
          },
        },
      },
      root: {
        color: theme.palette.text.secondary,
      },
      active: {
        color: theme.palette.text.primary,
      },
      icon: { minWidth: theme.spacing(5) },
    }
  },
  {
    name: 'NDAppBar',
  },
)

// Track vertical page-scroll movement in the direction the controls reveal.
const useScrollRevealProgress = (headerRef, enabled = true, resetKey = '') => {
  const [offset, setOffset] = useState(null)
  const offsetRef = useRef(0)
  const lastScrollY = useRef(0)
  const lastScrollTarget = useRef(null)

  // The layout persists across routes; reset the motion baseline on navigation.
  useEffect(() => {
    const maxOffset = headerRef.current?.getBoundingClientRect().height || 82
    offsetRef.current = maxOffset
    setOffset(maxOffset)
    lastScrollY.current = 0
    lastScrollTarget.current = null
  }, [headerRef, resetKey])

  useEffect(() => {
    if (!enabled) {
      const maxOffset = headerRef.current?.getBoundingClientRect().height || 82
      offsetRef.current = maxOffset
      setOffset(maxOffset)
      return
    }

    const handleScroll = (event) => {
      const target = event.target
      const currentScrollY =
        target === document || target === window
          ? window.scrollY || document.documentElement.scrollTop
          : target.scrollTop !== undefined
            ? target.scrollTop
            : window.scrollY

      if (currentScrollY === undefined) return

      const isRootScroller = target === document || target === window
      if (
        !isRootScroller &&
        !/auto|scroll/.test(window.getComputedStyle(target).overflowY)
      ) {
        return
      }

      // Don't apply another scroll container's position as a sudden movement.
      if (target !== lastScrollTarget.current) {
        const hasPreviousTarget = lastScrollTarget.current !== null
        lastScrollTarget.current = target
        lastScrollY.current = hasPreviousTarget ? currentScrollY : 0
        if (hasPreviousTarget && currentScrollY > 0) return
      }

      const diff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY
      const maxOffset = headerRef.current?.getBoundingClientRect().height || 82
      // Reveal controls as content moves down (scrollTop decreases), and
      // retract them as content moves up (scrollTop increases).
      const nextOffset = Math.max(
        0,
        Math.min(maxOffset, offsetRef.current - diff),
      )

      // Keep controls fully revealed at the top, including during overscroll.
      offsetRef.current = currentScrollY <= 0 ? maxOffset : nextOffset
      setOffset(offsetRef.current)
    }

    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [enabled, headerRef])

  return offset
}

const MobileTopBar = () => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const headerRef = useRef(null)
  const listParams = useSelector(
    (state) => state.admin?.resources?.song?.list?.params,
  )

  const [searchQuery, setSearchQuery] = useState(() => {
    const searchParams = new URLSearchParams(location.search)
    const filterParam = searchParams.get('filter')
    if (filterParam) {
      try {
        const parsed = JSON.parse(filterParam)
        return parsed.title || ''
      } catch {
        return ''
      }
    }
    return ''
  })

  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(searchQuery))
  const debounceTimerRef = useRef(null)
  const headerOffset = useScrollRevealProgress(
    headerRef,
    !isSearchOpen,
    location.key || `${location.pathname}${location.search}${location.hash}`,
  )
  const headerHeight = headerRef.current?.getBoundingClientRect().height || 82
  const controlsProgress =
    isSearchOpen || headerOffset === null
      ? 1
      : Math.max(0, Math.min(1, headerOffset / headerHeight))

  // Keep the scroll content below the safe area and floating control row.
  useEffect(() => {
    const topOffset = 'calc(env(safe-area-inset-top, 0px) + 92px)'
    const rootStyle = document.documentElement.style
    const previousOffset = rootStyle.getPropertyValue('--nd-mobile-top-offset')
    const previousPriority = rootStyle.getPropertyPriority(
      '--nd-mobile-top-offset',
    )
    rootStyle.setProperty('--nd-mobile-top-offset', topOffset)
    return () => {
      if (previousOffset) {
        rootStyle.setProperty(
          '--nd-mobile-top-offset',
          previousOffset,
          previousPriority,
        )
      } else {
        rootStyle.removeProperty('--nd-mobile-top-offset')
      }
    }
  }, [])

  const handleMenuClick = useCallback(() => {
    dispatch(toggleSidebar())
  }, [dispatch])

  // Update filter in URL and Redux state
  const applySearchFilter = useCallback(
    (query) => {
      const trimmed = query.trim()
      let currentFilters = {}
      const searchParams = new URLSearchParams(history.location.search)
      const filterParam = searchParams.get('filter')
      if (filterParam) {
        try {
          currentFilters = JSON.parse(filterParam)
        } catch {
          currentFilters = {}
        }
      }

      const newFilters = { ...currentFilters }
      if (trimmed) {
        newFilters.title = trimmed
      } else {
        delete newFilters.title
      }

      const targetPath = history.location.pathname.startsWith('/song')
        ? history.location.pathname
        : '/song'

      const nextSearchParams = new URLSearchParams(history.location.search)
      if (Object.keys(newFilters).length > 0) {
        nextSearchParams.set('filter', JSON.stringify(newFilters))
      } else {
        nextSearchParams.delete('filter')
      }

      // Keep mobile search URLs consistent with the desktop list state. The
      // base song route uses these defaults even when they are omitted from
      // the URL, but retaining them makes shared/search URLs deterministic.
      if (trimmed && targetPath === '/song') {
        nextSearchParams.set('displayedFilters', '{}')
        nextSearchParams.set('order', listParams?.order || 'ASC')
        nextSearchParams.set('page', '1')
        nextSearchParams.set(
          'perPage',
          String(listParams?.perPage || getStoredPerPage()),
        )
        nextSearchParams.set('sort', listParams?.sort || 'random')
      }

      const queryString = nextSearchParams.toString()

      history.replace(`${targetPath}${queryString ? `?${queryString}` : ''}`)

      dispatch(
        changeListParams('song', {
          sort: listParams?.sort || 'random',
          order: listParams?.order || 'ASC',
          page: 1,
          perPage: listParams?.perPage || getStoredPerPage(),
          filter: newFilters,
        }),
      )
    },
    [history, dispatch, listParams],
  )

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const trimmed = value.trim()
    if (trimmed === '') {
      applySearchFilter('')
    } else {
      const delay = trimmed.length === 1 ? 400 : 300
      debounceTimerRef.current = setTimeout(() => {
        applySearchFilter(value)
      }, delay)
    }
  }

  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setSearchQuery('')
    applySearchFilter('')
  }

  const handleCloseSearch = () => {
    setIsSearchOpen(false)
    if (!searchQuery) {
      applySearchFilter('')
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Sync searchQuery with location search if modified externally
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const filterParam = searchParams.get('filter')
    if (filterParam) {
      try {
        const parsed = JSON.parse(filterParam)
        const nextQuery =
          parsed && typeof parsed.title === 'string' ? parsed.title : ''
        setSearchQuery(nextQuery)
        if (nextQuery) {
          setIsSearchOpen(true)
        }
      } catch {
        // Ignore malformed filter state
      }
    } else {
      setSearchQuery('')
    }
  }, [location.pathname, location.search])

  return (
    <MuiAppBar
      position="fixed"
      ref={headerRef}
      className={classes.mobileAppBar}
      style={{
        pointerEvents: 'none',
      }}
    >
      {/* Hidden React-Admin Title Portal anchor */}
      <span id="react-admin-title" style={{ display: 'none' }} />

      {/* Row 1: YouTube Music Style Top Bar */}
      <div
        className={classes.topRow}
        style={{
          opacity: controlsProgress,
          transform: `translateY(${(controlsProgress - 1) * 24}px)`,
          visibility: controlsProgress > 0 ? 'visible' : 'hidden',
          pointerEvents: controlsProgress > 0 ? 'auto' : 'none',
        }}
      >
        {isSearchOpen ? (
          <ClickAwayListener onClickAway={handleCloseSearch}>
            <div className={classes.expandedSearchRow}>
              <IconButton
                className={classes.headerIconButton}
                onClick={handleCloseSearch}
                aria-label="Close search"
              >
                <ArrowBackIcon style={{ fontSize: 24 }} />
              </IconButton>

              <InputBase
                autoFocus
                className={classes.expandedSearchInput}
                placeholder="Search your music"
                value={searchQuery}
                onChange={handleSearchChange}
                inputProps={{ 'aria-label': 'Search your music' }}
              />

              {searchQuery ? (
                <IconButton
                  className={classes.headerIconButton}
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  <MdClose size={22} />
                </IconButton>
              ) : null}

              <CastButton
                className={classes.headerIconButton}
                size={27}
                tabIndex={-1}
              />
            </div>
          </ClickAwayListener>
        ) : (
          <>
            <div className={classes.leftGroup}>
              <div className={classes.menuBrandPill}>
                <IconButton
                  className={classes.headerIconButton}
                  onClick={handleMenuClick}
                  aria-label="Open menu"
                  title="Open menu"
                >
                  <MenuIcon style={{ fontSize: 28 }} />
                </IconButton>
                <BragiLogo className={classes.mobileBrandLogo} />
              </div>
            </div>

            {/* Right: Search Icon + Cast Button */}
            <div className={classes.rightGroup}>
              <IconButton
                className={classes.floatingActionButton}
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search your music"
                title="Search your music"
              >
                <SearchIcon style={{ fontSize: 27 }} />
              </IconButton>

              <CastButton
                className={classes.floatingActionButton}
                size={27}
                tabIndex={-1}
              />
            </div>
          </>
        )}
      </div>

      <Dialogs />
    </MuiAppBar>
  )
}

const MobileBackTopBar = ({ title }) => {
  const classes = useStyles()
  const history = useHistory()
  const dispatch = useDispatch()

  const handleBackToSongs = () => {
    dispatch(createSongListResetAction())
    history.replace('/song')
  }

  return (
    <div className={classes.mobileBackBar}>
      <div className={classes.mobileBackRow}>
        <IconButton
          className={classes.headerIconButton}
          onClick={handleBackToSongs}
          aria-label="Back to Songs"
          title="Back to Songs"
        >
          <ArrowBackIcon style={{ fontSize: 24 }} />
        </IconButton>
        <Typography className={classes.mobileBackTitle}>{title}</Typography>
      </div>
      <Dialogs />
    </div>
  )
}

const NO_SEARCH_BAR_PREFIXES = ['/personal', '/user', '/library', '/about']

const shouldHideSearchBar = (pathname) => {
  return NO_SEARCH_BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

const AppBar = (props) => {
  const location = useLocation()
  const translate = useTranslate()
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'))

  if (isMobile) {
    if (
      ['/personal', '/library', '/about'].some((path) =>
        location.pathname.startsWith(path),
      )
    ) {
      const title = location.pathname.startsWith('/personal')
        ? translate('menu.personal.name', { _: 'Personal Settings' })
        : location.pathname.startsWith('/library')
          ? translate('menu.library', { _: 'Library' })
          : translate('menu.about', { _: 'About' })

      return <MobileBackTopBar title={title} />
    }

    if (shouldHideSearchBar(location.pathname)) {
      return (
        <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
          <Dialogs />
        </div>
      )
    }
    return <MobileTopBar />
  }

  // Desktop mode: No top header bar. Consolidate all controls into the sidebar.
  return (
    <>
      <span id="react-admin-title" style={{ display: 'none' }} />
      <Dialogs />
    </>
  )
}

export default AppBar
