import React, { useState } from 'react'
import { Typography, Collapse } from '@material-ui/core'
import { makeStyles } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import ArtistExternalLinks from './ArtistExternalLink'
import config from '../config'
import { RatingField, ImageUploadOverlay, ImageViewerDialog } from '../common'
import ExpandInfoDialog from '../dialogs/ExpandInfoDialog'
import AlbumInfo from '../album/AlbumInfo'
import subsonic from '../subsonic'
import { SafeHTML } from '../common/SafeHTML'
import { Artwork } from '../common/Artwork'
import ArtistNameEditor from './ArtistNameEditor'

const useStyles = makeStyles(
  () => ({
    root: {
      display: 'flex',
      padding: '0.5em 0',
    },
    details: {
      display: 'flex',
      flex: '1',
      flexDirection: 'column',
      justifyContent: 'center',
    },
    biography: {
      display: 'inline-block',
      marginTop: '1em',
      float: 'left',
      wordBreak: 'break-word',
      cursor: 'pointer',
      minHeight: '4.5em',
    },
    content: {
      flex: '0 1 auto',
      padding: '0 1.5em !important',
    },
    artistHeadingRow: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: '0.75rem',
    },
    cover: {
      width: '8rem',
      height: '8rem',
      borderRadius: '50%',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      transition: 'opacity 0.3s ease-in-out',
      objectFit: 'cover',
    },
    artistImage: {
      maxHeight: '8rem',
      minHeight: '8rem',
      width: '8rem',
      minWidth: '8rem',
      backgroundColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'none',
      position: 'relative',
    },
    artistDetail: {
      flex: '1',
      padding: '0 !important',
      display: 'flex',
      minHeight: '8rem',
      backgroundColor: 'transparent',
      boxShadow: 'none',
    },
    button: {
      marginLeft: '1.5em',
    },
    artistActions: {
      display: 'flex',
      alignItems: 'center',
    },
    rating: {
      marginTop: '5px',
    },
    artistName: {
      wordBreak: 'break-word',
    },
  }),
  { name: 'NDDesktopArtistDetails' },
)

const DesktopArtistDetails = ({ artistInfo, record, biography, onNameSaved }) => {
  const [expanded, setExpanded] = useState(false)
  const classes = useStyles()
  const title = record.name
  const [isLightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div className={classes.root}>
      <div className={classes.artistDetail}>
        <div className={classes.artistImage}>
          <Artwork
            record={record}
            className={classes.cover}
            title={title}
            onClick={() => setLightboxOpen(true)}
          />
          <ImageUploadOverlay
            entityType="artist"
            entityId={record.id}
            hasUploadedImage={!!record.uploadedImage}
          />
        </div>
        <div className={classes.details}>
          <div className={classes.content}>
            <div className={classes.artistHeadingRow}>
              <Typography
                component="h5"
                variant="h5"
                className={classes.artistName}
              >
                {title}
              </Typography>
              <div className={classes.artistActions}>
                <ArtistNameEditor
                  record={record}
                  onSaved={onNameSaved}
                />
              </div>
            </div>
            {config.enableStarRating && (
              <div>
                <RatingField
                  record={record}
                  resource={'artist'}
                  size={'small'}
                  className={classes.rating}
                />
              </div>
            )}
            <Collapse
              collapsedSize={'4.5em'}
              in={expanded}
              timeout={'auto'}
              className={classes.biography}
            >
              <Typography
                variant={'body1'}
                onClick={() => setExpanded(!expanded)}
              >
                <span>
                  <SafeHTML>{biography}</SafeHTML>
                </span>
              </Typography>
            </Collapse>
          </div>
          <Typography component={'div'} className={classes.button}>
            {config.enableExternalServices && (
              <ArtistExternalLinks artistInfo={artistInfo} record={record} />
            )}
          </Typography>
        </div>
        {isLightboxOpen && (
          <ImageViewerDialog
            title={record.name}
            src={subsonic.getCoverArtUrl(record)}
            open={isLightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
      <ExpandInfoDialog content={<AlbumInfo />} />
    </div>
  )
}

export default DesktopArtistDetails
