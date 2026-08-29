import React, { useState } from 'react'
import { Typography, Collapse } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import config from '../config'
import { LoveButton, RatingField, ImageUploadOverlay, ImageViewerDialog } from '../common'
import subsonic from '../subsonic'
import { SafeHTML } from '../common/SafeHTML'
import { Artwork } from '../common/Artwork'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      display: 'flex',
      backgroundColor: 'transparent',
    },
    bgContainer: {
      display: 'flex',
      height: 'auto',
      width: '100%',
      padding: '0.5rem 0',
      backgroundColor: 'transparent',
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
    },
    biography: {
      display: 'flex',
      marginLeft: '0.5rem',
      marginRight: '0.5rem',
      marginTop: '0.5em',
      zIndex: '1',
      '& p': {
        whiteSpace: ({ expanded }) => (expanded ? 'unset' : 'nowrap'),
        overflow: 'hidden',
        width: '95vw',
        textOverflow: 'ellipsis',
      },
    },
    cover: {
      width: 110,
      height: 110,
      borderRadius: '55px',
      backgroundColor: 'transparent',
      transition: 'opacity 0.3s ease-in-out',
      objectFit: 'cover',
    },
    artistImage: {
      marginLeft: '0.5em',
      maxHeight: '7rem',
      backgroundColor: 'transparent',
      marginTop: '0.5rem',
      width: '7rem',
      minWidth: '7rem',
      display: 'flex',
      borderRadius: '5em',
      position: 'relative',
      boxShadow: 'none',
    },
    loveButton: {
      top: theme.spacing(-0.2),
      left: theme.spacing(0.5),
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

const MobileArtistDetails = ({ biography, record }) => {
  const img = subsonic.getCoverArtUrl(record, 800)
  const [expanded, setExpanded] = useState(false)
  const classes = useStyles({ img, expanded })
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
              <LoveButton
                className={classes.loveButton}
                record={record}
                resource={'artist'}
                size={'small'}
                aria-label="love"
                color="primary"
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
      <div className={classes.biography}>
        <Collapse collapsedHeight={'1.5em'} in={expanded} timeout={'auto'}>
          <Typography variant={'body1'} onClick={() => setExpanded(!expanded)}>
            <span>
              <SafeHTML>{biography}</SafeHTML>
            </span>
          </Typography>
        </Collapse>
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
