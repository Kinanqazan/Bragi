import React, { cloneElement, useCallback, useRef } from 'react'
import { Backdrop, Modal, Paper, useMediaQuery } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { Sidebar as RASidebar, setSidebarVisibility } from 'react-admin'
import { useDispatch, useSelector } from 'react-redux'
import { MOBILE_SIDEBAR_BACKGROUND_COLOR } from '../consts'
import useSidebarSwipe from './useSidebarSwipe'

const useStyles = makeStyles((theme) => ({
  '@global': {
    '@media (max-width: 959.95px)': {
      body: { touchAction: 'pan-y pinch-zoom' },
    },
  },
  modal: {
    // Above the fixed header and mobile player, below dialogs and popovers.
    zIndex: theme.zIndex.modal - 1,
  },
  paper: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    maxWidth: 'calc(100vw - 32px)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    touchAction: 'pan-y pinch-zoom',
    background: `${MOBILE_SIDEBAR_BACKGROUND_COLOR} !important`,
    outline: 'none',
    '& > div': { width: '100%' },
  },
}))

const MobileSidebar = ({ children }) => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const open = useSelector((state) => state.admin.ui.sidebarOpen)
  const initialOpen = useRef(open)
  const changeOpen = useCallback(
    (value) => dispatch(setSidebarVisibility(value)),
    [dispatch],
  )
  const { paperRef, present, dragging } = useSidebarSwipe(open, changeOpen)

  return (
    <Modal
      className={`MuiDrawer-root MuiDrawer-modal ${classes.modal}`}
      open={present}
      keepMounted
      disableAutoFocus={dragging || !open}
      disableEnforceFocus={dragging || !open}
      onClose={() => changeOpen(false)}
      BackdropComponent={Backdrop}
      BackdropProps={{ invisible: true, transitionDuration: 0 }}
    >
      <Paper
        ref={paperRef}
        className={`MuiDrawer-paper ${classes.paper}`}
        elevation={0}
        square
        role="dialog"
        aria-label="Navigation"
        aria-modal="true"
        tabIndex={-1}
        style={{
          transform: initialOpen.current
            ? 'translate3d(0%, 0, 0)'
            : 'translate3d(-100%, 0, 0)',
        }}
      >
        {cloneElement(children, { sidebarOpen: true })}
      </Paper>
    </Modal>
  )
}

const Sidebar = (props) => {
  const isPhoneMode = useMediaQuery((theme) => theme.breakpoints.down('sm'))
  return isPhoneMode ? <MobileSidebar {...props} /> : <RASidebar {...props} />
}

export default Sidebar
