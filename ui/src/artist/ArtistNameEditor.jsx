import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from '@material-ui/core'
import { Button, useDataProvider, useNotify, usePermissions } from 'react-admin'
import EditIcon from '@material-ui/icons/Edit'
import config from '../config'
import { REST_URL } from '../consts'
import { httpClient } from '../dataProvider'

const ArtistNameEditor = ({ record, onSaved }) => {
  const notify = useNotify()
  const dataProvider = useDataProvider()
  const { permissions } = usePermissions()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(record.name || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(record.name || '')
  }, [record.id, record.name])

  if (!config.enableMediaFileMetadataEditing || permissions !== 'admin') return null

  const save = async (event) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      notify('Artist name cannot be empty', 'warning')
      return
    }
    setSaving(true)
    try {
      const id = encodeURIComponent(record.id)
      const response = await httpClient(`${REST_URL}/artist/${id}/name`, {
        method: 'PUT',
        body: JSON.stringify({ name: cleanName }),
      })
      onSaved(response.json.name)
      dataProvider.clearCache?.()
      setOpen(false)
      notify('Artist name updated', 'info')
    } catch (error) {
      notify(error.message || 'Could not update artist name', 'warning')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Tooltip title="Edit artist name">
        <IconButton
          size="small"
          aria-label="Edit artist name"
          onClick={() => setOpen(true)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !saving && setOpen(false)}>
        <form onSubmit={save}>
          <DialogTitle>Edit artist name</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Artist name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ maxLength: 255 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              label="ra.action.cancel"
              onClick={() => setOpen(false)}
              disabled={saving}
            />
            <Button
              type="submit"
              label="ra.action.save"
              disabled={saving || !name.trim()}
            />
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}

export default ArtistNameEditor
