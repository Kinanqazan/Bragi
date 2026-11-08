import React, { useEffect, useState } from 'react'
import {
  Button,
  Link,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { httpClient } from '../dataProvider'

const useStyles = makeStyles((theme) => ({
  root: { margin: '1.5rem 1rem 1rem', maxWidth: 480 },
  title: { marginBottom: theme.spacing(1) },
  description: { marginBottom: theme.spacing(1.5) },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
}))

export default function YouTubeKeySettings() {
  const classes = useStyles()
  const [status, setStatus] = useState(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    httpClient('/api/listenbrainz/youtube-key')
      .then(({ json }) => {
        if (active) setStatus(json)
      })
      .catch(() => {
        if (active)
          setMessage(
            'Could not load YouTube settings. Check that the server is up to date.',
          )
      })
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    if (!key.trim()) return
    setBusy(true)
    setMessage('')
    try {
      await httpClient('/api/listenbrainz/youtube-key', {
        method: 'PUT',
        body: JSON.stringify({ key: key.trim() }),
      })
      setKey('')
      setStatus((current) => ({ ...current, configured: true }))
      setMessage(
        'API key saved. It will be checked when Bragi searches YouTube.',
      )
    } catch {
      setMessage('Could not save the API key. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setMessage('')
    try {
      await httpClient('/api/listenbrainz/youtube-key', { method: 'DELETE' })
      setStatus((current) => ({ ...current, configured: false }))
      setKey('')
      setMessage('Your API key was removed.')
    } catch {
      setMessage('Could not remove the API key. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        YouTube song links
      </Typography>
      <Typography
        variant="body2"
        color="textSecondary"
        className={classes.description}
      >
        Optional: add a YouTube Data API key to help For You find direct song
        links when MusicBrainz has none. Matches are not guaranteed. Your key is
        saved on this server for your account.{' '}
        <Link
          href="https://developers.google.com/youtube/registering_an_application"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (window.BragiNative?.openExternalUrl) {
              event.preventDefault()
              window.BragiNative.openExternalUrl(event.currentTarget.href)
            }
          }}
        >
          Get an API key
        </Link>
      </Typography>
      {status && (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.description}
        >
          {status.configured
            ? 'Your API key is saved.'
            : status.serverConfigured
              ? 'A server-wide API key is available.'
              : 'No API key configured.'}
        </Typography>
      )}
      <TextField
      id="youtube-data-api-key"
        label={status?.configured ? 'Replace API key' : 'YouTube Data API key'}
        type="password"
        autoComplete="off"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        fullWidth
        disabled={busy || !status}
      />
      <div className={classes.actions}>
        <Button
          variant="contained"
          color="primary"
          onClick={save}
          disabled={busy || !status || !key.trim()}
        >
          Save API key
        </Button>
        {status?.configured && (
          <Button onClick={remove} disabled={busy}>
            Remove API key
          </Button>
        )}
      </div>
      {message && (
        <Typography
          role="status"
          variant="body2"
          className={classes.description}
        >
          {message}
        </Typography>
      )}
    </section>
  )
}
