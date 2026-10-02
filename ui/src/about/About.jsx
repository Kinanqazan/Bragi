import React, { useEffect, useState } from 'react'
import Link from '@material-ui/core/Link'
import Card from '@material-ui/core/Card'
import Avatar from '@material-ui/core/Avatar'
import Paper from '@material-ui/core/Paper'
import { Title, useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import config from '../config'
import subsonic from '../subsonic/index.js'
import { Typography } from '@material-ui/core'
import BragiLogo from '../icons/BragiLogo'

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: '1em',
    marginBottom: theme.spacing(3),
    background: 'transparent !important',
    backgroundColor: 'transparent !important',
    backgroundImage: 'none !important',
    boxShadow: 'none !important',
  },
  panel: {
    marginTop: theme.spacing(2),
    overflow: 'hidden',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    backgroundColor: theme.palette.background.paper,
  },
  contentPanel: {
    padding: theme.spacing(3),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  aboutContent: {
    display: 'grid',
    gap: theme.spacing(2.5),
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    background:
      theme.palette.type === 'dark'
        ? 'linear-gradient(135deg, rgba(255,255,255,0.065), rgba(255,255,255,0.015))'
        : 'linear-gradient(135deg, rgba(0,0,0,0.035), rgba(255,255,255,0.8))',
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
      gap: theme.spacing(2),
      padding: theme.spacing(2.5),
    },
  },
  heroMark: {
    display: 'grid',
    placeItems: 'center',
    width: 84,
    height: 84,
    borderRadius: 22,
    color: theme.brandColor || theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
    [theme.breakpoints.down('xs')]: {
      width: 68,
      height: 68,
      borderRadius: 18,
    },
  },
  heroLogo: {
    width: 54,
    height: 54,
    [theme.breakpoints.down('xs')]: {
      width: 44,
      height: 44,
    },
  },
  eyebrow: {
    color: theme.palette.primary.main,
    fontWeight: 700,
    letterSpacing: '0.09em',
  },
  heroTitle: {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
    fontWeight: 700,
    letterSpacing: '-0.025em',
  },
  heroDescription: {
    maxWidth: 660,
    color: theme.palette.text.secondary,
    lineHeight: 1.7,
  },
  creatorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
  },
  creatorAvatar: {
    width: 46,
    height: 46,
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
    fontWeight: 700,
  },
  creatorCopy: {
    minWidth: 0,
  },
  creatorDescription: {
    marginTop: theme.spacing(0.25),
    color: theme.palette.text.secondary,
  },
  versionCard: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(0.5),
  },
  versionLabel: {
    color: theme.palette.text.secondary,
  },
  versionValue: {
    padding: theme.spacing(0.75, 1.25),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.action.hover,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.82rem',
  },
}))

const LinkToVersion = ({ version }) => {
  return <>{version || '—'}</>
}

const AboutContent = ({
  uiVersion,
  serverVersion,
}) => {
  const translate = useTranslate()
  const classes = useStyles()

  return (
    <div className={classes.aboutContent}>
      <section className={classes.hero}>
        <div className={classes.heroMark}>
          <BragiLogo className={classes.heroLogo} />
        </div>
        <div>
          <Typography variant="overline" className={classes.eyebrow}>
            {translate('about.eyebrow', { _: 'YOUR PERSONAL MUSIC SERVER' })}
          </Typography>
          <Typography variant="h4" className={classes.heroTitle}>
            {translate('about.headline', { _: 'Your music, on your terms.' })}
          </Typography>
          <Typography variant="body1" className={classes.heroDescription}>
            {translate('about.description', {
              _: 'Bragi is my self-hosted music server and player for my music library, available on the web and Android.',
            })}
          </Typography>
        </div>
      </section>

      <section className={classes.creatorCard}>
        <Avatar className={classes.creatorAvatar}>K</Avatar>
        <div className={classes.creatorCopy}>
          <Typography variant="overline" className={classes.eyebrow}>
            {translate('about.creatorLabel', { _: 'BUILT BY' })}
          </Typography>
          <Typography variant="h6">Kinan</Typography>
          <Typography variant="body2" className={classes.creatorDescription}>
            {translate('about.creator', {
              _: 'I’m exploring applied AI by building practical software.',
            })}
          </Typography>
        </div>
      </section>

      {serverVersion && (
        <div className={classes.versionCard}>
          <Typography variant="overline" className={classes.versionLabel}>
            {translate('menu.version')}
          </Typography>
          <Typography variant="body2" className={classes.versionValue}>
            <LinkToVersion version={serverVersion} />
          </Typography>
          {uiVersion !== serverVersion && (
            <Typography variant="caption" component="div">
              UI {translate('menu.version')}: {uiVersion}{' '}
              <Link onClick={() => window.location.reload()}>
                {translate('ra.notification.new_version')}
              </Link>
            </Typography>
          )}
        </div>
      )}
    </div>
  )
}

const About = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const [serverVersion, setServerVersion] = useState('')
  const uiVersion = config.version

  useEffect(() => {
    let isMounted = true
    subsonic
      .ping()
      .then((resp) => resp?.json?.['subsonic-response'])
      .then((data) => {
        if (isMounted && data?.status === 'ok') {
          setServerVersion(data.serverVersion)
        }
      })
      .catch((e) => {
        if (isMounted) {
          // eslint-disable-next-line no-console
          console.error('error pinging server', e)
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <Card className={`${classes.root} phone-page-scroll`}>
      <Title title={`Bragi - ${translate('menu.about', { _: 'About' })}`} />
      <Paper className={classes.panel} elevation={0}>
        <div className={classes.contentPanel}>
          <AboutContent
            uiVersion={uiVersion}
            serverVersion={serverVersion}
          />
        </div>
      </Paper>
    </Card>
  )
}

export { About, LinkToVersion }
export default About
