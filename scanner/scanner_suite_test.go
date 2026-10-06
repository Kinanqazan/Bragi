package scanner_test

import (
	"context"
	"io/fs"
	"os"
	"testing"

	"github.com/kinanqaz/bragi/consts"
	"github.com/kinanqaz/bragi/core/storage/local"
	"github.com/kinanqaz/bragi/db"
	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model/metadata"
	"github.com/kinanqaz/bragi/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"go.uber.org/goleak"
)

// The local storage is registered in this test binary, so any spec (or background watcher)
// touching a file:// library needs a default extractor to avoid a startup fatal.
type noopSuiteExtractor struct{}

func (noopSuiteExtractor) Parse(...string) (map[string]metadata.Info, error) { return nil, nil }
func (noopSuiteExtractor) Version() string                                   { return "0" }

func init() {
	local.RegisterExtractor(consts.DefaultScannerExtractor, func(fs.FS, string) local.Extractor {
		return noopSuiteExtractor{}
	})
}

func TestScanner(t *testing.T) {
	// Only run goleak checks when the GOLEAK env var is set
	if os.Getenv("GOLEAK") != "" {
		// Detect any goroutine leaks in the scanner code under test
		defer goleak.VerifyNone(t,
			goleak.IgnoreTopFunction("github.com/onsi/ginkgo/v2/internal/interrupt_handler.(*InterruptHandler).registerForInterrupts.func2"),
			// The notify library creates internal goroutines for file watching that persist after Stop() is called.
			goleak.IgnoreTopFunction("github.com/rjeczalik/notify.(*recursiveTree).dispatch"),
		)
	}

	tests.Init(t, true)
	defer db.Close(context.Background())
	log.SetLevel(log.LevelFatal)
	RegisterFailHandler(Fail)
	RunSpecs(t, "Scanner Suite")
}
