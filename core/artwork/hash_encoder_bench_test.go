package artwork

import (
	"fmt"
	"image"
	"testing"

	"github.com/kinanqaz/bragi/core/artwork/thumbhash"
)

// hashEncoders contains the placeholder encoder used by decodeArtwork.
var hashEncoders = []struct {
	name   string
	encode func(image.Image) error
}{
	{"thumbhash", func(img image.Image) error { _, err := thumbhash.Encode(img); return err }},
}

func benchEncoder(b *testing.B, encode func(image.Image) error, img image.Image) {
	b.Helper()
	b.ReportAllocs()
	for b.Loop() {
		if err := encode(img); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkHashEncodersAtInputSize measures the exact image makeThumbnail produces.
func BenchmarkHashEncodersAtInputSize(b *testing.B) {
	img := gradientNRGBA(thumbnailSize)
	for _, e := range hashEncoders {
		b.Run(e.name, func(b *testing.B) { benchEncoder(b, e.encode, img) })
	}
}

// BenchmarkHashEncoders sweeps past the pipeline's input size, where the encoder's own defensive
// downscale starts to dominate. thumbnailSize itself is covered by the benchmark above.
func BenchmarkHashEncoders(b *testing.B) {
	for _, size := range []int{300, 600, 900, 1200, 1500} {
		img := gradientNRGBA(size)
		for _, e := range hashEncoders {
			b.Run(fmt.Sprintf("%s/%dx%d", e.name, size, size), func(b *testing.B) {
				benchEncoder(b, e.encode, img)
			})
		}
	}
}
