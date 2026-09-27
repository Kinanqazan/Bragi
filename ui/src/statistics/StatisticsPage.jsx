import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'
import ListeningStats from './ListeningStats'

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    maxWidth: 900,
    height: '100%',
    margin: '0 auto',
    padding: theme.spacing(1, 0),
    overflowY: 'auto',
    boxSizing: 'border-box',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 0, 3),
    },
  },
  title: {
    marginBottom: theme.spacing(1),
    fontWeight: 700,
  },
}))

const StatisticsPage = () => {
  const classes = useStyles()

  return (
    <main className={classes.root}>
      <Typography variant="h4" component="h1" className={classes.title}>
        Listening stats
      </Typography>
      <ListeningStats showTitle={false} />
    </main>
  )
}

export default StatisticsPage
