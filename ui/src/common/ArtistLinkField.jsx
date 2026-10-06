import React from 'react'
import { useImmediateLinkPress } from '../audioplayer/controlPress'
import PropTypes from 'prop-types'
import { Link } from 'react-admin'
import { withWidth } from '@material-ui/core'
import { useGetHandleArtistClick } from './useGetHandleArtistClick'
import { intersperse } from '../utils/index.js'
import { useDispatch } from 'react-redux'
import { closeExtendedInfoDialog } from '../actions/dialogs.js'

// noSSR: withWidth otherwise renders null until mounted, so the artist line pops in and grows the row.
const ALink = withWidth({ noSSR: true })((props) => {
  const { artist, width, onArtistClick, ...rest } = props
  const artistLink = useGetHandleArtistClick(width)
  const dispatch = useDispatch()
  const activateArtist = React.useCallback(
    (event) => {
      dispatch(closeExtendedInfoDialog())
      onArtistClick?.(event)
    },
    [dispatch, onArtistClick],
  )
  const immediatePress = useImmediateLinkPress(activateArtist)

  return (
    <Link
      key={artist.id}
      to={artistLink(artist.id)}
      {...(onArtistClick ? immediatePress : {})}
      onClick={(e) => {
        if (onArtistClick) {
          immediatePress.onClick(e)
          e.currentTarget.blur()
        } else {
          e.stopPropagation()
          dispatch(closeExtendedInfoDialog())
        }
        e.stopPropagation()
      }}
      {...rest}
    >
      {artist.name}
      {artist.subroles?.length > 0 ? ` (${artist.subroles.join(', ')})` : ''}
    </Link>
  )
})

const parseAndReplaceArtists = (
  displayAlbumArtist,
  albumArtists,
  className,
  onArtistClick,
) => {
  let result = []
  let lastIndex = 0

  albumArtists?.forEach((artist) => {
    const index = displayAlbumArtist.indexOf(artist.name, lastIndex)
    if (index !== -1) {
      // Add text before the artist name
      if (index > lastIndex) {
        result.push(displayAlbumArtist.slice(lastIndex, index))
      }
      // Add the artist link
      result.push(
        <ALink
          artist={artist}
          className={className}
          onArtistClick={onArtistClick}
          key={artist.id}
        />,
      )
      lastIndex = index + artist.name.length
    }
  })

  if (lastIndex === 0) {
    return []
  }

  // Add any remaining text after the last artist name
  if (lastIndex < displayAlbumArtist.length) {
    result.push(displayAlbumArtist.slice(lastIndex))
  }

  return result
}

export const ArtistLinkField = ({
  record,
  className,
  limit,
  source,
  onArtistClick,
}) => {
  const role = source.toLowerCase()

  // Get artists array with fallback
  let artists = record?.participants?.[role] || []
  const remixers =
    role === 'artist' && record?.participants?.remixer
      ? record.participants.remixer.slice(0, 2)
      : []

  // Use parseAndReplaceArtists for artist and albumartist roles
  if ((role === 'artist' || role === 'albumartist') && record[source]) {
    const artistsLinks = parseAndReplaceArtists(
      record[source],
      artists,
      className,
      onArtistClick,
    )

    if (artistsLinks.length > 0) {
      // For artist role, append remixers if available, avoiding duplicates
      if (role === 'artist' && remixers.length > 0) {
        // Track which artists are already displayed to avoid duplicates
        const displayedArtistIds = new Set(
          artists.map((artist) => artist.id).filter(Boolean),
        )

        // Only add remixers that aren't already in the artists list
        const uniqueRemixers = remixers.filter(
          (remixer) => remixer.id && !displayedArtistIds.has(remixer.id),
        )

        if (uniqueRemixers.length > 0) {
          artistsLinks.push(' • ')
          uniqueRemixers.forEach((remixer, index) => {
            if (index > 0) artistsLinks.push(' • ')
            artistsLinks.push(
              <ALink
                artist={remixer}
                className={className}
                onArtistClick={onArtistClick}
                key={`remixer-${remixer.id}`}
              />,
            )
          })
        }
      }

      return <div className={className}>{artistsLinks}</div>
    }
  }

  // Fall back to regular handling
  if (artists.length === 0 && record[source]) {
    artists = [{ name: record[source], id: record[source + 'Id'] }]
  }

  // For artist role, combine artists and remixers before deduplication
  const allArtists = role === 'artist' ? [...artists, ...remixers] : artists

  // Dedupe artists and collect subroles
  const seen = new Map()
  const dedupedArtists = []
  let limitedShow = false

  for (const artist of allArtists) {
    if (!artist?.id) continue

    if (!seen.has(artist.id)) {
      if (dedupedArtists.length < limit) {
        seen.set(artist.id, dedupedArtists.length)
        dedupedArtists.push({
          ...artist,
          subroles: artist.subRole ? [artist.subRole] : [],
        })
      } else {
        limitedShow = true
      }
    } else {
      const position = seen.get(artist.id)
      const existing = dedupedArtists[position]
      if (artist.subRole && !existing.subroles.includes(artist.subRole)) {
        existing.subroles.push(artist.subRole)
      }
    }
  }

  // Create artist links
  const artistsList = dedupedArtists.map((artist) => (
    <ALink
      artist={artist}
      className={className}
      onArtistClick={onArtistClick}
      key={artist.id}
    />
  ))

  if (limitedShow) {
    artistsList.push(<span key="more">...</span>)
  }

  return <>{intersperse(artistsList, ' • ')}</>
}

ArtistLinkField.propTypes = {
  limit: PropTypes.number,
  record: PropTypes.object,
  className: PropTypes.string,
  source: PropTypes.string,
  onArtistClick: PropTypes.func,
}

ArtistLinkField.defaultProps = {
  addLabel: true,
  limit: 3,
  source: 'albumArtist',
}
