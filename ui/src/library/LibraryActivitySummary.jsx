import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { usePermissions, useTranslate } from 'react-admin'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { alpha } from '@material-ui/core/styles'
import config from '../config'
import { useInterval } from '../common'
import { formatDuration, formatShortDuration } from '../utils'
import { useScanElapsedTime } from '../layout/useScanElapsedTime'

const useStyles = makeStyles((theme) => ({
  card: {
    borderRadius: 14,
    border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
    boxShadow: 'none',
    overflow: 'hidden',
  },
  content: {
    padding: theme.spacing(2.5),
    '&:last-child': {
      paddingBottom: theme.spacing(2.5),
    },
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2),
      '&:last-child': {
        paddingBottom: theme.spacing(2),
      },
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  title: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  scanning: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1),
    borderRadius: 999,
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
    minHeight: 68,
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 10,
    backgroundColor: alpha(theme.palette.text.primary, 0.035),
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: '0.72rem',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  value: {
    fontSize: '1rem',
    fontWeight: 650,
    color: theme.palette.text.primary,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  },
  error: {
    color: theme.palette.error.main,
  },
  errorBox: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderRadius: 6,
    backgroundColor: alpha(theme.palette.error.main, 0.12),
  },
  [theme.breakpoints.down('xs')]: {
    stat: {
      minHeight: 64,
      padding: theme.spacing(1, 1.25),
    },
    value: {
      fontSize: '0.95rem',
    },
  },
}))

const Uptime = ({ start }) => {
  const [uptime, setUptime] = useState(() =>
    start?.startTime
      ? formatDuration((Date.now() - start.startTime) / 1000)
      : '-',
  )

  useInterval(() => {
    setUptime(
      start?.startTime
        ? formatDuration((Date.now() - start.startTime) / 1000)
        : '-',
    )
  }, 1000)

  return <>{uptime}</>
}

const LibraryActivitySummary = () => {
  const translate = useTranslate()
  const classes = useStyles()
  const { permissions } = usePermissions()
  const scanStatus = useSelector((state) => state.activity?.scanStatus || {})
  const serverStart = useSelector((state) => state.activity?.serverStart || {})
  const showActivity = config.devActivityPanel || permissions === 'admin'
  const elapsed = useScanElapsedTime(
    scanStatus.scanning,
    scanStatus.elapsedTime,
  )
  const serverIsUp = Boolean(serverStart.startTime)

  if (!showActivity) return null

  const lastScanType = (() => {
    switch (scanStatus.scanType) {
      case 'full':
        return translate('activity.fullScan', { _: 'Full scan' })
      case 'quick':
        return translate('activity.quickScan', { _: 'Quick scan' })
      case 'full-selective':
      case 'quick-selective':
        return translate('activity.selectiveScan', { _: 'Selective' })
      default:
        return '-'
    }
  })()

  const stats = [
    {
      label: translate('activity.serverUptime', { _: 'Server Uptime' }),
      value: serverIsUp ? <Uptime start={serverStart} /> : translate('activity.serverDown', { _: 'Server Down' }),
      error: !serverIsUp,
    },
    {
      label: translate('activity.totalScanned', { _: 'Total Folders Scanned' }),
      value: scanStatus.folderCount || '-',
    },
    {
      label: translate('activity.scanType', { _: 'Last Scan' }),
      value: lastScanType,
    },
    {
      label: translate('activity.elapsedTime', { _: 'Elapsed Time' }),
      value: scanStatus.scanning || elapsed > 0 ? formatShortDuration(elapsed) : '-',
    },
  ]

  return (
    <Card className={classes.card}>
      <CardContent className={classes.content}>
        <div className={classes.header}>
          <Typography className={classes.title}>
            {translate('activity.title', { _: 'Server & Sync Status' })}
          </Typography>
          {scanStatus.scanning && (
            <Box className={classes.scanning}>
              <CircularProgress size={12} color="primary" />
              <Typography variant="caption" color="inherit">
                {translate('activity.scanning', { _: 'Scanning...' })}
              </Typography>
            </Box>
          )}
        </div>
        <div className={classes.stats}>
          {stats.map(({ label, value, error }) => (
            <div className={classes.stat} key={label}>
              <span className={classes.label}>{label}</span>
              <span className={`${classes.value} ${error ? classes.error : ''}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
        {scanStatus.error && (
          <div className={classes.errorBox}>
            <Typography variant="caption" className={classes.error}>
              {translate('activity.status', { _: 'Status' })}: {scanStatus.error}
            </Typography>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LibraryActivitySummary
