package server

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/mime"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/slice"
	"github.com/navidrome/navidrome/utils/str"
)

func Index(ds model.DataStore, fs fs.FS) http.HandlerFunc {
	return serveIndex(ds, fs, nil)
}

func IndexWithShare(ds model.DataStore, fs fs.FS, shareInfo *model.Share) http.HandlerFunc {
	return serveIndex(ds, fs, shareInfo)
}

// Injects the config in the `index.html` template
func serveIndex(ds model.DataStore, fsys fs.FS, shareInfo *model.Share) http.HandlerFunc {
	var (
		tplOnce   sync.Once
		cachedTpl *template.Template
		tplErr    error
	)
	return func(w http.ResponseWriter, r *http.Request) {
		tplOnce.Do(func() {
			cachedTpl, tplErr = parseIndexTemplate(fsys)
		})
		if tplErr != nil {
			log.Error(r, "Could not parse `index.html` template", tplErr)
			http.NotFound(w, r)
			return
		}
		t := cachedTpl

		c, err := ds.User(r.Context()).CountAll()
		firstTime := c == 0 && err == nil
		appConfig := map[string]any{
			"version":                   consts.Version,
			"firstTime":                 firstTime,
			"variousArtistsId":          consts.VariousArtistsID,
			"baseURL":                   str.SanitizeText(strings.TrimSuffix(conf.Server.BasePath, "/")),
			"castMediaBaseURL":          str.SanitizeText(strings.TrimSuffix(conf.Server.CastMediaBaseURL, "/")),
			"loginBackgroundURL":        str.SanitizeText(conf.Server.UILoginBackgroundURL),
			"welcomeMessage":            str.SanitizeHTML(conf.Server.UIWelcomeMessage),
			"maxSidebarPlaylists":       conf.Server.MaxSidebarPlaylists,
			"enableTranscodingConfig":   conf.Server.EnableTranscodingConfig,
			"enableDownloads":           conf.Server.EnableDownloads,
			"enableMediaFileDeletion":   conf.Server.EnableMediaFileDeletion,
			"enableFavourites":          conf.Server.EnableFavourites,
			"enableStarRating":          conf.Server.EnableStarRating,
			"defaultTheme":              conf.Server.DefaultTheme,
			"defaultLanguage":           conf.Server.DefaultLanguage,
			"defaultUIVolume":           conf.Server.DefaultUIVolume,
			"uiSearchDebounceMs":        conf.Server.UISearchDebounceMs,
			"uiCoverArtSize":            conf.Server.UICoverArtSize,
			"enableCoverAnimation":      conf.Server.EnableCoverAnimation,
			"enableNowPlaying":          conf.Server.EnableNowPlaying,
			"playbackReportIntervalMs":  conf.Server.UIPlaybackReportInterval.Milliseconds(),
			"gaTrackingId":              conf.Server.GATrackingID,
			"losslessFormats":           strings.ToUpper(strings.Join(mime.LosslessFormats, ",")),
			"devActivityPanel":          conf.Server.DevActivityPanel,
			"enableUserEditing":         conf.Server.EnableUserEditing,
			"enableArtworkUpload":       conf.Server.EnableArtworkUpload,
			"enableSharing":             conf.Server.EnableSharing,
			"shareURL":                  conf.Server.ShareURL,
			"defaultDownloadableShare":  conf.Server.DefaultDownloadableShare,
			"devSidebarPlaylists":       conf.Server.DevSidebarPlaylists,
			"lastFMEnabled":             conf.Server.LastFM.Enabled,
			"devShowArtistPage":         conf.Server.DevShowArtistPage,
			"devUIShowConfig":           conf.Server.DevUIShowConfig,
			"devNewEventStream":         conf.Server.DevNewEventStream,
			"listenBrainzEnabled":       conf.Server.ListenBrainz.Enabled,
			"enableExternalServices":    conf.Server.EnableExternalServices,
			"enableReplayGain":          conf.Server.EnableReplayGain,
			"defaultDownsamplingFormat": conf.Server.DefaultDownsamplingFormat,
			"separator":                 string(os.PathSeparator),
			"enableInspect":             conf.Server.Inspect.Enabled,
			"pluginsEnabled":            conf.Server.Plugins.Enabled,
			"extAuthLogoutURL":          conf.Server.ExtAuth.LogoutURL,
		}
		if strings.HasPrefix(conf.Server.UILoginBackgroundURL, "/") {
			appConfig["loginBackgroundURL"] = path.Join(conf.Server.BasePath, conf.Server.UILoginBackgroundURL)
		}
		auth := handleLoginFromHeaders(ds, r)
		if auth != nil {
			appConfig["auth"] = auth
		}
		appConfigJson, err := json.Marshal(appConfig)
		if err != nil {
			log.Error(r, "Error converting config to JSON", "config", appConfig, err)
		} else {
			log.Trace(r, "Injecting config in index.html", "config", string(appConfigJson))
		}

		log.Debug("UI configuration", "appConfig", appConfig)
		version := consts.Version
		if version != "dev" {
			version = "v" + version
		}
		data := map[string]any{
			"AppConfig": string(appConfigJson),
			"Version":   version,
		}
		addShareData(r, data, shareInfo)

		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		err = t.Execute(w, data)
		if err != nil {
			log.Error(r, "Could not execute `index.html` template", err)
		}
	}
}

func parseIndexTemplate(fsys fs.FS) (*template.Template, error) {
	t := template.New("initial state")
	indexHtml, err := fsys.Open("index.html")
	if err != nil {
		return nil, fmt.Errorf("could not find `index.html` template: %w", err)
	}
	defer indexHtml.Close()
	indexStr, err := io.ReadAll(indexHtml)
	if err != nil {
		return nil, fmt.Errorf("could not read from `index.html`: %w", err)
	}
	t, err = t.Parse(string(indexStr))
	if err != nil {
		return nil, fmt.Errorf("error parsing `index.html`: %w", err)
	}
	return t, nil
}

type shareData struct {
	ID           string       `json:"id"`
	Description  string       `json:"description"`
	Downloadable bool         `json:"downloadable"`
	Tracks       []shareTrack `json:"tracks"`
}

type shareTrack struct {
	ID        string    `json:"id,omitempty"`
	Title     string    `json:"title,omitempty"`
	Artist    string    `json:"artist,omitempty"`
	Album     string    `json:"album,omitempty"`
	UpdatedAt time.Time `json:"updatedAt"`
	Duration  float32   `json:"duration,omitempty"`
}

func addShareData(r *http.Request, data map[string]any, shareInfo *model.Share) {
	ctx := r.Context()
	if shareInfo == nil || shareInfo.ID == "" {
		return
	}
	sd := shareData{
		ID:           shareInfo.ID,
		Description:  shareInfo.Description,
		Downloadable: shareInfo.Downloadable,
	}
	sd.Tracks = slice.Map(shareInfo.Tracks, func(mf model.MediaFile) shareTrack {
		return shareTrack{
			ID:        mf.ID,
			Title:     mf.Title,
			Artist:    mf.Artist,
			Album:     mf.Album,
			Duration:  mf.Duration,
			UpdatedAt: mf.UpdatedAt,
		}
	})

	shareInfoJson, err := json.Marshal(sd)
	if err != nil {
		log.Error(ctx, "Error converting shareInfo to JSON", "config", shareInfo, err)
	} else {
		log.Trace(ctx, "Injecting shareInfo in index.html", "config", string(shareInfoJson))
	}

	if shareInfo.Description != "" {
		data["ShareDescription"] = shareInfo.Description
	} else {
		data["ShareDescription"] = shareInfo.Contents
	}
	data["ShareURL"] = shareInfo.URL
	data["ShareImageURL"] = shareInfo.ImageURL
	data["ShareInfo"] = string(shareInfoJson)
}
