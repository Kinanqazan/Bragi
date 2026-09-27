package persistence

import (
	"context"
	"database/sql"
	"errors"
	"time"

	. "github.com/Masterminds/squirrel"
	"github.com/deluan/rest"
	"github.com/navidrome/navidrome/model"
	"github.com/pocketbase/dbx"
)

type scrobbleRepository struct {
	sqlRepository
}

func fromTs(_ string, value any) Sqlizer {
	return GtOrEq{"scrobbles.submission_time": value}
}

func toTs(_ string, value any) Sqlizer {
	return LtOrEq{"scrobbles.submission_time": value}
}

func (r *scrobbleRepository) baseQuery(options ...model.QueryOptions) SelectBuilder {
	user := loggedUser(r.ctx)

	return r.newSelect(options...).
		Columns("id", "media_file_id", "submission_time").
		Where(Eq{"scrobbles.user_id": user.ID})
}

func NewScrobbleRepository(ctx context.Context, db dbx.Builder) model.ScrobbleRepository {
	r := &scrobbleRepository{}
	r.ctx = ctx
	r.db = db
	r.tableName = "scrobbles"
	r.registerModel(&model.Scrobble{}, map[string]filterFunc{
		"from": fromTs,
		"to":   toTs,
	})
	r.setSortMappings(map[string]string{
		"submission_time": "submission_time",
	})
	return r
}

func (r *scrobbleRepository) RecordScrobble(mediaFileID string, submissionTime time.Time) error {
	userID := loggedUser(r.ctx).ID
	values := map[string]any{
		"media_file_id":   mediaFileID,
		"user_id":         userID,
		"submission_time": submissionTime.Unix(),
	}
	insert := Insert(r.tableName).SetMap(values)
	_, err := r.executeSQL(insert)
	return err
}

func (r *scrobbleRepository) CountAll(options ...model.QueryOptions) (int64, error) {
	return r.count(r.baseQuery(), options...)
}

func (r *scrobbleRepository) GetListeningStats(since time.Time) (*model.ListeningStats, error) {
	userID := loggedUser(r.ctx).ID
	params := dbx.Params{
		"userId": userID,
		"since":  since.Unix(),
	}
	stats := &model.ListeningStats{
		TopTracks:         []model.ListeningTrack{},
		TopArtists:        []model.ListeningArtist{},
		UnplayedTrackList: []model.ListeningTrack{},
	}

	err := r.db.NewQuery(`
		SELECT COUNT(*) AS plays, COUNT(DISTINCT media_file_id) AS unique_tracks
		FROM scrobbles
		WHERE user_id = {:userId} AND submission_time >= {:since}
	`).Bind(params).WithContext(r.ctx).One(stats)
	if err != nil {
		return nil, err
	}

	var unplayed struct {
		Count int64 `db:"count"`
	}
	unplayedQuery := Select("mf.id", "mf.title", "mf.artist", "mf.album", "mf.duration").
		From("media_file mf").
		LeftJoin(
			"annotation ON annotation.item_id = mf.id AND annotation.item_type = ? AND annotation.user_id = ?",
			"media_file",
			userID,
		).
		Where(Eq{"mf.missing": false}).
		Where(Expr("COALESCE(annotation.play_count, 0) = 0"))
	unplayedQuery = r.applyLibraryFilter(unplayedQuery, "mf")

	err = r.queryOne(
		unplayedQuery.RemoveColumns().Columns("COUNT(*) AS count"),
		&unplayed,
	)
	if err != nil {
		return nil, err
	}
	stats.UnplayedTrackCount = unplayed.Count

	err = r.queryAll(
		unplayedQuery.
			OrderBy("mf.created_at DESC, mf.order_title ASC, mf.id ASC").
			Limit(10),
		&stats.UnplayedTrackList,
	)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		return nil, err
	}
	if stats.UnplayedTrackList == nil {
		stats.UnplayedTrackList = []model.ListeningTrack{}
	}

	err = r.db.NewQuery(`
		SELECT mf.id, mf.title, mf.artist, mf.album, mf.duration, COUNT(*) AS plays
		FROM scrobbles s
		JOIN media_file mf ON mf.id = s.media_file_id
		WHERE s.user_id = {:userId} AND s.submission_time >= {:since}
		GROUP BY mf.id, mf.title, mf.artist, mf.album, mf.duration
		ORDER BY plays DESC, mf.title ASC
		LIMIT 10
	`).Bind(params).WithContext(r.ctx).All(&stats.TopTracks)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if stats.TopTracks == nil {
		stats.TopTracks = []model.ListeningTrack{}
	}

	err = r.db.NewQuery(`
		SELECT a.id, a.name, COUNT(*) AS plays
		FROM scrobbles s
		JOIN media_file mf ON mf.id = s.media_file_id
		JOIN artist a ON a.id = mf.artist_id
		WHERE s.user_id = {:userId} AND s.submission_time >= {:since}
		GROUP BY a.id, a.name
		ORDER BY plays DESC, a.name ASC
		LIMIT 5
	`).Bind(params).WithContext(r.ctx).All(&stats.TopArtists)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if stats.TopArtists == nil {
		stats.TopArtists = []model.ListeningArtist{}
	}

	return stats, nil
}

func (r *scrobbleRepository) Count(options ...rest.QueryOptions) (int64, error) {
	return r.CountAll(r.parseRestOptions(r.ctx, options...))
}

func (r *scrobbleRepository) Get(id string) (*model.Scrobble, error) {
	sel := r.baseQuery().Where(Eq{"id": id})
	var res model.Scrobble
	err := r.queryOne(sel, &res)
	return &res, err
}

func (r *scrobbleRepository) GetAll(options ...model.QueryOptions) (model.Scrobbles, error) {
	sel := r.baseQuery(options...)
	var scrobbles model.Scrobbles
	err := r.queryAll(sel, &scrobbles)
	return scrobbles, err
}

func (r *scrobbleRepository) Read(id string) (any, error) {
	return r.Get(id)
}

func (r *scrobbleRepository) ReadAll(options ...rest.QueryOptions) (any, error) {
	return r.GetAll(r.parseRestOptions(r.ctx, options...))
}

func (r *scrobbleRepository) EntityName() string {
	return "scrobble"
}

func (r *scrobbleRepository) NewInstance() any {
	return &model.Scrobble{}
}

var _ model.ScrobbleRepository = (*scrobbleRepository)(nil)
var _ model.ResourceRepository = (*scrobbleRepository)(nil)
