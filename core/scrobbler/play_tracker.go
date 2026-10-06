package scrobbler

import (
	"context"
	"maps"
	"slices"
	"sync"
	"time"

	"github.com/kinanqaz/bragi/conf"
	"github.com/kinanqaz/bragi/consts"
	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
	"github.com/kinanqaz/bragi/server/events"
	"github.com/kinanqaz/bragi/utils/cache"
	"github.com/kinanqaz/bragi/utils/singleton"
)

const (
	StateStarting = "starting"
	StatePlaying  = "playing"
	StatePaused   = "paused"
	StateStopped  = "stopped"
	StateExpired  = "expired"
)

var ValidStates = map[string]bool{
	StateStarting: true,
	StatePlaying:  true,
	StatePaused:   true,
	StateStopped:  true,
}

type PlaybackSession struct {
	MediaFile    model.MediaFile
	Start        time.Time
	UserId       string
	Username     string
	PlayerId     string
	PlayerName   string
	State        string
	PositionMs   int64
	PlaybackRate float64
	LastReport   time.Time
}

type Submission struct {
	TrackID   string
	Timestamp time.Time
}

type ReportPlaybackParams struct {
	MediaId        string
	PositionMs     int64
	State          string
	PlaybackRate   float64
	IgnoreScrobble bool
	ClientId       string
	ClientName     string
}

type nowPlayingEntry struct {
	ctx      context.Context
	userId   string
	track    *model.MediaFile
	position int
}

type playbackReportEntry struct {
	ctx  context.Context
	info PlaybackSession
}

type PlayTracker interface {
	GetNowPlaying(ctx context.Context) ([]PlaybackSession, error)
	Submit(ctx context.Context, submissions []Submission) error
	ReportPlayback(ctx context.Context, params ReportPlaybackParams) error
}

type playTracker struct {
	ds                model.DataStore
	broker            events.Broker
	playMap           cache.SimpleCache[string, PlaybackSession]
	sessionsMu        sync.Mutex // serializes playMap check-then-write across concurrent reports
	builtinScrobblers map[string]Scrobbler
	npQueue           map[string]nowPlayingEntry
	npMu              sync.Mutex
	npSignal          chan struct{}
	shutdown          chan struct{}
	workerDone        chan struct{}
	prQueue           []playbackReportEntry
	prMu              sync.Mutex
	prSignal          chan struct{}
	prWorkerDone      chan struct{}
}

func GetPlayTracker(ds model.DataStore, broker events.Broker) PlayTracker {
	return singleton.GetInstance(func() *playTracker {
		return newPlayTracker(ds, broker)
	})
}

// NewPlayTracker creates a new PlayTracker instance. For normal usage, the PlayTracker has to be a singleton,
// returned by the GetPlayTracker function above. This constructor is exported for testing.
func NewPlayTracker(ds model.DataStore, broker events.Broker) PlayTracker {
	return newPlayTracker(ds, broker)
}

func newPlayTracker(ds model.DataStore, broker events.Broker) *playTracker {
	m := cache.NewSimpleCache[string, PlaybackSession]()
	p := &playTracker{
		ds:                ds,
		playMap:           m,
		broker:            broker,
		builtinScrobblers: make(map[string]Scrobbler),
		npQueue:           make(map[string]nowPlayingEntry),
		npSignal:          make(chan struct{}, 1),
		shutdown:          make(chan struct{}),
		workerDone:        make(chan struct{}),
		prSignal:          make(chan struct{}, 1),
		prWorkerDone:      make(chan struct{}),
	}
	enableNowPlaying := conf.Server.EnableNowPlaying
	m.OnExpiration(func(_ string, info PlaybackSession) {
		log.Debug("PlaybackSession expired", "clientId", info.PlayerId, "mediaId", info.MediaFile.ID, "state",
			info.State, "username", info.Username, "userId", info.UserId)
		if enableNowPlaying {
			broker.SendBroadcastMessage(context.Background(), &events.NowPlayingCount{Count: m.Len()})
		}
		ctx := request.WithUser(context.Background(), model.User{ID: info.UserId, UserName: info.Username})
		if info.State != StateStopped {
			log.Trace("Enqueueing PlaybackReport for expired session", "session", info)
			info.State = StateExpired
			info.LastReport = time.Now()
			p.enqueuePlaybackReport(ctx, info)
		}
	})

	var enabled []string
	for name, constructor := range constructors {
		s := constructor(ds)
		if s == nil {
			log.Debug("Scrobbler not available. Missing configuration?", "name", name)
			continue
		}
		enabled = append(enabled, name)
		s = newBufferedScrobbler(ds, s, name)
		p.builtinScrobblers[name] = s
	}
	log.Debug("List of builtin scrobblers enabled", "names", enabled)
	go p.nowPlayingWorker()
	go p.playbackReportWorker()
	return p
}

// stopBackgroundWorkers stops the background workers. This is primarily for testing.
func (p *playTracker) stopBackgroundWorkers() {
	close(p.shutdown)
	<-p.workerDone   // Wait for nowPlaying worker to finish
	<-p.prWorkerDone // Wait for playbackReport worker to finish
}

// getActiveScrobblers returns the configured built-in scrobblers.
func (p *playTracker) getActiveScrobblers() map[string]Scrobbler {
	return maps.Clone(p.builtinScrobblers)
}

// hasPlayingSession reports whether clientId's current session is already playing mediaId.
func (p *playTracker) hasPlayingSession(clientId, mediaId string) bool {
	cur, err := p.playMap.Get(clientId)
	return err == nil && cur.MediaFile.ID == mediaId && cur.State == StatePlaying
}

func remainingTTL(durationSec float32, positionMs int64, rate float64) time.Duration {
	if rate <= 0 {
		rate = 1.0
	}
	remainingMs := float64(int64(durationSec*1000)-positionMs) / rate
	remainingSec := max(int(remainingMs/1000), 0)
	return time.Duration(remainingSec+5) * time.Second
}

func (p *playTracker) ReportPlayback(ctx context.Context, params ReportPlaybackParams) error {
	player, _ := request.PlayerFrom(ctx)
	user, _ := request.UserFrom(ctx)
	clientId := params.ClientId
	client := params.ClientName

	now := time.Now()

	switch params.State {
	case StateStarting:
		// Clients may send starting/playing unordered; a late "starting" must not downgrade
		// a playing session, or position estimation freezes until the next report.
		if p.hasPlayingSession(clientId, params.MediaId) {
			log.Trace(ctx, "Ignoring out-of-order starting report for playing session", "clientId", clientId, "mediaId", params.MediaId)
			return nil
		}
		mf, err := p.ds.MediaFile(ctx).GetWithParticipants(params.MediaId)
		if err != nil {
			return err
		}
		info := PlaybackSession{
			MediaFile:    *mf,
			Start:        now,
			UserId:       user.ID,
			Username:     user.UserName,
			PlayerId:     clientId,
			PlayerName:   client,
			State:        params.State,
			PositionMs:   params.PositionMs,
			PlaybackRate: params.PlaybackRate,
			LastReport:   now,
		}
		p.sessionsMu.Lock()
		// re-check: a concurrent "playing" report may have created the session during the load above
		if p.hasPlayingSession(clientId, params.MediaId) {
			p.sessionsMu.Unlock()
			log.Trace(ctx, "Ignoring out-of-order starting report for playing session", "clientId", clientId, "mediaId", params.MediaId)
			return nil
		}
		err = p.playMap.AddWithTTL(clientId, info, remainingTTL(mf.Duration, params.PositionMs, params.PlaybackRate))
		p.sessionsMu.Unlock()
		if err != nil {
			log.Warn(ctx, "Error adding PlaybackSession to cache", "clientId", clientId, "mediaId", params.MediaId, "state", params.State, err)
		}
		p.enqueuePlaybackReport(ctx, info)

	case StatePlaying, StatePaused:
		info, getErr := p.playMap.Get(clientId)
		if getErr != nil || info.MediaFile.ID != params.MediaId {
			mf, err := p.ds.MediaFile(ctx).GetWithParticipants(params.MediaId)
			if err != nil {
				return err
			}
			info = PlaybackSession{
				MediaFile:  *mf,
				Start:      now.Add(-time.Duration(params.PositionMs) * time.Millisecond),
				UserId:     user.ID,
				Username:   user.UserName,
				PlayerId:   clientId,
				PlayerName: client,
			}
		}
		info.State = params.State
		info.PositionMs = params.PositionMs
		info.PlaybackRate = params.PlaybackRate
		info.LastReport = now
		ttl := 30 * time.Minute
		if params.State == StatePlaying {
			ttl = remainingTTL(info.MediaFile.Duration, params.PositionMs, params.PlaybackRate)
		}
		log.Trace(ctx, "Updating PlaybackSession in cache", "clientId", clientId, "mediaId", params.MediaId, "state", params.State, "positionMs", params.PositionMs, "playbackRate", params.PlaybackRate, "ttl", ttl)
		p.sessionsMu.Lock()
		err := p.playMap.AddWithTTL(clientId, info, ttl)
		p.sessionsMu.Unlock()
		if err != nil {
			log.Warn(ctx, "Error updating PlaybackSession in cache", "clientId", clientId, "mediaId", params.MediaId, "state", params.State, err)
		}
		p.enqueuePlaybackReport(ctx, info)

	case StateStopped:
		var loadedMF *model.MediaFile
		if !params.IgnoreScrobble && player.ScrobbleEnabled {
			mf, err := p.ds.MediaFile(ctx).GetWithParticipants(params.MediaId)
			if err != nil {
				return err
			}
			loadedMF = mf
			trackDurationMs := int64(mf.Duration * 1000)
			threshold := min(trackDurationMs*50/100, 240_000)
			if params.PositionMs >= threshold {
				err = p.incPlay(ctx, mf, now)
				if err != nil {
					log.Warn(ctx, "Error updating play counts", "id", mf.ID, "track", mf.Title, "user", user.UserName, err)
				}
				p.dispatchScrobble(ctx, mf, now)
			}
		}
		p.sessionsMu.Lock()
		info, getErr := p.playMap.Get(clientId)
		// A late stop for a previous track must not end the current session nor reach
		// playback reporters without a corresponding active track would clear the current state.
		if getErr == nil && info.MediaFile.ID != params.MediaId {
			p.sessionsMu.Unlock()
			log.Trace(ctx, "Ignoring out-of-order stopped report for different track", "clientId", clientId, "stoppedMediaId", params.MediaId, "currentMediaId", info.MediaFile.ID)
			return nil
		}
		p.playMap.Remove(clientId)
		p.sessionsMu.Unlock()
		stoppedInfo := PlaybackSession{
			UserId:       user.ID,
			Username:     user.UserName,
			PlayerId:     clientId,
			PlayerName:   client,
			State:        params.State,
			PositionMs:   params.PositionMs,
			PlaybackRate: params.PlaybackRate,
			LastReport:   now,
		}
		if getErr == nil {
			stoppedInfo.MediaFile = info.MediaFile
			stoppedInfo.Start = info.Start
		} else {
			mf := loadedMF
			if mf == nil {
				var mfErr error
				mf, mfErr = p.ds.MediaFile(ctx).GetWithParticipants(params.MediaId)
				if mfErr != nil {
					return mfErr
				}
			}
			stoppedInfo.MediaFile = *mf
		}
		p.enqueuePlaybackReport(ctx, stoppedInfo)
	}

	if conf.Server.EnableNowPlaying {
		p.broker.SendBroadcastMessage(ctx, &events.NowPlayingCount{Count: p.playMap.Len()})
	}

	// NowPlaying gating, by design distinct from scrobble submission:
	//   - IgnoreScrobble=true   -> still send NowPlaying (suppresses only the
	//     scrobble submission/play-count above), mirroring the legacy scrobble
	//     endpoint's submission=false behavior.
	//   - player.ScrobbleEnabled=false -> never send NowPlaying.
	// External agents here are the active scrobblers (Last.fm, ListenBrainz, and
	// returned by getActiveScrobblers; see dispatchNowPlaying.
	if player.ScrobbleEnabled &&
		(params.State == StateStarting || params.State == StatePlaying) {
		if info, err := p.playMap.Get(clientId); err == nil {
			p.enqueueNowPlaying(ctx, clientId, user.ID, &info.MediaFile, int(params.PositionMs/1000))
		}
	}

	return nil
}

func (p *playTracker) GetNowPlaying(_ context.Context) ([]PlaybackSession, error) {
	res := p.playMap.Values()
	slices.SortFunc(res, func(a, b PlaybackSession) int {
		return b.Start.Compare(a.Start)
	})
	for i := range res {
		if res[i].State == StatePlaying {
			elapsed := time.Since(res[i].LastReport).Milliseconds()
			estimated := res[i].PositionMs + int64(float64(elapsed)*res[i].PlaybackRate)
			trackDurationMs := int64(res[i].MediaFile.Duration * 1000)
			res[i].PositionMs = min(estimated, trackDurationMs)
		}
	}
	return res, nil
}

func (p *playTracker) Submit(ctx context.Context, submissions []Submission) error {
	username, _ := request.UsernameFrom(ctx)
	player, _ := request.PlayerFrom(ctx)
	if !player.ScrobbleEnabled {
		log.Debug(ctx, "External scrobbling disabled for this player", "player", player.Name, "ip", player.IP, "user", username)
	}
	event := &events.RefreshResource{}
	success := 0

	for _, s := range submissions {
		mf, err := p.ds.MediaFile(ctx).GetWithParticipants(s.TrackID)
		if err != nil {
			log.Error(ctx, "Cannot find track for scrobbling", "id", s.TrackID, "user", username, err)
			continue
		}
		err = p.incPlay(ctx, mf, s.Timestamp)
		if err != nil {
			log.Error(ctx, "Error updating play counts", "id", mf.ID, "track", mf.Title, "user", username, err)
		} else {
			success++
			event.With("song", mf.ID).With("album", mf.AlbumID).With("artist", mf.AlbumArtistID)
			log.Info(ctx, "Scrobbled", "title", mf.Title, "artist", mf.Artist, "user", username, "timestamp", s.Timestamp)
			if player.ScrobbleEnabled {
				p.dispatchScrobble(ctx, mf, s.Timestamp)
			}
		}
	}

	if success > 0 {
		p.broker.SendMessage(ctx, event)
	}
	return nil
}

func (p *playTracker) incPlay(ctx context.Context, track *model.MediaFile, timestamp time.Time) error {
	return p.ds.WithTx(func(tx model.DataStore) error {
		err := tx.MediaFile(ctx).IncPlayCount(track.ID, timestamp)
		if err != nil {
			return err
		}
		err = tx.Album(ctx).IncPlayCount(track.AlbumID, timestamp)
		if err != nil {
			return err
		}
		for _, artist := range track.Participants[model.RoleArtist] {
			err = tx.Artist(ctx).IncPlayCount(artist.ID, timestamp)
			if err != nil {
				return err
			}
		}
		if conf.Server.EnableScrobbleHistory {
			return tx.Scrobble(ctx).RecordScrobble(track.ID, timestamp)
		}
		return nil
	})
}

func (p *playTracker) dispatchScrobble(ctx context.Context, t *model.MediaFile, playTime time.Time) {
	if t.Artist == consts.UnknownArtist {
		log.Debug(ctx, "Ignoring external Scrobble for track with unknown artist", "track", t.Title, "artist", t.Artist)
		return
	}

	allScrobblers := p.getActiveScrobblers()
	u, _ := request.UserFrom(ctx)
	scrobble := Scrobble{MediaFile: *t, TimeStamp: playTime}
	for name, s := range allScrobblers {
		if !s.IsAuthorized(ctx, u.ID) {
			continue
		}
		log.Debug(ctx, "Buffering Scrobble", "scrobbler", name, "track", t.Title, "artist", t.Artist)
		err := s.Scrobble(ctx, u.ID, scrobble)
		if err != nil {
			log.Error(ctx, "Error sending Scrobble", "scrobbler", name, "track", t.Title, "artist", t.Artist, err)
			continue
		}
	}
}

var constructors map[string]Constructor

func Register(name string, init Constructor) {
	if constructors == nil {
		constructors = make(map[string]Constructor)
	}
	constructors[name] = init
}
