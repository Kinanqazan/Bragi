import React from 'react'
import MusicNoteOutlinedIcon from '@material-ui/icons/MusicNoteOutlined'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import DynamicMenuIcon from '../layout/DynamicMenuIcon'
import SongList from './SongList'

export default {
  list: SongList,
  icon: (
    <DynamicMenuIcon
      path={'song'}
      icon={MusicNoteOutlinedIcon}
      activeIcon={MusicNoteIcon}
    />
  ),
}
