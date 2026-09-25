import { v4 as uuidv4 } from 'uuid'
import subsonic from '../subsonic'

const pad = (value) => String(value).padStart(2, '0')

const parseLyrics = (lyrics) => {
  if (!lyrics) return ''
  try {
    const structured = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics
    let lyricText = ''
    for (const structuredLyric of structured || []) {
      if (!structuredLyric.synced) continue
      for (const line of structuredLyric.line || []) {
        const centiseconds = Math.floor((line.start || 0) / 10)
        const milliseconds = centiseconds % 100
        const totalSeconds = Math.floor(centiseconds / 100)
        const seconds = totalSeconds % 60
        const minutes = Math.floor(totalSeconds / 60)
        lyricText += `[${pad(minutes)}:${pad(seconds)}.${pad(milliseconds)}] ${line.value || ''}\n`
      }
    }
    return lyricText
  } catch {
    return ''
  }
}

export const toQueueTrack = (item = {}) => {
  const trackId = item.mediaFileId || item.trackId || item.id
  const isRadio = Boolean(item.isRadio)
  const coverArt = item.coverArt || item.song?.coverArt
  const cover =
    item.cover ||
    (!isRadio && (coverArt || trackId)
      ? subsonic.getCoverArtUrl(
          coverArt
            ? { coverArt, updatedAt: item.updatedAt || item.song?.updatedAt }
            : {
                id: trackId,
                updatedAt: item.updatedAt || item.song?.updatedAt,
                album: item.album || item.song?.album,
                albumArtist: item.albumArtist || item.song?.albumArtist,
              },
          300,
        )
      : '')

  return {
    uuid: item.uuid || uuidv4(),
    trackId,
    song: item.song || item,
    title: item.title || item.name || item.song?.title || '',
    name: item.name || item.title || item.song?.title || '',
    artist: item.artist || item.singer || item.song?.artist || '',
    singer: item.singer || item.artist || item.song?.artist || '',
    album: item.album || item.song?.album || '',
    duration: item.duration || item.song?.duration || 0,
    cover,
    lyric: item.lyric || parseLyrics(item.lyrics || item.song?.lyrics),
    lyrics: item.lyrics || item.song?.lyrics || '',
    isRadio,
    // Only radio sources are already known. Normal tracks are resolved by the
    // PlaybackEngine and intentionally have no stored stream URL.
    streamUrl: isRadio
      ? item.streamUrl || item['music' + 'Src'] || ''
      : undefined,
  }
}

export const normalizePersistedTrack = (item = {}) => toQueueTrack(item)

export const trackIdOf = (track) =>
  track?.trackId || track?.song?.id || track?.id || null
