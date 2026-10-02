import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslate } from 'react-admin'
import { Button, TextField, Typography, makeStyles } from '@material-ui/core'
import { setSidebarExternalLink } from '../actions'

const EMPTY_SIDEBAR_LINK = { label: '', url: '' }

const normalizeExternalUrl = (value) => {
  try {
    const trimmed = value.trim()
    if (!/^https?:\/\//i.test(trimmed)) return ''
    const url = new URL(trimmed)
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}

const useStyles = makeStyles((theme) => ({
  root: {
    margin: '1.5rem 1rem 1rem',
    maxWidth: 480,
  },
  title: {
    marginBottom: theme.spacing(1),
  },
  field: {
    marginBottom: theme.spacing(1),
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
}))

const SidebarLinkSettings = () => {
  const dispatch = useDispatch()
  const translate = useTranslate()
  const classes = useStyles()
  const savedLink = useSelector(
    (state) => state.settings?.sidebarExternalLink || EMPTY_SIDEBAR_LINK,
  )
  const [label, setLabel] = useState(savedLink.label || '')
  const [url, setUrl] = useState(savedLink.url || '')
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setLabel(savedLink.label || '')
    setUrl(savedLink.url || '')
  }, [savedLink.label, savedLink.url])

  const save = () => {
    const normalizedLabel = label.trim()
    const urlValue = url.trim()
    if (!normalizedLabel && !urlValue) {
      dispatch(setSidebarExternalLink(EMPTY_SIDEBAR_LINK))
      setErrors({})
      return
    }

    const normalizedUrl = normalizeExternalUrl(urlValue)
    const nextErrors = {
      label: normalizedLabel
        ? ''
        : translate('menu.sidebarShortcut.nameRequired', {
            _: 'Enter a button name.',
          }),
      url: normalizedUrl
        ? ''
        : translate('menu.sidebarShortcut.urlRequired', {
            _: 'Enter a valid http:// or https:// URL.',
          }),
    }
    setErrors(nextErrors)
    if (nextErrors.label || nextErrors.url) return

    dispatch(
      setSidebarExternalLink({ label: normalizedLabel, url: normalizedUrl }),
    )
  }

  const clear = () => {
    setLabel('')
    setUrl('')
    setErrors({})
    dispatch(setSidebarExternalLink(EMPTY_SIDEBAR_LINK))
  }

  return (
    <section className={classes.root}>
      <Typography variant="h6" className={classes.title}>
        {translate('menu.configureSidebarLink', {
          _: 'Configure Sidebar Link',
        })}
      </Typography>
      <TextField
        className={classes.field}
        label={translate('menu.sidebarShortcut.buttonName', {
          _: 'Button name',
        })}
        value={label}
        onChange={(event) => {
          setLabel(event.target.value)
          setErrors((current) => ({ ...current, label: '' }))
        }}
        error={Boolean(errors.label)}
        helperText={errors.label}
        fullWidth
      />
      <TextField
        className={classes.field}
        label={translate('menu.sidebarShortcut.url', { _: 'URL' })}
        placeholder="http://192.168.1.25:8081"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value)
          setErrors((current) => ({ ...current, url: '' }))
        }}
        error={Boolean(errors.url)}
        helperText={
          errors.url ||
          translate('menu.sidebarShortcut.urlHelp', {
            _: 'Use a complete http:// or https:// URL.',
          })
        }
        fullWidth
      />
      <Typography variant="caption" color="textSecondary">
        {translate('menu.sidebarShortcut.clearHelp', {
          _: 'Leave both fields empty to remove the shortcut.',
        })}
      </Typography>
      <div className={classes.actions}>
        <Button color="primary" variant="contained" onClick={save}>
          {translate('ra.action.save', { _: 'Save' })}
        </Button>
        <Button onClick={clear}>
          {translate('ra.action.clear', { _: 'Clear' })}
        </Button>
      </div>
    </section>
  )
}

export default SidebarLinkSettings
