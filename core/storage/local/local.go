package local

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/djherbis/times"
	"github.com/kinanqaz/bragi/conf"
	"github.com/kinanqaz/bragi/consts"
	"github.com/kinanqaz/bragi/core/storage"
	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model/metadata"
	"go.senan.xyz/taglib"
)

// localStorage implements a Storage that reads the files from the local filesystem and uses registered extractors
// to extract the metadata and tags from the files.
type localStorage struct {
	u            url.URL
	extractor    Extractor
	resolvedPath string
	watching     atomic.Bool
}

func newLocalStorage(u url.URL) storage.Storage {
	newExtractor, ok := extractors[conf.Server.Scanner.Extractor]
	if !ok || newExtractor == nil {
		if conf.Server.Scanner.Extractor != consts.DefaultScannerExtractor {
			log.Warn("Extractor not found, using default", "extractor", conf.Server.Scanner.Extractor, "default", consts.DefaultScannerExtractor)
		}
		newExtractor = extractors[consts.DefaultScannerExtractor]
		if newExtractor == nil {
			log.Fatal("Default extractor not registered", "extractor", consts.DefaultScannerExtractor)
		}
	}
	isWindowsPath := filepath.VolumeName(u.Host) != ""
	if u.Scheme == storage.LocalSchemaID && isWindowsPath {
		u.Path = filepath.Join(u.Host, u.Path)
	}
	resolvedPath, err := filepath.EvalSymlinks(u.Path)
	if err != nil {
		log.Warn("Error resolving path", "path", u.Path, "err", err)
		resolvedPath = u.Path
	}
	return &localStorage{u: u, extractor: newExtractor(os.DirFS(u.Path), u.Path), resolvedPath: resolvedPath}
}

func (s *localStorage) FS() (storage.MusicFS, error) {
	path := s.u.Path
	if _, err := os.Stat(path); err != nil { //nolint:gosec
		return nil, fmt.Errorf("%w: %s", err, path)
	}
	return &localFS{FS: os.DirFS(path), extractor: s.extractor, root: path}, nil
}

type localFS struct {
	fs.FS
	extractor Extractor
	root      string
}

// ResolveSymlink implements storage.SymlinkResolverFS. It resolves the whole chain at the
// OS level, so links whose targets live outside the library folder (not reachable through
// the fs.FS abstraction) still resolve to their final target.
func (lfs *localFS) ResolveSymlink(name string) (string, error) {
	if !fs.ValidPath(name) {
		return "", &fs.PathError{Op: "resolvesymlink", Path: name, Err: fs.ErrInvalid}
	}
	return filepath.EvalSymlinks(filepath.Join(lfs.root, filepath.FromSlash(name)))
}

// Remove deletes a single file beneath the library root. os.Root prevents
// traversal through ".." or symlinks that escape the library, including races
// where a path component is replaced while the operation is in progress.
func (lfs *localFS) Remove(name string) error {
	if name == "." || !fs.ValidPath(name) {
		return &fs.PathError{Op: "remove", Path: name, Err: fs.ErrInvalid}
	}

	root, err := os.OpenRoot(lfs.root)
	if err != nil {
		return fmt.Errorf("opening library root: %w", err)
	}
	defer root.Close()

	name = filepath.FromSlash(name)
	info, err := root.Lstat(name)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0 {
		return &fs.PathError{Op: "remove", Path: name, Err: fmt.Errorf("not a regular file")}
	}
	return root.Remove(name)
}

// WriteTags writes only the supplied standard tags. It edits a hidden sibling
// copy, verifies the requested values, then replaces the original so failed
// writes leave the music file untouched. Dot-prefixed staging files are
// ignored by both the scanner and the library watcher.
func (lfs *localFS) WriteTags(name string, tags map[string][]string) error {
	if name == "." || !fs.ValidPath(name) || len(tags) == 0 {
		return &fs.PathError{Op: "write-tags", Path: name, Err: fs.ErrInvalid}
	}
	return lfs.writeStagedMediaFile(name, func(stagingPath string) error {
		if err := taglib.WriteTags(stagingPath, tags, 0); err != nil {
			return fmt.Errorf("writing media tags: %w", err)
		}
		return verifyWrittenTags(stagingPath, tags)
	})
}

func (lfs *localFS) WriteImage(name string, image []byte, mimeType string) error {
	if name == "." || !fs.ValidPath(name) || len(image) == 0 || mimeType == "" {
		return &fs.PathError{Op: "write-image", Path: name, Err: fs.ErrInvalid}
	}
	return lfs.writeStagedMediaFile(name, func(stagingPath string) error {
		if err := taglib.WriteImageOptions(stagingPath, image, 0, "Front Cover", "", mimeType); err != nil {
			return fmt.Errorf("writing embedded image: %w", err)
		}
		written, err := taglib.ReadImageOptions(stagingPath, 0)
		if err != nil {
			return fmt.Errorf("verifying embedded image: %w", err)
		}
		if !bytes.Equal(written, image) {
			return fmt.Errorf("verifying embedded image: saved image did not match")
		}
		return nil
	})
}

// writeStagedMediaFile edits a hidden sibling copy and replaces the original
// only after the requested metadata has been written and verified.
func (lfs *localFS) writeStagedMediaFile(name string, write func(stagingPath string) error) error {

	root, err := os.OpenRoot(lfs.root)
	if err != nil {
		return fmt.Errorf("opening library root: %w", err)
	}
	defer root.Close()

	name = filepath.FromSlash(name)
	info, err := root.Lstat(name)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return &fs.PathError{Op: "write-tags", Path: name, Err: fmt.Errorf("not a regular file")}
	}

	source, err := root.Open(name)
	if err != nil {
		return err
	}
	defer source.Close()

	dir := filepath.Dir(name)
	ext := filepath.Ext(name)
	var tempName string
	var temp *os.File
	for range 5 {
		random := make([]byte, 12)
		if _, err := rand.Read(random); err != nil {
			return fmt.Errorf("creating metadata staging name: %w", err)
		}
		tempName = filepath.Join(dir, ".bragi-metadata-"+hex.EncodeToString(random)+ext)
		temp, err = root.OpenFile(tempName, os.O_CREATE|os.O_EXCL|os.O_WRONLY, info.Mode().Perm())
		if err == nil {
			break
		}
		if !os.IsExist(err) {
			return fmt.Errorf("creating metadata staging file: %w", err)
		}
	}
	if temp == nil {
		return fmt.Errorf("creating metadata staging file: %w", err)
	}
	defer func() { _ = root.Remove(tempName) }()

	if _, err = io.Copy(temp, source); err != nil {
		_ = temp.Close()
		return fmt.Errorf("copying media file for metadata edit: %w", err)
	}
	if err = temp.Sync(); err != nil {
		_ = temp.Close()
		return fmt.Errorf("syncing metadata staging file: %w", err)
	}
	if err = temp.Close(); err != nil {
		return fmt.Errorf("closing metadata staging file: %w", err)
	}
	if err := source.Close(); err != nil {
		return fmt.Errorf("closing original media file: %w", err)
	}

	stagingPath := filepath.Join(lfs.root, tempName)
	if err := write(stagingPath); err != nil {
		return err
	}

	if err := root.Rename(tempName, name); err != nil {
		return fmt.Errorf("replacing media file with edited copy: %w", err)
	}
	return nil
}

const maxLyricsSidecarSize = 1 << 20

func (lfs *localFS) ReadLyricsSidecar(name string) ([]byte, string, error) {
	if !validLyricsSidecarPath(name) {
		return nil, "", &fs.PathError{Op: "read-lyrics", Path: name, Err: fs.ErrInvalid}
	}
	root, err := os.OpenRoot(lfs.root)
	if err != nil {
		return nil, "", fmt.Errorf("opening library root: %w", err)
	}
	defer root.Close()

	name = filepath.FromSlash(name)
	info, err := root.Lstat(name)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	if !info.Mode().IsRegular() {
		return nil, "", &fs.PathError{Op: "read-lyrics", Path: name, Err: fmt.Errorf("not a regular file")}
	}
	file, err := root.Open(name)
	if err != nil {
		return nil, "", err
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, maxLyricsSidecarSize+1))
	if err != nil {
		return nil, "", fmt.Errorf("reading lyrics sidecar: %w", err)
	}
	if len(content) > maxLyricsSidecarSize {
		return nil, "", fmt.Errorf("lyrics sidecar exceeds %d bytes", maxLyricsSidecarSize)
	}
	return content, lyricsSidecarVersion(content), nil
}

func (lfs *localFS) WriteLyricsSidecar(name string, content []byte, expectedVersion string) (string, error) {
	if !validLyricsSidecarPath(name) || len(content) > maxLyricsSidecarSize || !utf8.Valid(content) || bytes.ContainsRune(content, '\x00') {
		return "", &fs.PathError{Op: "write-lyrics", Path: name, Err: fs.ErrInvalid}
	}
	root, err := os.OpenRoot(lfs.root)
	if err != nil {
		return "", fmt.Errorf("opening library root: %w", err)
	}
	defer root.Close()

	name = filepath.FromSlash(name)
	mode := fs.FileMode(0o600)
	info, statErr := root.Lstat(name)
	if statErr == nil {
		if !info.Mode().IsRegular() {
			return "", &fs.PathError{Op: "write-lyrics", Path: name, Err: fmt.Errorf("not a regular file")}
		}
		mode = info.Mode().Perm()
		current, err := root.Open(name)
		if err != nil {
			return "", err
		}
		currentContent, readErr := io.ReadAll(io.LimitReader(current, maxLyricsSidecarSize+1))
		closeErr := current.Close()
		if readErr != nil {
			return "", fmt.Errorf("reading current lyrics sidecar: %w", readErr)
		}
		if closeErr != nil {
			return "", fmt.Errorf("closing current lyrics sidecar: %w", closeErr)
		}
		if len(currentContent) > maxLyricsSidecarSize || lyricsSidecarVersion(currentContent) != expectedVersion {
			return "", storage.ErrLyricsSidecarConflict
		}
	} else if errors.Is(statErr, fs.ErrNotExist) {
		if expectedVersion != "" {
			return "", storage.ErrLyricsSidecarConflict
		}
	} else {
		return "", statErr
	}

	dir := filepath.Dir(name)
	ext := filepath.Ext(name)
	var tempName string
	var temp *os.File
	for range 5 {
		random := make([]byte, 12)
		if _, err := rand.Read(random); err != nil {
			return "", fmt.Errorf("creating lyrics staging name: %w", err)
		}
		tempName = filepath.Join(dir, ".bragi-lyrics-"+hex.EncodeToString(random)+ext)
		temp, err = root.OpenFile(tempName, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
		if err == nil {
			break
		}
		if !os.IsExist(err) {
			return "", fmt.Errorf("creating lyrics staging file: %w", err)
		}
	}
	if temp == nil {
		return "", fmt.Errorf("creating lyrics staging file: %w", err)
	}
	defer func() { _ = root.Remove(tempName) }()
	if _, err := temp.Write(content); err != nil {
		_ = temp.Close()
		return "", fmt.Errorf("writing lyrics staging file: %w", err)
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return "", fmt.Errorf("syncing lyrics staging file: %w", err)
	}
	if err := temp.Close(); err != nil {
		return "", fmt.Errorf("closing lyrics staging file: %w", err)
	}
	if err := root.Rename(tempName, name); err != nil {
		return "", fmt.Errorf("replacing lyrics sidecar: %w", err)
	}
	return lyricsSidecarVersion(content), nil
}

func (lfs *localFS) DeleteLyricsSidecar(name, expectedVersion string) error {
	if !validLyricsSidecarPath(name) {
		return &fs.PathError{Op: "delete-lyrics", Path: name, Err: fs.ErrInvalid}
	}
	root, err := os.OpenRoot(lfs.root)
	if err != nil {
		return fmt.Errorf("opening library root: %w", err)
	}
	defer root.Close()

	name = filepath.FromSlash(name)
	info, err := root.Lstat(name)
	if errors.Is(err, fs.ErrNotExist) {
		if expectedVersion == "" {
			return nil
		}
		return storage.ErrLyricsSidecarConflict
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return &fs.PathError{Op: "delete-lyrics", Path: name, Err: fmt.Errorf("not a regular file")}
	}
	file, err := root.Open(name)
	if err != nil {
		return err
	}
	content, readErr := io.ReadAll(io.LimitReader(file, maxLyricsSidecarSize+1))
	closeErr := file.Close()
	if readErr != nil {
		return fmt.Errorf("reading lyrics sidecar before deletion: %w", readErr)
	}
	if closeErr != nil {
		return fmt.Errorf("closing lyrics sidecar before deletion: %w", closeErr)
	}
	if len(content) > maxLyricsSidecarSize || lyricsSidecarVersion(content) != expectedVersion {
		return storage.ErrLyricsSidecarConflict
	}
	if err := root.Remove(name); err != nil {
		return fmt.Errorf("deleting lyrics sidecar: %w", err)
	}
	return nil
}

func validLyricsSidecarPath(name string) bool {
	if name == "." || !fs.ValidPath(name) {
		return false
	}
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".txt" || ext == ".lrc"
}

func lyricsSidecarVersion(content []byte) string {
	version := sha256.Sum256(content)
	return hex.EncodeToString(version[:])
}

func verifyWrittenTags(path string, expected map[string][]string) error {
	file, err := taglib.OpenReadOnly(path, taglib.WithReadStyle(taglib.ReadStyleFast))
	if err != nil {
		return fmt.Errorf("verifying edited media file: %w", err)
	}
	defer file.Close()

	actual := file.AllTags().Tags
	for key, values := range expected {
		actualValues := actual[strings.ToUpper(key)]
		if len(values) == 0 || len(values) == 1 && strings.TrimSpace(values[0]) == "" {
			if len(actualValues) != 0 {
				return fmt.Errorf("verifying edited media file: tag %s was not cleared", key)
			}
			continue
		}
		if len(actualValues) != len(values) {
			return fmt.Errorf("verifying edited media file: tag %s did not retain its values", key)
		}
		for i := range values {
			if actualValues[i] != values[i] {
				return fmt.Errorf("verifying edited media file: tag %s did not retain its value", key)
			}
		}
	}
	return nil
}

func (lfs *localFS) ReadTags(path ...string) (map[string]metadata.Info, error) {
	res, err := lfs.extractor.Parse(path...)
	if err != nil {
		return nil, err
	}
	for path, v := range res {
		if v.FileInfo == nil {
			info, err := fs.Stat(lfs, path)
			if err != nil {
				return nil, err
			}
			v.FileInfo = localFileInfo{info}
			res[path] = v
		}
	}
	return res, nil
}

// localFileInfo is a wrapper around fs.FileInfo that adds a BirthTime method, to make it compatible
// with metadata.FileInfo
type localFileInfo struct {
	fs.FileInfo
}

func (lfi localFileInfo) BirthTime() time.Time {
	if ts := times.Get(lfi.FileInfo); ts.HasBirthTime() {
		return ts.BirthTime()
	}
	return time.Now()
}

func init() {
	storage.Register(storage.LocalSchemaID, newLocalStorage)
}
