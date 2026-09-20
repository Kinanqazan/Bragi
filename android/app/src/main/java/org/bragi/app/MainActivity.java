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
import android.util.Log;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.mediarouter.app.MediaRouteButton;
import androidx.mediarouter.app.MediaRouteChooserDialogFragment;
import androidx.mediarouter.app.MediaRouteControllerDialogFragment;
import androidx.mediarouter.media.MediaRouteSelector;
import androidx.mediarouter.media.MediaRouter;
import android.net.wifi.WifiManager;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.lang.ref.WeakReference;
import java.util.Collections;
import java.util.Locale;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.cert.X509Certificate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import org.json.JSONObject;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;

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
    private static final String KEY_DEV_MODE = "dev_mode_enabled";
    private static final String APP_LOCAL_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;
    private View serverConnectLayout;
    private EditText serverUrlInput;
    private CheckBox devModeCheckbox;
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
    private volatile CastSession currentCastSession;
    private volatile boolean isMediaLoading = false;
    private volatile boolean isCastSessionConnected = false;
    private volatile boolean isActivityResumed = false;
    private volatile String currentCastDeviceName = "";
    private volatile double currentCastVolume = 1.0;
    private volatile String currentCastMediaBaseUrl = "";
    private WifiManager.MulticastLock multicastLock;
    private MediaRouter mediaRouter;
    private MediaRouter.Callback mediaRouterCallback;

    private synchronized CastContext ensureCastContext() {
        if (castContext != null) {
            return castContext;
        }
        try {
            castContext = CastContext.getSharedInstance(this);
            if (castContext != null && castContext.getSessionManager() != null) {
                try {
                    castContext.getSessionManager().removeSessionManagerListener(sessionManagerListener, CastSession.class);
                } catch (Exception ignored) {}
                castContext.getSessionManager().addSessionManagerListener(sessionManagerListener, CastSession.class);
            }
        } catch (Exception e) {
            Log.w("BragiCast", "CastContext initialization pending or unavailable: " + e.getMessage());
        }
        return castContext;
    }

    CastSession getActiveCastSession() {
        CastContext ctx = ensureCastContext();
        if (ctx != null && ctx.getSessionManager() != null) {
            try {
                CastSession session = ctx.getSessionManager().getCurrentCastSession();
                if (session != null && session.isConnected()) {
                    currentCastSession = session;
                    isCastSessionConnected = true;
                    return session;
                }
            } catch (Exception ignored) {}
        }
        return (isCastSessionConnected && currentCastSession != null && currentCastSession.isConnected()) ? currentCastSession : null;
    }

    private void acquireMulticastLock() {
        if (multicastLock == null) {
            try {
                WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifi != null) {
                    multicastLock = wifi.createMulticastLock("BragiCastMulticastLock");
                    multicastLock.setReferenceCounted(false);
                }
            } catch (Exception e) {
                Log.w("BragiCast", "Could not create MulticastLock: " + e.getMessage());
            }
        }
        if (multicastLock != null && !multicastLock.isHeld()) {
            try {
                multicastLock.acquire();
                Log.d("BragiCast", "MulticastLock acquired");
            } catch (Exception e) {
                Log.w("BragiCast", "Failed to acquire MulticastLock: " + e.getMessage());
            }
        }
    }

    private void releaseMulticastLock() {
        if (multicastLock != null && multicastLock.isHeld()) {
            try {
                multicastLock.release();
                Log.d("BragiCast", "MulticastLock released");
            } catch (Exception e) {
                Log.w("BragiCast", "Failed to release MulticastLock: " + e.getMessage());
            }
        }
    }

    private void startMediaRouteDiscovery() {
        CastContext ctx = ensureCastContext();
        if (ctx == null) return;
        try {
            if (mediaRouter == null) {
                mediaRouter = MediaRouter.getInstance(this);
            }
            if (mediaRouterCallback == null) {
                mediaRouterCallback = new MediaRouter.Callback() {
                    @Override
                    public void onRouteAdded(@NonNull MediaRouter router, @NonNull MediaRouter.RouteInfo route) {
                        Log.d("BragiCast", "Cast route discovered: " + route.getName());
                    }
                };
            }
            MediaRouteSelector selector = ctx.getMergedSelector();
            if (selector != null) {
                mediaRouter.removeCallback(mediaRouterCallback);
                mediaRouter.addCallback(selector, mediaRouterCallback, MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY);
                Log.d("BragiCast", "Active MediaRoute discovery started");
            }
        } catch (Exception e) {
            Log.w("BragiCast", "Error starting MediaRoute discovery: " + e.getMessage());
        }
    }

    private void stopMediaRouteDiscovery() {
        if (mediaRouter != null && mediaRouterCallback != null) {
            try {
                mediaRouter.removeCallback(mediaRouterCallback);
                Log.d("BragiCast", "MediaRoute discovery stopped");
            } catch (Exception ignored) {}
        }
    }

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
        MediaStatus mediaStatus = client.getMediaStatus();
        int playerState = mediaStatus.getPlayerState();
        String stateStr = "PAUSED";
        if (playerState == MediaStatus.PLAYER_STATE_PLAYING) {
            isMediaLoading = false;
            stateStr = "PLAYING";
        } else if (isMediaLoading) {
            stateStr = "BUFFERING";
        } else if (playerState == MediaStatus.PLAYER_STATE_BUFFERING) {
            stateStr = "BUFFERING";
        } else if (playerState == MediaStatus.PLAYER_STATE_IDLE) {
            stateStr = "IDLE";
        } else if (playerState == MediaStatus.PLAYER_STATE_PAUSED) {
            stateStr = "PAUSED";
        }
        double volume = 1.0;
        try {
            volume = currentCastSession.getVolume();
            currentCastVolume = volume;
        } catch (Exception ignored) {
            volume = mediaStatus.getStreamVolume();
            currentCastVolume = volume;
        }
        String contentId = "";
        if (mediaStatus.getMediaInfo() != null && mediaStatus.getMediaInfo().getContentId() != null) {
            contentId = mediaStatus.getMediaInfo().getContentId();
        }
        notifyNativeCastMediaStatus(stateStr, "NONE", progressMs / 1000.0, durationMs / 1000.0, volume, contentId);
        boolean isPlaying = (playerState == MediaStatus.PLAYER_STATE_PLAYING || playerState == MediaStatus.PLAYER_STATE_BUFFERING);
        if (!isCastSessionConnected) {
            PlaybackService.updatePosition(MainActivity.this, progressMs / 1000.0, durationMs / 1000.0, isPlaying);
        }
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
        double volume = 1.0;
        try {
            volume = currentCastSession.getVolume();
            currentCastVolume = volume;
        } catch (Exception ignored) {
            volume = status.getStreamVolume();
            currentCastVolume = volume;
        }

        String stateStr = "PAUSED";
        if (playerState == MediaStatus.PLAYER_STATE_PLAYING) {
            isMediaLoading = false;
            stateStr = "PLAYING";
        } else if (isMediaLoading) {
            stateStr = "BUFFERING";
        } else if (playerState == MediaStatus.PLAYER_STATE_BUFFERING) {
            stateStr = "BUFFERING";
        } else if (playerState == MediaStatus.PLAYER_STATE_IDLE) {
            stateStr = "IDLE";
        } else if (playerState == MediaStatus.PLAYER_STATE_PAUSED) {
            stateStr = "PAUSED";
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

        String contentId = "";
        if (status.getMediaInfo() != null && status.getMediaInfo().getContentId() != null) {
            contentId = status.getMediaInfo().getContentId();
        }

        Log.d("BragiCast", "notifyCastStatus: playerState=" + stateStr + " (" + playerState + "), idleReason=" + idleReasonStr + " (" + idleReason + "), isMediaLoading=" + isMediaLoading + ", contentId=" + contentId);
        notifyNativeCastMediaStatus(stateStr, idleReasonStr, streamPosition / 1000.0, streamDuration / 1000.0, volume, contentId);
        boolean isPlaying = (playerState == MediaStatus.PLAYER_STATE_PLAYING || playerState == MediaStatus.PLAYER_STATE_BUFFERING);
        if (!isCastSessionConnected) {
            PlaybackService.updateMetadata(MainActivity.this, null, null, null, null, isPlaying, streamDuration / 1000.0, streamPosition / 1000.0);
        }
    }

    private void notifyNativeCastMediaStatus(String playerState, String idleReason, double currentTime, double duration, double volume) {
        notifyNativeCastMediaStatus(playerState, idleReason, currentTime, duration, volume, "");
    }

    private void notifyNativeCastMediaStatus(String playerState, String idleReason, double currentTime, double duration, double volume, String contentId) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String safeContentId = contentId != null ? contentId.replace("'", "\\'") : "";
            String script = String.format(
                    Locale.US,
                    "if (window.__bragiNativeCastMediaStatus) { window.__bragiNativeCastMediaStatus({ playerState: '%s', idleReason: '%s', currentTime: %.2f, duration: %.2f, volume: %.4f, contentId: '%s' }); }",
                    playerState, idleReason, currentTime, duration, volume, safeContentId
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

    public static void handleSeekAction(double positionSec) {
        if (sInstance != null) {
            MainActivity activity = sInstance.get();
            if (activity != null) {
                activity.executeSeekAction(positionSec);
            }
        }
    }

    private void executeSeekAction(double positionSec) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String script = String.format(Locale.US, "if (window.__bragiSeek) { window.__bragiSeek(%.2f); }", positionSec);
            webView.evaluateJavascript(script, null);
        });
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
            PlaybackService.stopImmediately(MainActivity.this);
            updateNativeCastState("SESSION_STARTING", session);
        }

        @Override
        public void onSessionStarted(@NonNull CastSession session, @NonNull String sessionId) {
            currentCastSession = session;
            isCastSessionConnected = true;
            PlaybackService.stopImmediately(MainActivity.this);
            RemoteMediaClient client = session.getRemoteMediaClient();
            if (client != null) {
                client.unregisterCallback(remoteMediaClientCallback);
                client.registerCallback(remoteMediaClientCallback);
                client.removeProgressListener(progressListener);
                client.addProgressListener(progressListener, 1000L);
            }
            updateNativeCastState("SESSION_STARTED", session);
        }

        @Override
        public void onSessionStartFailed(@NonNull CastSession session, int error) {
            isMediaLoading = false;
            currentCastSession = null;
            isCastSessionConnected = false;
            if (!isActivityResumed) {
                releaseMulticastLock();
            }
            updateNativeCastState("SESSION_START_FAILED", null);
        }

        @Override
        public void onSessionEnding(@NonNull CastSession session) {
            updateNativeCastState("SESSION_ENDING", session);
        }

        @Override
        public void onSessionEnded(@NonNull CastSession session, int error) {
            isMediaLoading = false;
            isCastSessionConnected = false;
            if (!isActivityResumed) {
                releaseMulticastLock();
            }
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
            PlaybackService.stopImmediately(MainActivity.this);
            updateNativeCastState("SESSION_STARTING", session);
        }

        @Override
        public void onSessionResumed(@NonNull CastSession session, boolean wasSuspended) {
            currentCastSession = session;
            isCastSessionConnected = true;
            PlaybackService.stopImmediately(MainActivity.this);
            RemoteMediaClient client = session.getRemoteMediaClient();
            if (client != null) {
                client.unregisterCallback(remoteMediaClientCallback);
                client.registerCallback(remoteMediaClientCallback);
                client.removeProgressListener(progressListener);
                client.addProgressListener(progressListener, 1000L);
            }
            updateNativeCastState("SESSION_STARTED", session);
        }

        @Override
        public void onSessionResumeFailed(@NonNull CastSession session, int error) {
            isMediaLoading = false;
            currentCastSession = null;
            isCastSessionConnected = false;
            if (!isActivityResumed) {
                releaseMulticastLock();
            }
            updateNativeCastState("SESSION_START_FAILED", null);
        }

        @Override
        public void onSessionSuspended(@NonNull CastSession session, int reason) {
            isCastSessionConnected = false;
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
                    CastSession session = null;
                    if (castContext != null && castContext.getSessionManager() != null) {
                        session = castContext.getSessionManager().getCurrentCastSession();
                    }
                    if (session == null && currentCastSession != null && currentCastSession.isConnected()) {
                        session = currentCastSession;
                    }
                    double vol;
                    if (session != null && session.isConnected()) {
                        try {
                            vol = session.getVolume();
                        } catch (Exception e) {
                            vol = 1.0;
                        }
                    } else {
                        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                        int max = am != null ? am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) : 0;
                        int current = am != null ? am.getStreamVolume(AudioManager.STREAM_MUSIC) : 0;
                        vol = max > 0 ? (double) current / max : 1.0;
                    }
                    if (webView != null) {
                        String script = String.format(Locale.US, "if (window.__bragiNativeVolumeChanged) { window.__bragiNativeVolumeChanged(%.4f); }", vol);
                        webView.evaluateJavascript(script, null);
                    }
                }
            }
        };
        try {
            registerReceiver(volumeReceiver, new IntentFilter("android.media.VOLUME_CHANGED_ACTION"));
        } catch (Exception ignored) {}

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        currentCastMediaBaseUrl = prefs.getString("cast_media_base_url", "");

        webView = findViewById(R.id.webview);
        serverConnectLayout = findViewById(R.id.server_connect_layout);
        serverUrlInput = findViewById(R.id.server_url_input);
        devModeCheckbox = findViewById(R.id.dev_mode_checkbox);
        connectButton = findViewById(R.id.connect_button);
        statusMessage = findViewById(R.id.status_message);
        loadingProgress = findViewById(R.id.loading_progress);
        mediaRouteButton = findViewById(R.id.media_route_button);

        if (devModeCheckbox != null) {
            if (BuildConfig.DEBUG) {
                devModeCheckbox.setVisibility(View.VISIBLE);
                devModeCheckbox.setChecked(prefs.getBoolean(KEY_DEV_MODE, false));
            } else {
                devModeCheckbox.setVisibility(View.GONE);
            }
        }

        // Enable Chrome remote debugging in debug builds
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        // Initialize Google Cast
        ensureCastContext();
        try {
            if (mediaRouteButton != null) {
                CastButtonFactory.setUpMediaRouteButton(this, mediaRouteButton);
            }
        } catch (Exception e) {
            Log.w("BragiCast", "Error setting up mediaRouteButton: " + e.getMessage());
        }
        try {
            acquireMulticastLock();
            startMediaRouteDiscovery();
        } catch (Exception e) {
            Log.w("BragiCast", "Error starting multicast or route discovery: " + e.getMessage());
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

            // Strip trailing /app or /app/
            input = input.replaceAll("/app/?$", "");

            if (!input.endsWith("/")) {
                input = input + "/";
            }

            boolean isDevMode = BuildConfig.DEBUG && devModeCheckbox != null && devModeCheckbox.isChecked();
            saveAndLoadServer(input, isDevMode);
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
        isActivityResumed = true;
        acquireMulticastLock();
        startMediaRouteDiscovery();
        if (!TextUtils.isEmpty(currentServerUrl)) {
            fetchServerConfig(currentServerUrl);
        }
        if (webView != null && webView.getVisibility() == View.VISIBLE) {
            webView.post(() -> {
                if (!webView.hasFocus()) {
                    webView.requestFocus();
                }
            });
        }
        CastContext resumeCtx = ensureCastContext();
        if (resumeCtx != null) {
            try {
                CastSession session = resumeCtx.getSessionManager().getCurrentCastSession();
                if (session != null && session.isConnected()) {
                    currentCastSession = session;
                    isCastSessionConnected = true;
                    try {
                        if (session.getCastDevice() != null) {
                            currentCastDeviceName = session.getCastDevice().getFriendlyName();
                        }
                    } catch (Exception ignored) {}
                    RemoteMediaClient client = session.getRemoteMediaClient();
                    if (client != null) {
                        client.removeProgressListener(progressListener);
                        client.addProgressListener(progressListener, 1000L);
                        client.unregisterCallback(remoteMediaClientCallback);
                        client.registerCallback(remoteMediaClientCallback);
                    }
                    updateNativeCastState("SESSION_STARTED", session);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        isActivityResumed = false;
        stopMediaRouteDiscovery();
        if (!isCastSessionConnected) {
            releaseMulticastLock();
        }
        // Keep sessionManagerListener registered across pause/resume so background casting works uninterrupted
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
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setOnTouchListener((v, event) -> {
            if (!v.hasFocus()) {
                v.requestFocus();
            }
            return false;
        });

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
                "  var isConnected = false;" +
                "  var deviceName = '';" +
                "  try { isConnected = Boolean(window.BragiNative && window.BragiNative.isCastConnected && window.BragiNative.isCastConnected()); } catch (e) {}" +
                "  try { deviceName = (window.BragiNative && window.BragiNative.getCastDeviceName && window.BragiNative.getCastDeviceName()) || ''; } catch (e) {}" +
                "  var currentState = {" +
                "    connected: isConnected," +
                "    deviceName: deviceName," +
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

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && isCastSessionConnected) {
            CastSession session = getActiveCastSession();
            if (session != null && session.isConnected()) {
                int keyCode = event.getKeyCode();
                if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                    try {
                        double current = session.getVolume();
                        session.setVolume(Math.min(1.0, current + 0.05));
                    } catch (Exception ignored) {}
                    return true;
                } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                    try {
                        double current = session.getVolume();
                        session.setVolume(Math.max(0.0, current - 0.05));
                    } catch (Exception ignored) {}
                    return true;
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void updateNativeCastState(String eventType, CastSession session) {
        runOnUiThread(() -> {
            boolean connected = ("SESSION_STARTED".equals(eventType) || "SESSION_RESUMED".equals(eventType)) && session != null && session.isConnected();
            String deviceName = "";
            String sessionId = "";
            if (session != null) {
                CastDevice device = session.getCastDevice();
                if (device != null) {
                    deviceName = device.getFriendlyName();
                }
                sessionId = session.getSessionId();
            }

            isCastSessionConnected = connected;
            currentCastDeviceName = deviceName;

            String script = String.format(
                    Locale.US,
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
        String cleanCastUrl = currentCastMediaBaseUrl != null ? currentCastMediaBaseUrl.replaceAll("/+$", "") : "";
        String script = String.format("window.__BRAGI_SERVER_URL__ = '%s'; window.__BRAGI_CAST_MEDIA_BASE_URL__ = '%s';", cleanUrl, cleanCastUrl);
        webView.evaluateJavascript(script, null);
    }

    private void fetchServerConfig(String serverUrl) {
        if (TextUtils.isEmpty(serverUrl)) return;
        final String cleanUrl = serverUrl.replaceAll("/+$", "");
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(cleanUrl + "/app/");
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 BragiNativeApp/1.0");

                if (conn instanceof HttpsURLConnection) {
                    HttpsURLConnection httpsConn = (HttpsURLConnection) conn;
                    TrustManager[] trustAllCerts = new TrustManager[]{
                            new X509TrustManager() {
                                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                            }
                    };
                    SSLContext sc = SSLContext.getInstance("TLS");
                    sc.init(null, trustAllCerts, new java.security.SecureRandom());
                    httpsConn.setSSLSocketFactory(sc.getSocketFactory());
                    httpsConn.setHostnameVerifier((hostname, session) -> true);
                }

                int code = conn.getResponseCode();
                if (code == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    reader.close();

                    String body = sb.toString();
                    int startIdx = body.indexOf("window.__APP_CONFIG__");
                    if (startIdx != -1) {
                        int eqIdx = body.indexOf("=", startIdx);
                        int scriptEnd = body.indexOf("</script>", startIdx);
                        if (eqIdx != -1 && (scriptEnd == -1 || eqIdx < scriptEnd)) {
                            int firstQuote = body.indexOf("\"", eqIdx);
                            int firstBrace = body.indexOf("{", eqIdx);
                            String jsonStr = null;
                            if (firstQuote != -1 && (firstBrace == -1 || firstQuote < firstBrace)) {
                                // Quoted JSON string: window.__APP_CONFIG__ = "{\"baseURL\"...}";
                                int lastQuote = scriptEnd != -1 ? body.lastIndexOf("\"", scriptEnd) : body.lastIndexOf("\"");
                                if (lastQuote > firstQuote) {
                                    String rawVal = body.substring(firstQuote + 1, lastQuote);
                                    jsonStr = rawVal.replace("\\\"", "\"").replace("\\\\", "\\");
                                }
                            } else if (firstBrace != -1) {
                                // Raw JSON object: window.__APP_CONFIG__ = {"baseURL"...};
                                int lastBrace = scriptEnd != -1 ? body.lastIndexOf("}", scriptEnd) : body.lastIndexOf("}");
                                if (lastBrace > firstBrace) {
                                    jsonStr = body.substring(firstBrace, lastBrace + 1);
                                }
                            }
                            if (jsonStr != null) {
                                try {
                                    JSONObject json = new JSONObject(jsonStr);
                                    if (json.has("castMediaBaseURL")) {
                                        String castBase = json.optString("castMediaBaseURL", "").trim();
                                        if (!TextUtils.isEmpty(castBase)) {
                                            currentCastMediaBaseUrl = castBase;
                                            prefs.edit().putString("cast_media_base_url", castBase).apply();
                                            Log.i("BragiCast", "Discovered server castMediaBaseURL: " + castBase);
                                            runOnUiThread(() -> {
                                                if (webView != null) {
                                                    String script = String.format(Locale.US,
                                                            "window.__BRAGI_CAST_MEDIA_BASE_URL__ = '%s'; if (window.__bragiSetCastMediaBaseUrl) { window.__bragiSetCastMediaBaseUrl('%s'); }",
                                                            castBase.replace("'", "\\'"), castBase.replace("'", "\\'"));
                                                    webView.evaluateJavascript(script, null);
                                                }
                                            });
                                        }
                                    }
                                } catch (Exception e) {
                                    Log.w("BragiCast", "Failed to parse __APP_CONFIG__ JSON: " + e.getMessage());
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w("BragiCast", "Failed to fetch remote server config: " + e.getMessage());
            } finally {
                if (conn != null) {
                    try { conn.disconnect(); } catch (Exception ignored) {}
                }
            }
        }).start();
    }

    private void saveAndLoadServer(String url) {
        saveAndLoadServer(url, prefs.getBoolean(KEY_DEV_MODE, false));
    }

    private void saveAndLoadServer(String url, boolean devMode) {
        currentServerUrl = url;
        prefs.edit()
                .putString(KEY_SERVER_URL, url)
                .putBoolean(KEY_DEV_MODE, devMode)
                .apply();
        loadLocalApp();
    }

    private void loadLocalApp() {
        loadingProgress.setVisibility(View.VISIBLE);
        serverConnectLayout.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        webView.post(() -> {
            if (!webView.hasFocus()) {
                webView.requestFocus();
            }
        });
        fetchServerConfig(currentServerUrl);
        boolean devMode = BuildConfig.DEBUG && prefs.getBoolean(KEY_DEV_MODE, false);
        if (devMode && !TextUtils.isEmpty(currentServerUrl)) {
            String cleanUrl = currentServerUrl.replaceAll("/+$", "");
            String devUrl = cleanUrl + "/app/";
            Log.i("BragiDev", "Live Dev Mode active: loading " + devUrl);
            webView.loadUrl(devUrl);
        } else {
            webView.loadUrl(APP_LOCAL_URL);
        }
    }

    private void showServerPicker() {
        webView.setVisibility(View.GONE);
        serverConnectLayout.setVisibility(View.VISIBLE);
        if (devModeCheckbox != null) {
            if (BuildConfig.DEBUG) {
                devModeCheckbox.setVisibility(View.VISIBLE);
                devModeCheckbox.setChecked(prefs.getBoolean(KEY_DEV_MODE, false));
            } else {
                devModeCheckbox.setVisibility(View.GONE);
            }
        }
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
        stopMediaRouteDiscovery();
        releaseMulticastLock();
        if (castContext != null && castContext.getSessionManager() != null) {
            try {
                castContext.getSessionManager().removeSessionManagerListener(sessionManagerListener, CastSession.class);
            } catch (Exception ignored) {}
        }
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
            return ensureCastContext() != null;
        }

        @JavascriptInterface
        public boolean isCastConnected() {
            try {
                return isCastSessionConnected;
            } catch (Exception ignored) {
                return false;
            }
        }

        @JavascriptInterface
        public String getCastDeviceName() {
            try {
                return currentCastDeviceName != null ? currentCastDeviceName : "";
            } catch (Exception ignored) {
                return "";
            }
        }

        @JavascriptInterface
        public String getCastMediaBaseUrl() {
            try {
                return currentCastMediaBaseUrl != null ? currentCastMediaBaseUrl : "";
            } catch (Exception ignored) {
                return "";
            }
        }

        @JavascriptInterface
        public void setVolume(double volume) {
            currentCastVolume = volume;
            runOnUiThread(() -> {
                CastSession session = getActiveCastSession();
                if (session != null) {
                    try {
                        session.setVolume(volume);
                    } catch (Exception ignored) {
                        RemoteMediaClient client = session.getRemoteMediaClient();
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
            if (isCastSessionConnected) {
                return currentCastVolume;
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
            updateMetadata(title, artist, album, artworkUrl, isPlaying, 0.0, 0.0);
        }

        @JavascriptInterface
        public void updateMetadata(String title, String artist, String album, String artworkUrl, boolean isPlaying, double durationSec, double positionSec) {
            if (!isCastSessionConnected) {
                PlaybackService.updateMetadata(MainActivity.this, title, artist, album, artworkUrl, isPlaying, durationSec, positionSec);
            }
        }

        @JavascriptInterface
        public void onPlaybackStarted() {
            if (!isCastSessionConnected) {
                PlaybackService.start(MainActivity.this);
            }
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
                if (isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed()) || getSupportFragmentManager().isStateSaved()) return;
                if (getSupportFragmentManager().findFragmentByTag("MediaRouteControllerDialogFragment") != null ||
                        getSupportFragmentManager().findFragmentByTag("MediaRouteChooserDialogFragment") != null) {
                    return;
                }
                CastContext ctx = ensureCastContext();
                startMediaRouteDiscovery();
                try {
                    if (isCastConnected()) {
                        MediaRouteControllerDialogFragment controllerDialog = new MediaRouteControllerDialogFragment();
                        controllerDialog.show(getSupportFragmentManager(), "MediaRouteControllerDialogFragment");
                    } else if (ctx != null) {
                        MediaRouteSelector selector = ctx.getMergedSelector();
                        if (selector != null) {
                            MediaRouteChooserDialogFragment chooserDialog = new MediaRouteChooserDialogFragment();
                            chooserDialog.setRouteSelector(selector);
                            chooserDialog.show(getSupportFragmentManager(), "MediaRouteChooserDialogFragment");
                        } else if (mediaRouteButton != null) {
                            mediaRouteButton.showDialog();
                        }
                    } else if (mediaRouteButton != null) {
                        mediaRouteButton.showDialog();
                    }
                } catch (Exception e) {
                    Log.w("BragiCast", "Error showing Cast dialog: " + e.getMessage());
                    if (mediaRouteButton != null) {
                        try { mediaRouteButton.showDialog(); } catch (Exception ignored) {}
                    }
                }
            });
        }

        @JavascriptInterface
        public void endCastSession() {
            runOnUiThread(() -> {
                CastContext ctx = ensureCastContext();
                if (ctx != null && ctx.getSessionManager() != null) {
                    ctx.getSessionManager().endCurrentSession(true);
                }
            });
        }

        private int currentLoadOperationId = 0;
        private final Handler loadMediaHandler = new Handler(Looper.getMainLooper());
        private Runnable pendingLoadRetry = null;

        @JavascriptInterface
        public void loadMedia(String title, String artist, String album, String streamUrl, String artworkUrl, double positionSec, boolean autoplay) {
            loadMedia(title, artist, album, streamUrl, artworkUrl, positionSec, 0.0, autoplay);
        }

        @JavascriptInterface
        public void loadMedia(String title, String artist, String album, String streamUrl, String artworkUrl, double positionSec, double durationSec, boolean autoplay) {
            Log.d("BragiCast", "Native loadMedia: title=" + title + ", streamUrl=" + streamUrl + ", pos=" + positionSec + ", dur=" + durationSec + ", autoplay=" + autoplay);
            runOnUiThread(() -> {
                final int opId = ++currentLoadOperationId;
                if (pendingLoadRetry != null) {
                    loadMediaHandler.removeCallbacks(pendingLoadRetry);
                    pendingLoadRetry = null;
                }
                executeLoadMedia(title, artist, album, streamUrl, artworkUrl, positionSec, durationSec, autoplay, 1, opId);
            });
        }

        private void executeLoadMedia(String title, String artist, String album, String streamUrl, String artworkUrl, double positionSec, double durationSec, boolean autoplay, int attempt, int opId) {
            if (opId != currentLoadOperationId) {
                Log.d("BragiCast", "Discarding superseded executeLoadMedia (opId=" + opId + ", current=" + currentLoadOperationId + ")");
                return;
            }

            if (TextUtils.isEmpty(streamUrl)) {
                Log.e("BragiCast", "streamUrl is empty when loadMedia called");
                isMediaLoading = false;
                notifyNativeCastMediaStatus("IDLE", "ERROR", 0, 0, 1.0, "");
                return;
            }

            String effectiveStreamUrl = streamUrl;
            String effectiveArtworkUrl = artworkUrl;

            // Determine effective base URL for Cast receiver streaming:
            String castBaseToUse = currentCastMediaBaseUrl;
            if (TextUtils.isEmpty(castBaseToUse) && !TextUtils.isEmpty(currentServerUrl)) {
                castBaseToUse = currentServerUrl;
            }

            if (!TextUtils.isEmpty(castBaseToUse)) {
                try {
                    Uri origStreamUri = Uri.parse(streamUrl);
                    Uri baseUri = Uri.parse(castBaseToUse);
                    boolean schemeDiff = origStreamUri.getScheme() != null && baseUri.getScheme() != null &&
                            !origStreamUri.getScheme().equalsIgnoreCase(baseUri.getScheme());
                    boolean hostDiff = origStreamUri.getHost() != null && baseUri.getHost() != null &&
                            !origStreamUri.getHost().equalsIgnoreCase(baseUri.getHost());
                    boolean portDiff = origStreamUri.getPort() != baseUri.getPort();

                    if (schemeDiff || hostDiff || portDiff) {
                        Uri.Builder builder = baseUri.buildUpon();
                        String origPath = origStreamUri.getPath();
                        String basePath = baseUri.getPath() != null ? baseUri.getPath().replaceAll("/+$", "") : "";
                        if (!TextUtils.isEmpty(basePath) && origPath != null && origPath.startsWith(basePath)) {
                            origPath = origPath.substring(basePath.length());
                        }
                        builder.encodedPath((basePath != null ? basePath : "") + (origPath != null ? origPath : ""));
                        builder.encodedQuery(origStreamUri.getEncodedQuery());
                        String rewritten = builder.build().toString();
                        Log.i("BragiCast", "Rewrote streamUrl for Cast receiver: " + rewritten);
                        effectiveStreamUrl = rewritten;
                    }
                } catch (Exception e) {
                    Log.w("BragiCast", "Could not rewrite streamUrl: " + e.getMessage());
                }

                if (!TextUtils.isEmpty(artworkUrl)) {
                    try {
                        Uri origArtUri = Uri.parse(artworkUrl);
                        Uri baseUri = Uri.parse(castBaseToUse);
                        boolean schemeDiff = origArtUri.getScheme() != null && baseUri.getScheme() != null &&
                                !origArtUri.getScheme().equalsIgnoreCase(baseUri.getScheme());
                        boolean hostDiff = origArtUri.getHost() != null && baseUri.getHost() != null &&
                                !origArtUri.getHost().equalsIgnoreCase(baseUri.getHost());
                        boolean portDiff = origArtUri.getPort() != baseUri.getPort();

                        if (schemeDiff || hostDiff || portDiff) {
                            Uri.Builder builder = baseUri.buildUpon();
                            String origPath = origArtUri.getPath();
                            String basePath = baseUri.getPath() != null ? baseUri.getPath().replaceAll("/+$", "") : "";
                            if (!TextUtils.isEmpty(basePath) && origPath != null && origPath.startsWith(basePath)) {
                                origPath = origPath.substring(basePath.length());
                            }
                            builder.encodedPath((basePath != null ? basePath : "") + (origPath != null ? origPath : ""));
                            builder.encodedQuery(origArtUri.getEncodedQuery());
                            effectiveArtworkUrl = builder.build().toString();
                        }
                    } catch (Exception ignored) {}
                }
            }

            final String finalStreamUrl = effectiveStreamUrl;
            final String finalArtworkUrl = effectiveArtworkUrl;

            CastSession session = getActiveCastSession();
            if (session == null) {
                Log.w("BragiCast", "No active Cast session when loadMedia called (attempt " + attempt + ", opId " + opId + ")");
                if (attempt < 4) {
                    pendingLoadRetry = () -> {
                        executeLoadMedia(title, artist, album, finalStreamUrl, finalArtworkUrl, positionSec, durationSec, autoplay, attempt + 1, opId);
                    };
                    loadMediaHandler.postDelayed(pendingLoadRetry, 400);
                } else {
                    if (opId == currentLoadOperationId) {
                        isMediaLoading = false;
                        notifyNativeCastMediaStatus("IDLE", "ERROR", 0, 0, 1.0, finalStreamUrl);
                    }
                }
                return;
            }

            RemoteMediaClient client = session.getRemoteMediaClient();
            if (client == null) {
                Log.w("BragiCast", "RemoteMediaClient is null (attempt " + attempt + ", opId " + opId + ")");
                if (attempt < 4) {
                    pendingLoadRetry = () -> {
                        executeLoadMedia(title, artist, album, finalStreamUrl, finalArtworkUrl, positionSec, durationSec, autoplay, attempt + 1, opId);
                    };
                    loadMediaHandler.postDelayed(pendingLoadRetry, 400);
                } else {
                    if (opId == currentLoadOperationId) {
                        isMediaLoading = false;
                        notifyNativeCastMediaStatus("IDLE", "ERROR", 0, 0, 1.0, finalStreamUrl);
                    }
                }
                return;
            }

            isMediaLoading = true;

            MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
            if (!TextUtils.isEmpty(title)) metadata.putString(MediaMetadata.KEY_TITLE, title);
            if (!TextUtils.isEmpty(artist)) {
                metadata.putString(MediaMetadata.KEY_ARTIST, artist);
                metadata.putString(MediaMetadata.KEY_SUBTITLE, artist);
            }
            if (!TextUtils.isEmpty(album)) metadata.putString(MediaMetadata.KEY_ALBUM_TITLE, album);
            if (!TextUtils.isEmpty(finalArtworkUrl)) {
                try {
                    Uri artUri = Uri.parse(finalArtworkUrl);
                    if (artUri != null && artUri.isAbsolute()) {
                        metadata.addImage(new WebImage(artUri));
                    }
                } catch (Exception ignored) {}
            }

            MediaInfo.Builder mediaInfoBuilder = new MediaInfo.Builder(finalStreamUrl)
                    .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                    .setContentType("audio/mpeg")
                    .setMetadata(metadata);
            if (durationSec > 0) {
                mediaInfoBuilder.setStreamDuration((long) Math.round(durationSec * 1000.0));
            }
            MediaInfo mediaInfo = mediaInfoBuilder.build();

            long startPosMs = (long) Math.round(positionSec * 1000.0);
            MediaLoadRequestData.Builder requestBuilder = new MediaLoadRequestData.Builder()
                    .setMediaInfo(mediaInfo)
                    .setAutoplay(autoplay);
            if (startPosMs > 0) {
                requestBuilder.setCurrentTime(startPosMs);
            }
            MediaLoadRequestData requestData = requestBuilder.build();

            final int watchOpId = opId;
            loadMediaHandler.postDelayed(() -> {
                if (isMediaLoading && currentLoadOperationId == watchOpId) {
                    Log.w("BragiCast", "Media load timed out waiting for playback (opId=" + watchOpId + ")");
                    isMediaLoading = false;
                    notifyCastStatus();
                }
            }, 12000L);

            // Transmit Cast load request immediately
            client.load(requestData).setResultCallback(result -> {
                if (opId != currentLoadOperationId) {
                    Log.d("BragiCast", "Ignoring obsolete load result (opId=" + opId + ", current=" + currentLoadOperationId + ")");
                    return;
                }

                if (!result.getStatus().isSuccess()) {
                    int statusCode = result.getStatus().getStatusCode();
                    // 2002 = CastStatusCodes.CANCELED (replaced/interrupted by subsequent load)
                    // 2100 = MediaStatusCodes.STATUS_CANCELED
                    // 2103 = MediaStatusCodes.STATUS_REPLACED
                    // 14 = CommonStatusCodes.INTERRUPTED
                    if (statusCode == 2002 || statusCode == 2103 || statusCode == 2100 || statusCode == 14) {
                        Log.d("BragiCast", "Load was cancelled or replaced on receiver (statusCode=" + statusCode + "), ignoring");
                        return;
                    }
                    Log.e("BragiCast", "Media load failed on Cast receiver (attempt " + attempt + ", opId " + opId + "): " + statusCode);
                    if (attempt < 3) {
                        pendingLoadRetry = () -> {
                            executeLoadMedia(title, artist, album, finalStreamUrl, finalArtworkUrl, (attempt == 1 ? positionSec : 0.0), durationSec, autoplay, attempt + 1, opId);
                        };
                        loadMediaHandler.postDelayed(pendingLoadRetry, 400);
                    } else {
                        if (opId == currentLoadOperationId) {
                            isMediaLoading = false;
                            notifyNativeCastMediaStatus("IDLE", "ERROR", 0, 0, 1.0, finalStreamUrl);
                        }
                    }
                } else {
                    if (opId == currentLoadOperationId) {
                        Log.i("BragiCast", "Media load accepted by Cast receiver for opId=" + opId);
                    }
                }
            });

            // CastMediaOptions and RemoteMediaClient manage the remote Cast notification and media session automatically
        }

        @JavascriptInterface
        public void play() {
            runOnUiThread(() -> {
                CastSession session = getActiveCastSession();
                if (session != null && session.getRemoteMediaClient() != null) {
                    session.getRemoteMediaClient().play();
                }
            });
        }

        @JavascriptInterface
        public void pause() {
            runOnUiThread(() -> {
                CastSession session = getActiveCastSession();
                if (session != null && session.getRemoteMediaClient() != null) {
                    session.getRemoteMediaClient().pause();
                }
            });
        }

        private final Handler seekHandler = new Handler(Looper.getMainLooper());
        private Runnable pendingSeekRunnable = null;

        @JavascriptInterface
        public void seek(double positionSec) {
            runOnUiThread(() -> {
                if (pendingSeekRunnable != null) {
                    seekHandler.removeCallbacks(pendingSeekRunnable);
                }
                pendingSeekRunnable = () -> {
                    CastSession session = getActiveCastSession();
                    if (session != null && session.getRemoteMediaClient() != null) {
                        try {
                            session.getRemoteMediaClient().seek(
                                    new MediaSeekOptions.Builder().setPosition((long) Math.round(positionSec * 1000.0)).build()
                            );
                        } catch (Exception e) {
                            Log.w("BragiCast", "Error executing native Cast seek: " + e.getMessage());
                        }
                    }
                    pendingSeekRunnable = null;
                };
                seekHandler.postDelayed(pendingSeekRunnable, 100);
            });
        }
    }
}
