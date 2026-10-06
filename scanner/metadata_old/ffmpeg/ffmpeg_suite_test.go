package ffmpeg

import (
	"testing"

	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestFFMpeg(t *testing.T) {
	tests.Init(t, true)
	log.SetLevel(log.LevelFatal)
	RegisterFailHandler(Fail)
	RunSpecs(t, "FFMpeg Suite")
}
