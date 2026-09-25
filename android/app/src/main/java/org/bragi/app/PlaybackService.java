package org.bragi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import android.util.LruCache;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PlaybackService extends Service {
    private static final String CHANNEL_ID = "bragi_playback_channel";
    private static final LruCache<String, Bitmap> sBitmapCache = new LruCache<>(40);
    private static final int NOTIFICATION_ID = 1001;
    private static final long STOP_GRACE_PERIOD_MS = 20000L; // 20 seconds

    public static final String ACTION_START = "org.bragi.app.ACTION_START_PLAYBACK";
    public static final String ACTION_STOP = "org.bragi.app.ACTION_STOP_PLAYBACK";
    public static final String ACTION_STOP_IMMEDIATELY = "org.bragi.app.ACTION_STOP_IMMEDIATELY";
    public static final String ACTION_UPDATE_METADATA = "org.bragi.app.ACTION_UPDATE_METADATA";
    public static final String ACTION_UPDATE_POSITION = "org.bragi.app.ACTION_UPDATE_POSITION";
    public static final String ACTION_PLAY_PAUSE = "org.bragi.app.ACTION_PLAY_PAUSE";
    public static final String ACTION_NEXT = "org.bragi.app.ACTION_NEXT";
    public static final String ACTION_PREVIOUS = "org.bragi.app.ACTION_PREVIOUS";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK_URL = "artwork_url";
    public static final String EXTRA_IS_PLAYING = "is_playing";
    public static final String EXTRA_DURATION_SEC = "duration_sec";
    public static final String EXTRA_POSITION_SEC = "position_sec";

    private PowerManager.WakeLock wakeLock;
    private MediaSessionCompat mediaSession;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable stopRunnable = this::stopForegroundPlayback;
    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();

    private String currentTitle = "Bragi";
    private String currentArtist = "Playing in background";
    private String currentAlbum = "";
    private String currentArtworkUrl = "";
    private Bitmap currentCoverBitmap = null;
    private boolean currentIsPlaying = true;
    private double currentDurationSec = 0;
    private double currentPositionSec = 0;
    private boolean isForegroundRunning = false;

    public static void start(Context context) {
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    public static void stopImmediately(Context context) {
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(ACTION_STOP_IMMEDIATELY);
        try {
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    public static void updatePosition(Context context, double positionSec, double durationSec, boolean isPlaying) {
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(ACTION_UPDATE_POSITION);
        intent.putExtra(EXTRA_IS_PLAYING, isPlaying);
        intent.putExtra(EXTRA_DURATION_SEC, durationSec);
        intent.putExtra(EXTRA_POSITION_SEC, positionSec);
        try {
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    public static void updateMetadata(Context context, String title, String artist, String album, boolean isPlaying) {
        updateMetadata(context, title, artist, album, "", isPlaying, 0, 0);
    }

    public static void updateMetadata(Context context, String title, String artist, String album, String artworkUrl, boolean isPlaying, double durationSec, double positionSec) {
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(ACTION_UPDATE_METADATA);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_ARTIST, artist);
        intent.putExtra(EXTRA_ALBUM, album);
        intent.putExtra(EXTRA_ARTWORK_URL, artworkUrl);
        intent.putExtra(EXTRA_IS_PLAYING, isPlaying);
        intent.putExtra(EXTRA_DURATION_SEC, durationSec);
        intent.putExtra(EXTRA_POSITION_SEC, positionSec);
        try {
            context.startService(intent);
        } catch (Exception e) {
            if (isPlaying && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    context.startForegroundService(intent);
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Bragi::PlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }
        createNotificationChannel();
        setupMediaSession();
    }

    private void setupMediaSession() {
        mediaSession = new MediaSessionCompat(this, "BragiMediaSession");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                MainActivity.handlePlaybackAction(ACTION_PLAY_PAUSE);
            }

            @Override
            public void onPause() {
                MainActivity.handlePlaybackAction(ACTION_PLAY_PAUSE);
            }

            @Override
            public void onSkipToNext() {
                MainActivity.handlePlaybackAction(ACTION_NEXT);
            }

            @Override
            public void onSkipToPrevious() {
                MainActivity.handlePlaybackAction(ACTION_PREVIOUS);
            }

            @Override
            public void onSeekTo(long pos) {
                MainActivity.handleSeekAction(pos / 1000.0);
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP_IMMEDIATELY.equals(action)) {
            if (mediaSession != null) {
                mediaSession.setActive(false);
            }
            stopForegroundPlayback();
            return START_NOT_STICKY;
        }

        if (ACTION_STOP.equals(action)) {
            currentIsPlaying = false;
            syncMediaSession();
            updateNotification();
            handler.removeCallbacks(stopRunnable);
            handler.postDelayed(stopRunnable, STOP_GRACE_PERIOD_MS);
            return START_NOT_STICKY;
        }

        if (ACTION_PREVIOUS.equals(action) || ACTION_PLAY_PAUSE.equals(action) || ACTION_NEXT.equals(action)) {
            MainActivity.handlePlaybackAction(action);
            return START_NOT_STICKY;
        }

        handler.removeCallbacks(stopRunnable);

        if (ACTION_UPDATE_POSITION.equals(action)) {
            currentIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, currentIsPlaying);
            currentDurationSec = intent.getDoubleExtra(EXTRA_DURATION_SEC, currentDurationSec);
            currentPositionSec = intent.getDoubleExtra(EXTRA_POSITION_SEC, currentPositionSec);
            syncMediaSession();
            return START_STICKY;
        }

        if (ACTION_UPDATE_METADATA.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            String album = intent.getStringExtra(EXTRA_ALBUM);
            String artworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);
            boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
            double durationSec = intent.getDoubleExtra(EXTRA_DURATION_SEC, currentDurationSec);
            double positionSec = intent.getDoubleExtra(EXTRA_POSITION_SEC, currentPositionSec);

            boolean metadataChanged = false;
            if (title != null && !title.isEmpty() && !title.equals(currentTitle)) {
                currentTitle = title;
                metadataChanged = true;
            }
            if (artist != null && !artist.isEmpty() && !artist.equals(currentArtist)) {
                currentArtist = artist;
                metadataChanged = true;
            }
            if (album != null && !album.equals(currentAlbum)) {
                currentAlbum = album;
                metadataChanged = true;
            }
            if (artworkUrl != null && !artworkUrl.isEmpty() && !artworkUrl.equals(currentArtworkUrl)) {
                currentArtworkUrl = artworkUrl;
                loadArtworkBitmap(artworkUrl);
                metadataChanged = true;
            }
            boolean playStateChanged = (currentIsPlaying != isPlaying);
            currentIsPlaying = isPlaying;
            currentDurationSec = durationSec;
            currentPositionSec = positionSec;

            syncMediaSession();
            if (!isForegroundRunning) {
                startForegroundPlayback();
            } else if (metadataChanged || playStateChanged) {
                updateNotification();
            }
            return START_STICKY;
        }

        syncMediaSession();
        if (!isForegroundRunning) {
            startForegroundPlayback();
        }
        return START_STICKY;
    }

    private void syncMediaSession() {
        if (mediaSession == null) return;

        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO;

        long posMs = (long) Math.max(0, Math.round(currentPositionSec * 1000.0));
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(
                        currentIsPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                        posMs,
                        currentIsPlaying ? 1.0f : 0.0f
                );
        mediaSession.setPlaybackState(stateBuilder.build());

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum);
        if (currentDurationSec > 0) {
            metaBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (long) Math.round(currentDurationSec * 1000.0));
        }
        if (currentCoverBitmap != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentCoverBitmap);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, currentCoverBitmap);
        }
        mediaSession.setMetadata(metaBuilder.build());
    }

    private void loadArtworkBitmap(String urlString) {
        if (urlString == null || urlString.isEmpty()) {
            currentCoverBitmap = null;
            syncMediaSession();
            updateNotification();
            return;
        }

        Bitmap cached = sBitmapCache.get(urlString);
        if (cached != null) {
            currentCoverBitmap = cached;
            syncMediaSession();
            updateNotification();
            return;
        }

        imageExecutor.execute(() -> {
            Bitmap bmp = null;
            try {
                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                if (conn instanceof javax.net.ssl.HttpsURLConnection) {
                    javax.net.ssl.HttpsURLConnection httpsConn = (javax.net.ssl.HttpsURLConnection) conn;
                    try {
                        javax.net.ssl.TrustManager[] trustAll = new javax.net.ssl.TrustManager[]{
                                new javax.net.ssl.X509TrustManager() {
                                    public java.security.cert.X509Certificate[] getAcceptedIssuers() { return new java.security.cert.X509Certificate[0]; }
                                    public void checkClientTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                                    public void checkServerTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                                }
                        };
                        javax.net.ssl.SSLContext sc = javax.net.ssl.SSLContext.getInstance("TLS");
                        sc.init(null, trustAll, new java.security.SecureRandom());
                        httpsConn.setSSLSocketFactory(sc.getSocketFactory());
                        httpsConn.setHostnameVerifier((hostname, session) -> true);
                    } catch (Exception ignored) {}
                }
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.connect();
                if (conn.getResponseCode() == 200) {
                    try (InputStream is = conn.getInputStream()) {
                        bmp = BitmapFactory.decodeStream(is);
                    }
                }
            } catch (Exception ignored) {}

            final Bitmap loadedBmp = bmp;
            if (loadedBmp != null) {
                sBitmapCache.put(urlString, loadedBmp);
            }
            handler.post(() -> {
                if (urlString.equals(currentArtworkUrl)) {
                    currentCoverBitmap = loadedBmp;
                    syncMediaSession();
                    updateNotification();
                }
            });
        });
    }

    private void startForegroundPlayback() {
        if (isForegroundRunning) {
            updateNotification();
            return;
        }

        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(24 * 60 * 60 * 1000L); // 24 hour safety cap
        }

        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        isForegroundRunning = true;
    }

    private void updateNotification() {
        if (!isForegroundRunning) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, flags);

        PendingIntent prevIntent = PendingIntent.getService(
                this, 1, new Intent(this, PlaybackService.class).setAction(ACTION_PREVIOUS), flags
        );
        PendingIntent playPauseIntent = PendingIntent.getService(
                this, 2, new Intent(this, PlaybackService.class).setAction(ACTION_PLAY_PAUSE), flags
        );
        PendingIntent nextIntent = PendingIntent.getService(
                this, 3, new Intent(this, PlaybackService.class).setAction(ACTION_NEXT), flags
        );

        int playPauseIcon = currentIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseTitle = currentIsPlaying ? "Pause" : "Play";

        androidx.media.app.NotificationCompat.MediaStyle mediaStyle =
                new androidx.media.app.NotificationCompat.MediaStyle()
                        .setShowActionsInCompactView(0, 1, 2);
        if (mediaSession != null) {
            mediaStyle.setMediaSession(mediaSession.getSessionToken());
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setStyle(mediaStyle)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(currentIsPlaying)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
                .addAction(playPauseIcon, playPauseTitle, playPauseIntent)
                .addAction(android.R.drawable.ic_media_next, "Next", nextIntent);

        if (currentAlbum != null && !currentAlbum.isEmpty()) {
            builder.setSubText(currentAlbum);
        }
        if (currentCoverBitmap != null) {
            builder.setLargeIcon(currentCoverBitmap);
        }

        return builder.build();
    }

    private void stopForegroundPlayback() {
        handler.removeCallbacks(stopRunnable);
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        stopForeground(true);
        isForegroundRunning = false;
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Bragi Audio Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains music playback when screen is locked");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(stopRunnable);
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        imageExecutor.shutdownNow();
        isForegroundRunning = false;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
