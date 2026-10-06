package core

import (
	"github.com/kinanqaz/bragi/core/agents"
	"github.com/kinanqaz/bragi/core/external"
	"github.com/kinanqaz/bragi/core/ffmpeg"
	"github.com/kinanqaz/bragi/core/lyrics"
	"github.com/kinanqaz/bragi/core/matcher"
	"github.com/kinanqaz/bragi/core/playback"
	"github.com/kinanqaz/bragi/core/playlists"
	"github.com/kinanqaz/bragi/core/scrobbler"
	"github.com/kinanqaz/bragi/core/stream"
	"github.com/google/wire"
)

var Set = wire.NewSet(
	stream.NewMediaStreamer,
	stream.GetTranscodingCache,
	NewArchiver,
	NewPlayers,
	NewShare,
	playlists.NewPlaylists,
	NewLibrary,
	NewUser,
	NewMaintenance,
	stream.NewTranscodeDecider,
	agents.GetAgents,
	external.NewProvider,
	matcher.New,
	wire.Bind(new(external.Agents), new(*agents.Agents)),
	ffmpeg.New,
	scrobbler.GetPlayTracker,
	playback.GetInstance,
	lyrics.NewLyrics,
)
