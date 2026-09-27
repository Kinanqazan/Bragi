package model

import "time"

type Scrobble struct {
	ID             int64  `structs:"id" json:"id"`
	MediaFileID    string `structs:"media_file_id" json:"mediaFileId"`
	UserID         string `json:"-"`
	SubmissionTime int64  `structs:"submission_time" json:"submissionTime"`
}

type ListeningStats struct {
	Plays              int64             `json:"plays" db:"plays"`
	UniqueTracks       int64             `json:"uniqueTracks" db:"unique_tracks"`
	UnplayedTrackCount int64             `json:"unplayedTrackCount" db:"unplayed_track_count"`
	TopTracks          []ListeningTrack  `json:"topTracks"`
	TopArtists         []ListeningArtist `json:"topArtists"`
	UnplayedTrackList  []ListeningTrack  `json:"unplayedTrackList"`
}

type ListeningTrack struct {
	ID       string  `json:"id" db:"id"`
	Title    string  `json:"title" db:"title"`
	Artist   string  `json:"artist" db:"artist"`
	Album    string  `json:"album" db:"album"`
	Duration float32 `json:"duration" db:"duration"`
	Plays    int64   `json:"plays" db:"plays"`
}

type ListeningArtist struct {
	ID    string `json:"id" db:"id"`
	Name  string `json:"name" db:"name"`
	Plays int64  `json:"plays" db:"plays"`
}

type ScrobbleRepository interface {
	CountAll(options ...QueryOptions) (int64, error)
	Get(id string) (*Scrobble, error)
	GetAll(options ...QueryOptions) (Scrobbles, error)
	GetListeningStats(since time.Time) (*ListeningStats, error)
	RecordScrobble(mediaFileID string, submissionTime time.Time) error
}

type Scrobbles []Scrobble
