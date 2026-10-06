package core

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/kinanqaz/bragi/conf"
	"github.com/kinanqaz/bragi/consts"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
	"github.com/xrash/smetrics"
)

const (
	lrclibAPIBaseURL        = "https://lrclib.net/api"
	lyricsSearchTimeout     = 8 * time.Second
	lyricsSearchRetryDelay  = 150 * time.Millisecond
	lyricsSearchRetryCount  = 1
	lyricsSearchMaxResponse = 4 << 20
	lyricsSearchMaxResults  = 10
	lyricsSearchMaxText     = 1 << 20
)

var ErrMediaFileLyricsSearchUnavailable = errors.New("lyrics search is temporarily unavailable")
var errRetryableLyricsSearchFailure = errors.New("temporary lyrics search failure")

type MediaFileLyricsSearchRateLimitError struct {
	RetryAfter string
}

func (e *MediaFileLyricsSearchRateLimitError) Error() string {
	return "lyrics source rate limit reached"
}

type lrclibSearchClient struct {
	baseURL    string
	httpClient *http.Client
}

func newLRCLIBSearchClient() lrclibSearchClient {
	return lrclibSearchClient{
		baseURL:    lrclibAPIBaseURL,
		httpClient: &http.Client{Timeout: lyricsSearchTimeout},
	}
}

func (s *maintenanceService) SearchMediaFileLyrics(ctx context.Context, id, query string) ([]MediaFileLyricsSearchResult, error) {
	user, ok := request.UserFrom(ctx)
	if !ok || !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	if !conf.Server.EnableMediaFileMetadataEditing {
		return nil, ErrMediaFileMetadataEditingDisabled
	}

	mf, err := s.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}
	query = strings.TrimSpace(query)
	if query == "" {
		query = strings.TrimSpace(mf.Title)
	}
	if query == "" {
		return nil, fmt.Errorf("%w: song title is required to search lyrics", model.ErrValidation)
	}
	return s.lyricsSearch.search(ctx, query)
}

func (s lrclibSearchClient) search(ctx context.Context, title string) ([]MediaFileLyricsSearchResult, error) {
	requestCtx, cancel := context.WithTimeout(ctx, lyricsSearchTimeout)
	defer cancel()

	for attempt := 0; ; attempt++ {
		matches, err := s.searchQuery(requestCtx, title)
		if err == nil {
			return rankLyricsSearchResults(matches, title), nil
		}
		if attempt >= lyricsSearchRetryCount || requestCtx.Err() != nil || !errors.Is(err, errRetryableLyricsSearchFailure) {
			return nil, err
		}
		timer := time.NewTimer(lyricsSearchRetryDelay)
		select {
		case <-requestCtx.Done():
			timer.Stop()
			return nil, err
		case <-timer.C:
		}
	}
}

func (s lrclibSearchClient) searchQuery(ctx context.Context, searchTerm string) ([]MediaFileLyricsSearchResult, error) {
	endpoint, err := url.Parse(strings.TrimRight(s.baseURL, "/") + "/search")
	if err != nil {
		return nil, fmt.Errorf("%w: invalid search endpoint", ErrMediaFileLyricsSearchUnavailable)
	}
	query := endpoint.Query()
	// Search broadly by title so a typo or alternate artist credit does not
	// suppress useful candidates. Rank them locally with title as the primary
	// signal and artist/album similarity as tie-breakers.
	query.Set("q", searchTerm)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("%w: could not create request", ErrMediaFileLyricsSearchUnavailable)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Bragi/%s (+https://github.com/kinanqaz/bragi)", consts.Version))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %w: request failed", ErrMediaFileLyricsSearchUnavailable, errRetryableLyricsSearchFailure)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, &MediaFileLyricsSearchRateLimitError{RetryAfter: resp.Header.Get("Retry-After")}
	}
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode >= http.StatusInternalServerError {
			return nil, fmt.Errorf("%w: %w: upstream returned %s", ErrMediaFileLyricsSearchUnavailable, errRetryableLyricsSearchFailure, resp.Status)
		}
		return nil, fmt.Errorf("%w: upstream returned %s", ErrMediaFileLyricsSearchUnavailable, resp.Status)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, lyricsSearchMaxResponse+1))
	if err != nil || len(body) > lyricsSearchMaxResponse {
		return nil, fmt.Errorf("%w: response was too large or incomplete", ErrMediaFileLyricsSearchUnavailable)
	}
	var matches []struct {
		ID           int64   `json:"id"`
		TrackName    string  `json:"trackName"`
		ArtistName   string  `json:"artistName"`
		AlbumName    string  `json:"albumName"`
		Duration     float64 `json:"duration"`
		PlainLyrics  string  `json:"plainLyrics"`
		SyncedLyrics string  `json:"syncedLyrics"`
	}
	if err := json.Unmarshal(body, &matches); err != nil {
		return nil, fmt.Errorf("%w: response was invalid", ErrMediaFileLyricsSearchUnavailable)
	}

	results := make([]MediaFileLyricsSearchResult, 0, len(matches))
	for _, match := range matches {
		if match.ID <= 0 || (match.PlainLyrics == "" && match.SyncedLyrics == "") ||
			len(match.PlainLyrics) > lyricsSearchMaxText || len(match.SyncedLyrics) > lyricsSearchMaxText {
			continue
		}
		results = append(results, MediaFileLyricsSearchResult{
			ID: match.ID, TrackName: match.TrackName, ArtistName: match.ArtistName,
			AlbumName: match.AlbumName, Duration: match.Duration,
			PlainLyrics: match.PlainLyrics, SyncedLyrics: match.SyncedLyrics,
		})
	}
	return results, nil
}

type rankedLyricsSearchResult struct {
	result MediaFileLyricsSearchResult
	score  float64
	title  float64
}

func rankLyricsSearchResults(results []MediaFileLyricsSearchResult, query string) []MediaFileLyricsSearchResult {
	wantedQuery := normalizeLyricsSearchText(query)
	ranked := make([]rankedLyricsSearchResult, 0, len(results))
	seen := make(map[int64]struct{}, len(results))
	for _, result := range results {
		if _, exists := seen[result.ID]; exists {
			continue
		}
		seen[result.ID] = struct{}{}
		resultTitle := normalizeLyricsSearchText(result.TrackName)
		resultArtist := normalizeLyricsSearchText(result.ArtistName)
		combinedMetadata := strings.TrimSpace(resultTitle + " " + resultArtist)
		matchScore := lyricsSearchSimilarity(wantedQuery, combinedMetadata)
		titleScore := lyricsSearchSimilarity(wantedQuery, resultTitle)
		// A query may contain both title and artist, only a title, or a user's
		// completely different search. Compare it with the result's title and
		// artist together, while retaining title similarity as a tie-breaker.
		if wantedQuery == resultTitle {
			matchScore = 1
		}
		if matchScore < 0.55 {
			continue
		}
		ranked = append(ranked, rankedLyricsSearchResult{
			result: result,
			score:  matchScore,
			title:  titleScore,
		})
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].score != ranked[j].score {
			return ranked[i].score > ranked[j].score
		}
		return ranked[i].title > ranked[j].title
	})
	if len(ranked) > lyricsSearchMaxResults {
		ranked = ranked[:lyricsSearchMaxResults]
	}
	ordered := make([]MediaFileLyricsSearchResult, len(ranked))
	for i := range ranked {
		ordered[i] = ranked[i].result
	}
	return ordered
}

func normalizeLyricsSearchText(value string) string {
	var normalized strings.Builder
	previousSpace := true
	for _, char := range strings.ToLower(value) {
		if unicode.IsLetter(char) || unicode.IsNumber(char) {
			normalized.WriteRune(char)
			previousSpace = false
		} else if !previousSpace {
			normalized.WriteByte(' ')
			previousSpace = true
		}
	}
	return strings.TrimSpace(normalized.String())
}

func lyricsSearchSimilarity(a, b string) float64 {
	if a == "" || b == "" {
		return 0
	}
	if a == b {
		return 1
	}
	score := smetrics.JaroWinkler(a, b, 0.7, 4)
	if tokenScore := lyricsSearchTokenSimilarity(a, b); tokenScore > score {
		score = tokenScore
	}
	return score
}

func lyricsSearchTokenSimilarity(a, b string) float64 {
	tokens := func(value string) map[string]struct{} {
		unique := make(map[string]struct{})
		for _, token := range strings.Fields(value) {
			unique[token] = struct{}{}
		}
		return unique
	}
	left, right := tokens(a), tokens(b)
	if len(left) == 0 || len(right) == 0 {
		return 0
	}
	shared := 0
	for token := range left {
		if _, exists := right[token]; exists {
			shared++
		}
	}
	return 2 * float64(shared) / float64(len(left)+len(right))
}
