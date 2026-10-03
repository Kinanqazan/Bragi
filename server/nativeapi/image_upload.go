package nativeapi

import (
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/core/artwork"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	_ "golang.org/x/image/webp"
)

func checkImageUploadPermission(w http.ResponseWriter, r *http.Request) bool {
	user, _ := request.UserFrom(r.Context())
	if !conf.Server.EnableArtworkUpload && !user.IsAdmin {
		http.Error(w, "artwork upload is disabled", http.StatusForbidden)
		return false
	}
	return true
}

func parseUploadedImage(w http.ResponseWriter, r *http.Request) ([]byte, string, error) {
	maxImageSize := artwork.MaxImageUploadSize()
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize)
	err := r.ParseMultipartForm(min(maxImageSize, 10<<20))
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()
	if err != nil {
		return nil, "", fmt.Errorf("file too large or invalid form")
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		return nil, "", fmt.Errorf("missing image file")
	}
	defer file.Close()
	config, format, err := image.DecodeConfig(file)
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 16000 || config.Height > 16000 || int64(config.Width)*int64(config.Height) > 100_000_000 {
		return nil, "", fmt.Errorf("invalid or excessively large image")
	}
	mimeType := ""
	switch format {
	case "jpeg":
		mimeType = "image/jpeg"
	case "png":
		mimeType = "image/png"
	case "gif":
		mimeType = "image/gif"
	case "webp":
		mimeType = "image/webp"
	default:
		return nil, "", fmt.Errorf("unsupported image format")
	}
	if seeker, ok := file.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return nil, "", fmt.Errorf("reading image file")
		}
	}
	data, err := io.ReadAll(io.LimitReader(file, maxImageSize+1))
	if err != nil || int64(len(data)) > maxImageSize {
		return nil, "", fmt.Errorf("file too large or unreadable")
	}
	return data, mimeType, nil
}

func handleImageUpload(saveFn func(ctx context.Context, reader io.Reader, ext string) error) http.HandlerFunc {
	maxImageSize := artwork.MaxImageUploadSize()
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if !checkImageUploadPermission(w, r) {
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxImageSize)
		if err := r.ParseMultipartForm(min(maxImageSize, 10<<20)); err != nil {
			log.Error(ctx, "Error parsing multipart form", err)
			http.Error(w, "file too large or invalid form", http.StatusBadRequest)
			return
		}
		defer func() {
			if r.MultipartForm != nil {
				if err := r.MultipartForm.RemoveAll(); err != nil {
					log.Warn(ctx, "Error removing multipart temp files", err)
				}
			}
		}()
		file, header, err := r.FormFile("image")
		if err != nil {
			log.Error(ctx, "Error reading uploaded file", err)
			http.Error(w, "missing image file", http.StatusBadRequest)
			return
		}
		defer file.Close()
		_, format, err := image.DecodeConfig(file)
		if err != nil {
			log.Error(ctx, "Uploaded file is not a valid image", err)
			http.Error(w, "invalid image file", http.StatusBadRequest)
			return
		}
		if seeker, ok := file.(io.Seeker); ok {
			if _, err := seeker.Seek(0, io.SeekStart); err != nil {
				log.Error(ctx, "Error seeking file", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
		ext := "." + format
		if ext == "." {
			ext = strings.ToLower(filepath.Ext(header.Filename))
		}
		if ext == "" || ext == "." {
			log.Error(ctx, "Could not determine image type", "filename", header.Filename)
			http.Error(w, "could not determine image type", http.StatusBadRequest)
			return
		}
		if err := saveFn(ctx, file, ext); err != nil {
			if errors.Is(err, model.ErrNotAuthorized) {
				http.Error(w, "not authorized", http.StatusForbidden)
				return
			}
			if errors.Is(err, model.ErrNotFound) {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			log.Error(ctx, "Error saving image", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_, _ = fmt.Fprintf(w, `{"status":"ok"}`)
	}
}

func handleImageDelete(deleteFn func(ctx context.Context) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if !checkImageUploadPermission(w, r) {
			return
		}
		if err := deleteFn(ctx); err != nil {
			if errors.Is(err, model.ErrNotAuthorized) {
				http.Error(w, "not authorized", http.StatusForbidden)
				return
			}
			if errors.Is(err, model.ErrNotFound) {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			log.Error(ctx, "Error removing image", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_, _ = fmt.Fprintf(w, `{"status":"ok"}`)
	}
}
