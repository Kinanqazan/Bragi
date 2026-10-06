package nativeapi

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/kinanqaz/bragi/core"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Song metadata endpoints", func() {
	var service *metadataMaintenanceMock

	newRequest := func(method, route, body string, user model.User) *httptest.ResponseRecorder {
		router := chi.NewRouter()
		router.With(adminOnlyMiddleware).Put("/song/{id}/metadata", updateMediaFileMetadata(service))
		router.With(adminOnlyMiddleware).Put("/song/{id}/artwork", updateMediaFileArtwork(service))
		router.With(adminOnlyMiddleware).Post("/song/{id}/metadata/refresh", refreshMediaFileMetadata(service))
		router.With(adminOnlyMiddleware).Get("/song/{id}/lyrics", getMediaFileLyrics(service))
		router.With(adminOnlyMiddleware).Get("/song/{id}/lyrics/search", searchMediaFileLyrics(service))
		router.With(adminOnlyMiddleware).Put("/song/{id}/lyrics", saveMediaFileLyrics(service))
		router.With(adminOnlyMiddleware).Put("/song/{id}/lyrics/embedded", saveEmbeddedMediaFileLyrics(service))
		router.With(adminOnlyMiddleware).Delete("/song/{id}/lyrics", deleteMediaFileLyrics(service))
		req := httptest.NewRequest(method, route, strings.NewReader(body))
		req = req.WithContext(request.WithUser(req.Context(), user))
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}

	BeforeEach(func() {
		service = &metadataMaintenanceMock{
			result:    &core.MediaFileMetadataResult{Saved: true, RefreshRequired: true, RefreshError: "scanner busy"},
			mediaFile: &model.MediaFile{ID: "song-1", Title: "Updated"},
		}
	})

	It("accepts only supplied metadata fields and reports a pending refresh", func() {
		response := newRequest(http.MethodPut, "/song/song-1/metadata", `{"title":"Updated","artist":"Artist","genres":["Rock","Alternative"],"moods":["Dreamy"]}`, model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusAccepted))
		Expect(response.Body.String()).To(MatchJSON(`{"saved":true,"refreshRequired":true,"refreshError":"scanner busy"}`))
		Expect(service.updatedID).To(Equal("song-1"))
		Expect(service.changes.Title).ToNot(BeNil())
		Expect(*service.changes.Title).To(Equal("Updated"))
		Expect(service.changes.Artist).ToNot(BeNil())
		Expect(service.changes.AlbumArtist).To(BeNil())
		Expect(service.changes.Genres).ToNot(BeNil())
		Expect(*service.changes.Genres).To(Equal([]string{"Rock", "Alternative"}))
		Expect(service.changes.Moods).ToNot(BeNil())
		Expect(*service.changes.Moods).To(Equal([]string{"Dreamy"}))
	})

	It("rejects unknown fields", func() {
		response := newRequest(http.MethodPut, "/song/song-1/metadata", `{"title":"Updated","album":"Unexpected"}`, model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusBadRequest))
		Expect(service.updatedID).To(BeEmpty())
	})

	It("accepts a validated image upload and refreshes the selected song", func() {
		var imageBytes bytes.Buffer
		cover := image.NewRGBA(image.Rect(0, 0, 2, 2))
		cover.Set(0, 0, color.RGBA{B: 255, A: 255})
		Expect(png.Encode(&imageBytes, cover)).To(Succeed())
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		file, err := form.CreateFormFile("image", "cover.png")
		Expect(err).ToNot(HaveOccurred())
		_, err = file.Write(imageBytes.Bytes())
		Expect(err).ToNot(HaveOccurred())
		Expect(form.Close()).To(Succeed())
		req := httptest.NewRequest(http.MethodPut, "/song/song-1/artwork", &body)
		req.Header.Set("Content-Type", form.FormDataContentType())
		req = req.WithContext(request.WithUser(req.Context(), model.User{ID: "admin", IsAdmin: true}))
		response := httptest.NewRecorder()
		router := chi.NewRouter()
		router.With(adminOnlyMiddleware).Put("/song/{id}/artwork", updateMediaFileArtwork(service))
		router.ServeHTTP(response, req)

		Expect(response.Code).To(Equal(http.StatusAccepted))
		Expect(response.Body.String()).To(ContainSubstring(`"refreshRequired":true`))
		Expect(service.artworkID).To(Equal("song-1"))
		Expect(service.artworkMIME).To(Equal("image/png"))
		Expect(service.artwork).To(Equal(imageBytes.Bytes()))
	})

	It("blocks non-admin access before calling the service", func() {
		response := newRequest(http.MethodPut, "/song/song-1/metadata", `{"title":"Updated"}`, model.User{ID: "user"})

		Expect(response.Code).To(Equal(http.StatusForbidden))
		Expect(service.updatedID).To(BeEmpty())
	})

	It("refreshes a song's library entry", func() {
		response := newRequest(http.MethodPost, "/song/song-1/metadata/refresh", "", model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusOK))
		Expect(response.Body.String()).To(ContainSubstring(`"id":"song-1"`))
		Expect(response.Body.String()).To(ContainSubstring(`"title":"Updated"`))
		Expect(service.refreshedID).To(Equal("song-1"))
	})

	It("loads lyrics sidecars for an administrator", func() {
		response := newRequest(http.MethodGet, "/song/song-1/lyrics", "", model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusOK))
		Expect(service.refreshedID).To(Equal("song-1"))
	})

	It("searches online lyrics for the selected song without saving them", func() {
		service.lyricsSearchResults = []core.MediaFileLyricsSearchResult{{
			ID: 42, TrackName: "Test Song", ArtistName: "Test Artist", AlbumName: "Test Album", Duration: 180,
			PlainLyrics: "First line", SyncedLyrics: "[00:01.00]First line",
		}}
		response := newRequest(http.MethodGet, "/song/song-1/lyrics/search?q=Custom+Title", "", model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusOK))
		Expect(response.Body.String()).To(MatchJSON(`[{"id":42,"trackName":"Test Song","artistName":"Test Artist","albumName":"Test Album","duration":180,"plainLyrics":"First line","syncedLyrics":"[00:01.00]First line"}]`))
		Expect(service.lyricsSearchID).To(Equal("song-1"))
		Expect(service.lyricsSearchQuery).To(Equal("Custom Title"))
		Expect(service.updatedID).To(BeEmpty())
	})

	It("saves a selected lyrics sidecar with its version token", func() {
		response := newRequest(http.MethodPut, "/song/song-1/lyrics", `{"extension":".lrc","content":"[00:01.00]Line","expectedVersion":"old-version"}`, model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusOK))
		Expect(service.updatedID).To(Equal("song-1"))
		Expect(service.lyricsUpdate).To(Equal([3]string{".lrc", "[00:01.00]Line", "old-version"}))
	})

	It("saves embedded lyrics with optimistic version checking", func() {
		response := newRequest(http.MethodPut, "/song/song-1/lyrics/embedded", `{"content":"[00:01.00]Line","expectedVersion":"old-version"}`, model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusOK))
		Expect(service.updatedID).To(Equal("song-1"))
		Expect(service.embeddedLyricsUpdate).To(Equal([3]string{"song-1", "[00:01.00]Line", "old-version"}))
	})

	It("rejects unknown lyrics update fields", func() {
		response := newRequest(http.MethodPut, "/song/song-1/lyrics", `{"extension":".txt","content":"text","unexpected":true}`, model.User{ID: "admin", IsAdmin: true})
		Expect(response.Code).To(Equal(http.StatusBadRequest))
		Expect(service.updatedID).To(BeEmpty())
	})

	It("reports concurrent lyrics edits as a conflict", func() {
		service.err = core.ErrMediaFileLyricsConflict
		response := newRequest(http.MethodPut, "/song/song-1/lyrics", `{"extension":".txt","content":"text"}`, model.User{ID: "admin", IsAdmin: true})
		Expect(response.Code).To(Equal(http.StatusConflict))
	})

	It("deletes both managed sidecars using their loaded versions", func() {
		response := newRequest(http.MethodDelete, "/song/song-1/lyrics", `{"txtVersion":"txt-v1","lrcVersion":"lrc-v1"}`, model.User{ID: "admin", IsAdmin: true})

		Expect(response.Code).To(Equal(http.StatusOK))
		Expect(service.deletedID).To(Equal("song-1"))
		Expect(service.lyricsDeleteVersions).To(Equal([2]string{"txt-v1", "lrc-v1"}))
	})

	It("maps service errors to stable HTTP statuses", func() {
		service.err = model.ErrValidation
		response := newRequest(http.MethodPut, "/song/song-1/metadata", `{"title":"Updated"}`, model.User{ID: "admin", IsAdmin: true})
		Expect(response.Code).To(Equal(http.StatusBadRequest))

		service.err = errors.New("internal write detail")
		response = newRequest(http.MethodPut, "/song/song-1/metadata", `{"title":"Updated"}`, model.User{ID: "admin", IsAdmin: true})
		Expect(response.Code).To(Equal(http.StatusInternalServerError))
		Expect(response.Body.String()).ToNot(ContainSubstring("internal write detail"))
	})
})

type metadataMaintenanceMock struct {
	updatedID            string
	refreshedID          string
	changes              core.MediaFileMetadataChanges
	result               *core.MediaFileMetadataResult
	mediaFile            *model.MediaFile
	lyricsUpdate         [3]string
	embeddedLyricsUpdate [3]string
	deletedID            string
	lyricsDeleteVersions [2]string
	artworkID            string
	artworkMIME          string
	artwork              []byte
	lyricsSearchID       string
	lyricsSearchQuery    string
	lyricsSearchResults  []core.MediaFileLyricsSearchResult
	err                  error
}

func (m *metadataMaintenanceMock) UpdateMediaFileMetadata(_ context.Context, id string, changes core.MediaFileMetadataChanges) (*core.MediaFileMetadataResult, error) {
	m.updatedID = id
	m.changes = changes
	return m.result, m.err
}

func (m *metadataMaintenanceMock) UpdateMediaFileArtwork(_ context.Context, id string, image []byte, mimeType string) (*core.MediaFileMetadataResult, error) {
	m.artworkID = id
	m.artworkMIME = mimeType
	m.artwork = image
	return m.result, m.err
}

func (m *metadataMaintenanceMock) RefreshMediaFileMetadata(_ context.Context, id string) (*model.MediaFile, error) {
	m.refreshedID = id
	return m.mediaFile, m.err
}

func (m *metadataMaintenanceMock) LoadMediaFileLyrics(_ context.Context, id string) (*core.MediaFileLyrics, error) {
	m.refreshedID = id
	return &core.MediaFileLyrics{}, m.err
}

func (m *metadataMaintenanceMock) SearchMediaFileLyrics(_ context.Context, id, query string) ([]core.MediaFileLyricsSearchResult, error) {
	m.lyricsSearchID = id
	m.lyricsSearchQuery = query
	return m.lyricsSearchResults, m.err
}

func (m *metadataMaintenanceMock) SaveMediaFileLyrics(_ context.Context, id, extension, content, expectedVersion string) (*core.MediaFileLyrics, error) {
	m.updatedID = id
	m.lyricsUpdate = [3]string{extension, content, expectedVersion}
	return &core.MediaFileLyrics{}, m.err
}

func (m *metadataMaintenanceMock) SaveEmbeddedMediaFileLyrics(_ context.Context, id, content, expectedVersion string) (*core.MediaFileLyrics, error) {
	m.updatedID = id
	m.embeddedLyricsUpdate = [3]string{id, content, expectedVersion}
	return &core.MediaFileLyrics{}, m.err
}

func (m *metadataMaintenanceMock) DeleteMediaFileLyrics(_ context.Context, id, expectedTxtVersion, expectedLrcVersion string) (*core.MediaFileLyrics, error) {
	m.deletedID = id
	m.lyricsDeleteVersions = [2]string{expectedTxtVersion, expectedLrcVersion}
	return &core.MediaFileLyrics{}, m.err
}

func (*metadataMaintenanceMock) DeleteMediaFile(context.Context, string) error      { return nil }
func (*metadataMaintenanceMock) DeleteMissingFiles(context.Context, []string) error { return nil }
func (*metadataMaintenanceMock) DeleteAllMissingFiles(context.Context) error        { return nil }
