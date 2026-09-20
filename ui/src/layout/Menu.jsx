import React, { createElement, useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useHistory } from 'react-router-dom'
import {
  Divider,
  Typography,
  makeStyles,
  Avatar,
  IconButton,
  Tooltip,
  CircularProgress,
  Box,
  useMediaQuery,
  Popover,
  MenuList,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Button,
} from '@material-ui/core'
import { alpha } from '@material-ui/core/styles'
import clsx from 'clsx'
import {
  useTranslate,
  useNotify,
  MenuItemLink,
  getResources,
  useGetIdentity,
  usePermissions,
  toggleSidebar,
} from 'react-admin'
import ViewListIcon from '@material-ui/icons/ViewList'
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined'
import WbSunnyOutlinedIcon from '@material-ui/icons/WbSunnyOutlined'
import AccountCircle from '@material-ui/icons/AccountCircle'
import TuneIcon from '@material-ui/icons/Tune'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import PersonIcon from '@material-ui/icons/Person'
import SupervisorAccountIcon from '@material-ui/icons/SupervisorAccount'
import ExitToAppIcon from '@material-ui/icons/ExitToApp'
import RefreshIcon from '@material-ui/icons/Refresh'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import MenuIcon from '@material-ui/icons/Menu'
import BragiLogo from '../icons/BragiLogo'
import { VscSync } from 'react-icons/vsc'
import { GiMagnifyingGlass } from 'react-icons/gi'
import { BiError, BiMessageError } from 'react-icons/bi'
import { humanize, pluralize } from 'inflection'
import songLists from '../song/songLists'
import LibrarySelector from '../common/LibrarySelector'
import { AboutDialog } from '../dialogs'
import subsonic from '../subsonic'
import authProvider from '../authProvider'
import config from '../config'
import { startEventStream } from '../eventStream'
import { useInitialScanStatus } from './useInitialScanStatus'
import { useScanElapsedTime } from './useScanElapsedTime'
import { useInterval } from '../common'
import { formatDuration, formatShortDuration } from '../utils'

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === 'dark'
  const sidebarBorder = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.12)'
  const sidebarBg = isDark
    ? 'rgba(0, 0, 0, 0.22)'
    : 'rgba(0, 0, 0, 0.025)'

  return {
    root: {
      marginTop: 0,
      marginBottom: 0,
      transition: theme.transitions.create(['width', 'padding'], {
        easing: theme.transitions.easing.easeInOut,
        duration: theme.transitions.duration.shorter,
      }),
      paddingTop: '24px',
      paddingBottom: theme.spacing(1.5),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      userSelect: 'none',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '100vh',
      boxSizing: 'border-box',
      borderRight: `1px solid ${sidebarBorder}`,
      backgroundColor: sidebarBg,
      [theme.breakpoints.down('sm')]: {
        height: '100%',
        minHeight: '100vh',
        paddingTop: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px))',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        paddingLeft: theme.spacing(1.5),
        paddingRight: theme.spacing(1.5),
        marginBottom: 0,
        borderRight: 'none',
        backgroundColor: 'transparent',
      },
    },
    brandHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 6px 14px 8px',
      minHeight: 38,
      marginBottom: theme.spacing(0.5),
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      boxSizing: 'border-box',
      flexShrink: 0,
      [theme.breakpoints.down('sm')]: {
        padding: '0 4px 14px 6px',
        marginBottom: theme.spacing(1.5),
        minHeight: 42,
        justifyContent: 'flex-start',
      },
    },
    brandHeaderClosed: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '0 0 14px',
      minHeight: 38,
      marginBottom: theme.spacing(0.5),
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      boxSizing: 'border-box',
      flexShrink: 0,
    },
    brandContent: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.25),
      textDecoration: 'none',
      userSelect: 'none',
      cursor: 'pointer',
    },
    brandLogo: {
      width: 28,
      height: 28,
      color: theme.palette.primary.main,
      filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25))',
      [theme.breakpoints.down('sm')]: {
        width: 30,
        height: 30,
      },
    },
    brandLogoSmall: {
      width: 28,
      height: 28,
      color: theme.palette.primary.main,
      transition: 'transform 0.2s ease',
      '&:hover': {
        transform: 'scale(1.08)',
      },
    },
    brandTitle: {
      fontSize: '1.15rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: theme.palette.text.primary,
      lineHeight: 1,
      [theme.breakpoints.down('sm')]: {
        fontSize: '1.2rem',
      },
    },
    brandToggleButton: {
      color: theme.palette.text.secondary,
      padding: 5,
      transition: 'all 0.2s ease',
      '&:hover': {
        color: theme.palette.text.primary,
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)',
      },
    },
    brandClosedButton: {
      padding: 6,
    },
    navSection: {
      flex: '1 1 auto',
      overflowY: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      [theme.breakpoints.down('sm')]: {
        paddingTop: theme.spacing(1),
      },
    },
    open: {
      width: 240,
    },
    closed: {
      width: 60,
      paddingLeft: 0,
      paddingRight: 0,
      '& $navSection': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      },
      '& $divider': {
        width: 36,
        margin: `${theme.spacing(1)}px 0`,
      },
      '& $menuItem': {
        width: 38,
        minWidth: 38,
        maxWidth: 38,
        height: 38,
        minHeight: 38,
        padding: 0,
        margin: '4px 0',
        borderRadius: 9,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontSize: 0,
        '&:hover': {
          transform: 'none',
        },
        '& .RaMenuItemLink-icon, & .MuiListItemIcon-root': {
          minWidth: 'unset',
          width: 'auto',
          margin: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
      },
    },
    sectionHeader: {
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: theme.palette.text.secondary,
      opacity: 0.65,
      padding: `${theme.spacing(1.5)}px ${theme.spacing(1.5)}px ${theme.spacing(0.5)}px`,
      userSelect: 'none',
    },
    divider: {
      margin: `${theme.spacing(1)}px ${theme.spacing(1)}px`,
      opacity: 0.25,
    },
    menuItem: {
      borderRadius: 8,
      margin: '2px 0',
      padding: '7px 12px',
      transition: 'all 0.16s ease-in-out',
      color: theme.palette.text.secondary,
      '&:hover': {
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)',
        color: theme.palette.text.primary,
        transform: 'translateX(3px)',
      },
      '& .RaMenuItemLink-icon': {
        minWidth: 36,
        color: 'inherit',
        transition: 'color 0.16s ease-in-out',
      },
      [theme.breakpoints.down('sm')]: {
        margin: '3px 0',
        padding: '9px 12px',
        '& .RaMenuItemLink-icon': {
          minWidth: 38,
        },
      },
    },
    active: {
      color: `${theme.palette.text.primary} !important`,
      fontWeight: 600,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.12) !important'
        : 'rgba(0, 0, 0, 0.08) !important',
      '& .RaMenuItemLink-icon': {
        color: `${theme.palette.primary.main} !important`,
      },
    },
    bottomSection: {
      marginTop: 'auto',
      flexShrink: 0,
      paddingTop: theme.spacing(1),
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
    },
    bottomSectionClosed: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: theme.spacing(1),
    },
    userCard: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 8px',
      borderRadius: 12,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(0, 0, 0, 0.03)',
      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.06)',
        borderColor: alpha(theme.palette.primary.main, 0.3),
      },
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
      flex: 1,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      color: theme.palette.primary.main,
    },
    userNameWrapper: {
      minWidth: 0,
      flex: 1,
      overflow: 'hidden',
    },
    userName: {
      fontSize: '0.84rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: theme.palette.text.primary,
      lineHeight: 1.2,
    },
    userRole: {
      fontSize: '0.66rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: theme.palette.text.secondary,
      opacity: 0.8,
      lineHeight: 1.2,
      marginTop: 2,
    },
    syncButton: {
      padding: 5,
      color: theme.palette.text.secondary,
      transition: 'all 0.2s ease',
      '&:hover': {
        color: theme.palette.primary.main,
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)',
      },
    },
    settingsButton: {
      padding: 5,
      color: theme.palette.text.secondary,
      transition: 'all 0.2s ease',
      '&:hover': {
        color: theme.palette.text.primary,
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)',
      },
    },
    collapsedAvatarButton: {
      padding: 6,
      position: 'relative',
      color: 'inherit',
    },
    collapsedProgress: {
      position: 'absolute',
      top: 4,
      left: 4,
      zIndex: 1,
      color: theme.palette.primary.main,
    },
    warningIcon: {
      color: `${theme.palette.warning.main} !important`,
    },
    errorIcon: {
      color: `${theme.palette.error.main} !important`,
    },
    errorText: {
      color: theme.palette.error.main,
    },
    spinning: {
      animation: '$spin 1.5s linear infinite',
    },
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
    // Popover Menu Styles
    popoverPaper: {
      width: 290,
      maxWidth: 'calc(100vw - 32px)',
      borderRadius: 14,
      boxShadow: isDark
        ? '0 12px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.1)'
        : '0 12px 36px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)',
      backgroundColor: theme.palette.background.paper,
      backgroundImage: 'none',
      padding: '8px 0',
      marginBottom: 10,
    },
    popoverUserHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: `${theme.spacing(1.5)}px ${theme.spacing(2)}px`,
    },
    popoverAvatar: {
      width: 38,
      height: 38,
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      color: theme.palette.primary.main,
    },
    popoverUserInfo: {
      minWidth: 0,
      flex: 1,
    },
    popoverUserName: {
      fontSize: '0.92rem',
      fontWeight: 600,
      color: theme.palette.text.primary,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    popoverUserRole: {
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: theme.palette.text.secondary,
      marginTop: 2,
    },
    popoverActivitySection: {
      margin: `${theme.spacing(0.5)}px ${theme.spacing(1.5)}px`,
      padding: theme.spacing(1.5),
      borderRadius: 10,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(0, 0, 0, 0.03)',
      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
    },
    activityHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),
    },
    activityTitle: {
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: theme.palette.text.secondary,
      opacity: 0.8,
    },
    activityStats: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    },
    activityStatRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.78rem',
    },
    activityStatLabel: {
      color: theme.palette.text.secondary,
    },
    activityStatValue: {
      fontWeight: 500,
      color: theme.palette.text.primary,
    },
    activityErrorBox: {
      marginTop: 6,
      padding: '4px 8px',
      borderRadius: 6,
      backgroundColor: alpha(theme.palette.error.main, 0.12),
      border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
    },
    activityActions: {
      display: 'flex',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1.25),
    },
    actionButton: {
      flex: 1,
      borderRadius: 8,
      textTransform: 'none',
      fontSize: '0.75rem',
      fontWeight: 600,
      padding: '4px 8px',
    },
    popoverDivider: {
      margin: `${theme.spacing(1)}px 0`,
      opacity: 0.25,
    },
    menuList: {
      padding: '0 6px',
    },
    popoverMenuItem: {
      borderRadius: 8,
      padding: '7px 10px',
      margin: '2px 0',
      transition: 'all 0.15s ease',
      color: theme.palette.text.secondary,
      '&:hover': {
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)',
        color: theme.palette.text.primary,
      },
    },
    popoverMenuIcon: {
      minWidth: 32,
      color: 'inherit',
    },
    popoverMenuText: {
      fontSize: '0.84rem',
      fontWeight: 500,
    },
    logoutMenuItem: {
      color: isDark ? '#ff7b72' : '#d32f2f',
      '&:hover': {
        backgroundColor: isDark ? 'rgba(255, 123, 114, 0.12)' : 'rgba(211, 47, 47, 0.08)',
        color: isDark ? '#ff9992' : '#b71c1c',
      },
    },
  }
})

const translatedResourceName = (resource, translate) =>
  translate(`resources.${resource.name}.name`, {
    smart_count: 2,
    _:
      resource.options && resource.options.label
        ? translate(resource.options.label, {
            smart_count: 2,
            _: resource.options.label,
          })
        : humanize(pluralize(resource.name)),
  })

const settingsResources = (resource) =>
  resource.name !== 'user' &&
  resource.hasList &&
  resource.options &&
  resource.options.subMenu === 'settings'

const getUptime = (start) =>
  start && start.startTime
    ? formatDuration((Date.now() - start.startTime) / 1000)
    : '-'

const Uptime = () => {
  const start = useSelector((state) => state.activity?.serverStart)
  const [uptime, setUptime] = useState(() => getUptime(start))
  useInterval(() => {
    setUptime(getUptime(start))
  }, 1000)
  return <span>{uptime}</span>
}

const Menu = ({ dense = false }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const open = useSelector((state) => state.admin.ui.sidebarOpen)
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'))
  const translate = useTranslate()
  const notify = useNotify()
  const queue = useSelector((state) => state.player?.queue || [])
  const scanStatus = useSelector((state) => state.activity?.scanStatus || {})
  const serverStart = useSelector((state) => state.activity?.serverStart || {})
  const { loaded, identity } = useGetIdentity()
  const { permissions } = usePermissions()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)
  const menuOpen = Boolean(anchorEl)
  const classes = useStyles({ addPadding: queue.length > 0 })
  const resources = useSelector(getResources)
  const resourcesByName = new Map(
    resources.map((resource) => [resource.name, resource]),
  )

  useInitialScanStatus()
  const elapsed = useScanElapsedTime(
    scanStatus.scanning,
    scanStatus.elapsedTime,
  )

  useEffect(() => {
    if (config.devActivityPanel) {
      authProvider
        .checkAuth()
        .then(() => startEventStream(dispatch))
        .catch(() => {})
    }
  }, [dispatch])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.BragiNative) return
    if (serverStart?.version && serverStart.version !== config.version) {
      notify('ra.notification.new_version', 'info', {}, false, 604800000 * 50)
    }
  }, [serverStart, notify])

  const up = Boolean(serverStart?.startTime)
  const serverDown = !up
  const hasWarning = Boolean(scanStatus?.error)

  const songResource = resourcesByName.get('song')
  const albumResource = resourcesByName.get('album')
  const artistResource = resourcesByName.get('artist')
  const playlistResource = resourcesByName.get('playlist')

  const handleQuickScan = (e) => {
    e?.stopPropagation()
    subsonic.startScan({ fullScan: false })
  }

  const handleFullScan = (e) => {
    e?.stopPropagation()
    subsonic.startScan({ fullScan: true })
  }

  const handleOpenMenu = (e) => {
    e?.stopPropagation()
    setAnchorEl(e.currentTarget)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
  }

  const handleNavigate = (path) => {
    handleCloseMenu()
    if (path && path !== '#') {
      history.push(path)
    }
  }

  const handleOpenAbout = () => {
    handleCloseMenu()
    setAboutOpen(true)
  }

  const handleLogout = () => {
    handleCloseMenu()
    authProvider.logout().then((redirectTo) => {
      if (redirectTo !== false) {
        window.location.reload()
      }
    })
  }

  const handleReloadApp = () => {
    handleCloseMenu()
    window.location.reload()
  }

  const lastScanType = (() => {
    switch (scanStatus.scanType) {
      case 'full':
        return translate('activity.fullScan', { _: 'Full scan' })
      case 'quick':
        return translate('activity.quickScan', { _: 'Quick scan' })
      case 'full-selective':
      case 'quick-selective':
        return translate('activity.selectiveScan', { _: 'Selective scan' })
      default:
        return ''
    }
  })()

  const renderResourceMenuItemLink = (
    resource,
    target = resource ? `/${resource.name}` : '',
  ) => {
    if (!resource) return null
    return (
      <MenuItemLink
        key={resource.name}
        to={target}
        activeClassName={classes.active}
        className={classes.menuItem}
        primaryText={translatedResourceName(resource, translate)}
        leftIcon={resource.icon || <ViewListIcon />}
        sidebarIsOpen={open}
        dense={dense}
      />
    )
  }

  const renderSongListMenuItemLink = (type, songList) => {
    const songListAddress = `/song/${type}`
    const name = translate(`resources.album.lists.${type}`, {
      _: humanize(type),
    })

    return (
      <MenuItemLink
        key={songListAddress}
        to={songListAddress}
        activeClassName={classes.active}
        className={classes.menuItem}
        primaryText={name}
        leftIcon={songList.icon || <ViewListIcon />}
        sidebarIsOpen={open}
        dense={dense}
        exact
      />
    )
  }

  return (
    <div
      className={clsx(classes.root, {
        [classes.open]: open,
        [classes.closed]: !open,
      })}
    >
      {/* Brand Header at Top-Left of Sidebar */}
      {open ? (
        <div className={classes.brandHeader}>
          <div
            className={classes.brandContent}
            onClick={() => {
              if (isMobile) {
                dispatch(toggleSidebar())
              }
              history.push('/')
            }}
            role="button"
            tabIndex={0}
          >
            <BragiLogo className={classes.brandLogo} />
            <Typography className={classes.brandTitle}>Bragi</Typography>
          </div>
          {!isMobile && (
            <Tooltip title={translate('ra.action.collapse', { _: 'Collapse sidebar' })}>
              <IconButton
                size="small"
                className={classes.brandToggleButton}
                onClick={() => dispatch(toggleSidebar())}
                aria-label="Collapse sidebar"
              >
                <MenuOpenIcon style={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      ) : (
        !isMobile && (
          <div className={classes.brandHeaderClosed}>
            <Tooltip title="Expand sidebar (Bragi)" placement="right">
              <IconButton
                size="small"
                className={classes.brandClosedButton}
                onClick={() => dispatch(toggleSidebar())}
                aria-label="Expand sidebar"
              >
                <BragiLogo className={classes.brandLogoSmall} />
              </IconButton>
            </Tooltip>
          </div>
        )
      )}

      <div className={classes.navSection}>
        {open && <LibrarySelector />}

        {/* Library Section */}
        {!isMobile && open && (
          <Typography className={classes.sectionHeader}>
            {translate('menu.library', { _: 'Library' })}
          </Typography>
        )}
        {renderResourceMenuItemLink(songResource)}
        {renderResourceMenuItemLink(artistResource)}
        {renderResourceMenuItemLink(albumResource, '/album/all')}
        {!isMobile && (
          <>
            <MenuItemLink
              to="/genres"
              activeClassName={classes.active}
              className={classes.menuItem}
              primaryText={translate('resources.genre.name', {
                smart_count: 2,
                _: 'Genres',
              })}
              leftIcon={<CategoryOutlinedIcon />}
              sidebarIsOpen={open}
              dense={dense}
            />
            <MenuItemLink
              to="/moods"
              activeClassName={classes.active}
              className={classes.menuItem}
              primaryText={translate('menu.moods', { _: 'Moods' })}
              leftIcon={<WbSunnyOutlinedIcon />}
              sidebarIsOpen={open}
              dense={dense}
            />
          </>
        )}
        {isMobile && renderResourceMenuItemLink(playlistResource)}
        {isMobile &&
          songLists.recentlyAdded &&
          renderSongListMenuItemLink(
            'recentlyAdded',
            songLists.recentlyAdded,
          )}
        {isMobile &&
          songLists.recentlyPlayed &&
          renderSongListMenuItemLink(
            'recentlyPlayed',
            songLists.recentlyPlayed,
          )}

        {/* Discover Section (Desktop Only) */}
        {!isMobile && (
          <>
            <Divider className={classes.divider} />
            {open && (
              <Typography className={classes.sectionHeader}>
                {translate('menu.discover', { _: 'Discover' })}
              </Typography>
            )}
            {Object.keys(songLists).map((type) =>
              renderSongListMenuItemLink(type, songLists[type]),
            )}
            {renderResourceMenuItemLink(playlistResource)}
          </>
        )}
      </div>

      {/* Unified Bottom Profile, Activity & Settings Hub */}
      {open ? (
        <div className={classes.bottomSection}>
          <div
            className={classes.userCard}
            onClick={handleOpenMenu}
            role="button"
            tabIndex={0}
            aria-label="User profile & system settings"
          >
            <div className={classes.userInfo}>
              {loaded && identity?.avatar ? (
                <Avatar
                  src={identity.avatar}
                  alt={identity.fullName}
                  className={classes.avatar}
                />
              ) : (
                <Avatar className={classes.avatar}>
                  <AccountCircle />
                </Avatar>
              )}
              <div className={classes.userNameWrapper}>
                <Typography className={classes.userName}>
                  {loaded && identity?.fullName ? identity.fullName : 'Bragi'}
                </Typography>
                <Typography className={classes.userRole}>
                  {permissions === 'admin' ? 'Administrator' : 'User'}
                </Typography>
              </div>
            </div>

            <Box display="flex" alignItems="center" onClick={(e) => e.stopPropagation()}>
              <Tooltip
                title={
                  scanStatus.scanning
                    ? `${translate('activity.status')}: Scanning...`
                    : translate('activity.quickScan', { _: 'Quick Scan' })
                }
              >
                <IconButton
                  size="small"
                  className={clsx(
                    classes.syncButton,
                    scanStatus.scanning && classes.spinning,
                  )}
                  onClick={handleQuickScan}
                  disabled={scanStatus.scanning}
                  aria-label="Sync / Quick scan"
                >
                  <VscSync size={18} />
                </IconButton>
              </Tooltip>

              <Tooltip title={translate('menu.settings', { _: 'Settings & Activity' })}>
                <IconButton
                  size="small"
                  className={clsx(
                    classes.settingsButton,
                    hasWarning && classes.warningIcon,
                    serverDown && classes.errorIcon,
                  )}
                  onClick={handleOpenMenu}
                  aria-label="Settings & Activity"
                >
                  {serverDown ? (
                    <BiError size={18} />
                  ) : hasWarning ? (
                    <BiMessageError size={18} />
                  ) : (
                    <TuneIcon style={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          </div>
        </div>
      ) : (
        <div className={clsx(classes.bottomSection, classes.bottomSectionClosed)}>
          <Tooltip
            title={
              loaded && identity?.fullName
                ? `${identity.fullName} • ${translate('menu.settings', { _: 'Settings & Activity' })}`
                : translate('menu.settings', { _: 'Settings & Activity' })
            }
            placement="right"
          >
            <IconButton
              className={clsx(
                classes.collapsedAvatarButton,
                scanStatus.scanning && classes.collapsedScanningRing,
              )}
              onClick={handleOpenMenu}
              aria-label="User profile & system settings"
            >
              {loaded && identity?.avatar ? (
                <Avatar
                  src={identity.avatar}
                  alt={identity.fullName}
                  className={classes.avatar}
                />
              ) : (
                <Avatar className={classes.avatar}>
                  <AccountCircle />
                </Avatar>
              )}
              {scanStatus.scanning && (
                <CircularProgress size={36} className={classes.collapsedProgress} />
              )}
            </IconButton>
          </Tooltip>
        </div>
      )}

      {/* Unified System & Settings Popover Menu */}
      <Popover
        open={menuOpen}
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        anchorOrigin={{
          vertical: 'top',
          horizontal: open ? 'left' : 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        PaperProps={{
          className: classes.popoverPaper,
        }}
      >
        {/* Profile Header */}
        <div className={classes.popoverUserHeader}>
          {loaded && identity?.avatar ? (
            <Avatar
              src={identity.avatar}
              alt={identity.fullName}
              className={classes.popoverAvatar}
            />
          ) : (
            <Avatar className={classes.popoverAvatar}>
              <AccountCircle />
            </Avatar>
          )}
          <div className={classes.popoverUserInfo}>
            <Typography className={classes.popoverUserName}>
              {loaded && identity?.fullName ? identity.fullName : 'Bragi'}
            </Typography>
            <Typography className={classes.popoverUserRole}>
              {permissions === 'admin' ? 'Administrator' : 'User'}
            </Typography>
          </div>
        </div>

        {/* System & Scan Status Widget */}
        {(config.devActivityPanel || permissions === 'admin') && (
          <div className={classes.popoverActivitySection}>
            <div className={classes.activityHeader}>
              <Typography className={classes.activityTitle}>
                {translate('activity.title', { _: 'Server & Sync Status' })}
              </Typography>
              {scanStatus.scanning && (
                <Box display="flex" alignItems="center" gap="4px">
                  <CircularProgress size={12} color="primary" />
                  <Typography variant="caption" color="primary">
                    Scanning...
                  </Typography>
                </Box>
              )}
            </div>

            <div className={classes.activityStats}>
              <div className={classes.activityStatRow}>
                <span className={classes.activityStatLabel}>
                  {translate('activity.serverUptime', { _: 'Server Uptime' })}:
                </span>
                <span className={clsx(classes.activityStatValue, serverDown && classes.errorText)}>
                  {up ? <Uptime /> : translate('activity.serverDown', { _: 'Server Down' })}
                </span>
              </div>

              <div className={classes.activityStatRow}>
                <span className={classes.activityStatLabel}>
                  {translate('activity.totalScanned', { _: 'Total Scanned' })}:
                </span>
                <span className={classes.activityStatValue}>
                  {scanStatus.folderCount || '-'}
                </span>
              </div>

              {lastScanType ? (
                <div className={classes.activityStatRow}>
                  <span className={classes.activityStatLabel}>
                    {translate('activity.scanType', { _: 'Scan Type' })}:
                  </span>
                  <span className={classes.activityStatValue}>
                    {lastScanType}
                  </span>
                </div>
              ) : null}

              {(scanStatus.scanning || elapsed > 0) && (
                <div className={classes.activityStatRow}>
                  <span className={classes.activityStatLabel}>
                    {translate('activity.elapsedTime', { _: 'Elapsed Time' })}:
                  </span>
                  <span className={classes.activityStatValue}>
                    {formatShortDuration(elapsed)}
                  </span>
                </div>
              )}

              {scanStatus.error && (
                <div className={classes.activityErrorBox}>
                  <Typography variant="caption" className={classes.errorText}>
                    {translate('activity.status', { _: 'Status' })}: {scanStatus.error}
                  </Typography>
                </div>
              )}
            </div>

            {/* Scan Action Buttons */}
            <div className={classes.activityActions}>
              <Button
                size="small"
                variant="outlined"
                className={classes.actionButton}
                startIcon={<VscSync className={scanStatus.scanning ? classes.spinning : undefined} />}
                onClick={handleQuickScan}
                disabled={scanStatus.scanning}
              >
                {translate('activity.quickScan', { _: 'Quick Scan' })}
              </Button>
              {permissions === 'admin' && (
                <Button
                  size="small"
                  variant="outlined"
                  className={classes.actionButton}
                  startIcon={<GiMagnifyingGlass />}
                  onClick={handleFullScan}
                  disabled={scanStatus.scanning}
                >
                  {translate('activity.fullScan', { _: 'Full Scan' })}
                </Button>
              )}
            </div>
          </div>
        )}

        <Divider className={classes.popoverDivider} />

        {/* Navigation & Settings Menu Items */}
        <MenuList className={classes.menuList}>
          <MenuItem
            className={classes.popoverMenuItem}
            onClick={() => handleNavigate('/personal')}
          >
            <ListItemIcon className={classes.popoverMenuIcon}>
              <TuneIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={translate('menu.personal.name', { _: 'Personal Settings' })}
              classes={{ primary: classes.popoverMenuText }}
            />
          </MenuItem>

          {/* User Management Link */}
          {(() => {
            const userResource = resourcesByName.get('user')
            if (!userResource) return null
            if (permissions !== 'admin' && !config.enableUserEditing) return null
            const userId = permissions !== 'admin' ? localStorage.getItem('userId') : null
            const link = userId ? `/user/${userId}` : '/user'
            const label = translate(`resources.user.name`, {
              smart_count: userId ? 1 : 2,
              _: 'Users',
            })
            return (
              <MenuItem
                key="user-mgmt"
                className={classes.popoverMenuItem}
                onClick={() => handleNavigate(link)}
              >
                <ListItemIcon className={classes.popoverMenuIcon}>
                  {permissions === 'admin' ? (
                    <SupervisorAccountIcon fontSize="small" />
                  ) : (
                    <PersonIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  classes={{ primary: classes.popoverMenuText }}
                />
              </MenuItem>
            )
          })()}

          {/* Settings Resources (Players, Transcoding, Radio, etc.) */}
          {resources.filter(settingsResources).map((r) => {
            const label = translate(`resources.${r.name}.name`, {
              smart_count: 2,
              _: humanize(pluralize(r.name)),
            })
            return (
              <MenuItem
                key={r.name}
                className={classes.popoverMenuItem}
                onClick={() => handleNavigate(`/${r.name}`)}
              >
                <ListItemIcon className={classes.popoverMenuIcon}>
                  {(r.icon && createElement(r.icon, { size: 20 })) || (
                    <ViewListIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  classes={{ primary: classes.popoverMenuText }}
                />
              </MenuItem>
            )
          })}

          <MenuItem
            className={classes.popoverMenuItem}
            onClick={handleOpenAbout}
          >
            <ListItemIcon className={classes.popoverMenuIcon}>
              <InfoOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={translate('menu.about', { _: 'About' })}
              classes={{ primary: classes.popoverMenuText }}
            />
          </MenuItem>

          <MenuItem
            className={classes.popoverMenuItem}
            onClick={handleReloadApp}
          >
            <ListItemIcon className={classes.popoverMenuIcon}>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={translate('menu.refresh', { _: 'Refresh App' })}
              classes={{ primary: classes.popoverMenuText }}
            />
          </MenuItem>

          {(!config.auth || !!config.extAuthLogoutURL) && (
            <Divider className={classes.popoverDivider} key="logout-div" />
          )}
          {(!config.auth || !!config.extAuthLogoutURL) && (
            <MenuItem
              key="logout-item"
              className={clsx(classes.popoverMenuItem, classes.logoutMenuItem)}
              onClick={handleLogout}
            >
              <ListItemIcon className={classes.popoverMenuIcon}>
                <ExitToAppIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={translate('ra.auth.logout', { _: 'Logout' })}
                classes={{ primary: classes.popoverMenuText }}
              />
            </MenuItem>
          )}
        </MenuList>
      </Popover>

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  )
}

export default Menu
