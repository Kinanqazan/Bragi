package nativeapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/tests"
)

type statsCapture struct {
	tests.MockScrobbleRepo
	since time.Time
}

func (s *statsCapture) GetListeningStats(since time.Time) (*model.ListeningStats, error) {
	s.since = since
	return &model.ListeningStats{}, nil
}

func TestListeningStatsPeriods(t *testing.T) {
	for _, tc := range []struct {
		query, period string
		days          int
	}{
		{"", "30d", 30}, {"30d", "30d", 30}, {"90d", "90d", 90}, {"1y", "1y", 365}, {"all", "all", 0},
	} {
		t.Run(tc.period+tc.query, func(t *testing.T) {
			repo := &statsCapture{}
			handler := getListeningStats(&tests.MockDataStore{MockedScrobble: repo})
			before := time.Now()
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/listening-stats?period="+tc.query, nil))
			if response.Code != http.StatusOK {
				t.Fatalf("status: %d", response.Code)
			}
			var body struct {
				Period string `json:"period"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Period != tc.period {
				t.Fatalf("unexpected response: %s", response.Body.String())
			}
			if tc.period == "all" {
				if !repo.since.IsZero() {
					t.Fatalf("all time starts at %v", repo.since)
				}
			} else {
				expected := before.AddDate(0, 0, -tc.days)
				if tc.period == "1y" {
					expected = before.AddDate(-1, 0, 0)
				}
				if delta := repo.since.Sub(expected); delta < 0 || delta > time.Minute {
					t.Fatalf("unexpected start: %v", repo.since)
				}
			}
		})
	}
	response := httptest.NewRecorder()
	getListeningStats(&tests.MockDataStore{}).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/listening-stats?period=bad", nil))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("invalid period: %d", response.Code)
	}
}
