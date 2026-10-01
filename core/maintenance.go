package core

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/core/storage"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/utils/slice"
)

var (
	ErrMediaFileDeletionDisabled        = errors.New("media file deletion is disabled")
	ErrMediaFileDeletionUnsupported     = errors.New("media file deletion is not supported by this storage")
	ErrMediaFileMetadataEditingDisabled = errors.New("media file metadata editing is disabled")
	ErrMediaFileMetadataUnsupported     = errors.New("media file metadata editing is not supported by this storage or format")
	ErrMediaFileMetadataConflict        = errors.New("media file changed since the library last scanned it")
	ErrMediaFileLyricsConflict          = storage.ErrLyricsSidecarConflict
)

type Maintenance interface {
	// DeleteMediaFile removes a media file from storage and then cleans its database records.
	DeleteMediaFile(ctx context.Context, id string) error
	// DeleteMissingFiles deletes specific missing files by their IDs
	DeleteMissingFiles(ctx context.Context, ids []string) error
	// DeleteAllMissingFiles deletes all files marked as missing
	DeleteAllMissingFiles(ctx context.Context) error
	UpdateMediaFileMetadata(ctx context.Context, id string, changes MediaFileMetadataChanges) (*MediaFileMetadataResult, error)
	RefreshMediaFileMetadata(ctx context.Context, id string) (*model.MediaFile, error)
	LoadMediaFileLyrics(ctx context.Context, id string) (*MediaFileLyrics, error)
	SaveMediaFileLyrics(ctx context.Context, id, extension, content, expectedVersion string) (*MediaFileLyrics, error)
	DeleteMediaFileLyrics(ctx context.Context, id, expectedTxtVersion, expectedLrcVersion string) (*MediaFileLyrics, error)
}

type LyricsSidecar struct {
	Content string `json:"content"`
	Version string `json:"version"`
	Exists  bool   `json:"exists"`
}

type MediaFileLyrics struct {
	Txt LyricsSidecar `json:"txt"`
	Lrc LyricsSidecar `json:"lrc"`
}

type MediaFileMetadataChanges struct {
	Title       *string   `json:"title"`
	Artist      *string   `json:"artist"`
	AlbumArtist *string   `json:"albumArtist"`
	Genres      *[]string `json:"genres"`
	Moods       *[]string `json:"moods"`
}

type MediaFileMetadataResult struct {
	MediaFile       *model.MediaFile `json:"mediaFile,omitempty"`
	Saved           bool             `json:"saved"`
	RefreshRequired bool             `json:"refreshRequired"`
	RefreshError    string           `json:"refreshError,omitempty"`
}

func (c MediaFileMetadataChanges) values() (map[string][]string, error) {
	tags := make(map[string][]string, 5)
	for key, value := range map[string]*string{
		"TITLE": c.Title, "ARTIST": c.Artist, "ALBUMARTIST": c.AlbumArtist,
	} {
		if value == nil {
			continue
		}
		clean := strings.TrimSpace(*value)
		if len(clean) > 4096 || strings.ContainsRune(clean, '\x00') {
			return nil, fmt.Errorf("%w: %s is invalid or too long", model.ErrValidation, key)
		}
		if clean == "" {
			tags[key] = []string{}
		} else {
			tags[key] = []string{clean}
		}
	}
	for _, field := range []struct {
		name   string
		tag    string
		values *[]string
	}{
		{name: "genres", tag: "GENRE", values: c.Genres},
		{name: "moods", tag: "MOOD", values: c.Moods},
	} {
		if field.values == nil {
			continue
		}
		if len(*field.values) > 100 {
			return nil, fmt.Errorf("%w: too many %s values", model.ErrValidation, field.name)
		}
		values := make([]string, 0, len(*field.values))
		for _, value := range *field.values {
			clean := strings.TrimSpace(value)
			if len(clean) > 4096 || strings.ContainsRune(clean, '\x00') {
				return nil, fmt.Errorf("%w: %s contains an invalid or too-long value", model.ErrValidation, field.name)
			}
			if clean != "" {
				values = append(values, clean)
			}
		}
		tags[field.tag] = values
	}
	if len(tags) == 0 {
		return nil, fmt.Errorf("%w: no metadata fields provided", model.ErrValidation)
	}
	return tags, nil
}

func (s *maintenanceService) DeleteMediaFile(ctx context.Context, id string) error {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileDeletion {
		return ErrMediaFileDeletionDisabled
	}
	s.metadataMu.Lock()
	defer s.metadataMu.Unlock()

	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return err
	}
	store, err := storage.For(mf.LibraryPath)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrMediaFileDeletionUnsupported, err)
	}
	musicFS, err := store.FS()
	if err != nil {
		return fmt.Errorf("opening media storage: %w", err)
	}
	mutable, ok := musicFS.(storage.MutableFS)
	if !ok {
		return ErrMediaFileDeletionUnsupported
	}

	if err := mutable.Remove(mf.Path); err != nil {
		return fmt.Errorf("removing media file: %w", err)
	}
	log.Info(ctx, "Media file removed by administrator", "id", mf.ID, "path", mf.Path, "user", user.UserName)

	// The physical operation cannot be rolled back. If database cleanup fails,
	// the normal scanner will still discover and purge the now-missing file.
	if err := s.ds.MediaFile(ctx).MarkMissing(true, mf); err != nil {
		return fmt.Errorf("marking removed media file as missing: %w", err)
	}
	return s.deleteMissing(ctx, []string{id})
}

type maintenanceService struct {
	ds         model.DataStore
	scanner    model.Scanner
	metadataMu sync.Mutex
	wg         sync.WaitGroup
}

func NewMaintenance(ds model.DataStore, scanners ...model.Scanner) Maintenance {
	var scan model.Scanner
	if len(scanners) > 0 {
		scan = scanners[0]
	}
	return &maintenanceService{
		ds:      ds,
		scanner: scan,
	}
}

func (s *maintenanceService) UpdateMediaFileMetadata(ctx context.Context, id string, changes MediaFileMetadataChanges) (*MediaFileMetadataResult, error) {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileMetadataEditing {
		return nil, ErrMediaFileMetadataEditingDisabled
	}
	tags, err := changes.values()
	if err != nil {
		return nil, err
	}

	s.metadataMu.Lock()
	defer s.metadataMu.Unlock()

	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}
	if mf.Missing || !model.IsAudioFile(mf.Path) {
		return nil, ErrMediaFileMetadataUnsupported
	}
	store, err := storage.For(mf.LibraryPath)
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", ErrMediaFileMetadataUnsupported)
	}
	musicFS, err := store.FS()
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", err)
	}
	fileInfo, err := fs.Stat(musicFS, mf.Path)
	if err != nil {
		return nil, fmt.Errorf("checking media file: %w", err)
	}
	if mf.Size != fileInfo.Size() || !mf.UpdatedAt.IsZero() && absDuration(mf.UpdatedAt.Sub(fileInfo.ModTime())) > time.Second {
		return nil, ErrMediaFileMetadataConflict
	}
	writable, ok := musicFS.(storage.MetadataWritableFS)
	if !ok {
		return nil, ErrMediaFileMetadataUnsupported
	}
	if err := writable.WriteTags(mf.Path, tags); err != nil {
		log.Error(ctx, "[DEBUG-meta-save-20261001] Metadata file write failed", "songID", mf.ID, "path", mf.Path, err)
		return nil, fmt.Errorf("writing media metadata: %w", err)
	}

	result := &MediaFileMetadataResult{Saved: true}
	updated, scanErr := s.refreshMetadataFolder(ctx, mf)
	if scanErr != nil {
		result.RefreshRequired = true
		result.RefreshError = scanErr.Error()
		return result, nil
	}
	result.MediaFile = updated
	return result, nil
}

func absDuration(value time.Duration) time.Duration {
	if value < 0 {
		return -value
	}
	return value
}

func (s *maintenanceService) RefreshMediaFileMetadata(ctx context.Context, id string) (*model.MediaFile, error) {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileMetadataEditing {
		return nil, ErrMediaFileMetadataEditingDisabled
	}
	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}
	if mf.Missing {
		return nil, model.ErrNotFound
	}
	return s.refreshMetadataFolder(ctx, mf)
}

func (s *maintenanceService) LoadMediaFileLyrics(ctx context.Context, id string) (*MediaFileLyrics, error) {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileMetadataEditing {
		return nil, ErrMediaFileMetadataEditingDisabled
	}
	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}
	if mf.Missing || !model.IsAudioFile(mf.Path) {
		return nil, ErrMediaFileMetadataUnsupported
	}
	store, err := storage.For(mf.LibraryPath)
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", ErrMediaFileMetadataUnsupported)
	}
	musicFS, err := store.FS()
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", err)
	}
	writable, ok := musicFS.(storage.LyricsSidecarWritableFS)
	if !ok {
		return nil, ErrMediaFileMetadataUnsupported
	}
	base := strings.TrimSuffix(mf.Path, path.Ext(mf.Path))
	lyrics := &MediaFileLyrics{}
	for _, entry := range []struct {
		extension string
		target    *LyricsSidecar
	}{{".txt", &lyrics.Txt}, {".lrc", &lyrics.Lrc}} {
		content, version, err := writable.ReadLyricsSidecar(base + entry.extension)
		if err != nil {
			return nil, fmt.Errorf("reading lyrics sidecar: %w", err)
		}
		entry.target.Content = string(content)
		entry.target.Version = version
		entry.target.Exists = version != ""
	}
	return lyrics, nil
}

func (s *maintenanceService) SaveMediaFileLyrics(ctx context.Context, id, extension, content, expectedVersion string) (*MediaFileLyrics, error) {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileMetadataEditing {
		return nil, ErrMediaFileMetadataEditingDisabled
	}
	if extension != ".txt" && extension != ".lrc" || len(content) > 1<<20 || !utf8.ValidString(content) || strings.ContainsRune(content, '\x00') {
		return nil, fmt.Errorf("%w: lyrics must be valid UTF-8 text and at most 1 MiB", model.ErrValidation)
	}
	s.metadataMu.Lock()
	defer s.metadataMu.Unlock()
	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}
	if mf.Missing || !model.IsAudioFile(mf.Path) {
		return nil, ErrMediaFileMetadataUnsupported
	}
	store, err := storage.For(mf.LibraryPath)
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", ErrMediaFileMetadataUnsupported)
	}
	musicFS, err := store.FS()
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", err)
	}
	writable, ok := musicFS.(storage.LyricsSidecarWritableFS)
	if !ok {
		return nil, ErrMediaFileMetadataUnsupported
	}
	base := strings.TrimSuffix(mf.Path, path.Ext(mf.Path))
	if _, err := writable.WriteLyricsSidecar(base+extension, []byte(content), expectedVersion); err != nil {
		return nil, fmt.Errorf("writing lyrics sidecar: %w", err)
	}
	return s.LoadMediaFileLyrics(ctx, id)
}

func (s *maintenanceService) DeleteMediaFileLyrics(ctx context.Context, id, expectedTxtVersion, expectedLrcVersion string) (*MediaFileLyrics, error) {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileMetadataEditing {
		return nil, ErrMediaFileMetadataEditingDisabled
	}
	s.metadataMu.Lock()
	defer s.metadataMu.Unlock()
	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}
	if mf.Missing || !model.IsAudioFile(mf.Path) {
		return nil, ErrMediaFileMetadataUnsupported
	}
	store, err := storage.For(mf.LibraryPath)
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", ErrMediaFileMetadataUnsupported)
	}
	musicFS, err := store.FS()
	if err != nil {
		return nil, fmt.Errorf("opening media storage: %w", err)
	}
	writable, ok := musicFS.(storage.LyricsSidecarWritableFS)
	if !ok {
		return nil, ErrMediaFileMetadataUnsupported
	}
	base := strings.TrimSuffix(mf.Path, path.Ext(mf.Path))
	// Preflight both versions before removing either file, so stale editor state
	// cannot silently delete lyrics that changed on disk.
	for _, entry := range []struct {
		extension string
		version   string
	}{{".txt", expectedTxtVersion}, {".lrc", expectedLrcVersion}} {
		_, currentVersion, err := writable.ReadLyricsSidecar(base + entry.extension)
		if err != nil {
			return nil, fmt.Errorf("checking lyrics sidecar before deletion: %w", err)
		}
		if currentVersion != entry.version {
			return nil, ErrMediaFileLyricsConflict
		}
	}
	// Remove LRC first because it takes priority over TXT in the default resolver.
	for _, entry := range []struct {
		extension string
		version   string
	}{{".lrc", expectedLrcVersion}, {".txt", expectedTxtVersion}} {
		if err := writable.DeleteLyricsSidecar(base+entry.extension, entry.version); err != nil {
			return nil, fmt.Errorf("deleting lyrics sidecar: %w", err)
		}
	}
	return s.LoadMediaFileLyrics(ctx, id)
}

func (s *maintenanceService) refreshMetadataFolder(ctx context.Context, mf *model.MediaFile) (*model.MediaFile, error) {
	if s.scanner == nil {
		return nil, errors.New("scanner is unavailable")
	}
	folder := path.Dir(mf.Path)
	if folder == "." {
		folder = ""
	}
	if _, err := s.scanner.ScanFolders(ctx, false, []model.ScanTarget{{LibraryID: mf.LibraryID, FolderPath: folder}}); err != nil {
		return nil, fmt.Errorf("refreshing library metadata: %w", err)
	}
	updated, err := s.ds.MediaFile(ctx).Get(mf.ID)
	if err != nil {
		return nil, fmt.Errorf("loading refreshed song: %w", err)
	}
	return updated, nil
}

func (s *maintenanceService) DeleteMissingFiles(ctx context.Context, ids []string) error {
	return s.deleteMissing(ctx, ids)
}

func (s *maintenanceService) DeleteAllMissingFiles(ctx context.Context) error {
	return s.deleteMissing(ctx, nil)
}

// deleteMissing handles the deletion of missing files and triggers necessary cleanup operations
func (s *maintenanceService) deleteMissing(ctx context.Context, ids []string) error {
	// Track affected album IDs before deletion for refresh
	affectedAlbumIDs, err := s.getAffectedAlbumIDs(ctx, ids)
	if err != nil {
		log.Warn(ctx, "Error tracking affected albums for refresh", err)
		// Don't fail the operation, just log the warning
	}

	// Delete missing files within a transaction
	err = s.ds.WithTx(func(tx model.DataStore) error {
		if len(ids) == 0 {
			_, err := tx.MediaFile(ctx).DeleteAllMissing()
			return err
		}
		return tx.MediaFile(ctx).DeleteMissing(ids)
	})
	if err != nil {
		log.Error(ctx, "Error deleting missing tracks from DB", "ids", ids, err)
		return err
	}

	// Run garbage collection to clean up orphaned records
	if err := s.ds.GC(ctx); err != nil {
		log.Error(ctx, "Error running GC after deleting missing tracks", err)
		return err
	}

	// Refresh statistics in background
	s.refreshStatsAsync(ctx, affectedAlbumIDs)

	return nil
}

// refreshAlbums recalculates album attributes (size, duration, song count, etc.) from media files.
// It uses batch queries to minimize database round-trips for efficiency.
func (s *maintenanceService) refreshAlbums(ctx context.Context, albumIDs []string) error {
	if len(albumIDs) == 0 {
		return nil
	}

	log.Debug(ctx, "Refreshing albums", "count", len(albumIDs))

	// Process in chunks to avoid query size limits
	const chunkSize = 100
	for chunk := range slice.CollectChunks(slices.Values(albumIDs), chunkSize) {
		if err := s.refreshAlbumChunk(ctx, chunk); err != nil {
			return fmt.Errorf("refreshing album chunk: %w", err)
		}
	}

	log.Debug(ctx, "Successfully refreshed albums", "count", len(albumIDs))
	return nil
}

// refreshAlbumChunk processes a single chunk of album IDs
func (s *maintenanceService) refreshAlbumChunk(ctx context.Context, albumIDs []string) error {
	albumRepo := s.ds.Album(ctx)
	mfRepo := s.ds.MediaFile(ctx)

	// Batch load existing albums
	albums, err := albumRepo.GetAll(model.QueryOptions{
		Filters: squirrel.Eq{"album.id": albumIDs},
	})
	if err != nil {
		return fmt.Errorf("loading albums: %w", err)
	}

	// Create a map for quick lookup
	albumMap := make(map[string]*model.Album, len(albums))
	for i := range albums {
		albumMap[albums[i].ID] = &albums[i]
	}

	// Batch load all media files for these albums
	mediaFiles, err := mfRepo.GetAll(model.QueryOptions{
		Filters: squirrel.Eq{"album_id": albumIDs},
		Sort:    "album_id, path",
	})
	if err != nil {
		return fmt.Errorf("loading media files: %w", err)
	}

	// Group media files by album ID
	filesByAlbum := make(map[string]model.MediaFiles)
	for i := range mediaFiles {
		albumID := mediaFiles[i].AlbumID
		filesByAlbum[albumID] = append(filesByAlbum[albumID], mediaFiles[i])
	}

	// Recalculate each album from its media files
	for albumID, oldAlbum := range albumMap {
		mfs, hasTracks := filesByAlbum[albumID]
		if !hasTracks {
			// Album has no tracks anymore, skip (will be cleaned up by GC)
			log.Debug(ctx, "Skipping album with no tracks", "albumID", albumID)
			continue
		}

		// Recalculate album from media files
		newAlbum := mfs.ToAlbum()

		// Only update if something changed (avoid unnecessary writes)
		if !oldAlbum.Equals(newAlbum) {
			// Preserve original timestamps
			newAlbum.UpdatedAt = time.Now()
			newAlbum.CreatedAt = oldAlbum.CreatedAt

			if err := albumRepo.Put(&newAlbum); err != nil {
				log.Error(ctx, "Error updating album during refresh", "albumID", albumID, err)
				// Continue with other albums instead of failing entirely
				continue
			}
			log.Trace(ctx, "Refreshed album", "albumID", albumID, "name", newAlbum.Name)
		}
	}

	return nil
}

// getAffectedAlbumIDs returns distinct album IDs from missing media files
func (s *maintenanceService) getAffectedAlbumIDs(ctx context.Context, ids []string) ([]string, error) {
	var filters squirrel.Sqlizer = squirrel.Eq{"missing": true}
	if len(ids) > 0 {
		filters = squirrel.And{
			squirrel.Eq{"missing": true},
			squirrel.Eq{"media_file.id": ids},
		}
	}

	mfs, err := s.ds.MediaFile(ctx).GetAll(model.QueryOptions{
		Filters: filters,
	})
	if err != nil {
		return nil, err
	}

	// Extract unique album IDs
	albumIDMap := make(map[string]struct{}, len(mfs))
	for _, mf := range mfs {
		if mf.AlbumID != "" {
			albumIDMap[mf.AlbumID] = struct{}{}
		}
	}

	albumIDs := make([]string, 0, len(albumIDMap))
	for id := range albumIDMap {
		albumIDs = append(albumIDs, id)
	}

	return albumIDs, nil
}

// refreshStatsAsync refreshes artist and album statistics in background goroutines
func (s *maintenanceService) refreshStatsAsync(ctx context.Context, affectedAlbumIDs []string) {
	// Refresh artist stats in background
	s.wg.Go(func() {
		bgCtx := request.AddValues(context.Background(), ctx)
		if _, err := s.ds.Artist(bgCtx).RefreshStats(true); err != nil {
			log.Error(bgCtx, "Error refreshing artist stats after deleting missing files", err)
		} else {
			log.Debug(bgCtx, "Successfully refreshed artist stats after deleting missing files")
		}

		// Refresh album stats in background if we have affected albums
		if len(affectedAlbumIDs) > 0 {
			if err := s.refreshAlbums(bgCtx, affectedAlbumIDs); err != nil {
				log.Error(bgCtx, "Error refreshing album stats after deleting missing files", err)
			} else {
				log.Debug(bgCtx, "Successfully refreshed album stats after deleting missing files", "count", len(affectedAlbumIDs))
			}
		}
	})
}

// Wait waits for all background goroutines to complete.
// WARNING: This method is ONLY for testing. Never call this in production code.
// Calling Wait() in production will block until ALL background operations complete
// and may cause race conditions with new operations starting.
func (s *maintenanceService) wait() {
	s.wg.Wait()
}
