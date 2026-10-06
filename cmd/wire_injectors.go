//go:build wireinject

package cmd

import (
	"context"

	"github.com/kinanqaz/bragi/adapters/lastfm"
	"github.com/kinanqaz/bragi/adapters/listenbrainz"
	"github.com/kinanqaz/bragi/core"
	"github.com/kinanqaz/bragi/core/artwork"
	"github.com/kinanqaz/bragi/core/metrics"
	"github.com/kinanqaz/bragi/core/playback"
	"github.com/kinanqaz/bragi/core/playlists"
	"github.com/kinanqaz/bragi/db"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/persistence"
	"github.com/kinanqaz/bragi/scanner"
	"github.com/kinanqaz/bragi/server"
	"github.com/kinanqaz/bragi/server/events"
	"github.com/kinanqaz/bragi/server/nativeapi"
	"github.com/kinanqaz/bragi/server/public"
	"github.com/kinanqaz/bragi/server/subsonic"
	"github.com/google/wire"
)

var allProviders = wire.NewSet(
	core.Set,
	artwork.Set,
	server.New,
	subsonic.New,
	nativeapi.New,
	public.New,
	persistence.New,
	lastfm.NewRouter,
	listenbrainz.NewRouter,
	events.GetBroker,
	scanner.New,
	scanner.GetWatcher,
	metrics.GetPrometheusInstance,
	db.Db,
	wire.Bind(new(core.Watcher), new(scanner.Watcher)),
	wire.Bind(new(playlists.ImageUploadService), new(artwork.Uploader)),
)

func CreateDataStore() model.DataStore {
	panic(wire.Build(
		allProviders,
	))
}

func CreateServer() *server.Server {
	panic(wire.Build(
		allProviders,
	))
}

func CreateNativeAPIRouter(ctx context.Context) *nativeapi.Router {
	panic(wire.Build(
		allProviders,
	))
}

func CreateSubsonicAPIRouter(ctx context.Context) *subsonic.Router {
	panic(wire.Build(
		allProviders,
	))
}

func CreatePublicRouter() *public.Router {
	panic(wire.Build(
		allProviders,
	))
}

func CreateLastFMRouter() *lastfm.Router {
	panic(wire.Build(
		allProviders,
	))
}

func CreateListenBrainzRouter() *listenbrainz.Router {
	panic(wire.Build(
		allProviders,
	))
}

func CreatePrometheus() metrics.Metrics {
	panic(wire.Build(
		allProviders,
	))
}

func CreateScanner(ctx context.Context) model.Scanner {
	panic(wire.Build(
		allProviders,
	))
}

func CreateScanWatcher(ctx context.Context) scanner.Watcher {
	panic(wire.Build(
		allProviders,
	))
}

func GetPlaybackServer() playback.PlaybackServer {
	panic(wire.Build(
		allProviders,
	))
}

func CreateArtworkWorker() *artwork.Worker {
	panic(wire.Build(
		allProviders,
	))
}

func CreateArtworkResolver(trace *artwork.ChainTrace, live bool) *artwork.TracingResolver {
	panic(wire.Build(
		allProviders,
		artwork.NewTracingResolver,
	))
}
