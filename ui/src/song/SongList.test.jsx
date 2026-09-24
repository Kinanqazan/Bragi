import { describe, expect, it } from 'vitest'
import { getAutocompleteArrayClasses, songFilterStyles } from './SongList'
import { createSongListResetAction } from './songListNavigation'

const createTheme = (type = 'dark') => ({
  breakpoints: { down: (breakpoint) => `@media-${breakpoint}` },
  palette: {
    type,
    text: { primary: type === 'dark' ? '#fff' : '#111' },
  },
  spacing: (value) => value * 8,
})

describe('song facet filter layout', () => {
  it('defines autocomplete and chip helper classes', () => {
    const classes = {
      chip: 'chip',
      chipRow: 'chip-row',
      autocompleteInput: 'autocomplete-input',
    }

    expect(getAutocompleteArrayClasses(classes)).toEqual({
      chip: 'chip',
      chipContainerOutlined: 'chip-row',
      inputInput: 'autocomplete-input',
    })
  })

  it('uses readable palette text colors in light themes', () => {
    const styles = songFilterStyles(createTheme('light'))

    expect(styles.searchInput['& .MuiInputBase-input'].color).toBe('#111')
    expect(styles.rightGroup['& .MuiButton-root'].color).toBe('#111 !important')
  })

  it('keeps toolbar responsive with clean toolbarRoot and filterButton', () => {
    const styles = songFilterStyles(createTheme())

    expect(styles.toolbarRoot).toMatchObject({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    })
    expect(styles.filterButton).toMatchObject({
      height: '36px !important',
      borderRadius: '18px !important',
    })
    expect(styles.favoriteToggleButton).toMatchObject({
      height: '36px !important',
      borderRadius: '18px !important',
    })
    expect(styles.favoriteToggleButtonActive).toBeDefined()
    expect(styles.searchSection).toMatchObject({
      flex: '0 0 130px',
      width: 130,
    })
    expect(styles.leftGroup.flex).toBe('1 1 auto')
    expect(styles.facetCarousel).toMatchObject({
      flex: '1 1 auto',
      overflowX: 'auto',
    })
    expect(styles.toolbarActions.flex).toBe('0 0 auto')
  })
})

describe('song list navigation', () => {
  it('resets React-Admin song params when leaving a special list', () => {
    expect(createSongListResetAction()).toEqual({
      type: 'RA/CRUD_CHANGE_LIST_PARAMS',
      payload: {
        sort: 'random',
        order: 'ASC',
        page: 1,
        perPage: 25,
        filter: {},
      },
      meta: { resource: 'song' },
    })
  })
})
