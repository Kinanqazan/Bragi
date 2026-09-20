import React, { useContext, useEffect, useRef, useState } from 'react'
import { ReactReduxContext } from 'react-redux'
import { showNotification } from 'react-admin'
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@material-ui/core'
import { alpha, makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { MdCast, MdPhoneAndroid } from 'react-icons/md'
import { endCastSession, requestCastSession } from './castApi'
import { getCastErrorCode } from './castDiagnostics'
import { useCastState } from './useCastState'

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === 'dark'
  return {
    connected: {
      color: `${theme.palette.primary.main} !important`,
    },
    menuPaper: {
      borderRadius: 14,
      padding: '6px',
      boxShadow: isDark
        ? '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.1)'
        : '0 12px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08)',
      backgroundColor: theme.palette.background.paper,
      backgroundImage: 'none',
      marginTop: 6,
      marginBottom: 6,
      minWidth: 200,
    },
    menuItem: {
      borderRadius: 10,
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)',
      },
    },
    iconWrapper: {
      minWidth: 32,
      width: 32,
      height: 32,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? alpha(theme.palette.primary.main, 0.16)
        : alpha(theme.palette.primary.main, 0.1),
      color: theme.palette.primary.main,
      marginRight: theme.spacing(1.25),
      flexShrink: 0,
    },
    itemText: {
      fontSize: '0.86rem',
      fontWeight: 600,
      color: theme.palette.text.primary,
      whiteSpace: 'nowrap',
    },
  }
})

const isCastRequestCancelled = (code) =>
  ['CANCEL', 'CANCELLED', 'CANCELED', 'USER_CANCELLED'].includes(
    String(code).toUpperCase(),
  )

const CastButton = ({ className, size, tabIndex = 0 }) => {
  const classes = useStyles()
  const castState = useCastState()
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const safetyTimerRef = useRef(null)
  const reduxContext = useContext(ReactReduxContext)

  const notify = React.useCallback(
    (message, type = 'info') => {
      if (reduxContext?.store?.dispatch) {
        reduxContext.store.dispatch(
          showNotification(message, type, { translate: false }),
        )
      }
    },
    [reduxContext],
  )

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!castState.connected) setMenuAnchor(null)
  }, [castState.connected])

  const handleClick = async (event) => {
    if (requesting) return

    if (castState.connected) {
      setMenuAnchor(event.currentTarget)
      return
    }

    setRequesting(true)
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = setTimeout(() => {
      setRequesting(false)
    }, 10000)

    try {
      // Keep the request synchronously connected to the click event so device discovery retains
      // the browser's transient user activation token (avoid calling blur() or async ticks before).
      await requestCastSession()
    } catch (error) {
      const code = getCastErrorCode(error)
      if (!isCastRequestCancelled(code)) {
        // eslint-disable-next-line no-console
        console.warn('[Navidrome Cast] Session request failed', {
          code,
          description: error?.description || error?.message || (typeof error === 'string' ? error : undefined),
          details: error?.details,
          error,
        })
        if (code === 'TIMEOUT') {
          notify('cast.timeout', 'warning')
        } else if (
          code === 'NO_DEVICES_AVAILABLE' ||
          (String(code).toUpperCase() === 'SESSION_ERROR' &&
            castState.castState === 'NO_DEVICES_AVAILABLE')
        ) {
          notify('cast.no_devices', 'warning')
        } else if (String(code).toUpperCase() === 'SESSION_ERROR') {
          notify('cast.session_error', 'warning')
        }
      }
      // The button remains usable so a transient discovery failure can retry.
    } finally {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
      setRequesting(false)
    }
  }

  const handleUseThisDevice = async () => {
    setMenuAnchor(null)
    try {
      await endCastSession(true, { resumeLocal: true })
    } catch (error) {
      const code = getCastErrorCode(error)
      if (!isCastRequestCancelled(code)) {
        // eslint-disable-next-line no-console
        console.warn('[Navidrome Cast] Could not switch to this device', {
          code,
        })
      }
    }
  }

  const label = castState.connected
    ? `Cast options${castState.deviceName ? ` — connected to ${castState.deviceName}` : ''}`
    : requesting
      ? 'Connecting to Cast device'
      : 'Cast to device'

  return (
    <>
      <IconButton
        className={clsx(className, {
          [classes.connected]: castState.connected,
          'nd-player-cast-connected': castState.connected,
        })}
        onClick={handleClick}
        aria-label={label}
        title={label}
        aria-haspopup={castState.connected ? 'menu' : undefined}
        aria-expanded={castState.connected ? Boolean(menuAnchor) : undefined}
        aria-busy={requesting || undefined}
        disabled={requesting}
        tabIndex={tabIndex}
      >
        <MdCast size={size} />
      </IconButton>
      {castState.connected && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          getContentAnchorEl={null}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          classes={{ paper: classes.menuPaper }}
          elevation={0}
        >
          <MenuItem className={classes.menuItem} onClick={handleUseThisDevice}>
            <ListItemIcon className={classes.iconWrapper}>
              <MdPhoneAndroid size={18} />
            </ListItemIcon>
            <ListItemText
              primary="Play on this device"
              classes={{ primary: classes.itemText }}
            />
          </MenuItem>
        </Menu>
      )}
    </>
  )
}

export default CastButton
