import React, { useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Layout as RALayout } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from '@material-ui/core/styles'
import Menu from './Menu'
import AppBar from './AppBar'
import Notification from './Notification'
import MobileBottomNav from './MobileBottomNav'
import useCurrentTheme from '../themes/useCurrentTheme'
import { useSearchRefocus } from '../common'
import { desktopPlayerMediaQuery } from '../audioplayer/playerLayout'

const useStyles = makeStyles((theme) => ({
  root: (props) => ({
    width: '100%',
    maxWidth: '100vw',
    minWidth: 0,
    height: '100vh',
    maxHeight: '100vh',
    boxSizing: 'border-box',
    overflow: 'hidden',
    paddingBottom: props.addPadding
      ? 'calc(184px + env(safe-area-inset-bottom))'
      : 'calc(84px + env(safe-area-inset-bottom))',
    '& .MuiDrawer-root.MuiDrawer-modal, & .MuiDrawer-modal, & .RaSidebar-root .MuiDrawer-modal':
      {
        background: 'transparent !important',
        backgroundColor: 'transparent !important',
      },
    '& .MuiDrawer-modal .MuiBackdrop-root, & .RaSidebar-root .MuiBackdrop-root':
      {
        background: 'transparent !important',
        backgroundColor: 'transparent !important',
        backdropFilter: 'none !important',
        WebkitBackdropFilter: 'none !important',
      },
    '& [class*="appFrame"], & [class*="contentWithSidebar"], & [class*="RaLayout-appFrame"], & [class*="RaLayout-content"], & [class*="RaLayout-children"], & .RaSidebar-root, & [class*="RaSidebar"], & .MuiDrawer-docked':
      {
        marginTop: '0 !important',
        paddingTop: '0 !important',
        top: '0 !important',
        minWidth: 0,
      },
    [theme.breakpoints.down('sm')]: {
      '& .list-page, & [class*="RaList-root"], & [class*="RaList-main"], & [class*="RaList-content"], & .MuiCard-root':
        {
          marginTop: '0 !important',
          paddingTop: '0 !important',
          marginBottom: '0 !important',
          boxShadow: 'none !important',
        },
      '& .RaList-header, & div[class*="RaList-header"], & [class*="RaList-header"], & [class*="RaList-actions"], & [class*="RaTopToolbar-root"]':
        {
          display: 'none !important',
          minHeight: '0 !important',
          height: '0 !important',
          margin: '0 !important',
          padding: '0 !important',
        },
    },
    '& #main-content': {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
      paddingLeft: theme.spacing(3),
      paddingRight: theme.spacing(3),
      paddingTop: '24px',
      paddingBottom: theme.spacing(3),
      transition: theme.transitions.create(['padding-left', 'padding-right'], {
        easing: theme.transitions.easing.easeInOut,
        duration: theme.transitions.duration.shorter,
      }),
      [theme.breakpoints.down('sm')]: {
        paddingTop: '0 !important',
        paddingLeft: '16px !important',
        paddingRight: '16px !important',
        paddingBottom: theme.spacing(2),
      },
      [theme.breakpoints.down('xs')]: {
        paddingLeft: '16px !important',
        paddingRight: '16px !important',
        paddingTop: '0 !important',
        paddingBottom: theme.spacing(2),
      },
      '& thead.MuiTableHead-root, & .RaDatagrid-thead, & .RaDatagrid-headerRow':
        {
          [theme.breakpoints.down('xs')]: {
            display: 'none !important',
          },
        },
      '& .list-page, & [class*="RaList-root"], & [class*="RaList-main"], & [class*="RaList-content"]':
        {
          width: '100% !important',
          maxWidth: '100% !important',
          minWidth: '0 !important',
          boxSizing: 'border-box !important',
        },
      '& .RaList-content': {
        backgroundColor: 'transparent !important',
        boxShadow: 'none !important',
        backgroundImage: 'none !important',
        margin: '0 !important',
        padding: '0 !important',
        width: '100% !important',
        maxWidth: '100% !important',
        minWidth: '0 !important',
      },
      '& .RaList-main': {
        backgroundColor: 'transparent',
        padding: '0 !important',
        margin: '0 !important',
        width: '100% !important',
        maxWidth: '100% !important',
        minWidth: '0 !important',
      },
      '& .RaList-header': {
        display: 'none !important',
        minHeight: '0 !important',
        height: '0 !important',
        marginBottom: '0 !important',
        marginTop: '0 !important',
        padding: '0 !important',
        width: '100% !important',
      },
      '& .RaList-actions': {
        display: 'none !important',
        minHeight: '0 !important',
        height: '0 !important',
      },
      '& .RaTopToolbar-root': {
        display: 'none !important',
      },
      // Global filter form overrides — React-Admin FilterForm defaults
      '& form[class*="RaFilterForm"], & .RaFilterForm-root': {
        display: 'block !important',
        width: '100% !important',
        maxWidth: '100% !important',
        minHeight: '0 !important',
        height: 'auto !important',
        margin: '0 !important',
        padding: '0 !important',
        boxSizing: 'border-box !important',
        pointerEvents: 'auto !important',
      },
      // React-Admin FilterFormInput spacer + clearfix
      '& .filter-field > div:last-child:not(:first-child)': {
        display: 'none !important',
      },
      '& .RaFilterForm-clearfix, & [class*="clearfix"], & form[class*="RaFilterForm"] > div:last-child:not(.filter-field)':
        {
          display: 'none !important',
        },
      '& .filter-field, & div[class*="filter-field"]': {
        display: 'block !important',
        width: '100% !important',
        maxWidth: '100% !important',
        margin: '0 !important',
        padding: '0 !important',
        boxSizing: 'border-box !important',
        alignItems: 'center !important',
        pointerEvents: 'auto !important',
      },
      // Target ModernFilterBar directly through its stable structural wrapper
      '& div[class*="toolbarRoot"], & [class*="toolbarRoot"], & div[class*="filterRow"]':
        {
          display: 'flex !important',
          visibility: 'visible !important',
          opacity: '1 !important',
          minHeight: '38px !important',
          height: 'auto !important',
          pointerEvents: 'auto !important',
          zIndex: 10,
          position: 'sticky',
          top: 0,
        },
      '& div[class*="controlsGroup"], & div[class*="searchSection"]': {
        display: 'flex !important',
        visibility: 'visible !important',
        opacity: '1 !important',
        pointerEvents: 'auto !important',
      },
      '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
        display: 'inline-flex !important',
        boxSizing: 'border-box !important',
        alignItems: 'center !important',
        pointerEvents: 'auto !important',
      },
      // Force autocomplete chips to display inline — override MUI's flexWrap:wrap
      // Uses #main-content's ID specificity to beat MUI's own class-based selectors
      '& .MuiAutocomplete-inputRoot[class*="MuiOutlinedInput-root"]': {
        flexWrap: 'nowrap !important',
        overflow: 'hidden !important',
        alignItems: 'center !important',
      },
      // Center table pagination in main content
      '& .MuiTablePagination-root': {
        display: 'flex !important',
        justifyContent: 'center !important',
        width: '100% !important',
      },
      '& .MuiTablePagination-toolbar': {
        justifyContent: 'center !important',
        width: '100% !important',
      },
      '& .MuiTablePagination-spacer': {
        display: 'none !important',
      },
    },
    [desktopPlayerMediaQuery]: {
      paddingBottom: 0,
      '& #main-content': {
        paddingLeft: `${theme.spacing(3.5)}px !important`,
        paddingRight: `calc(var(--nd-player-offset, 0px) + 2px) !important`,
        paddingTop: '24px !important',
        paddingBottom: `${theme.spacing(3)}px !important`,
      },
    },
  }),
  appFrame: {
    marginTop: '0 !important',
    paddingTop: '0 !important',
    width: '100%',
    maxWidth: '100vw',
    minWidth: 0,
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
  },
  contentWithSidebar: {
    marginTop: '0 !important',
    paddingTop: '0 !important',
    width: '100%',
    maxWidth: '100vw',
    minWidth: 0,
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
  },
  content: {
    marginTop: '0 !important',
    paddingTop: '0 !important',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
  },
}))

const Layout = (props) => {
  const themeConfig = useCurrentTheme()
  const muiTheme = useMemo(() => createTheme(themeConfig), [themeConfig])
  const queue = useSelector((state) => state.player?.queue || [])
  const hasQueue = queue.length > 0
  const classes = useStyles({ addPadding: hasQueue })
  useSearchRefocus()

  useEffect(() => {
    const offset = hasQueue
      ? 'calc(200px + env(safe-area-inset-bottom, 0px))'
      : 'calc(96px + env(safe-area-inset-bottom, 0px))'
    document.documentElement.style.setProperty(
      '--nd-mobile-bottom-offset',
      offset,
    )
  }, [hasQueue])

  return (
    <>
      <RALayout
        {...props}
        className={classes.root}
        classes={{
          appFrame: classes.appFrame,
          contentWithSidebar: classes.contentWithSidebar,
          content: classes.content,
        }}
        menu={Menu}
        appBar={AppBar}
        theme={themeConfig}
        notification={Notification}
      />
      <MuiThemeProvider theme={muiTheme}>
        <MobileBottomNav />
      </MuiThemeProvider>
    </>
  )
}

export default Layout
