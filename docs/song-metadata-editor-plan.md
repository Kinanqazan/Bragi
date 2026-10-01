# Song page and metadata editing implementation plan

Status: Stages 1–3 are implemented and confirmed working by the user. Stage 4.1 (player lyrics resolution and plain-text display) is implemented and ready for user testing.

## Goal and agreed scope

Open a dedicated song page by clicking a song, then edit that song's metadata on the same page. Save changes to the original music file and refresh how the song appears throughout Bragi.

- Keep filenames and folder names unchanged.
- Every edit applies to the selected song only. There is no collection-wide artist rename.
- Changing Artist uses an existing matching artist entry or produces a new entry after scanning. Other songs retain their tags.
- Artist and Album artist are separate fields. Keep Album artist visible on the song page and explain that it applies to this song. Album grouping may change as a consequence of that tag.
- Keep the main form focused on title, artist, genres, and moods. No album-management workflow.
- Use one song page and one explicit Save action. Add lyrics and artwork to this page in later stages.
- Reuse the current visual style, authentication, data provider, player, and scanner.

Implement one numbered step at a time. Complete its verification, report the result, and leave it available for the user's manual testing before starting the next step.

## Step 1 — Song page and navigation

**Visible result:** clicking a song row starts playback. The song page opens from the song's three-dot menu or by clicking the current title in the player.

### Implementation

1. Add a song show page at `/song/:id/show` (full app URL: `/app/#/song/:id/show`). Register it in the song resource using the existing album/artist show-page pattern.
2. Load the current song by its music-file ID through the existing data provider. Show artwork, title, artist, duration, genres, and moods, plus Back, Play, and the existing favorite control where enabled.
3. Display metadata as read-only in this step. Do not add a nonfunctional Save button or change files/database metadata.
4. Keep song-row clicks in the Songs list, album track lists, and playlists as direct playback. Preserve the source-list playback queue and start position. Do not add a separate Play column or control.
5. Add “Open song page” to the song's three-dot menu and link the current song title in desktop and expanded mobile players to that page. Keep artist links, checkboxes, context menus, drag handles, and other actions independent of row playback.
6. On the song page, Play starts the selected song through the existing player actions.
7. Resolve song-page navigation using `mediaFileId`, not the playlist-entry ID. Duplicate playlist entries open the same song; clicking a playlist row still starts playback at that entry.
8. Preserve mobile selection/long-press behavior. In selection mode, tapping a row selects it rather than playing it. Keep controls usable by keyboard and touch.
9. Back returns to the originating list with filters, sorting, pagination, and scroll position preserved. A direct link without an in-app origin falls back to Songs. Reuse existing history and scroll-restoration helpers where possible.
10. Handle loading, unavailable/inaccessible song IDs, and missing files. Opening the page must not interrupt ongoing playback. Disable playback for a missing file.

### Starting code locations

- `ui/src/song/index.jsx`: currently registers only the song list; add a lazy-loaded show page.
- `ui/src/album/AlbumShow.jsx` and `ui/src/artist/ArtistShow.jsx`: existing show-page conventions.
- `ui/src/song/ModernSongList.jsx`: custom song rows start playback on click; keep that behavior and omit a separate Play control.
- `ui/src/song/SongList.jsx`: song-list integration and existing resource refresh.
- `ui/src/common/SongTitleField.jsx` and `ui/src/common/SongDatagrid.jsx`: shared title and table behavior.
- `ui/src/album/AlbumSongs.jsx` and `ui/src/playlist/PlaylistSongs.jsx`: table-row playback and playlist identity.
- `ui/src/common/SongContextMenu.jsx`: existing song information/action entry points; avoid duplicating the editor in its information dialog.

### Developer verification

- Add focused UI regression coverage for row playback, menu/player navigation, playlist identity, selection mode, independent controls, and missing-song handling.
- Run the affected UI tests, targeted lint/format checks, and `npm.cmd run build` from `ui`.
- Verify desktop and narrow/mobile layouts in the browser, including Back and a direct page reload.
- Validate the standalone build when preparing APK testing. Report an APK build separately from installation or device verification.

### User test checkpoint

- [ ] Click a row in Songs, an album, and a playlist; each starts the selected song with the expected queue.
- [ ] Open a song page through the three-dot menu and the current title in the player.
- [ ] Opening the page does not start, stop, or switch playback.
- [ ] No separate Play column or button appears in song lists.
- [ ] Play on the song page works.
- [ ] Artist links, favorites, selection, and menus still work independently.
- [ ] Back restores the previous list and position.
- [ ] Reloading a song page works; an invalid song link has a useful state.
- [ ] The layout works on desktop and mobile.

**Implementation condition:** navigation and playback are in place and developer checks pass. The user test checkpoint above remains pending. Metadata remains unchanged. Step 2 has not started.

## Step 2 — Save title and artist safely

**Visible result:** title, artist, and Album artist are visible on the song page and editable with Save and Cancel changes. Editing is limited to administrators and remains hidden until `EnableMediaFileMetadataEditing` is enabled on the server.

### Implementation

1. Add a dedicated metadata-editing backend module and endpoint, separate from generic database updates. Use the existing Go TagLib dependency to write tags.
2. Require administrator access and a separate editing capability/configuration flag. Expose that capability to the shared web UI and Android configuration; deletion permission alone does not enable editing.
3. Resolve the file server-side from the song ID and library. Support only validated writable storage/audio formats; enforce library-root containment and reject unsupported or unsafe targets.
4. Read the file's actual tags for editing. Do not reconstruct the whole file metadata from the mapped song response. Write only changed fields and preserve unrelated tags, identifiers, lyrics, and images.
5. Establish safe saving before enabling writes: coordinate edits/deletion and scanning, detect external changes, edit a temporary copy, verify it, retain recoverability, and replace the original safely. Temporary/backup files must not become duplicate library songs. Handle locked files and insufficient space without damaging the original.
6. Reuse a targeted folder scan to update song records, artist relationships, search, and caches. Preserve the song's identity and annotations while the library/path stay the same. Queue refresh work if another scan is running.
7. Refresh the page, relevant lists, and queued/current player metadata without restarting playback. Handle the case where the file saves successfully but indexing fails: show the actual state and allow a refresh retry.
8. Enable Save only for changed valid values, prevent duplicate submissions, and keep the user's draft on failure. Cancel restores the loaded values. Protect unsaved edits when navigating away.

### Developer verification

- Focused storage tests confirm requested tags change, unrelated album/comment tags remain, hidden staging files are removed, and a verification failure leaves the original file untouched.
- Native API tests cover update and retry endpoints, strict request validation, admin access, and refresh-pending responses.
- UI tests cover changed-only saves, cancel without saving, and retrying a pending library refresh.
- Run the live test environment or debug APK with the server feature flag enabled to manually validate representative copied files before editing the main library. Confirm unchanged audio, preserved unrelated metadata, denied edits, conflicts, and failed writes.

### User test checkpoint
- [ ] Correct a title and artist and see the result on the page, lists, and player.
- [ ] Reload and rescan; the changes remain.
- [ ] Cancel and verify no file changes occur.
- [ ] Other songs retain their artist tags.
- [ ] Favorites, playlist membership, play history, filenames, and folders remain correct.
- [ ] Album artist is clearly separate from Artist.

**Completion condition:** single-song title/artist edits persist in the original file and agree with the indexed/displayed result for the validated formats.

## Step 3 — Genres and moods

**Status:** implemented; user confirmed all functions are working.

**Visible result:** edit multiple genres and moods in the same form, with one value per line.

1. Add simple multi-value inputs using the existing genre/mood concepts.
2. Map edited values to writable file tags explicitly, accounting for aliases and configured splitting. Keep unrelated tags intact and allow values to be removed.
3. Reuse Step 2's save/scan/refresh flow so filters and counts update as well as the page.

**User checkpoint:** add two genres and a mood, find the song through those filters, remove one value, then reload/rescan and confirm the new values and filter results.

**Completion condition:** displayed values and library facets agree with the saved file. Custom categories/arbitrary tags remain a later decision.

## Step 4 — Paste or import separate lyrics

**Progress:** Step 4.1 is implemented and the user confirmed a same-folder `.txt` sidecar loads in the player. Step 4.2 is implemented and ready for manual testing.

**Visible result:** a Lyrics section supports plain text and timed `.lrc` imports, saved beside the song.

1. Connect player lyric loading to the existing backend lyrics resolver. The queue conversion supports plain text and timed lyrics; saving a sidecar requests an immediate refresh for the current track.
2. Add paste/import and explicit save to a matching `.txt` or `.lrc` sidecar. The upload button accepts either extension and detects the format from the chosen filename. Writes stay within local library storage, use hidden atomic staging files, and include optimistic conflict detection.
3. Show the lyrics file already beside the song. The page opens the LRC file when both supported files exist.
4. Keep lyrics saving independent from metadata saving. Compact Save, Cancel, and Delete controls sit beside the upload icon. Delete removes the managed TXT and LRC sidecars together so embedded lyrics can become visible again. The page protects both types of unsaved changes when navigating away.

**User checkpoint:** import or paste plain lyrics, save them, and confirm a matching `.txt` file appears beside the song; open the player and read them. Then import timed `.lrc` lyrics and confirm timed highlighting. Delete the sidecars and confirm embedded lyrics show again when present. If the song is currently playing, verify lyrics refresh after save or deletion. On a phone, scroll down the song page to reach the lyrics editor. Reload the page or restart the app and confirm persistence. Test Cancel and make sure lyrics changes do not save metadata drafts.

**Completion condition:** the user confirms sidecar edits persist and display in the player. Automatic lyrics search/download is deferred.

## Step 5 — Embedded lyrics

**Visible result:** choose to save lyrics inside the music file for validated formats.

1. Extend the safe tag-writing module with explicit embedded-lyrics handling for supported formats. Define supported plain/timed encoding rather than assuming every container supports identical fields.
2. Present Separate file / Inside music file as an explicit destination and explain any source-priority conflict without deleting existing lyrics automatically.
3. Reindex embedded lyrics and refresh the player.

**User checkpoint:** embed lyrics in a song without a conflicting sidecar, rescan, play the song, inspect it with another metadata reader, and confirm other tags/artwork survived.

**Completion condition:** supported embedded lyrics persist and display correctly. Unsupported combinations have a clear alternative.

## Step 6 — Embedded song artwork

**Visible result:** preview and replace the selected song's embedded front cover on its page.

1. Add image upload/preview with existing image validation and sensible limits.
2. Replace only the intended front-cover image through the safe writer; preserve other embedded images and unrelated metadata.
3. Refresh track artwork and the relevant artwork state/cache. Respect the existing per-track artwork setting and album/folder artwork priorities; explain the source shown when a shared cover takes precedence.
4. Keep editing scoped to the selected song. Do not overwrite a shared `cover.jpg` or other songs' embedded images.

**User checkpoint:** replace one cover, see it update on the page/list/player, reload and restart playback, check other songs, and verify the embedded image with another reader.

**Completion condition:** stored and displayed song artwork agree under the supported configuration.

## Testing environment and stage handoff

- Start the shared live environment with `scripts/dev.ps1` and use `/app/` URLs.
- A debug APK already configured for Live Dev Mode can exercise shared UI changes through HMR. Packaged production APK testing requires a fresh build; backend changes require a backend restart/deployment.
- At each handoff, report what changed, the checks actually run, any limitations, and the relevant user checklist. Build success alone is not device verification.
- Keep batch editing, file/folder renaming, collection-wide artist renaming, album management, arbitrary tag editing, and automatic lyrics acquisition outside these stages.

## Next action

User test Step 4.2 on a copied/test-library song: import or paste and save `.txt`, then test `.lrc` and timed highlighting. Confirm the files are beside the audio, player lyrics refresh after a save, Cancel discards drafts, and metadata edits remain independent. After this checkpoint passes, proceed to Step 5 (embedded lyrics).
