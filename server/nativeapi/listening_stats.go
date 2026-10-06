package nativeapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model"
)

func getListeningStats(ds model.DataStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats, err := ds.Scrobble(r.Context()).GetListeningStats(time.Now().AddDate(0, 0, -30))
		if err != nil {
			log.Error(r.Context(), "Error retrieving listening stats", err)
			http.Error(w, "Could not retrieve listening stats", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(stats); err != nil {
			log.Error(r.Context(), "Error writing listening stats", err)
		}
	}
}
