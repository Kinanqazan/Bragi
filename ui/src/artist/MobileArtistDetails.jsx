import React, { useState } from 'react'
import { Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import config from '../config'
import { RatingField, ImageUploadOverlay, ImageViewerDialog } from '../common'
import subsonic from '../subsonic'
import { Artwork } from '../common/Artwork'
import ArtistNameEditor from './ArtistNameEditor'

const useStyles = makeStyles(
  () => ({
    root: {
      display: 'flex',
      backgroundColor: 'transparent !important',
      backgroundImage: 'none !important',
    },
    bgContainer: {
      display: 'flex',
      alignItems: 'center',
      height: 'auto',
      width: '100%',
      padding: '0.5rem 0',
      backgroundColor: 'transparent !important',
      backgroundImage: 'none !important',
    },
    link: {
      margin: '1px',
    },
    details: {
      display: 'flex',
      alignItems: 'flex-start',
      flexDirection: 'column',
      justifyContent: 'center',
      marginLeft: '0.5rem',
      minWidth: 0,
      backgroundColor: 'transparent !important',
      backgroundImage: 'none !important',
    },
    cover: {
      width: '5.5rem',
      height: '5.5rem',
      borderRadius: '50%',
      backgroundColor: 'transparent',
      transition: 'opacity 0.3s ease-in-out',
      objectFit: 'cover',
    },
    artistImage: {
      marginLeft: '0.5em',
      maxHeight: '5.5rem',
      height: '5.5rem',
      backgroundColor: 'transparent !important',
      backgroundImage: 'none !important',
      marginTop: '0.5rem',
      width: '5.5rem',
      minWidth: '5.5rem',
      display: 'flex',
      borderRadius: '5em',
      position: 'relative',
      boxShadow: 'none',
    },
    rating: {
      marginTop: '5px',
    },
    artistName: {
      wordBreak: 'break-word',
    },
  }),
  { name: 'NDMobileArtistDetails' },
)

const MobileArtistDetails = ({ record, onNameSaved }) => {
  const img = subsonic.getCoverArtUrl(record, 800)
  const classes = useStyles()
  const title = record.name
  const [isLightboxOpen, setLightboxOpen] = useState(false)

  return (
    <>
      <div className={classes.root}>
        <div className={classes.bgContainer}>
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
            <Typography
              component="h5"
              variant="h5"
              className={classes.artistName}
            >
              {title}
              <ArtistNameEditor
                record={record}
                onSaved={onNameSaved}
              />
            </Typography>
            {config.enableStarRating && (
              <RatingField
                record={record}
                resource={'artist'}
                size={'small'}
                className={classes.rating}
              />
            )}
          </div>
        </div>
      </div>
      {isLightboxOpen && (
        <ImageViewerDialog
          title={record.name}
          src={img}
          open={isLightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}

export default MobileArtistDetails
