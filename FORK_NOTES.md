# Bragi project notes

Bragi began as a fork of Navidrome and is now maintained as its own project.
These notes document Bragi-specific behavior and deployment.

## Permanent music-file deletion

Administrators can permanently delete an individual song from its context
menu. The capability is disabled by default. Enable it explicitly with either:

```toml
EnableMediaFileDeletion = true
```

or the Docker environment variable:

```text
BR_ENABLEMEDIAFILEDELETION=true
```

The music volume must be mounted read-write. Only administrators can call the
endpoint, and the server checks that permission independently of the UI. Only
local storage opts into mutation. Removal uses Go's rooted filesystem API to
reject path traversal and symlink escapes, refuses directories and special
files, and records the administrator, media ID, and relative path in the log.

Deletion is permanent. It removes the audio file and Bragi's associated
database references, including playlist entries, ratings, bookmarks, and play
history. Artwork and lyric sidecar files are not removed.

## Container image

Pushes to `master` build the UI, compile the dynamic musl binary, and package
the final Alpine image with `Dockerfile.custom` for `linux/amd64`. The workflow
publishes `latest` and commit-specific tags to GitHub Container Registry:

```text
ghcr.io/kinanqaz/bragi:latest
ghcr.io/kinanqaz/bragi:sha-<short-commit>
```

The workflow uses the repository-scoped `GITHUB_TOKEN`; no Docker Hub password
or additional repository secret is required. GitHub Packages may initially
mark the image private. Make the package public or authenticate the host that
pulls it.

## Local development dependencies

- `ui/node_modules` is required for frontend builds and tests.
- Go 1.26 is required for backend builds.
- A C compiler is required by SQLite/CGO. The Windows development setup uses a
  portable Zig toolchain.
- `ui/build` and compiler/test caches are generated output.
