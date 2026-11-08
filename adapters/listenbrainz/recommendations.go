package listenbrainz

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/deluan/rest"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
)

type recommendationTrack struct {
	Title      string           `json:"title"`
	Creator    string           `json:"creator"`
	Album      string           `json:"album"`
	Identifier []string         `json:"identifier"`
	Library    *model.MediaFile `json:"library,omitempty"`
	Extension  map[string]struct {
		AdditionalMetadata struct {
			ReleaseMBID string `json:"caa_release_mbid"`
		} `json:"additional_metadata"`
	} `json:"extension,omitempty"`
}

var musicBrainzLookupMu sync.Mutex
var musicBrainzLastLookup time.Time

// MusicBrainz requires clients to limit requests to one per second.
func (s *Router) recordingYouTubeLink(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid recording ID", http.StatusBadRequest)
		return
	}
	musicBrainzLookupMu.Lock()
	defer musicBrainzLookupMu.Unlock()
	if delay := time.Until(musicBrainzLastLookup.Add(time.Second)); delay > 0 {
		timer := time.NewTimer(delay)
		defer timer.Stop()
		select {
		case <-timer.C:
		case <-r.Context().Done():
			return
		}
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://musicbrainz.org/ws/2/recording/"+id.String()+"?inc=url-rels+artist-credits&fmt=json", nil)
	if err != nil {
		http.Error(w, "Could not look up recording", http.StatusBadGateway)
		return
	}
	req.Header.Set("User-Agent", "Bragi/1.0 (https://github.com/kinanqaz/bragi)")
	musicBrainzLastLookup = time.Now()
	resp, err := s.client.hc.Do(req)
	if err != nil {
		http.Error(w, "Could not look up recording", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Could not look up recording", http.StatusBadGateway)
		return
	}
	var data struct {
		Title          string `json:"title"`
		Disambiguation string `json:"disambiguation"`
		ArtistCredit   []struct {
			Name   string `json:"name"`
			Artist struct {
				Name string `json:"name"`
			} `json:"artist"`
		} `json:"artist-credit"`
		Relations []struct {
			URL struct {
				Resource string `json:"resource"`
			} `json:"url"`
		} `json:"relations"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&data); err != nil {
		http.Error(w, "Could not look up recording", http.StatusBadGateway)
		return
	}
	link := ""
	for _, rel := range data.Relations {
		u, err := url.Parse(rel.URL.Resource)
		if err == nil && u.Scheme == "https" && (u.Hostname() == "music.youtube.com" || u.Hostname() == "www.youtube.com" || u.Hostname() == "youtube.com" || u.Hostname() == "youtu.be") {
			if u.Hostname() == "youtu.be" && strings.Trim(u.Path, "/") != "" {
				link = "https://music.youtube.com/watch?v=" + url.QueryEscape(strings.Trim(u.Path, "/"))
				break
			}
			if u.Path == "/watch" && u.Query().Get("v") != "" {
				link = "https://music.youtube.com/watch?v=" + url.QueryEscape(u.Query().Get("v"))
				break
			}
		}
	}
	if link == "" && strings.TrimSpace(os.Getenv("BR_YOUTUBE_API_KEY")) != "" {
		artists := make([]string, 0, len(data.ArtistCredit))
		for _, credit := range data.ArtistCredit {
			name := credit.Name
			if name == "" {
				name = credit.Artist.Name
			}
			if name != "" {
				artists = append(artists, name)
			}
		}
		if data.Title != "" && len(artists) > 0 {
			var err error
			link, err = searchYouTubeRecording(r.Context(), s.client.hc, os.Getenv("BR_YOUTUBE_API_KEY"), data.Title, strings.Join(artists, " "), data.Disambiguation)
			if err != nil {
				http.Error(w, "Could not search YouTube", http.StatusBadGateway)
				return
			}
		}
	}
	_ = rest.RespondWithJSON(w, http.StatusOK, map[string]string{"url": link})
}

func searchYouTubeRecording(ctx context.Context, hc httpDoer, key, title, artist, version string) (string, error) {
	values := url.Values{"part": {"snippet"}, "type": {"video"}, "maxResults": {"5"}, "q": {strings.TrimSpace(artist + " " + title + " " + version)}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/youtube/v3/search?"+values.Encode(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Goog-Api-Key", key)
	resp, err := hc.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("YouTube search returned HTTP %d", resp.StatusCode)
	}
	var result struct {
		Items []struct {
			ID struct {
				VideoID string `json:"videoId"`
			} `json:"id"`
			Snippet struct {
				Title        string `json:"title"`
				ChannelTitle string `json:"channelTitle"`
			} `json:"snippet"`
		} `json:"items"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return "", err
	}
	versionYear := regexp.MustCompile(`\b(?:19|20)\d{2}\b`).FindString(version)
	for _, item := range result.Items {
		if !regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`).MatchString(item.ID.VideoID) {
			continue
		}
		text := strings.ToLower(item.Snippet.Title + " " + item.Snippet.ChannelTitle)
		if strings.Contains(text, strings.ToLower(title)) && strings.Contains(text, strings.ToLower(artist)) && (versionYear == "" || strings.Contains(text, versionYear)) {
			return "https://music.youtube.com/watch?v=" + item.ID.VideoID, nil
		}
	}
	return "", nil
}

type recommendationPlaylist struct {
	Identifier string                `json:"identifier"`
	Title      string                `json:"title"`
	Date       string                `json:"date"`
	Annotation string                `json:"annotation"`
	Track      []recommendationTrack `json:"track,omitempty"`
}

type playlistEnvelope struct {
	Playlist recommendationPlaylist `json:"playlist"`
}

func (c *client) getRecommendationJSON(ctx context.Context, endpoint string, result any) error {
	uri, err := c.path(endpoint)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, uri, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Bragi/1.0 (https://github.com/kinanqaz/bragi)")
	resp, err := c.hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ListenBrainz returned HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(result)
}

func (s *Router) linkedRecommendations(ctx context.Context) ([]playlistEnvelope, string, error) {
	u, _ := request.UserFrom(ctx)
	key, err := s.sessionKeys.Get(ctx, u.ID)
	if errors.Is(err, model.ErrNotFound) || (err == nil && key == "") {
		return nil, "", model.ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	identity, err := s.client.validateToken(ctx, key)
	if err != nil {
		return nil, "", err
	}
	if !identity.Valid || identity.UserName == "" {
		return nil, "", errors.New("ListenBrainz token is invalid")
	}
	// Usernames are a single URL path component, never an arbitrary upstream path.
	if strings.ContainsAny(identity.UserName, "/\\") || identity.UserName == "." || identity.UserName == ".." {
		return nil, "", errors.New("invalid ListenBrainz username")
	}
	var response struct {
		Playlists []playlistEnvelope `json:"playlists"`
	}
	err = s.client.getRecommendationJSON(ctx, "user/"+identity.UserName+"/playlists/recommendations", &response)
	return response.Playlists, identity.UserName, err
}

func playlistID(identifier string) string {
	id := identifier[strings.LastIndex(identifier, "/")+1:]
	if _, err := uuid.Parse(id); err != nil {
		return ""
	}
	return id
}

func (s *Router) recommendations(w http.ResponseWriter, r *http.Request) {
	playlists, user, err := s.linkedRecommendations(r.Context())
	if errors.Is(err, model.ErrNotFound) {
		_ = rest.RespondWithJSON(w, http.StatusOK, map[string]any{"linked": false})
		return
	}
	if err != nil {
		_ = rest.RespondWithError(w, http.StatusBadGateway, "Could not load ListenBrainz recommendations")
		return
	}
	if playlists == nil {
		playlists = []playlistEnvelope{}
	}
	_ = rest.RespondWithJSON(w, http.StatusOK, map[string]any{"linked": true, "user": user, "playlists": playlists})
}

func (s *Router) recommendationPlaylist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		http.Error(w, "Invalid playlist ID", http.StatusBadRequest)
		return
	}
	playlists, _, err := s.linkedRecommendations(r.Context())
	if errors.Is(err, model.ErrNotFound) {
		http.Error(w, "ListenBrainz is not linked", http.StatusForbidden)
		return
	}
	if err != nil {
		_ = rest.RespondWithError(w, http.StatusBadGateway, "Could not load ListenBrainz recommendations")
		return
	}
	found := false
	for _, p := range playlists {
		if playlistID(p.Playlist.Identifier) == id {
			found = true
			break
		}
	}
	if !found {
		http.NotFound(w, r)
		return
	}
	var result playlistEnvelope
	if err := s.client.getRecommendationJSON(r.Context(), "playlist/"+id, &result); err != nil {
		_ = rest.RespondWithError(w, http.StatusBadGateway, "Could not load ListenBrainz playlist")
		return
	}
	var ids []string
	for _, track := range result.Playlist.Track {
		for _, identifier := range track.Identifier {
			if id := playlistID(identifier); id != "" {
				ids = append(ids, id)
			}
		}
	}
	if len(ids) > 0 {
		files, err := s.ds.MediaFile(r.Context()).GetAll(model.QueryOptions{Filters: squirrel.And{squirrel.Eq{"mbz_recording_id": ids}, squirrel.Eq{"missing": false}}})
		if err != nil {
			_ = rest.RespondWithError(w, http.StatusInternalServerError, "Could not match library tracks")
			return
		}
		byID := make(map[string]*model.MediaFile, len(files))
		for i := range files {
			if _, ok := byID[files[i].MbzRecordingID]; !ok {
				byID[files[i].MbzRecordingID] = &files[i]
			}
		}
		for i := range result.Playlist.Track {
			for _, identifier := range result.Playlist.Track[i].Identifier {
				if file := byID[playlistID(identifier)]; file != nil {
					result.Playlist.Track[i].Library = file
					break
				}
			}
		}
	}
	_ = rest.RespondWithJSON(w, http.StatusOK, result)
}
