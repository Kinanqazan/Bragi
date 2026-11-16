package nativeapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/kinanqaz/bragi/conf"
	"github.com/kinanqaz/bragi/log"
	"github.com/kinanqaz/bragi/model"
)

func getListeningStats(ds model.DataStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		period := r.URL.Query().Get("period")
		now := time.Now()
		var since time.Time
		switch period {
		case "", "30d":
			period, since = "30d", now.AddDate(0, 0, -30)
		case "90d":
			since = now.AddDate(0, 0, -90)
		case "1y":
			since = now.AddDate(-1, 0, 0)
		case "all":
			since = time.Time{}
		default:
			http.Error(w, "Invalid statistics period", http.StatusBadRequest)
			return
		}
		stats, err := ds.Scrobble(r.Context()).GetListeningStats(since)
		if err != nil {
			log.Error(r.Context(), "Error retrieving listening stats", err)
			http.Error(w, "Could not retrieve listening stats", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		response := struct {
			*model.ListeningStats
			Period         string `json:"period"`
			HistoryEnabled bool   `json:"historyEnabled"`
		}{stats, period, conf.Server.EnableScrobbleHistory}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Error(r.Context(), "Error writing listening stats", err)
		}
	}
}
