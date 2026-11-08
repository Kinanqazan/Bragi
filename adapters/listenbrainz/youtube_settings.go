package listenbrainz

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/deluan/rest"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
)

func (s *Router) getYouTubeKeyStatus(w http.ResponseWriter, r *http.Request) {
	u, _ := request.UserFrom(r.Context())
	key, err := s.youtubeKeys.Get(r.Context(), u.ID)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		http.Error(w, "Could not load YouTube settings", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	_ = rest.RespondWithJSON(w, http.StatusOK, map[string]bool{"configured": key != "", "serverConfigured": strings.TrimSpace(os.Getenv("BR_YOUTUBE_API_KEY")) != ""})
}

func (s *Router) putYouTubeKey(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&payload); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	key := strings.TrimSpace(payload.Key)
	if key == "" || len(key) > 512 || strings.ContainsAny(key, "\r\n") {
		http.Error(w, "Enter a valid API key", http.StatusBadRequest)
		return
	}
	u, _ := request.UserFrom(r.Context())
	if err := s.youtubeKeys.Put(r.Context(), u.ID, key); err != nil {
		http.Error(w, "Could not save YouTube settings", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	_ = rest.RespondWithJSON(w, http.StatusOK, map[string]bool{"configured": true})
}

func (s *Router) deleteYouTubeKey(w http.ResponseWriter, r *http.Request) {
	u, _ := request.UserFrom(r.Context())
	if err := s.youtubeKeys.Delete(r.Context(), u.ID); err != nil && !errors.Is(err, model.ErrNotFound) {
		http.Error(w, "Could not remove YouTube settings", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	_ = rest.RespondWithJSON(w, http.StatusOK, map[string]bool{"configured": false})
}
