import { describe, expect, it, vi } from 'vitest'
import { openSong } from './songNavigation'

describe('openSong', () => {
  it('opens the media file behind a playlist entry and remembers its list', () => {
    const history = { push: vi.fn() }
    const location = {
      pathname: '/playlist/pl-1/show',
      search: '?page=3',
    }

    openSong(history, location, {
      id: 'playlist-entry-1',
      mediaFileId: 'music-file-1',
    })

    expect(history.push).toHaveBeenCalledWith({
      pathname: '/song/music-file-1/show',
      state: { returnTo: '/playlist/pl-1/show?page=3' },
    })
  })

  it('does nothing when there is no song ID', () => {
    const history = { push: vi.fn() }

    openSong(history, { pathname: '/song', search: '' }, {})

    expect(history.push).not.toHaveBeenCalled()
  })
})
