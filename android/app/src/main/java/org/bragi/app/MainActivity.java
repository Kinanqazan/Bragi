package org.bragi.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.mediarouter.app.MediaRouteButton;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.lang.ref.WeakReference;
import java.util.Collections;

import com.google.android.gms.cast.CastDevice;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaSeekOptions;
import com.google.android.gms.cast.MediaStatus;
import com.google.android.gms.cast.framework.CastButtonFactory;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.common.images.WebImage;

public class MainActivity extends AppCompatActivity {
    private static final String PREFS_NAME = "bragi_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String APP_LOCAL_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;
    private View serverConnectLayout;
    private EditText serverUrlInput;
    private Button connectButton;
    private TextView statusMessage;
    private ProgressBar loadingProgress;
    private MediaRouteButton mediaRouteButton;
    private SharedPreferences prefs;

    private String currentServerUrl = "";
    private WebViewAssetLoader assetLoader;

    // Cast Framework references
    private static WeakReference<MainActivity> sInstance;
    private BroadcastReceiver volumeReceiver;
    private CastContext castContext;
    private CastSession currentCastSession;

    private final RemoteMediaClient.Callback remoteMediaClientCallback = new RemoteMediaClient.Callback() {
        @Override
        public void onStatusUpdated() {
            notifyCastStatus();
        }
        @Override
        public void onMetadataUpdated() {
            notifyCastStatus();
        }
    };

    private final RemoteMediaClient.ProgressListener progressListener = (progressMs, durationMs) -> {
        if (currentCastSession == null) return;
        RemoteMediaClient client = currentCastSession.getRemoteMediaClient();
        if (client == null || client.getMediaStatus() == null) return;
        int playerState = client.getMediaStatus().getPlayerState();
        String stateStr = (playerState == MediaStatus.PLAYER_STATE_PLAYING) ? "PLAYING" : "PAUSED";
        notifyNativeCastMediaStatus(stateStr, "NONE", progressMs / 1000.0, durationMs / 1000.0, client.getMediaStatus().getStreamVolume());
    };

    private void notifyCastStatus() {
        if (currentCastSession == null) return;
        RemoteMediaClient client = currentCastSession.getRemoteMediaClient();
        if (client == null) return;
        MediaStatus status = client.getMediaStatus();
        if (status == null) return;

        int playerState = status.getPlayerState();
        int idleReason = status.getIdleReason();
        long streamPosition = client.getApproximateStreamPosition();
        long streamDuration = client.getStreamDuration();
        double volume = status.getStreamVolume();

        String stateStr = "UNKNOWN";
        switch (playerState) {
            case MediaStatus.PLAYER_STATE_PLAYING: stateStr = "PLAYING"; break;
            case MediaStatus.PLAYER_STATE_PAUSED: stateStr = "PAUSED"; break;
            case MediaStatus.PLAYER_STATE_BUFFERING: stateStr = "BUFFERING"; break;
            case MediaStatus.PLAYER_STATE_IDLE: stateStr = "IDLE"; break;
        }

        String idleReasonStr = "NONE";
        if (playerState == MediaStatus.PLAYER_STATE_IDLE) {
            switch (idleReason) {
                case MediaStatus.IDLE_REASON_FINISHED: idleReasonStr = "FINISHED"; break;
                case MediaStatus.IDLE_REASON_ERROR: idleReasonStr = "ERROR"; break;
                case MediaStatus.IDLE_REASON_CANCELED: idleReasonStr = "CANCELED"; break;
                case MediaStatus.IDLE_REASON_INTERRUPTED: idleReasonStr = "INTERRUPTED"; break;
            }
        }

        notifyNativeCastMediaStatus(stateStr, idleReasonStr, streamPosition / 1000.0, streamDuration / 1000.0, volume);
    }

    private void notifyNativeCastMediaStatus(String playerState, String idleReason, double currentTime, double duration, double volume) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String script = String.format(
                    "if (window.__bragiNativeCastMediaStatus) { window.__bragiNativeCastMediaStatus({ playerState: '%s', idleReason: '%s', currentTime: %s, duration: %s, volume: %s }); }",
                    playerState, idleReason, currentTime, duration, volume
            );
            webView.evaluateJavascript(script, null);
        });
    }

    public static void handlePlaybackAction(String action) {
        if (sInstance != null) {
            MainActivity activity = sInstance.get();
            if (activity != null) {
                activity.executePlaybackAction(action);
            }
        }
    }

    private void executePlaybackAction(String action) {
        runOnUiThread(() -> {
            if (webView == null) return;
            if (PlaybackService.ACTION_PLAY_PAUSE.equals(action)) {
                webView.evaluateJavascript("if (window.__bragiTogglePlayback) { window.__bragiTogglePlayback(); }", null);
            } else if (PlaybackService.ACTION_NEXT.equals(action)) {
                webView.evaluateJavascript("if (window.__bragiNextTrack) { window.__bragiNextTrack(); }", null);
            } else if (PlaybackService.ACTION_PREVIOUS.equals(action)) {
                webView.evaluateJavascript("if (window.__bragiPreviousTrack) { window.__bragiPreviousTrack(); }", null);
            }
        });
    }

    private final SessionManagerListener<CastSession> sessionManagerListener = new SessionManagerListener<CastSession>() {
        @Override
        public void onSessionStarting(@NonNull CastSession session) {
            updateNativeCastState("SESSION_STARTING", session);
        }

        @Override
        public void onSessionStarted(@NonNull CastSession session, @NonNull String sessionId) {
            currentCastSession = session;
            RemoteMediaClient client = session.getRemoteMediaClient();
            if (client != null) {
                client.registerCallback(remoteMediaClientCallback);
                client.addProgressListener(progressListener, 1000L);
            }
            updateNativeCastState("SESSION_STARTED", session);
        }

        @Override
        public void onSessionStartFailed(@NonNull CastSession session, int error) {
            currentCastSession = null;
            updateNativeCastState("SESSION_START_FAILED", null);
        }

        @Override
        public void onSessionEnding(@NonNull CastSession session) {
            updateNativeCastState("SESSION_ENDING", session);
        }

        @Override
        public void onSessionEnded(@NonNull CastSession session, int error) {
            if (currentCastSession != null) {
                RemoteMediaClient client = currentCastSession.getRemoteMediaClient();
                if (client != null) {
                    client.unregisterCallback(remoteMediaClientCallback);
                    client.removeProgressListener(progressListener);
                }
            }
            currentCastSession = null;
            updateNativeCastState("SESSION_ENDED", null);
        }

        @Override
        public void onSessionResuming(@NonNull CastSession session, @NonNull String sessionId) {
            updateNativeCastState("SESSION_STARTING", session);
        }

        @Override
        public void onSessionResumed(@NonNull CastSession session, boolean wasSuspended) {
            currentCastSession = session;
            RemoteMediaClient client = session.getRemoteMediaClient();
            if (client != null) {
                client.registerCallback(remoteMediaClientCallback);
                client.addProgressListener(progressListener, 1000L);
            }
            updateNativeCastState("SESSION_STARTED", session);
        }

        @Override
        public void onSessionResumeFailed(@NonNull CastSession session, int error) {
            currentCastSession = null;
            updateNativeCastState("SESSION_START_FAILED", null);
        }

        @Override
        public void onSessionSuspended(@NonNull CastSession session, int reason) {
            if (currentCastSession != null) {
                RemoteMediaClient client = currentCastSession.getRemoteMediaClient();
                if (client != null) {
                    client.unregisterCallback(remoteMediaClientCallback);
                    client.removeProgressListener(progressListener);
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        sInstance = new WeakReference<>(this);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        volumeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if ("android.media.VOLUME_CHANGED_ACTION".equals(intent.getAction())) {
                    AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                    if (am != null) {
                        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                        int current = am.getStreamVolume(AudioManager.STREAM_MUSIC);
                        double normalized = max > 0 ? (double) current / max : 1.0;
                        if (webView != null) {
                            webView.evaluateJavascript(String.format("if (window.__bragiNativeVolumeChanged) { window.__bragiNativeVolumeChanged(%s); }", normalized), null);
                        }
                    }
                }
            }
        };
        try {
            registerReceiver(volumeReceiver, new IntentFilter("android.media.VOLUME_CHANGED_ACTION"));
        } catch (Exception ignored) {}

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        webView = findViewById(R.id.webview);
        serverConnectLayout = findViewById(R.id.server_connect_layout);
        serverUrlInput = findViewById(R.id.server_url_input);
        connectButton = findViewById(R.id.connect_button);
        statusMessage = findViewById(R.id.status_message);
        loadingProgress = findViewById(R.id.loading_progress);
        mediaRouteButton = findViewById(R.id.media_route_button);

        // Initialize Google Cast
        try {
            castContext = CastContext.getSharedInstance(this);
            CastButtonFactory.setUpMediaRouteButton(getApplicationContext(), mediaRouteButton);
        } catch (Exception e) {
            // Google Play Services Cast may be unavailable or outdated on some devices
            castContext = null;
        }

        setupWebView();

        connectButton.setOnClickListener(v -> {
            String input = serverUrlInput.getText().toString().trim();
            if (TextUtils.isEmpty(input)) {
                showError("Please enter a server address");
                return;
            }

            if (!input.startsWith("http://") && !input.startsWith("https://")) {
                input = "https://" + input;
            }

            if (!input.endsWith("/")) {
                input = input + "/";
            }

            saveAndLoadServer(input);
        });

        // Check if server is already saved
        String savedUrl = prefs.getString(KEY_SERVER_URL, "");
        if (!TextUtils.isEmpty(savedUrl)) {
            currentServerUrl = savedUrl;
            serverUrlInput.setText(savedUrl);
            loadLocalApp();
        } else {
            showServerPicker();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (castContext != null) {
            castContext.getSessionManager().addSessionManagerListener(sessionManagerListener, CastSession.class);
            currentCastSession = castContext.getSessionManager().getCurrentCastSession();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (castContext != null) {
            castContext.getSessionManager().removeSessionManagerListener(sessionManagerListener, CastSession.class);
        }
        // Do NOT call webView.onPause() so background music playback remains uninterrupted
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void setupWebView() {
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " BragiNativeApp/1.0");

        webView.addJavascriptInterface(new WebAppInterface(), "BragiNative");

        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(webView, getCastBridgeScript(), Collections.singleton("*"));
            }
        } catch (Exception ignored) {}

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    loadingProgress.setVisibility(View.VISIBLE);
                    loadingProgress.setProgress(newProgress);
                } else {
                    loadingProgress.setVisibility(View.GONE);
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
                if (response != null) {
                    return response;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                loadingProgress.setVisibility(View.VISIBLE);
                hideError();

                injectServerBindingScript();
                injectCastBridge();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loadingProgress.setVisibility(View.GONE);
                serverConnectLayout.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);

                injectServerBindingScript();
                injectAudioListeners();
                injectCastBridge();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && request.getUrl() != null &&
                        request.getUrl().toString().startsWith("https://appassets.androidplatform.net")) {
                    loadingProgress.setVisibility(View.GONE);
                    showError("Failed to load local app assets.");
                }
            }

            @SuppressLint("WebViewClientOnReceivedSslError")
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://appassets.androidplatform.net") ||
                        (!TextUtils.isEmpty(currentServerUrl) && url.startsWith(currentServerUrl))) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception ignored) {
                    return false;
                }
            }
        });
    }

    private void injectAudioListeners() {
        String script = "(function() {" +
                "  if (window.__bragiAudioHooked) return;" +
                "  window.__bragiAudioHooked = true;" +
                "  document.addEventListener('play', function(e) {" +
                "    if (e.target && e.target.tagName === 'AUDIO') {" +
                "      if (window.BragiNative) window.BragiNative.onPlaybackStarted();" +
                "    }" +
                "  }, true);" +
                "  document.addEventListener('pause', function(e) {" +
                "    if (e.target && e.target.tagName === 'AUDIO') {" +
                "      if (window.BragiNative) window.BragiNative.onPlaybackStopped();" +
                "    }" +
                "  }, true);" +
                "  document.addEventListener('ended', function(e) {" +
                "    if (e.target && e.target.tagName === 'AUDIO') {" +
                "      if (window.BragiNative) window.BragiNative.onPlaybackStopped();" +
                "    }" +
                "  }, true);" +
                "})();";
        webView.evaluateJavascript(script, null);
    }

    /**
     * Injects a native bridge for Google Cast so the Web UI's CastButton recognizes
     * Cast availability and delegates discovery/sessions to Android's Google Play Services.
     */
    private void injectCastBridge() {
        webView.evaluateJavascript(getCastBridgeScript(), null);
    }

    private String getCastBridgeScript() {
        return "(function() {" +
                "  if (window.__bragiCastBridgeInjected) return;" +
                "  window.__bragiCastBridgeInjected = true;" +
                "  window.chrome = window.chrome || {};" +
                "  window.chrome.cast = window.chrome.cast || {};" +
                "  window.chrome.cast.media = window.chrome.cast.media || {" +
                "    DEFAULT_MEDIA_RECEIVER_APP_ID: 'CC1AD845'," +
                "    PlayerState: { PLAYING: 'PLAYING', PAUSED: 'PAUSED', BUFFERING: 'BUFFERING', IDLE: 'IDLE' }" +
                "  };" +
                "  window.chrome.cast.AutoJoinPolicy = { ORIGIN_SCOPED: 'origin_scoped', PAGE_SCOPED: 'page_scoped', TAB_AND_ORIGIN_SCOPED: 'tab_and_origin_scoped' };" +
                "  window.cast = window.cast || {};" +
                "  window.cast.framework = window.cast.framework || {};" +
                "  window.cast.framework.CastContextEventType = {" +
                "    CAST_STATE_CHANGED: 'caststatechanged'," +
                "    SESSION_STATE_CHANGED: 'sessionstatechanged'" +
                "  };" +
                "  window.cast.framework.SessionState = {" +
                "    NO_SESSION: 'NO_SESSION'," +
                "    SESSION_STARTING: 'SESSION_STARTING'," +
                "    SESSION_STARTED: 'SESSION_STARTED'," +
                "    SESSION_START_FAILED: 'SESSION_START_FAILED'," +
                "    SESSION_ENDING: 'SESSION_ENDING'," +
                "    SESSION_ENDED: 'SESSION_ENDED'," +
                "    SESSION_RESUMED: 'SESSION_RESUMED'" +
                "  };" +
                "  window.cast.framework.CastState = {" +
                "    NO_DEVICES_AVAILABLE: 'NO_DEVICES_AVAILABLE'," +
                "    NOT_CONNECTED: 'NOT_CONNECTED'," +
                "    CONNECTING: 'CONNECTING'," +
                "    CONNECTED: 'CONNECTED'" +
                "  };" +
                "  window.cast.framework.RemotePlayer = function() {" +
                "    this.isMediaLoaded = false;" +
                "    this.canControlVolume = true;" +
                "    this.canPause = true;" +
                "    this.canSeek = true;" +
                "    this.displayName = '';" +
                "    this.statusText = '';" +
                "    this.title = '';" +
                "    this.currentTime = 0;" +
                "    this.duration = 0;" +
                "    this.volumeLevel = 1;" +
                "    this.playerState = 'IDLE';" +
                "  };" +
                "  window.cast.framework.RemotePlayerController = function(player) {" +
                "    this.addEventListener = function() {};" +
                "    this.removeEventListener = function() {};" +
                "    this.playOrPause = function() { if (window.BragiNative) window.BragiNative.play(); };" +
                "    this.seek = function(pos) { if (window.BragiNative) window.BragiNative.seek(pos); };" +
                "    this.setVolumeLevel = function() {};" +
                "    this.stop = function() { if (window.BragiNative) window.BragiNative.pause(); };" +
                "  };" +
                "" +
                "  var listeners = {};" +
                "  var currentState = {" +
                "    connected: Boolean(window.BragiNative && window.BragiNative.isCastConnected && window.BragiNative.isCastConnected())," +
                "    deviceName: (window.BragiNative && window.BragiNative.getCastDeviceName && window.BragiNative.getCastDeviceName()) || ''," +
                "    sessionId: ''" +
                "  };" +
                "" +
                "  function fireEvent(type, data) {" +
                "    var handlers = listeners[type] || [];" +
                "    for (var i = 0; i < handlers.length; i++) {" +
                "      try { handlers[i](data); } catch (e) {}" +
                "    }" +
                "  }" +
                "" +
                "  window.__bragiNativeCastState = function(state) {" +
                "    currentState = state || { connected: false, deviceName: '', sessionId: '' };" +
                "    var sessionState = currentState.connected ? 'SESSION_STARTED' : 'SESSION_ENDED';" +
                "    var castState = currentState.connected ? 'CONNECTED' : 'NOT_CONNECTED';" +
                "    fireEvent('sessionstatechanged', { sessionState: sessionState });" +
                "    fireEvent('caststatechanged', { castState: castState });" +
                "  };" +
                "" +
                "  var currentSessionInstance = {" +
                "    getCastDevice: function() { return { friendlyName: currentState.deviceName || 'Chromecast', deviceId: 'native-cast' }; }," +
                "    getSessionId: function() { return currentState.sessionId || 'native-session'; }," +
                "    endSession: function(stop) { if (window.BragiNative) window.BragiNative.endCastSession(); }," +
                "    getRemoteMediaClient: function() {" +
                "      return {" +
                "        loadMedia: function(req) {" +
                "          var media = (req && req.mediaInfo) || {};" +
                "          var meta = media.metadata || {};" +
                "          var title = meta.title || '';" +
                "          var artist = meta.artist || meta.subtitle || '';" +
                "          var album = meta.albumTitle || '';" +
                "          var url = media.contentId || media.contentUrl || '';" +
                "          var art = (meta.images && meta.images[0] && meta.images[0].url) || '';" +
                "          if (window.BragiNative) window.BragiNative.loadMedia(title, artist, album, url, art, (req && req.currentTime) || 0, true);" +
                "          return Promise.resolve();" +
                "        }," +
                "        play: function() { if (window.BragiNative) window.BragiNative.play(); }," +
                "        pause: function() { if (window.BragiNative) window.BragiNative.pause(); }," +
                "        seek: function(opt) { if (window.BragiNative) window.BragiNative.seek((opt && opt.position) || 0); }," +
                "        addEventListener: function() {}," +
                "        removeEventListener: function() {}" +
                "      };" +
                "    }" +
                "  };" +
                "" +
                "  var castContextInstance = {" +
                "    setOptions: function(opts) {}," +
                "    addEventListener: function(type, handler) {" +
                "      listeners[type] = listeners[type] || [];" +
                "      listeners[type].push(handler);" +
                "    }," +
                "    removeEventListener: function(type, handler) {" +
                "      var list = listeners[type] || [];" +
                "      var idx = list.indexOf(handler);" +
                "      if (idx >= 0) list.splice(idx, 1);" +
                "    }," +
                "    getCastState: function() { return currentState.connected ? 'CONNECTED' : 'NOT_CONNECTED'; }," +
                "    getSessionState: function() { return currentState.connected ? 'SESSION_STARTED' : 'NO_SESSION'; }," +
                "    getCurrentSession: function() { return currentState.connected ? currentSessionInstance : null; }," +
                "    requestSession: function() {" +
                "      if (window.BragiNative) window.BragiNative.requestCastSession();" +
                "      return Promise.resolve(currentSessionInstance);" +
                "    }" +
                "  };" +
                "" +
                "  window.cast.framework.CastContext = {" +
                "    getInstance: function() { return castContextInstance; }" +
                "  };" +
                "" +
                "  var _cb = window.__onGCastApiAvailable;" +
                "  try {" +
                "    Object.defineProperty(window, '__onGCastApiAvailable', {" +
                "      configurable: true," +
                "      enumerable: true," +
                "      get: function() { return _cb; }," +
                "      set: function(fn) {" +
                "        _cb = fn;" +
                "        if (typeof fn === 'function') { try { fn(true); } catch(e) {} }" +
                "      }" +
                "    });" +
                "  } catch(e) {" +
                "    window.__onGCastApiAvailable = function() {};" +
                "  }" +
                "  if (typeof _cb === 'function') {" +
                "    try { _cb(true); } catch(e) {}" +
                "  }" +
                "})();";
    }

    private void updateNativeCastState(String eventType, CastSession session) {
        runOnUiThread(() -> {
            boolean connected = "SESSION_STARTED".equals(eventType) && session != null && session.isConnected();
            String deviceName = "";
            String sessionId = "";
            if (session != null) {
                CastDevice device = session.getCastDevice();
                if (device != null) {
                    deviceName = device.getFriendlyName();
                }
                sessionId = session.getSessionId();
            }

            String script = String.format(
                    "if (window.__bragiNativeCastState) { window.__bragiNativeCastState({ connected: %s, deviceName: '%s', sessionId: '%s' }); }",
                    connected ? "true" : "false",
                    deviceName.replace("'", "\\'"),
                    sessionId
            );
            webView.evaluateJavascript(script, null);
        });
    }

    private void injectServerBindingScript() {
        String cleanUrl = currentServerUrl != null ? currentServerUrl.replaceAll("/+$", "") : "";
        String script = String.format("window.__BRAGI_SERVER_URL__ = '%s';", cleanUrl);
        webView.evaluateJavascript(script, null);
    }

    private void saveAndLoadServer(String url) {
        currentServerUrl = url;
        prefs.edit().putString(KEY_SERVER_URL, url).apply();
        loadLocalApp();
    }

    private void loadLocalApp() {
        loadingProgress.setVisibility(View.VISIBLE);
        serverConnectLayout.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(APP_LOCAL_URL);
    }

    private void showServerPicker() {
        webView.setVisibility(View.GONE);
        serverConnectLayout.setVisibility(View.VISIBLE);
    }

    private void showError(String msg) {
        statusMessage.setText(msg);
        statusMessage.setVisibility(View.VISIBLE);
    }

    private void hideError() {
        statusMessage.setVisibility(View.GONE);
    }

    @Override
    public void onBackPressed() {
        if (webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
        } else if (webView.getVisibility() == View.VISIBLE) {
            new AlertDialog.Builder(this)
                    .setTitle("Bragi")
                    .setMessage("What would you like to do?")
                    .setPositiveButton("Exit", (dialog, which) -> finish())
                    .setNeutralButton("Change Server", (dialog, which) -> showServerPicker())
                    .setNegativeButton("Cancel", null)
                    .show();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (volumeReceiver != null) {
            try { unregisterReceiver(volumeReceiver); } catch (Exception ignored) {}
            volumeReceiver = null;
        }
        if (sInstance != null && sInstance.get() == this) {
            sInstance = null;
        }
        PlaybackService.stop(this);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class WebAppInterface {
        @JavascriptInterface
        public String getServerUrl() {
            return currentServerUrl != null ? currentServerUrl.replaceAll("/+$", "") : "";
        }

        @JavascriptInterface
        public boolean hasNativeCast() {
            return castContext != null;
        }

        @JavascriptInterface
        public boolean isCastConnected() {
            return currentCastSession != null && currentCastSession.isConnected();
        }

        @JavascriptInterface
        public String getCastDeviceName() {
            if (currentCastSession != null && currentCastSession.getCastDevice() != null) {
                return currentCastSession.getCastDevice().getFriendlyName();
            }
            return "";
        }

        @JavascriptInterface
        public void setVolume(double volume) {
            runOnUiThread(() -> {
                if (currentCastSession != null && currentCastSession.isConnected()) {
                    try {
                        currentCastSession.setVolume(volume);
                    } catch (Exception ignored) {
                        RemoteMediaClient client = currentCastSession.getRemoteMediaClient();
                        if (client != null) {
                            client.setStreamVolume(volume);
                        }
                    }
                } else {
                    try {
                        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                        if (am != null) {
                            int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                            int target = (int) Math.round(volume * max);
                            am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public double getVolume() {
            if (currentCastSession != null && currentCastSession.isConnected()) {
                try {
                    return currentCastSession.getVolume();
                } catch (Exception ignored) {}
            }
            try {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    int current = am.getStreamVolume(AudioManager.STREAM_MUSIC);
                    return max > 0 ? (double) current / max : 1.0;
                }
            } catch (Exception ignored) {}
            return 1.0;
        }

        @JavascriptInterface
        public void updateMetadata(String title, String artist, String album, String artworkUrl, boolean isPlaying) {
            PlaybackService.updateMetadata(MainActivity.this, title, artist, album, isPlaying);
        }

        @JavascriptInterface
        public void onPlaybackStarted() {
            PlaybackService.start(MainActivity.this);
        }

        @JavascriptInterface
        public void onPlaybackStopped() {
            PlaybackService.stop(MainActivity.this);
        }

        @JavascriptInterface
        public void changeServer() {
            runOnUiThread(MainActivity.this::showServerPicker);
        }

        @JavascriptInterface
        public void requestCastSession() {
            runOnUiThread(() -> {
                if (mediaRouteButton != null) {
                    boolean shown = mediaRouteButton.showDialog();
                    if (!shown) {
                        mediaRouteButton.performClick();
                    }
                }
            });
        }

        @JavascriptInterface
        public void endCastSession() {
            runOnUiThread(() -> {
                if (castContext != null && castContext.getSessionManager() != null) {
                    castContext.getSessionManager().endCurrentSession(true);
                }
            });
        }

        @JavascriptInterface
        public void loadMedia(String title, String artist, String album, String streamUrl, String artworkUrl, long positionSec, boolean autoplay) {
            runOnUiThread(() -> {
                if (currentCastSession != null && currentCastSession.isConnected()) {
                    RemoteMediaClient client = currentCastSession.getRemoteMediaClient();
                    if (client != null) {
                        MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
                        if (!TextUtils.isEmpty(title)) metadata.putString(MediaMetadata.KEY_TITLE, title);
                        if (!TextUtils.isEmpty(artist)) metadata.putString(MediaMetadata.KEY_ARTIST, artist);
                        if (!TextUtils.isEmpty(album)) metadata.putString(MediaMetadata.KEY_ALBUM_TITLE, album);
                        if (!TextUtils.isEmpty(artworkUrl)) {
                            try {
                                metadata.addImage(new WebImage(Uri.parse(artworkUrl)));
                            } catch (Exception ignored) {}
                        }

                        MediaInfo mediaInfo = new MediaInfo.Builder(streamUrl)
                                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                                .setContentType("audio/mpeg")
                                .setMetadata(metadata)
                                .build();

                        MediaLoadRequestData requestData = new MediaLoadRequestData.Builder()
                                .setMediaInfo(mediaInfo)
                                .setAutoplay(autoplay)
                                .setCurrentTime(positionSec * 1000L)
                                .build();

                        client.load(requestData);
                    }
                }
            });
        }

        @JavascriptInterface
        public void play() {
            runOnUiThread(() -> {
                if (currentCastSession != null && currentCastSession.getRemoteMediaClient() != null) {
                    currentCastSession.getRemoteMediaClient().play();
                }
            });
        }

        @JavascriptInterface
        public void pause() {
            runOnUiThread(() -> {
                if (currentCastSession != null && currentCastSession.getRemoteMediaClient() != null) {
                    currentCastSession.getRemoteMediaClient().pause();
                }
            });
        }

        @JavascriptInterface
        public void seek(long positionSec) {
            runOnUiThread(() -> {
                if (currentCastSession != null && currentCastSession.getRemoteMediaClient() != null) {
                    currentCastSession.getRemoteMediaClient().seek(
                            new MediaSeekOptions.Builder().setPosition(positionSec * 1000L).build()
                    );
                }
            });
        }
    }
}
