package listenbrainz

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/tests"
)

func TestRecommendations(t *testing.T) {
	const playlistID = "11111111-1111-4111-8111-111111111111"
	const recordingID = "22222222-2222-4222-8222-222222222222"
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") == "" {
			t.Error("missing user agent")
		}
		switch r.URL.Path {
		case "/1/validate-token":
			if r.Header.Get("Authorization") != "Token secret" {
				t.Error("missing token")
			}
			fmt.Fprint(w, `{"valid":true,"user_name":"test user"}`)
		case "/1/user/test user/playlists/recommendations":
			fmt.Fprintf(w, `{"playlists":[{"playlist":{"identifier":"https://listenbrainz.org/playlist/%s","title":"Weekly"}}]}`, playlistID)
		case "/1/playlist/" + playlistID:
			fmt.Fprintf(w, `{"playlist":{"title":"Weekly","track":[{"title":"Song","creator":"Artist","identifier":["https://musicbrainz.org/recording/%s"]}]}}`, recordingID)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	repo := tests.CreateMockMediaFileRepo()
	repo.SetData(model.MediaFiles{{ID: "local", Title: "Song", MbzRecordingID: recordingID}})
	s := Router{sessionKeys: &fakeSessionKeys{KeyValue: "secret"}, client: newClient(upstream.URL+"/1/", upstream.Client()), ds: &tests.MockDataStore{MockedMediaFile: repo}}
	router := chi.NewRouter()
	router.Get("/recommendations", s.recommendations)
	router.Get("/recommendations/{id}", s.recommendationPlaylist)

	for _, tc := range []struct {
		path     string
		status   int
		contains string
	}{
		{"/recommendations", 200, `"user":"test user"`},
		{"/recommendations/" + playlistID, 200, `"id":"local"`},
		{"/recommendations/33333333-3333-4333-8333-333333333333", 404, "404"},
		{"/recommendations/not-a-uuid", 400, "Invalid playlist ID"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, tc.path, nil))
			if resp.Code != tc.status || !strings.Contains(resp.Body.String(), tc.contains) {
				t.Fatalf("got %d %s", resp.Code, resp.Body.String())
			}
		})
	}
	s.sessionKeys = &fakeSessionKeys{}
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/recommendations", nil))
	if resp.Code != 200 || !strings.Contains(resp.Body.String(), `"linked":false`) {
		t.Fatalf("unlinked: %d %s", resp.Code, resp.Body.String())
	}
}

func TestRecordingYouTubeLink(t *testing.T) {
	hc := &tests.FakeHttpClient{Res: http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewBufferString(`{"relations":[{"url":{"resource":"https://example.com/watch?v=wrong"}},{"url":{"resource":"https://www.youtube.com/watch?v=abc"}}]}`))}}
	s := Router{client: newClient("http://localhost/", hc)}
	r := chi.NewRouter()
	r.Get("/recording/{id}/youtube", s.recordingYouTubeLink)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/recording/22222222-2222-4222-8222-222222222222/youtube", nil))
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"url":"https://music.youtube.com/watch?v=abc"`) {
		t.Fatalf("got %d %s", resp.Code, resp.Body.String())
	}
}
