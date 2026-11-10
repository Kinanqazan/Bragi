import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useDispatch } from 'react-redux'
import {
  useNotify,
  usePermissions,
  useTranslate,
  useDataProvider,
  useRefresh,
} from 'react-admin'
import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import { MdQuestionMark } from 'react-icons/md'
import clsx from 'clsx'
import { openAddToPlaylist, playNext, openExtendedInfoDialog } from '../actions'
import { LoveButton } from './LoveButton'
import config from '../config'
import { playSimilar } from './playbackActions.js'
import { useHistory, useLocation } from 'react-router-dom'
import { openSong } from '../song/songNavigation'

const useStyles = makeStyles((theme) => ({
  noWrap: {
    whiteSpace: 'nowrap',
  },
  deleteItem: {
    color: theme.palette.error.main,
  },
  deleteDialog: {
    borderRadius: 16,
    padding: theme.spacing(1),
    width: '100%',
    maxWidth: 400,
  },
  deleteActions: { padding: theme.spacing(1, 3, 2), gap: theme.spacing(1) },
  deleteButton: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    '&:hover': { backgroundColor: theme.palette.error.dark },
  },
}))

const MoreButton = ({
  record,
  onClick,
  info,
  className,
  size = 'small',
  disabled,
  ...rest
}) => {
  const handleClick = record?.missing
    ? (e) => {
        info.action(record)
        e.stopPropagation()
      }
    : onClick
  return (
    <IconButton
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      size={size}
      className={className}
      disabled={disabled}
      aria-label="more"
      {...rest}
    >
      {record?.missing ? (
        <MdQuestionMark fontSize={'large'} />
      ) : (
        <MoreVertIcon fontSize={size === 'small' ? 'small' : undefined} />
      )}
    </IconButton>
  )
}

export const SongContextMenu = ({
  resource,
  record,
  showLove,
  onAddToPlaylist,
  className,
  buttonClassName,
  buttonSize = 'small',
  disabled,
  'data-testid': testId,
}) => {
  const classes = useStyles()
  const dispatch = useDispatch()
  const translate = useTranslate()
  const notify = useNotify()
  const dataProvider = useDataProvider()
  const [anchorEl, setAnchorEl] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { permissions } = usePermissions()
  const history = useHistory()
  const location = useLocation()
  const refresh = useRefresh()

  const options = {
    openSongPage: {
      enabled: !record.missing,
      label: translate('resources.song.actions.openSongPage', {
        _: 'Open song page',
      }),
      action: (record) => openSong(history, location, record),
    },
    playNext: {
      enabled: !record.missing,
      label: translate('resources.song.actions.playNext', { _: 'Play next' }),
      action: (record) => {
        const id = record.mediaFileId || record.id
        dispatch(playNext({ [id]: record }, [id]))
      },
    },
    instantMix: {
      enabled: config.enableExternalServices,
      label: translate('resources.song.actions.instantMix'),
      action: async (record) => {
        notify('message.startingInstantMix', { type: 'info' })
        try {
          const id = record.mediaFileId || record.id
          await playSimilar(dispatch, notify, id, {
            seedRecord: record,
            shuffle: false,
          })
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Error starting instant mix:', e)
          notify('ra.page.error', { type: 'warning' })
        }
      },
    },
    addToPlaylist: {
      enabled: true,
      label: translate('resources.song.actions.addToPlaylist'),
      action: (record) =>
        dispatch(
          openAddToPlaylist({
            selectedIds: [record.mediaFileId || record.id],
            onSuccess: (id) => onAddToPlaylist(id),
          }),
        ),
    },
    deleteFile: {
      enabled:
        config.enableMediaFileDeletion &&
        permissions === 'admin' &&
        !record.missing,
      label: translate('resources.song.actions.deleteFile'),
      action: () => setDeleteDialogOpen(true),
    },
    info: {
      enabled: true,
      label: translate('resources.song.actions.info'),
      action: async (record) => {
        let fullRecord = record
        if (permissions === 'admin' && !record.missing) {
          try {
            let id = record.mediaFileId ?? record.id
            const data = await dataProvider.inspect(id)
            fullRecord = { ...record, rawTags: data.data.rawTags }
          } catch (error) {
            notify(
              translate('ra.notification.http_error') + ': ' + error.message,
              {
                type: 'warning',
                multiLine: true,
                duration: 0,
              },
            )
          }
        }

        dispatch(openExtendedInfoDialog(fullRecord))
      },
    },
  }

  const handleClick = (e) => {
    setAnchorEl(e.currentTarget)
    e.stopPropagation()
  }

  const handleItemClick = (e) => {
    e.preventDefault()
    const key = e.currentTarget.getAttribute('value')
    const action = options[key].action

    setAnchorEl(null)
    action(record)
    e.stopPropagation()
  }

  const handleMainMenuClose = (e) => {
    setAnchorEl(null)
    e.stopPropagation()
  }

  const open = Boolean(anchorEl)

  const handleDeleteFile = async () => {
    setDeleting(true)
    try {
      const id = record.mediaFileId || record.id
      await dataProvider.deleteMediaFile(id)
      setDeleteDialogOpen(false)
      notify('message.mediaFileDeleted', { type: 'info' })
      refresh()
    } catch (error) {
      notify(translate('ra.notification.http_error') + ': ' + error.message, {
        type: 'warning',
        multiLine: true,
      })
    } finally {
      setDeleting(false)
    }
  }

  if (!record) {
    return null
  }

  const present = !record.missing

  return (
    <span className={clsx(classes.noWrap, className)}>
      <LoveButton
        record={record}
        resource={resource}
        visible={config.enableFavourites && showLove && present}
      />
      <MoreButton
        record={record}
        onClick={handleClick}
        info={options.info}
        className={buttonClassName}
        size={buttonSize}
        disabled={disabled}
        data-testid={testId}
        aria-expanded={open}
        aria-haspopup="true"
      />
      <Menu
        id={'menu' + record.id}
        anchorEl={anchorEl}
        open={open}
        onClose={handleMainMenuClose}
        getContentAnchorEl={null}
        style={{ zIndex: 1500 }}
      >
        {Object.keys(options)
          .filter((key) => key !== 'info')
          .map(
            (key) =>
              options[key].enabled && (
                <MenuItem
                  value={key}
                  key={key}
                  className={
                    key === 'deleteFile' ? classes.deleteItem : undefined
                  }
                  onClick={handleItemClick}
                >
                  {options[key].label}
                </MenuItem>
              ),
          )}
      </Menu>
      <Dialog
        open={deleteDialogOpen}
        onClose={deleting ? undefined : () => setDeleteDialogOpen(false)}
        aria-labelledby="delete-song-title"
        classes={{ paper: classes.deleteDialog }}
      >
        <DialogTitle id="delete-song-title">
          {translate('message.delete_media_file_title', {
            title: record.title,
          })}
        </DialogTitle>
        <DialogActions className={classes.deleteActions}>
          <Button
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(false)}
          >
            {translate('ra.action.cancel')}
          </Button>
          <Button
            className={classes.deleteButton}
            disabled={deleting}
            onClick={handleDeleteFile}
            variant="contained"
            disableElevation
          >
            {translate('ra.action.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </span>
  )
}

SongContextMenu.propTypes = {
  resource: PropTypes.string.isRequired,
  record: PropTypes.object.isRequired,
  onAddToPlaylist: PropTypes.func,
  showLove: PropTypes.bool,
  buttonClassName: PropTypes.string,
  buttonSize: PropTypes.string,
  disabled: PropTypes.bool,
}

SongContextMenu.defaultProps = {
  onAddToPlaylist: () => {},
  record: {},
  resource: 'song',
  showLove: true,
  addLabel: true,
  buttonSize: 'small',
}
