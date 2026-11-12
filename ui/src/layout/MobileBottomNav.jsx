import React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import { makeStyles, alpha } from '@material-ui/core/styles'
import MusicNoteOutlinedIcon from '@material-ui/icons/MusicNoteOutlined'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import PersonOutlineIcon from '@material-ui/icons/PersonOutline'
import PersonIcon from '@material-ui/icons/Person'
import EqualizerIcon from '@material-ui/icons/Equalizer'
import ExploreOutlinedIcon from '@material-ui/icons/ExploreOutlined'
import ExploreIcon from '@material-ui/icons/Explore'
import clsx from 'clsx'
import { useTranslate } from 'react-admin'
import { MOBILE_SIDEBAR_BACKGROUND_COLOR } from '../consts'
import useTouchActivation from './useTouchActivation'

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
      backgroundColor: MOBILE_SIDEBAR_BACKGROUND_COLOR,
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
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
      color: 'rgba(255, 255, 255, 0.52)',
      padding: '4px',
      boxSizing: 'border-box',
      transition: 'transform 0.1s ease',
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
      // Match the route immediately; animate only the small scale feedback.
      transition: 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
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
    path: '/statistics',
    labelKey: 'menu.statistics',
    defaultLabel: 'Statistics',
    Icon: EqualizerIcon,
    ActiveIcon: EqualizerIcon,
    isActive: (pathname) => pathname === '/statistics',
  },
  {
    path: '/for-you',
    labelKey: 'menu.forYou',
    defaultLabel: 'For You',
    Icon: ExploreOutlinedIcon,
    ActiveIcon: ExploreIcon,
    isActive: (pathname) => pathname === '/for-you',
  },
]

const bottomNavPaths = new Set(navItems.map((item) => item.path))

const isModifiedClick = (event) =>
  event.button !== 0 ||
  event.metaKey ||
  event.altKey ||
  event.ctrlKey ||
  event.shiftKey

const MobileBottomNavLink = ({
  item,
  label,
  active,
  Icon,
  onNavigate,
  linkClassName,
  iconContainerClassName,
}) => {
  const handleClick = (event) => {
    onNavigate(event, item, active)
  }

  return (
    <Link
      to={item.path}
      className={linkClassName}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
    >
      <div className={iconContainerClassName}>
        <Icon />
      </div>
    </Link>
  )
}

const MobileBottomNav = () => {
  const classes = useStyles()
  const history = useHistory()
  const location = useLocation()
  const translate = useTranslate()
  const hasBottomTabLayer = React.useRef(false)
  const linkTouch = useTouchActivation('a[href]')

  React.useEffect(
    () =>
      history.listen((nextLocation, action) => {
        if (action === 'POP' || !bottomNavPaths.has(nextLocation.pathname)) {
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
    <nav className={classes.root} aria-label="Bottom Navigation" {...linkTouch}>
      {navItems.map((item) => {
        const isActive = item.isActive(location.pathname)
        const IconComponent = isActive ? item.ActiveIcon : item.Icon
        const label = translate(item.labelKey, {
          smart_count: item.smartCount,
          _: item.defaultLabel,
        })

        return (
          <MobileBottomNavLink
            key={item.path}
            item={item}
            label={label}
            active={isActive}
            Icon={IconComponent}
            linkClassName={clsx(classes.navItem, {
              [classes.navItemActive]: isActive,
            })}
            iconContainerClassName={classes.iconContainer}
            onNavigate={navigate}
          />
        )
      })}
    </nav>
  )
}

export default MobileBottomNav
