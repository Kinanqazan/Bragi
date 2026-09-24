import React, { useState, useEffect, useRef, useCallback } from 'react'
import clsx from 'clsx'
import { toggleSidebar, changeListParams } from 'react-admin'
import { MdClose } from 'react-icons/md'
import MenuIcon from '@material-ui/icons/Menu'
import SearchIcon from '@material-ui/icons/Search'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
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
import BragiLogo from '../icons/BragiLogo'
import { MOBILE_BACKGROUND_COLOR } from '../consts'
import { getStoredPerPage } from '../common/perPageStore'

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
      // Fixed YouTube Music Style Collapsible Mobile Header
      mobileAppBar: {
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: '8px',
        paddingLeft: '14px',
        paddingRight: '14px',
        background: `${MOBILE_BACKGROUND_COLOR} !important`,
        color: `${theme.palette.text.primary} !important`,
        boxShadow: 'none !important',
        border: 'none !important',
        borderBottom: 'none !important',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'fixed !important',
        top: 0,
        left: 0,
        right: 0,
        zIndex: `${theme.zIndex.drawer + 1} !important`,
        width: '100vw',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        transition:
          'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateY(0)',
        opacity: 1,
      },
      mobileAppBarHidden: {
        transform: 'translateY(-100%) !important',
        opacity: 0,
        pointerEvents: 'none !important',
      },
      topRow: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: 48,
        minHeight: 48,
        boxSizing: 'border-box',
      },
      leftGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      },
      brandContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      },
      brandLogo: {
        width: 28,
        height: 28,
        color: theme.palette.primary.main,
        flexShrink: 0,
      },
      brandTitle: {
        fontSize: '1.3rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: theme.palette.text.primary,
        lineHeight: 1,
      },
      rightGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginRight: 8,
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
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgba(0, 0, 0, 0.06)',
        padding: '0 4px',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
      },
      expandedSearchInput: {
        flex: 1,
        minWidth: 0,
        marginLeft: 8,
        marginRight: 8,
        fontSize: '1rem',
        color: theme.palette.text.primary,
        '& input': {
          padding: '8px 0',
          color: `${theme.palette.text.primary} !important`,
          '&::placeholder': {
            color: theme.palette.text.secondary,
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

// Hook to detect scroll direction across any child scrollable container (capture phase)
const useHeaderVisibility = (enabled = true, resetKey = '') => {
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)
  const lastScrollTarget = useRef(null)
  const touchStartY = useRef(0)

  // AppBar survives route changes. Do not carry a hidden state or a scroll
  // baseline from the previous page into the next one.
  useEffect(() => {
    setVisible(true)
    lastScrollY.current = 0
    lastScrollTarget.current = null
    touchStartY.current = 0
  }, [resetKey])

  useEffect(() => {
    if (!enabled) {
      setVisible(true)
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

      // Different pages can own different scroll containers. Establish a
      // baseline for a new container instead of comparing it with the old page.
      if (target !== lastScrollTarget.current) {
        lastScrollTarget.current = target
        lastScrollY.current = 0
      }

      // Always show when near the very top of the list
      if (currentScrollY <= 25) {
        setVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      const diff = currentScrollY - lastScrollY.current

      // Jitter dampening threshold
      if (Math.abs(diff) < 10) return

      if (diff > 0) {
        // Scrolling down -> hide header
        setVisible(false)
      } else {
        // Scrolling up -> show header
        setVisible(true)
      }

      lastScrollY.current = currentScrollY
    }

    const handleTouchStart = (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY.current = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e) => {
      if (!e.touches || !e.touches[0]) return
      const currentY = e.touches[0].clientY
      const diff = touchStartY.current - currentY // positive = finger moved up = scroll down

      if (Math.abs(diff) > 12) {
        if (diff > 0) {
          setVisible(false)
        } else {
          setVisible(true)
        }
        touchStartY.current = currentY
      }
    }

    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    })
    window.addEventListener('touchstart', handleTouchStart, {
      capture: true,
      passive: true,
    })
    window.addEventListener('touchmove', handleTouchMove, {
      capture: true,
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('touchstart', handleTouchStart, {
        capture: true,
      })
      window.removeEventListener('touchmove', handleTouchMove, {
        capture: true,
      })
    }
  }, [enabled])

  return visible
}

const MobileTopBar = () => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
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
  const isHeaderVisible = useHeaderVisibility(
    !isSearchOpen,
    location.key || `${location.pathname}${location.search}${location.hash}`,
  )

  const isSongPage =
    location.pathname === '/' || location.pathname.startsWith('/song')

  // Set CSS top offset property dynamically so list content starts cleanly below fixed top bar with a generous gap
  useEffect(() => {
    const topOffset = 'calc(env(safe-area-inset-top, 0px) + 82px)'
    document.documentElement.style.setProperty(
      '--nd-mobile-top-offset',
      topOffset,
    )
  }, [])

  const handleToggleSidebar = (e) => {
    e.currentTarget?.blur()
    dispatch(toggleSidebar())
  }

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
      className={clsx(
        classes.mobileAppBar,
        !isHeaderVisible && classes.mobileAppBarHidden,
      )}
    >
      {/* Hidden React-Admin Title Portal anchor */}
      <span id="react-admin-title" style={{ display: 'none' }} />

      {/* Row 1: YouTube Music Style Top Bar */}
      <div className={classes.topRow}>
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
            {/* Left: Menu Hamburger + App Branding */}
            <div className={classes.leftGroup}>
              <IconButton
                className={classes.headerIconButton}
                onClick={handleToggleSidebar}
                aria-label="Open menu"
                tabIndex={-1}
              >
                <MenuIcon style={{ fontSize: 28 }} />
              </IconButton>

              <div
                className={classes.brandContainer}
                onClick={() => history.push('/song')}
                role="button"
                tabIndex={0}
                title="Bragi"
              >
                <BragiLogo className={classes.brandLogo} />
                <Typography className={classes.brandTitle}>Bragi</Typography>
              </div>
            </div>

            {/* Right: Search Icon + Cast Button */}
            <div className={classes.rightGroup}>
              <IconButton
                className={classes.headerIconButton}
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search your music"
              >
                <SearchIcon style={{ fontSize: 27 }} />
              </IconButton>

              <CastButton
                className={classes.headerIconButton}
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

const NO_SEARCH_BAR_PREFIXES = ['/personal', '/user', '/player', '/library']

const shouldHideSearchBar = (pathname) => {
  return NO_SEARCH_BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

const AppBar = (props) => {
  const location = useLocation()
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'))

  if (isMobile) {
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
