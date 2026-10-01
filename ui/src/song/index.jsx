import React from 'react'
import MusicNoteOutlinedIcon from '@material-ui/icons/MusicNoteOutlined'
import MusicNoteIcon from '@material-ui/icons/MusicNote'
import DynamicMenuIcon from '../layout/DynamicMenuIcon'
import SongList from './SongList'
import { lazyLoad } from '../common'

const SongShow = lazyLoad(() => import('./SongShow'))

export default {
  list: SongList,
  show: SongShow,
  icon: (
    <DynamicMenuIcon
      path={'song'}
      icon={MusicNoteOutlinedIcon}
      activeIcon={MusicNoteIcon}
    />
  ),
}
