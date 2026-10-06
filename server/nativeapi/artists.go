package nativeapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/deluan/rest"
	"github.com/go-chi/chi/v5"
	"github.com/kinanqaz/bragi/conf"
	"github.com/kinanqaz/bragi/consts"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/server"
)

func (api *Router) addArtistRoute(r chi.Router) {
	constructor := func(ctx context.Context) rest.Repository {
		return api.ds.Resource(ctx, model.Artist{})
	}
	r.Route("/artist", func(r chi.Router) {
		r.Get("/", rest.GetAll(constructor))
		r.Route("/{id}", func(r chi.Router) {
			r.Use(server.URLParamsMiddleware)
			r.Get("/", rest.Get(constructor))
			r.With(adminOnlyMiddleware).Put("/name", api.renameArtistName())
			r.Post("/image", api.uploadArtistImage())
			r.Delete("/image", api.deleteArtistImage())
		})
	})
}

func (api *Router) renameArtistName() http.HandlerFunc {
	type renameRequest struct {
		Name string `json:"name"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !conf.Server.EnableMediaFileMetadataEditing {
			http.Error(w, "artist name editing is disabled", http.StatusForbidden)
			return
		}
		var input renameRequest
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			http.Error(w, "invalid artist name: "+err.Error(), http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			http.Error(w, "invalid artist name: expected a single JSON object", http.StatusBadRequest)
			return
		}
		name := strings.TrimSpace(input.Name)
		if name == "" || len(name) > 255 || strings.ContainsRune(name, '\x00') {
			http.Error(w, "artist name must contain 1 to 255 bytes", http.StatusBadRequest)
			return
		}

		artist, err := api.ds.Artist(r.Context()).Get(chi.URLParam(r, "id"))
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			http.Error(w, "could not load artist", http.StatusInternalServerError)
			return
		}
		artist.NameOverride = name
		artist.UpdatedAt = new(time.Now())
		if err := api.ds.Artist(r.Context()).Put(artist, "name_override", "updated_at"); err != nil {
			http.Error(w, "could not save artist name", http.StatusInternalServerError)
			return
		}
		artist.Name = name
		writeJSON(w, http.StatusOK, artist)
	}
}

func (api *Router) uploadArtistImage() http.HandlerFunc {
	return handleImageUpload(func(ctx context.Context, reader io.Reader, ext string) error {
		artistID := chi.URLParamFromCtx(ctx, "id")
		ar, err := api.ds.Artist(ctx).Get(artistID)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				return model.ErrNotFound
			}
			return err
		}
		oldPath := ar.UploadedImagePath()
		filename, err := api.imgUpload.SetImage(ctx, consts.EntityArtist, ar.ID, ar.Name, oldPath, reader, ext)
		if err != nil {
			return err
		}
		ar.UploadedImage = filename
		ar.UpdatedAt = new(time.Now())
		if err := api.ds.Artist(ctx).Put(ar, "uploaded_image", "updated_at"); err != nil {
			return err
		}
		api.imgUpload.EnqueueArtwork(ctx, consts.EntityArtist, ar.ID)
		return nil
	})
}

func (api *Router) deleteArtistImage() http.HandlerFunc {
	return handleImageDelete(func(ctx context.Context) error {
		artistID := chi.URLParamFromCtx(ctx, "id")
		ar, err := api.ds.Artist(ctx).Get(artistID)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				return model.ErrNotFound
			}
			return err
		}
		if err := api.imgUpload.RemoveImage(ctx, ar.UploadedImagePath()); err != nil {
			return err
		}
		ar.UploadedImage = ""
		ar.UpdatedAt = new(time.Now())
		if err := api.ds.Artist(ctx).Put(ar, "uploaded_image", "updated_at"); err != nil {
			return err
		}
		api.imgUpload.EnqueueArtwork(ctx, consts.EntityArtist, ar.ID)
		return nil
	})
}
