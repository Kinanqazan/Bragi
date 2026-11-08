package listenbrainz

import (
	"bytes"
	"context"
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

type recommendationTestDoer func(*http.Request) (*http.Response, error)

func (f recommendationTestDoer) Do(req *http.Request) (*http.Response, error) { return f(req) }

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

func TestSearchYouTubeRecording(t *testing.T) {
	hc := &tests.FakeHttpClient{Res: http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewBufferString(`{"items":[{"id":{"videoId":"original123"},"snippet":{"title":"Chicago - 25 or 6 to 4","channelTitle":"Chicago"}},{"id":{"videoId":"version1986"},"snippet":{"title":"Chicago - 25 or 6 to 4 (1986)","channelTitle":"Chicago"}}]}`))}}
	link, err := searchYouTubeRecording(context.Background(), hc, "test-key", "25 or 6 to 4", "Chicago", "re-recorded, 1986: Chicago 18 version")
	if err != nil || link != "https://music.youtube.com/watch?v=version1986" {
		t.Fatalf("link %q, error %v", link, err)
	}
	if hc.SavedRequest.Header.Get("X-Goog-Api-Key") != "test-key" {
		t.Fatal("API key was not supplied in the request header")
	}
	if !strings.Contains(hc.SavedRequest.URL.Query().Get("q"), "1986") {
		t.Fatal("search omitted the recording version")
	}
}

func TestSearchYouTubeRecordingRejectsWrongVersion(t *testing.T) {
	hc := &tests.FakeHttpClient{Res: http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"items":[{"id":{"videoId":"original123"},"snippet":{"title":"Chicago - 25 or 6 to 4","channelTitle":"Chicago"}}]}`))}}
	link, err := searchYouTubeRecording(context.Background(), hc, "test-key", "25 or 6 to 4", "Chicago", "re-recorded, 1986: Chicago 18 version")
	if err != nil || link != "" {
		t.Fatalf("unexpected link %q, error %v", link, err)
	}
}

func TestRecordingYouTubeLinkSearchFallback(t *testing.T) {
	t.Setenv("BR_YOUTUBE_API_KEY", "test-key")
	hc := recommendationTestDoer(func(req *http.Request) (*http.Response, error) {
		body := `{"title":"25 or 6 to 4","disambiguation":"re-recorded, 1986: Chicago 18 version","artist-credit":[{"name":"Chicago"}],"relations":[]}`
		if req.URL.Host == "www.googleapis.com" {
			if req.Header.Get("X-Goog-Api-Key") != "test-key" || !strings.Contains(req.URL.Query().Get("q"), "1986") {
				t.Error("missing search credentials or version")
			}
			body = `{"items":[{"id":{"videoId":"version1986"},"snippet":{"title":"Chicago - 25 or 6 to 4 (1986)"}}]}`
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	s := Router{client: newClient("http://localhost/", hc)}
	r := chi.NewRouter()
	r.Get("/recording/{id}/youtube", s.recordingYouTubeLink)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/recording/c7b5013a-01e4-4e20-b7e2-fe5d0b42234d/youtube", nil))
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"url":"https://music.youtube.com/watch?v=version1986"`) {
		t.Fatalf("got %d %s", resp.Code, resp.Body.String())
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
