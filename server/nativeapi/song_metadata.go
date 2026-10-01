package nativeapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/core"
	"github.com/navidrome/navidrome/model"
)

func updateMediaFileMetadata(maintenance core.Maintenance) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var changes core.MediaFileMetadataChanges
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&changes); err != nil {
			http.Error(w, "invalid metadata update: "+err.Error(), http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
			http.Error(w, "invalid metadata update: expected a single JSON object", http.StatusBadRequest)
			return
		}

		result, err := maintenance.UpdateMediaFileMetadata(r.Context(), chi.URLParam(r, "id"), changes)
		if err != nil {
			writeMetadataError(w, err)
			return
		}
		status := http.StatusOK
		if result.RefreshRequired {
			status = http.StatusAccepted
		}
		writeJSON(w, status, result)
	}
}

func refreshMediaFileMetadata(maintenance core.Maintenance) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mediaFile, err := maintenance.RefreshMediaFileMetadata(r.Context(), chi.URLParam(r, "id"))
		if err != nil {
			writeMetadataError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"mediaFile": mediaFile})
	}
}

func getMediaFileLyrics(maintenance core.Maintenance) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lyrics, err := maintenance.LoadMediaFileLyrics(r.Context(), chi.URLParam(r, "id"))
		if err != nil {
			writeMetadataError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, lyrics)
	}
}

func saveMediaFileLyrics(maintenance core.Maintenance) http.HandlerFunc {
	type lyricsUpdate struct {
		Extension       string `json:"extension"`
		Content         string `json:"content"`
		ExpectedVersion string `json:"expectedVersion"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var changes lyricsUpdate
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, (1<<20)+64*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&changes); err != nil {
			http.Error(w, "invalid lyrics update: "+err.Error(), http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
			http.Error(w, "invalid lyrics update: expected a single JSON object", http.StatusBadRequest)
			return
		}
		lyrics, err := maintenance.SaveMediaFileLyrics(r.Context(), chi.URLParam(r, "id"), changes.Extension, changes.Content, changes.ExpectedVersion)
		if err != nil {
			writeMetadataError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, lyrics)
	}
}

func deleteMediaFileLyrics(maintenance core.Maintenance) http.HandlerFunc {
	type lyricsDelete struct {
		TxtVersion string `json:"txtVersion"`
		LrcVersion string `json:"lrcVersion"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var versions lyricsDelete
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&versions); err != nil {
			http.Error(w, "invalid lyrics deletion: "+err.Error(), http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
			http.Error(w, "invalid lyrics deletion: expected a single JSON object", http.StatusBadRequest)
			return
		}
		lyrics, err := maintenance.DeleteMediaFileLyrics(r.Context(), chi.URLParam(r, "id"), versions.TxtVersion, versions.LrcVersion)
		if err != nil {
			writeMetadataError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, lyrics)
	}
}

func writeMetadataError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, model.ErrNotAuthorized), errors.Is(err, core.ErrMediaFileMetadataEditingDisabled):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, model.ErrNotFound):
		http.Error(w, "not found", http.StatusNotFound)
	case errors.Is(err, model.ErrValidation):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, core.ErrMediaFileLyricsConflict):
		http.Error(w, "lyrics changed since they were loaded; reload before saving", http.StatusConflict)
	case errors.Is(err, core.ErrMediaFileMetadataUnsupported), errors.Is(err, core.ErrMediaFileMetadataConflict):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		http.Error(w, "metadata update failed", http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		return
	}
}
