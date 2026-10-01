package storage

import (
	"context"
	"errors"
	"io/fs"

	"github.com/navidrome/navidrome/model/metadata"
)

var ErrLyricsSidecarConflict = errors.New("lyrics sidecar changed since it was loaded")

type Storage interface {
	FS() (MusicFS, error)
}

// MusicFS is an interface that extends the fs.FS interface with the ability to read tags from files
type MusicFS interface {
	fs.FS
	ReadTags(path ...string) (map[string]metadata.Info, error)
}

// MutableFS is implemented only by storage backends that can safely remove a
// media file. Keeping mutation out of MusicFS makes read-only and remote
// backends opt in explicitly.
type MutableFS interface {
	Remove(name string) error
}

// MetadataWritableFS is implemented by storage backends that can safely edit
// metadata on a media file without replacing unrelated tags or audio data.
type MetadataWritableFS interface {
	WriteTags(name string, tags map[string][]string) error
}

// LyricsSidecarWritableFS provides safe, optimistic-concurrency writes for the
// supported plain-text lyric sidecars.
type LyricsSidecarWritableFS interface {
	ReadLyricsSidecar(name string) (content []byte, version string, err error)
	WriteLyricsSidecar(name string, content []byte, expectedVersion string) (newVersion string, err error)
	DeleteLyricsSidecar(name string, expectedVersion string) error
}

// SymlinkResolverFS is an optional interface for MusicFS implementations backed by a real
// filesystem. ResolveSymlink resolves the whole symlink chain of the named entry at the OS
// level and returns the final target's path — including targets outside the FS root, which
// fs.ReadLink-based resolution cannot follow.
type SymlinkResolverFS interface {
	ResolveSymlink(name string) (string, error)
}

// Watcher is a storage with the ability watch the FS and notify changes
type Watcher interface {
	// Start starts a watcher on the whole FS and returns a channel to send detected changes.
	// The watcher must be stopped when the context is done.
	Start(context.Context) (<-chan string, error)
}
