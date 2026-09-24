import React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { makeStyles, alpha } from '@material-ui/core/styles'
import MusicNoteOutlinedIcon from '@material-ui/icons/MusicNoteOutlined'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import PersonOutlineIcon from '@material-ui/icons/PersonOutline'
import PersonIcon from '@material-ui/icons/Person'
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined'
import CategoryIcon from '@material-ui/icons/Category'
import WbSunnyOutlinedIcon from '@material-ui/icons/WbSunnyOutlined'
import WbSunnyIcon from '@material-ui/icons/WbSunny'
import clsx from 'clsx'
import { useTranslate } from 'react-admin'

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === 'dark'
  const primaryColor = theme.palette.primary.main

  return {
    root: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      height: 54,
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxSizing: 'content-box',
      backgroundColor: isDark
        ? 'rgba(13, 13, 15, 0.92)'
        : 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.35)',
      userSelect: 'none',
      [theme.breakpoints.up('md')]: {
        display: 'none',
      },
    },
    navItem: {
      flex: '1 1 0%',
      width: '25%',
      maxWidth: '25%',
      minWidth: 0,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textDecoration: 'none',
      color: isDark ? 'rgba(255, 255, 255, 0.52)' : 'rgba(0, 0, 0, 0.5)',
      padding: '4px',
      boxSizing: 'border-box',
      transition: 'color 0.2s ease, transform 0.16s ease',
      WebkitTapHighlightColor: 'transparent',
      '&:active': {
        transform: 'scale(0.88)',
      },
    },
    navItemActive: {
      color: `${primaryColor} !important`,
      '& $iconContainer': {
        color: `${primaryColor} !important`,
        backgroundColor: alpha(primaryColor, isDark ? 0.18 : 0.12),
        transform: 'scale(1.05)',
      },
    },
    iconContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 52,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'transparent',
      transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      '& svg': {
        fontSize: 25,
      },
    },
  }
})

const navItems = [
  {
    path: '/song',
    labelKey: 'resources.song.name',
    defaultLabel: 'Songs',
    smartCount: 2,
    Icon: MusicNoteOutlinedIcon,
    ActiveIcon: MusicNoteIcon,
    isActive: (pathname) => pathname === '/song' || pathname === '/song/',
  },
  {
    path: '/artist',
    labelKey: 'resources.artist.name',
    defaultLabel: 'Artists',
    smartCount: 2,
    Icon: PersonOutlineIcon,
    ActiveIcon: PersonIcon,
    isActive: (pathname) => pathname.startsWith('/artist'),
  },
  {
    path: '/genres',
    labelKey: 'resources.genre.name',
    defaultLabel: 'Genres',
    smartCount: 2,
    Icon: CategoryOutlinedIcon,
    ActiveIcon: CategoryIcon,
    isActive: (pathname) =>
      pathname.startsWith('/genres') || pathname.startsWith('/categories'),
  },
  {
    path: '/moods',
    labelKey: 'menu.moods',
    defaultLabel: 'Moods',
    smartCount: 2,
    Icon: WbSunnyOutlinedIcon,
    ActiveIcon: WbSunnyIcon,
    isActive: (pathname) => pathname.startsWith('/moods'),
  },
]

const bottomNavPaths = new Set(navItems.map((item) => item.path))

const isModifiedClick = (event) =>
  event.button !== 0 ||
  event.metaKey ||
  event.altKey ||
  event.ctrlKey ||
  event.shiftKey

const MobileBottomNav = () => {
  const classes = useStyles()
  const history = useHistory()
  const location = useLocation()
  const translate = useTranslate()
  const hasBottomTabLayer = React.useRef(false)

  React.useEffect(
    () =>
      history.listen((nextLocation, action) => {
        if (
          action === 'POP' ||
          !bottomNavPaths.has(nextLocation.pathname)
        ) {
          hasBottomTabLayer.current = false
        }
      }),
    [history],
  )

  const navigate = (event, item, isActive) => {
    if (event.defaultPrevented || isModifiedClick(event)) return
    event.preventDefault()

    if (isActive) return

    if (item.path === '/song') {
      if (hasBottomTabLayer.current) {
        hasBottomTabLayer.current = false
        history.goBack()
      } else {
        history.replace('/song')
      }
      return
    }

    if (hasBottomTabLayer.current) {
      history.replace(item.path)
      return
    }

    // Keep Songs as the single root below the bottom-tab layer so Android Back
    // never has to replay every tab the user opened.
    if (location.pathname === '/song' || location.pathname === '/song/') {
      history.push(item.path)
    } else {
      history.replace(item.path)
    }
    hasBottomTabLayer.current = true
  }

  return (
    <nav className={classes.root} aria-label="Bottom Navigation">
      {navItems.map((item) => {
        const isActive = item.isActive(location.pathname)
        const IconComponent = isActive ? item.ActiveIcon : item.Icon
        const label = translate(item.labelKey, {
          smart_count: item.smartCount,
          _: item.defaultLabel,
        })

        return (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(classes.navItem, {
              [classes.navItemActive]: isActive,
            })}
            aria-label={label}
            title={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => navigate(event, item, isActive)}
          >
            <div className={classes.iconContainer}>
              <IconComponent />
            </div>

          </Link>
        )
      })}
    </nav>
  )
}

export default MobileBottomNav
