package core

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"

	"github.com/kinanqaz/bragi/conf"
	"github.com/kinanqaz/bragi/conf/configtest"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Song lyrics search", func() {
	var (
		service    Maintenance
		mediaFiles *extendedMediaFileRepo
		ctx        context.Context
	)

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.EnableMediaFileMetadataEditing = true
		ds := createTestDataStore()
		mediaFiles = ds.MockedMediaFile.(*extendedMediaFileRepo)
		mediaFiles.SetData(model.MediaFiles{{
			ID: "song-1", Title: "Test Track", Artist: "Test Artist", Album: "Test Album", Duration: 123,
		}})
		service = NewMaintenance(ds)
		ctx = request.WithUser(context.Background(), model.User{ID: "admin", IsAdmin: true})
	})

	It("searches LRCLIB broadly by title and returns selectable lyrics", func() {
		remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			Expect(r.URL.Path).To(Equal("/api/search"))
			Expect(r.URL.Query().Get("q")).To(Equal("Test Track"))
			Expect(r.URL.Query().Get("track_name")).To(BeEmpty())
			Expect(r.URL.Query().Get("artist_name")).To(BeEmpty())
			Expect(r.URL.Query().Get("album_name")).To(BeEmpty())
			Expect(r.Header.Get("User-Agent")).To(ContainSubstring("Bragi/"))
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(w, `[{"id":42,"trackName":"Test Track","artistName":"Test Artist","albumName":"Test Album","duration":123,"plainLyrics":"Plain line","syncedLyrics":"[00:01.00]Synced line"}]`)
		}))
		DeferCleanup(remote.Close)
		maintenance := service.(*maintenanceService)
		maintenance.lyricsSearch.baseURL = remote.URL + "/api"
		maintenance.lyricsSearch.httpClient = remote.Client()

		matches, err := service.SearchMediaFileLyrics(ctx, "song-1", "")

		Expect(err).ToNot(HaveOccurred())
		Expect(matches).To(HaveLen(1))
		Expect(matches[0]).To(Equal(MediaFileLyricsSearchResult{
			ID: 42, TrackName: "Test Track", ArtistName: "Test Artist", AlbumName: "Test Album", Duration: 123,
			PlainLyrics: "Plain line", SyncedLyrics: "[00:01.00]Synced line",
		}))
	})

	It("retries once when LRCLIB temporarily returns a gateway error", func() {
		attempts := 0
		remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			attempts++
			if attempts == 1 {
				http.Error(w, "upstream unavailable", http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(w, `[{"id":42,"trackName":"Test Track","artistName":"Test Artist","albumName":"Test Album","duration":123,"plainLyrics":"Plain line"}]`)
		}))
		DeferCleanup(remote.Close)
		maintenance := service.(*maintenanceService)
		maintenance.lyricsSearch.baseURL = remote.URL + "/api"
		maintenance.lyricsSearch.httpClient = remote.Client()

		matches, err := service.SearchMediaFileLyrics(ctx, "song-1", "")

		Expect(err).ToNot(HaveOccurred())
		Expect(matches).To(HaveLen(1))
		Expect(attempts).To(Equal(2))
	})

	It("ranks the user query against both result title and artist", func() {
		remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			Expect(r.URL.Query().Get("q")).To(Equal("Feeling Good Nina Simone"))
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(w, `[{"id":84,"trackName":"Feeling Good","artistName":"Other Artist","albumName":"Other Album","duration":171,"plainLyrics":"Lyrics"},{"id":85,"trackName":"Feeling Good","artistName":"Nina Simone","albumName":"Test Album","duration":171,"plainLyrics":"Lyrics"}]`)
		}))
		DeferCleanup(remote.Close)
		maintenance := service.(*maintenanceService)
		maintenance.lyricsSearch.baseURL = remote.URL + "/api"
		maintenance.lyricsSearch.httpClient = remote.Client()

		matches, err := service.SearchMediaFileLyrics(ctx, "song-1", "Feeling Good Nina Simone")

		Expect(err).ToNot(HaveOccurred())
		Expect(matches).To(HaveLen(2))
		Expect(matches[0].ID).To(Equal(int64(85)))
		Expect(matches[1].ID).To(Equal(int64(84)))
	})

	It("returns query-specific results for different typed titles", func() {
		remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			switch r.URL.Query().Get("q") {
			case "First Query":
				_, _ = fmt.Fprint(w, `[{"id":91,"trackName":"First Query","artistName":"Artist A","plainLyrics":"Lyrics A"}]`)
			case "Second Query":
				_, _ = fmt.Fprint(w, `[{"id":92,"trackName":"Second Query","artistName":"Artist B","plainLyrics":"Lyrics B"}]`)
			default:
				Fail("unexpected query: " + r.URL.Query().Get("q"))
			}
		}))
		DeferCleanup(remote.Close)
		maintenance := service.(*maintenanceService)
		maintenance.lyricsSearch.baseURL = remote.URL + "/api"
		maintenance.lyricsSearch.httpClient = remote.Client()

		first, err := service.SearchMediaFileLyrics(ctx, "song-1", "First Query")
		Expect(err).ToNot(HaveOccurred())
		second, err := service.SearchMediaFileLyrics(ctx, "song-1", "Second Query")
		Expect(err).ToNot(HaveOccurred())
		Expect(first).To(HaveLen(1))
		Expect(first[0].ID).To(Equal(int64(91)))
		Expect(second).To(HaveLen(1))
		Expect(second[0].ID).To(Equal(int64(92)))
	})

	It("ranks title and artist matches while keeping broader artist matches", func() {
		matches := []MediaFileLyricsSearchResult{
			{ID: 1, TrackName: "Test Track (Live)", ArtistName: "Test Artist", AlbumName: "Test Album"},
			{ID: 2, TrackName: "Test Track", ArtistName: "A different artist", AlbumName: "Other Album"},
			{ID: 3, TrackName: "Unrelated song", ArtistName: "Test Track", AlbumName: "Test Album"},
			{ID: 4, TrackName: "Test Track", ArtistName: "Test Artist", AlbumName: "Test Album"},
		}

		results := rankLyricsSearchResults(matches, "Test Track")

		Expect(results).To(HaveLen(4))
		Expect(results[0].ID).To(Equal(int64(2)))
		Expect(results[1].ID).To(Equal(int64(4)))
		Expect(results[2].ID).To(Equal(int64(1)))
		Expect(results[3].ID).To(Equal(int64(3)))
	})

	It("matches a short song title when the stored title has extra words", func() {
		matches := []MediaFileLyricsSearchResult{
			{ID: 84, TrackName: "Feeling Good", ArtistName: "Nina Simone", AlbumName: "I Put a Spell on You"},
		}

		results := rankLyricsSearchResults(matches, "Feeling Good - Nina Simone (1965)")

		Expect(results).To(HaveLen(1))
		Expect(results[0].ID).To(Equal(int64(84)))
	})

	It("sends the stored title unchanged and ranks a shorter title match", func() {
		mediaFiles.SetData(model.MediaFiles{{
			ID: "song-1", Title: "Feeling Good - Nina Simone (1965)", Artist: "Unknown Artist", Album: "Test Album",
		}})
		remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			Expect(r.URL.Query().Get("q")).To(Equal("Feeling Good - Nina Simone (1965)"))
			w.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(w, `[{"id":84,"trackName":"Feeling Good","artistName":"Nina Simone","albumName":"I Put a Spell on You","duration":171,"plainLyrics":"Lyrics"}]`)
		}))
		DeferCleanup(remote.Close)
		maintenance := service.(*maintenanceService)
		maintenance.lyricsSearch.baseURL = remote.URL + "/api"
		maintenance.lyricsSearch.httpClient = remote.Client()

		results, err := service.SearchMediaFileLyrics(ctx, "song-1", "")

		Expect(err).ToNot(HaveOccurred())
		Expect(results).To(HaveLen(1))
		Expect(results[0].ID).To(Equal(int64(84)))
	})

	It("does not query LRCLIB when lyrics editing is disabled", func() {
		conf.Server.EnableMediaFileMetadataEditing = false

		_, err := service.SearchMediaFileLyrics(ctx, "song-1", "")

		Expect(err).To(MatchError(ErrMediaFileMetadataEditingDisabled))
	})

	It("requires an administrator", func() {
		userCtx := request.WithUser(context.Background(), model.User{ID: "user"})

		_, err := service.SearchMediaFileLyrics(userCtx, "song-1", "")

		Expect(err).To(MatchError(model.ErrNotAuthorized))
	})
})
