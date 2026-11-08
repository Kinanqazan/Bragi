package listenbrainz

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
)

type isolatedYouTubeKeys map[string]string

func (keys isolatedYouTubeKeys) Put(_ context.Context, userID, key string) error {
	keys[userID] = key
	return nil
}
func (keys isolatedYouTubeKeys) Get(_ context.Context, userID string) (string, error) {
	return keys[userID], nil
}
func (keys isolatedYouTubeKeys) Delete(_ context.Context, userID string) error {
	delete(keys, userID)
	return nil
}

func TestYouTubeKeySettings(t *testing.T) {
	t.Setenv("BR_YOUTUBE_API_KEY", "")
	keys := isolatedYouTubeKeys{}
	s := Router{youtubeKeys: keys}
	makeRequest := func(method, body string) *http.Request {
		r := httptest.NewRequest(method, "/youtube-key", strings.NewReader(body))
		return r.WithContext(request.WithUser(r.Context(), model.User{ID: "user-1"}))
	}
	resp := httptest.NewRecorder()
	s.putYouTubeKey(resp, makeRequest(http.MethodPut, `{"key":"secret-key"}`))
	if resp.Code != http.StatusOK || keys["user-1"] != "secret-key" {
		t.Fatalf("save failed: %d %s", resp.Code, resp.Body.String())
	}
	resp = httptest.NewRecorder()
	s.getYouTubeKeyStatus(resp, makeRequest(http.MethodGet, ""))
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"configured":true`) || strings.Contains(resp.Body.String(), "secret-key") {
		t.Fatalf("status leaked key or failed: %d %s", resp.Code, resp.Body.String())
	}
	resp = httptest.NewRecorder()
	other := makeRequest(http.MethodGet, "")
	other = other.WithContext(request.WithUser(other.Context(), model.User{ID: "user-2"}))
	s.getYouTubeKeyStatus(resp, other)
	if !strings.Contains(resp.Body.String(), `"configured":false`) {
		t.Fatalf("other user inherited a key: %s", resp.Body.String())
	}
	resp = httptest.NewRecorder()
	s.deleteYouTubeKey(resp, makeRequest(http.MethodDelete, ""))
	if resp.Code != http.StatusOK || keys["user-1"] != "" {
		t.Fatalf("remove failed: %d %s", resp.Code, resp.Body.String())
	}
}
