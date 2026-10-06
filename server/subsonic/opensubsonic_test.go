package subsonic_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"

	"github.com/kinanqaz/bragi/server/subsonic"
	"github.com/kinanqaz/bragi/server/subsonic/responses"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("GetOpenSubsonicExtensions", func() {
	var (
		router *subsonic.Router
		w      *httptest.ResponseRecorder
		r      *http.Request
	)

	JustBeforeEach(func() {
		w = httptest.NewRecorder()
		r = httptest.NewRequest("GET", "/getOpenSubsonicExtensions?f=json", nil)
	})

	BeforeEach(func() {
		router = subsonic.New(nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	})

	It("returns the supported OpenSubsonic extensions", func() {
			router.ServeHTTP(w, r)

			// Make sure the endpoint is public, by not passing any authentication
			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(w.Header().Get("Content-Type")).To(Equal("application/json"))

			var response responses.JsonWrapper
			err := json.Unmarshal(w.Body.Bytes(), &response)
			Expect(err).NotTo(HaveOccurred())
			Expect(*response.Subsonic.OpenSubsonicExtensions).To(SatisfyAll(
				HaveLen(7),
				ContainElement(responses.OpenSubsonicExtension{Name: "transcodeOffset", Versions: []int32{1}}),
				ContainElement(responses.OpenSubsonicExtension{Name: "formPost", Versions: []int32{1}}),
				ContainElement(responses.OpenSubsonicExtension{Name: "songLyrics", Versions: []int32{1, 2}}),
				ContainElement(responses.OpenSubsonicExtension{Name: "indexBasedQueue", Versions: []int32{1}}),
				ContainElement(responses.OpenSubsonicExtension{Name: "transcoding", Versions: []int32{1}}),
				ContainElement(responses.OpenSubsonicExtension{Name: "playbackReport", Versions: []int32{1}}),
				ContainElement(responses.OpenSubsonicExtension{Name: "topSongsByArtistId", Versions: []int32{1}}),
		))
	})
})
