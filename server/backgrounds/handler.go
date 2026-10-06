package backgrounds

import (
	"encoding/base64"
	"net/http"

	"github.com/kinanqaz/bragi/consts"
)

var defaultImage, _ = base64.StdEncoding.DecodeString(consts.DefaultUILoginBackgroundOffline)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (*Handler) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("content-type", "image/png")
	_, _ = w.Write(defaultImage)
}
