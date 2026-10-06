package core

import (
	"context"
	"errors"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/kinanqaz/bragi/conf"
	corestorage "github.com/kinanqaz/bragi/core/storage"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/metadata"
	"github.com/kinanqaz/bragi/model/request"
	"github.com/kinanqaz/bragi/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/sirupsen/logrus"
	"go.senan.xyz/taglib"
)

var _ = Describe("Maintenance", func() {
	var ds *tests.MockDataStore
	var mfRepo *extendedMediaFileRepo
	var service Maintenance
	var ctx context.Context

	BeforeEach(func() {
		ctx = context.Background()
		ctx = request.WithUser(ctx, model.User{ID: "user1", IsAdmin: true})

		ds = createTestDataStore()
		mfRepo = ds.MockedMediaFile.(*extendedMediaFileRepo)
		service = NewMaintenance(ds)
	})

	Describe("DeleteMissingFiles", func() {
		Context("with specific IDs", func() {
			It("deletes specific missing files and runs GC", func() {
				// Setup: mock missing files with album IDs
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
					{ID: "mf2", AlbumID: "album2", Missing: true},
				})

				err := service.DeleteMissingFiles(ctx, []string{"mf1", "mf2"})

				Expect(err).ToNot(HaveOccurred())
				Expect(mfRepo.deleteMissingCalled).To(BeTrue())
				Expect(mfRepo.deletedIDs).To(Equal([]string{"mf1", "mf2"}))
				Expect(ds.GCCalled).To(BeTrue(), "GC should be called after deletion")
			})

			It("triggers artist stats refresh and album refresh after deletion", func() {
				artistRepo := ds.MockedArtist.(*extendedArtistRepo)
				// Setup: mock missing files with albums
				albumRepo := ds.MockedAlbum.(*extendedAlbumRepo)
				albumRepo.SetData(model.Albums{
					{ID: "album1", Name: "Test Album", SongCount: 5},
				})
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
					{ID: "mf2", AlbumID: "album1", Missing: false, Size: 1000, Duration: 180},
					{ID: "mf3", AlbumID: "album1", Missing: false, Size: 2000, Duration: 200},
				})

				err := service.DeleteMissingFiles(ctx, []string{"mf1"})

				Expect(err).ToNot(HaveOccurred())

				// Wait for background goroutines to complete
				service.(*maintenanceService).wait()

				// RefreshStats should be called
				Expect(artistRepo.IsRefreshStatsCalled()).To(BeTrue(), "Artist stats should be refreshed")

				// Album should be updated with new calculated values
				Expect(albumRepo.GetPutCallCount()).To(BeNumerically(">", 0), "Album.Put() should be called to refresh album data")
			})

			It("returns error if deletion fails", func() {
				mfRepo.deleteMissingError = errors.New("delete failed")

				err := service.DeleteMissingFiles(ctx, []string{"mf1"})

				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("delete failed"))
			})

			It("continues even if album tracking fails", func() {
				mfRepo.SetError(true)

				err := service.DeleteMissingFiles(ctx, []string{"mf1"})

				// Should not fail, just log warning
				Expect(err).ToNot(HaveOccurred())
				Expect(mfRepo.deleteMissingCalled).To(BeTrue())
			})

			It("returns error if GC fails", func() {
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
				})

				// Set GC to return error
				ds.GCError = errors.New("gc failed")

				err := service.DeleteMissingFiles(ctx, []string{"mf1"})

				Expect(err).To(HaveOccurred())
				Expect(err.Error()).To(ContainSubstring("gc failed"))
			})
		})

		Context("album ID extraction", func() {
			It("extracts unique album IDs from missing files", func() {
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
					{ID: "mf2", AlbumID: "album1", Missing: true},
					{ID: "mf3", AlbumID: "album2", Missing: true},
				})

				err := service.DeleteMissingFiles(ctx, []string{"mf1", "mf2", "mf3"})

				Expect(err).ToNot(HaveOccurred())
			})

			It("skips files without album IDs", func() {
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "", Missing: true},
					{ID: "mf2", AlbumID: "album1", Missing: true},
				})

				err := service.DeleteMissingFiles(ctx, []string{"mf1", "mf2"})

				Expect(err).ToNot(HaveOccurred())
			})
		})
	})

	Describe("DeleteAllMissingFiles", func() {
		It("deletes all missing files and runs GC", func() {
			mfRepo.SetData(model.MediaFiles{
				{ID: "mf1", AlbumID: "album1", Missing: true},
				{ID: "mf2", AlbumID: "album2", Missing: true},
				{ID: "mf3", AlbumID: "album3", Missing: true},
			})

			err := service.DeleteAllMissingFiles(ctx)

			Expect(err).ToNot(HaveOccurred())
			Expect(ds.GCCalled).To(BeTrue(), "GC should be called after deletion")
		})

		It("returns error if deletion fails", func() {
			mfRepo.SetError(true)

			err := service.DeleteAllMissingFiles(ctx)

			Expect(err).To(HaveOccurred())
		})

		It("handles empty result gracefully", func() {
			mfRepo.SetData(model.MediaFiles{})

			err := service.DeleteAllMissingFiles(ctx)

			Expect(err).ToNot(HaveOccurred())
		})
	})

	Describe("Album refresh logic", func() {
		var albumRepo *extendedAlbumRepo

		BeforeEach(func() {
			albumRepo = ds.MockedAlbum.(*extendedAlbumRepo)
		})

		Context("when album has no tracks after deletion", func() {
			It("skips the album without updating it", func() {
				// Setup album with no remaining tracks
				albumRepo.SetData(model.Albums{
					{ID: "album1", Name: "Empty Album", SongCount: 1},
				})
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
				})

				err := service.DeleteMissingFiles(ctx, []string{"mf1"})

				Expect(err).ToNot(HaveOccurred())

				// Wait for background goroutines to complete
				service.(*maintenanceService).wait()

				// Album should NOT be updated because it has no tracks left
				Expect(albumRepo.GetPutCallCount()).To(Equal(0), "Album with no tracks should not be updated")
			})
		})

		Context("when Put fails for one album", func() {
			It("continues processing other albums", func() {
				albumRepo.SetData(model.Albums{
					{ID: "album1", Name: "Album 1"},
					{ID: "album2", Name: "Album 2"},
				})
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
					{ID: "mf2", AlbumID: "album1", Missing: false, Size: 1000, Duration: 180},
					{ID: "mf3", AlbumID: "album2", Missing: true},
					{ID: "mf4", AlbumID: "album2", Missing: false, Size: 2000, Duration: 200},
				})

				// Make Put fail on first call but succeed on subsequent calls
				albumRepo.putError = errors.New("put failed")
				albumRepo.failOnce = true

				err := service.DeleteMissingFiles(ctx, []string{"mf1", "mf3"})

				// Should not fail even if one album's Put fails
				Expect(err).ToNot(HaveOccurred())

				// Wait for background goroutines to complete
				service.(*maintenanceService).wait()

				// Put should have been called multiple times
				Expect(albumRepo.GetPutCallCount()).To(BeNumerically(">", 0), "Put should be attempted")
			})
		})

		Context("when media file loading fails", func() {
			It("logs warning but continues when tracking affected albums fails", func() {
				// Set up log capturing
				hook, cleanup := tests.LogHook()
				defer cleanup()

				albumRepo.SetData(model.Albums{
					{ID: "album1", Name: "Album 1"},
				})
				mfRepo.SetData(model.MediaFiles{
					{ID: "mf1", AlbumID: "album1", Missing: true},
				})
				// Make GetAll fail when loading media files
				mfRepo.SetError(true)

				err := service.DeleteMissingFiles(ctx, []string{"mf1"})

				// Deletion should succeed despite the tracking error
				Expect(err).ToNot(HaveOccurred())
				Expect(mfRepo.deleteMissingCalled).To(BeTrue())

				// Verify the warning was logged
				Expect(hook.LastEntry()).ToNot(BeNil())
				Expect(hook.LastEntry().Level).To(Equal(logrus.WarnLevel))
				Expect(hook.LastEntry().Message).To(Equal("Error tracking affected albums for refresh"))
			})
		})
	})

	Describe("DeleteMediaFile", func() {
		var mutable *fakeMutableMusicFS

		BeforeEach(func() {
			conf.Server.EnableMediaFileDeletion = true
			DeferCleanup(func() { conf.Server.EnableMediaFileDeletion = false })
			mutable = &fakeMutableMusicFS{}
			corestorage.Register("deletion-test", func(url.URL) corestorage.Storage {
				return fakeStorage{musicFS: mutable}
			})
			mfRepo.SetData(model.MediaFiles{{
				ID: "mf1", LibraryPath: "deletion-test://library", Path: "artist/song.mp3",
			}})
		})

		It("removes the file before cleaning its database record", func() {
			Expect(service.DeleteMediaFile(ctx, "mf1")).To(Succeed())
			Expect(mutable.removed).To(Equal("artist/song.mp3"))
			Expect(mfRepo.markMissingCalled).To(BeTrue())
			Expect(mfRepo.deleteMissingCalled).To(BeTrue())
		})

		It("requires an administrator even when the feature is enabled", func() {
			regularUserCtx := request.WithUser(context.Background(), model.User{ID: "user2", IsAdmin: false})
			Expect(service.DeleteMediaFile(regularUserCtx, "mf1")).To(MatchError(model.ErrNotAuthorized))
			Expect(mutable.removed).To(BeEmpty())
		})

		It("does nothing when deletion is disabled", func() {
			conf.Server.EnableMediaFileDeletion = false
			Expect(service.DeleteMediaFile(ctx, "mf1")).To(MatchError(ErrMediaFileDeletionDisabled))
			Expect(mutable.removed).To(BeEmpty())
		})

		It("rejects a read-only storage backend", func() {
			corestorage.Register("deletion-test", func(url.URL) corestorage.Storage {
				return fakeStorage{musicFS: fakeReadOnlyMusicFS{}}
			})
			Expect(service.DeleteMediaFile(ctx, "mf1")).To(MatchError(ErrMediaFileDeletionUnsupported))
		})

		It("does not clean the database when physical removal fails", func() {
			mutable.removeErr = fs.ErrPermission
			Expect(service.DeleteMediaFile(ctx, "mf1")).To(MatchError(ContainSubstring("permission denied")))
			Expect(mfRepo.markMissingCalled).To(BeFalse())
			Expect(mfRepo.deleteMissingCalled).To(BeFalse())
		})
	})
})

var _ = Describe("Media file metadata changes", func() {
	It("updates plural artist tags without dropping other displayed credits", func() {
		artist := "New Artist • Guest Artist"
		albumArtist := "New Album Artist • Guest Album Artist"

		tags, err := (MediaFileMetadataChanges{Artist: &artist, AlbumArtist: &albumArtist}).values()

		Expect(err).ToNot(HaveOccurred())
		Expect(tags).To(HaveKeyWithValue("ARTISTS", []string{"New Artist", "Guest Artist"}))
		Expect(tags).To(HaveKeyWithValue("ALBUMARTISTS", []string{"New Album Artist", "Guest Album Artist"}))
	})

	It("trims multi-value genres and moods and preserves an empty list as a clear operation", func() {
		genres := []string{" Rock ", "Alternative"}
		moods := []string{"Dreamy", "  "}
		changes := MediaFileMetadataChanges{Genres: &genres, Moods: &moods}

		tags, err := changes.values()

		Expect(err).ToNot(HaveOccurred())
		Expect(tags).To(HaveKeyWithValue("GENRE", []string{"Rock", "Alternative"}))
		Expect(tags).To(HaveKeyWithValue("MOOD", []string{"Dreamy"}))

		clear := []string{}
		tags, err = (MediaFileMetadataChanges{Genres: &clear}).values()
		Expect(err).ToNot(HaveOccurred())
		Expect(tags).To(HaveKeyWithValue("GENRE", BeEmpty()))
	})

	It("rejects invalid values in a multi-value tag", func() {
		moods := []string{"valid", "invalid\x00value"}
		_, err := (MediaFileMetadataChanges{Moods: &moods}).values()
		Expect(err).To(MatchError(model.ErrValidation))
	})
})

var _ = Describe("Embedded lyrics metadata", func() {
	It("prefers the default embedded lyric and generates a version token", func() {
		musicFS := fakeEmbeddedLyricsMusicFS{info: metadata.Info{Tags: model.RawTags{
			"LYRICS:ENG": {"English lyrics"},
			"LYRICS:XXX": {"[00:01.20]Default lyrics"},
		}}}

		lyrics, err := readEmbeddedMediaFileLyrics(musicFS, "song.mp3")

		Expect(err).ToNot(HaveOccurred())
		Expect(lyrics.Content).To(Equal("[00:01.20]Default lyrics"))
		Expect(lyrics.Exists).To(BeTrue())
		Expect(lyrics.Version).To(Equal(embeddedLyricsVersion(lyrics.Content)))
	})

	It("saves embedded lyrics in the original file and leaves sidecars and other tags intact", func() {
		oldEnabled := conf.Server.EnableMediaFileMetadataEditing
		conf.Server.EnableMediaFileMetadataEditing = true
		DeferCleanup(func() { conf.Server.EnableMediaFileMetadataEditing = oldEnabled })

		dir, err := os.MkdirTemp("", "bragi-embedded-lyrics-service-")
		Expect(err).ToNot(HaveOccurred())
		DeferCleanup(func() { _ = os.RemoveAll(dir) })
		_, sourceFile, _, ok := runtime.Caller(0)
		Expect(ok).To(BeTrue())
		source, err := os.ReadFile(filepath.Join(filepath.Dir(sourceFile), "..", "tests", "fixtures", "test.flac"))
		Expect(err).ToNot(HaveOccurred())
		mediaPath := filepath.Join(dir, "song.flac")
		Expect(os.WriteFile(mediaPath, source, 0o600)).To(Succeed())
		Expect(os.WriteFile(filepath.Join(dir, "song.txt"), []byte("Keep this sidecar"), 0o600)).To(Succeed())
		info, err := os.Stat(mediaPath)
		Expect(err).ToNot(HaveOccurred())
		libraryURL, err := corestorage.LocalPathToURL(dir)
		Expect(err).ToNot(HaveOccurred())

		ds := createTestDataStore()
		mediaFiles := ds.MockedMediaFile.(*extendedMediaFileRepo)
		mediaFiles.SetData(model.MediaFiles{{
			ID: "song-1", LibraryID: 1, LibraryPath: libraryURL.String(), Path: "song.flac",
			Size: info.Size(), UpdatedAt: info.ModTime(),
		}})
		ctx := request.WithUser(context.Background(), model.User{ID: "admin", IsAdmin: true})
		service := NewMaintenance(ds)

		initial, err := service.LoadMediaFileLyrics(ctx, "song-1")
		Expect(err).ToNot(HaveOccurred())
		lyrics, err := service.SaveEmbeddedMediaFileLyrics(ctx, "song-1", "[00:01.20]Embedded line", initial.Embedded.Version)

		Expect(err).ToNot(HaveOccurred())
		Expect(lyrics.Embedded.Content).To(Equal("[00:01.20]Embedded line"))
		Expect(lyrics.Txt.Content).To(Equal("Keep this sidecar"))
		Expect(lyrics.RefreshRequired).To(BeTrue(), "the service was created without a scanner")

		written, err := taglib.OpenReadOnly(mediaPath, taglib.WithReadStyle(taglib.ReadStyleFast))
		Expect(err).ToNot(HaveOccurred())
		defer written.Close()
		Expect(written.AllTags().Tags["LYRICS"]).To(Equal([]string{"[00:01.20]Embedded line"}))
		Expect(written.AllTags().Tags["ALBUM"]).To(Equal([]string{"Album"}))
	})
})

var _ = Describe("Song artwork metadata", func() {
	It("updates embedded art for one song without changing its tags", func() {
		oldEnabled := conf.Server.EnableMediaFileMetadataEditing
		conf.Server.EnableMediaFileMetadataEditing = true
		DeferCleanup(func() { conf.Server.EnableMediaFileMetadataEditing = oldEnabled })

		dir, err := os.MkdirTemp("", "bragi-song-artwork-service-")
		Expect(err).ToNot(HaveOccurred())
		DeferCleanup(func() { _ = os.RemoveAll(dir) })
		_, sourceFile, _, ok := runtime.Caller(0)
		Expect(ok).To(BeTrue())
		source, err := os.ReadFile(filepath.Join(filepath.Dir(sourceFile), "..", "tests", "fixtures", "test.mp3"))
		Expect(err).ToNot(HaveOccurred())
		mediaPath := filepath.Join(dir, "song.mp3")
		Expect(os.WriteFile(mediaPath, source, 0o600)).To(Succeed())
		info, err := os.Stat(mediaPath)
		Expect(err).ToNot(HaveOccurred())
		libraryURL, err := corestorage.LocalPathToURL(dir)
		Expect(err).ToNot(HaveOccurred())

		ds := createTestDataStore()
		mediaFiles := ds.MockedMediaFile.(*extendedMediaFileRepo)
		mediaFiles.SetData(model.MediaFiles{{
			ID: "song-art-1", LibraryID: 1, LibraryPath: libraryURL.String(), Path: "song.mp3",
			Size: info.Size(), UpdatedAt: info.ModTime(),
		}})
		ctx := request.WithUser(context.Background(), model.User{ID: "admin", IsAdmin: true})
		service := NewMaintenance(ds)
		cover := []byte("replacement-cover")
		before, err := taglib.OpenReadOnly(mediaPath, taglib.WithReadStyle(taglib.ReadStyleFast))
		Expect(err).ToNot(HaveOccurred())
		beforeTags := before.AllTags().Tags
		Expect(before.Close()).To(Succeed())

		result, err := service.UpdateMediaFileArtwork(ctx, "song-art-1", cover, "image/jpeg")

		Expect(err).ToNot(HaveOccurred())
		Expect(result.Saved).To(BeTrue())
		Expect(result.RefreshRequired).To(BeTrue(), "the test service has no scanner")
		written, err := taglib.OpenReadOnly(mediaPath, taglib.WithReadStyle(taglib.ReadStyleFast))
		Expect(err).ToNot(HaveOccurred())
		defer written.Close()
		Expect(written.AllTags().Tags).To(Equal(beforeTags))
		image, err := taglib.ReadImageOptions(mediaPath, 0)
		Expect(err).ToNot(HaveOccurred())
		Expect(image).To(Equal(cover))
	})
})

// Test helper to create a mock DataStore with controllable behavior
func createTestDataStore() *tests.MockDataStore {
	ds := &tests.MockDataStore{}

	// Create extended album repo with Put tracking
	albumRepo := &extendedAlbumRepo{
		MockAlbumRepo: tests.CreateMockAlbumRepo(),
	}
	ds.MockedAlbum = albumRepo

	// Create extended artist repo with RefreshStats tracking
	artistRepo := &extendedArtistRepo{
		MockArtistRepo: tests.CreateMockArtistRepo(),
	}
	ds.MockedArtist = artistRepo

	// Create extended media file repo with DeleteMissing support
	mfRepo := &extendedMediaFileRepo{
		MockMediaFileRepo: tests.CreateMockMediaFileRepo(),
	}
	ds.MockedMediaFile = mfRepo

	return ds
}

// Extension of MockMediaFileRepo to add DeleteMissing method
type extendedMediaFileRepo struct {
	*tests.MockMediaFileRepo
	deleteMissingCalled bool
	deletedIDs          []string
	deleteMissingError  error
	markMissingCalled   bool
}

func (m *extendedMediaFileRepo) MarkMissing(missing bool, mediaFiles ...*model.MediaFile) error {
	m.markMissingCalled = true
	for _, mediaFile := range mediaFiles {
		mediaFile.Missing = missing
		m.Data[mediaFile.ID] = mediaFile
	}
	return nil
}

func (m *extendedMediaFileRepo) DeleteMissing(ids []string) error {
	m.deleteMissingCalled = true
	m.deletedIDs = ids
	if m.deleteMissingError != nil {
		return m.deleteMissingError
	}
	// Actually delete from the mock data
	for _, id := range ids {
		delete(m.Data, id)
	}
	return nil
}

// Extension of MockAlbumRepo to track Put calls
type extendedAlbumRepo struct {
	*tests.MockAlbumRepo
	mu           sync.RWMutex
	putCallCount int
	lastPutData  *model.Album
	putError     error
	failOnce     bool
}

func (m *extendedAlbumRepo) Put(album *model.Album) error {
	m.mu.Lock()
	m.putCallCount++
	m.lastPutData = album

	// Handle failOnce behavior
	var err error
	if m.putError != nil {
		if m.failOnce {
			err = m.putError
			m.putError = nil // Clear error after first failure
			m.mu.Unlock()
			return err
		}
		err = m.putError
		m.mu.Unlock()
		return err
	}
	m.mu.Unlock()

	return m.MockAlbumRepo.Put(album)
}

func (m *extendedAlbumRepo) GetPutCallCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.putCallCount
}

// Extension of MockArtistRepo to track RefreshStats calls
type extendedArtistRepo struct {
	*tests.MockArtistRepo
	mu                 sync.RWMutex
	refreshStatsCalled bool
	refreshStatsError  error
}

func (m *extendedArtistRepo) RefreshStats(allArtists bool) (int64, error) {
	m.mu.Lock()
	m.refreshStatsCalled = true
	err := m.refreshStatsError
	m.mu.Unlock()

	if err != nil {
		return 0, err
	}
	return m.MockArtistRepo.RefreshStats(allArtists)
}

func (m *extendedArtistRepo) IsRefreshStatsCalled() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.refreshStatsCalled
}

type fakeStorage struct {
	musicFS corestorage.MusicFS
}

func (s fakeStorage) FS() (corestorage.MusicFS, error) {
	return s.musicFS, nil
}

type fakeReadOnlyMusicFS struct{}

func (fakeReadOnlyMusicFS) Open(string) (fs.File, error) {
	return nil, fs.ErrNotExist
}

func (fakeReadOnlyMusicFS) ReadTags(...string) (map[string]metadata.Info, error) {
	return nil, nil
}

type fakeEmbeddedLyricsMusicFS struct {
	fakeReadOnlyMusicFS
	info metadata.Info
}

func (f fakeEmbeddedLyricsMusicFS) ReadTags(names ...string) (map[string]metadata.Info, error) {
	return map[string]metadata.Info{names[0]: f.info}, nil
}

type fakeMutableMusicFS struct {
	fakeReadOnlyMusicFS
	removed   string
	removeErr error
}

func (f *fakeMutableMusicFS) Remove(name string) error {
	if f.removeErr != nil {
		return f.removeErr
	}
	f.removed = name
	return nil
}
