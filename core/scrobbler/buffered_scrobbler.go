package scrobbler

import (
	"context"
	"errors"
	"time"

	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/model/request"
)

const (
	minRetryDelay = 5 * time.Second
	maxRetryDelay = 4 * time.Minute
	// maxRetryShift caps the exponent so the shift never overflows int64.
	// minRetryDelay<<6 = 320s already exceeds maxRetryDelay, so 6 reaches the ceiling.
	maxRetryShift = 6
)

// backoffDelay returns the delay for a zero-based retry index (0 = first retry):
// minRetryDelay doubled per prior failure, clamped to maxRetryDelay.
func backoffDelay(failures int) time.Duration {
	if failures < 0 {
		failures = 0
	}
	if failures >= maxRetryShift {
		return maxRetryDelay
	}
	d := minRetryDelay << failures
	if d > maxRetryDelay {
		return maxRetryDelay
	}
	return d
}

// newBufferedScrobbler creates a buffered scrobbler that wraps a static scrobbler instance.
// Use this for builtin scrobblers that don't change.
func newBufferedScrobbler(ds model.DataStore, s Scrobbler, service string) *bufferedScrobbler {
	ctx, cancel := context.WithCancel(context.Background())
	b := &bufferedScrobbler{
		ds:         ds,
		wrapped:    s,
		service:    service,
		wakeSignal: make(chan struct{}, 1),
		ctx:        ctx,
		cancel:     cancel,
	}
	go b.run(ctx)
	return b
}

type bufferedScrobbler struct {
	ds         model.DataStore
	wrapped    Scrobbler
	service    string
	wakeSignal chan struct{}
	ctx        context.Context
	cancel     context.CancelFunc
}

func (b *bufferedScrobbler) Stop() {
	if b.cancel != nil {
		b.cancel()
	}
}

func (b *bufferedScrobbler) IsAuthorized(ctx context.Context, userId string) bool {
	return b.wrapped.IsAuthorized(ctx, userId)
}

func (b *bufferedScrobbler) NowPlaying(ctx context.Context, userId string, track *model.MediaFile, position int) error {
	return b.wrapped.NowPlaying(ctx, userId, track, position)
}

func (b *bufferedScrobbler) Scrobble(ctx context.Context, userId string, s Scrobble) error {
	err := b.ds.ScrobbleBuffer(ctx).Enqueue(b.service, userId, s.ID, s.TimeStamp)
	if err != nil {
		return err
	}

	b.sendWakeSignal()
	return nil
}

func (b *bufferedScrobbler) PlaybackReport(ctx context.Context, info PlaybackSession) error {
	return b.wrapped.PlaybackReport(ctx, info)
}

func (b *bufferedScrobbler) sendWakeSignal() {
	// Don't block if the previous signal was not read yet
	select {
	case b.wakeSignal <- struct{}{}:
	default:
	}
}

func (b *bufferedScrobbler) run(ctx context.Context) {
	timer := time.NewTimer(time.Hour)
	timer.Stop()
	defer timer.Stop()
	failures := 0
	for {
		if b.processQueue(ctx) {
			failures = 0
			timer.Stop()
		} else {
			timer.Reset(backoffDelay(failures))
			if failures < maxRetryShift {
				failures++
			}
		}
		select {
		case <-b.wakeSignal:
		case <-timer.C:
		case <-ctx.Done():
			return
		}
	}
}

func (b *bufferedScrobbler) processQueue(ctx context.Context) bool {
	buffer := b.ds.ScrobbleBuffer(ctx)
	userIds, err := buffer.UserIDs(b.service)
	if err != nil {
		log.Error(ctx, "Error retrieving userIds from scrobble buffer", "scrobbler", b.service, err)
		return false
	}
	result := true
	for _, userId := range userIds {
		if !b.processUserQueue(ctx, userId) {
			result = false
		}
	}
	return result
}

func (b *bufferedScrobbler) processUserQueue(ctx context.Context, userId string) bool {
	// Scrobbles are drained on a background context that no longer carries the
	// request's authenticated user. Restore it from the buffered userId so that
	// external scrobblers still receive the correct user's context.
	if user, err := b.ds.User(ctx).Get(userId); err != nil {
		log.Warn(ctx, "Could not load user for buffered scrobble", "userId", userId, "scrobbler", b.service, err)
	} else {
		ctx = request.WithUser(ctx, *user)
	}
	buffer := b.ds.ScrobbleBuffer(ctx)
	for {
		entry, err := buffer.Next(b.service, userId)
		if err != nil {
			log.Error(ctx, "Error reading from scrobble buffer", "scrobbler", b.service, err)
			return false
		}
		if entry == nil {
			return true
		}
		log.Debug(ctx, "Sending scrobble", "scrobbler", b.service, "track", entry.Title, "artist", entry.Artist)
		err = b.wrapped.Scrobble(ctx, entry.UserID, Scrobble{
			MediaFile: entry.MediaFile,
			TimeStamp: entry.PlayTime,
		})
		if errors.Is(err, ErrRetryLater) {
			log.Warn(ctx, "Could not send scrobble. Will be retried", "userId", entry.UserID,
				"track", entry.Title, "artist", entry.Artist, "scrobbler", b.service, err)
			return false
		}
		if err != nil {
			log.Error(ctx, "Error sending scrobble to service. Discarding", "scrobbler", b.service,
				"userId", entry.UserID, "artist", entry.Artist, "track", entry.Title, err)
		}
		err = buffer.Dequeue(entry)
		if err != nil {
			log.Error(ctx, "Error removing entry from scrobble buffer", "userId", entry.UserID,
				"track", entry.Title, "artist", entry.Artist, "scrobbler", b.service, err)
			return false
		}
	}
}

var _ Scrobbler = (*bufferedScrobbler)(nil)
