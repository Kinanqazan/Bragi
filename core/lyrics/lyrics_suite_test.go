package lyrics_test

import (
	"io/fs"
	"testing"

	"github.com/kinanqaz/bragi/consts"
	"github.com/kinanqaz/bragi/core/storage/local"
	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model/metadata"
	"github.com/kinanqaz/bragi/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestLyrics(t *testing.T) {
	tests.Init(t, false)
	log.SetLevel(log.LevelFatal)
	RegisterFailHandler(Fail)
	RunSpecs(t, "Lyrics Suite")
}

// core/storage/local calls log.Fatal if the default scanner extractor is unregistered
// when constructing any localStorage. Register a no-op so storage.For("file://...") works
// in tests without importing the real extractor.
var _ = BeforeSuite(func() {
	local.RegisterExtractor(consts.DefaultScannerExtractor, func(fs.FS, string) local.Extractor {
		return &noopExtractor{}
	})
})

type noopExtractor struct{}

func (e *noopExtractor) Parse(_ ...string) (map[string]metadata.Info, error) { return nil, nil }
func (e *noopExtractor) Version() string                                     { return "noop" }
