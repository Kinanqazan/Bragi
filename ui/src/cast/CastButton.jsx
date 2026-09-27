import React, { useContext, useEffect, useRef, useState } from 'react'
import { ReactReduxContext } from 'react-redux'
import { showNotification } from 'react-admin'
import { IconButton } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { MdCast } from 'react-icons/md'
import { requestCastSession } from './castApi'
import { getCastErrorCode } from './castDiagnostics'
import { useCastState } from './useCastState'

const useStyles = makeStyles((theme) => {
  return {
    connected: {
      color: `${theme.palette.primary.main} !important`,
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

  const handleClick = async () => {
    if (requesting) return

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

  const label = castState.connected
    ? `Choose playback device${castState.deviceName ? ` — connected to ${castState.deviceName}` : ''}`
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
        aria-haspopup="dialog"
        aria-busy={requesting || undefined}
        disabled={requesting}
        tabIndex={tabIndex}
      >
        <MdCast size={size} />
      </IconButton>
    </>
  )
}

export default CastButton
