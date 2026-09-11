package org.bragi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class PlaybackService extends Service {
    private static final String CHANNEL_ID = "bragi_playback_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long STOP_GRACE_PERIOD_MS = 15000L; // 15 seconds

    public static final String ACTION_START = "org.bragi.app.ACTION_START_PLAYBACK";
    public static final String ACTION_STOP = "org.bragi.app.ACTION_STOP_PLAYBACK";
    public static final String ACTION_UPDATE_METADATA = "org.bragi.app.ACTION_UPDATE_METADATA";
    public static final String ACTION_PLAY_PAUSE = "org.bragi.app.ACTION_PLAY_PAUSE";
    public static final String ACTION_NEXT = "org.bragi.app.ACTION_NEXT";
    public static final String ACTION_PREVIOUS = "org.bragi.app.ACTION_PREVIOUS";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_IS_PLAYING = "is_playing";

    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable stopRunnable = this::stopForegroundPlayback;

    private String currentTitle = "Bragi";
    private String currentArtist = "Playing in background";
    private String currentAlbum = "";
    private boolean currentIsPlaying = true;
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

    public static void updateMetadata(Context context, String title, String artist, String album, boolean isPlaying) {
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(ACTION_UPDATE_METADATA);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_ARTIST, artist);
        intent.putExtra(EXTRA_ALBUM, album);
        intent.putExtra(EXTRA_IS_PLAYING, isPlaying);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
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
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            // Delay stop by grace period to prevent dropping wake lock during track transitions
            currentIsPlaying = false;
            updateNotification();
            handler.removeCallbacks(stopRunnable);
            handler.postDelayed(stopRunnable, STOP_GRACE_PERIOD_MS);
            return START_NOT_STICKY;
        }

        if (ACTION_PREVIOUS.equals(action) || ACTION_PLAY_PAUSE.equals(action) || ACTION_NEXT.equals(action)) {
            MainActivity.handlePlaybackAction(action);
            return START_NOT_STICKY;
        }

        // Playback started or metadata updated: cancel any pending stop
        handler.removeCallbacks(stopRunnable);

        if (ACTION_UPDATE_METADATA.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            String album = intent.getStringExtra(EXTRA_ALBUM);
            if (title != null && !title.isEmpty()) currentTitle = title;
            if (artist != null && !artist.isEmpty()) currentArtist = artist;
            if (album != null) currentAlbum = album;
            currentIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
        }

        startForegroundPlayback();
        return START_STICKY;
    }

    private void startForegroundPlayback() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(24 * 60 * 60 * 1000L); // 24 hour safety cap
        }

        Notification notification = buildNotification();

        if (!isForegroundRunning) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isForegroundRunning = true;
        } else {
            updateNotification();
        }
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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(currentIsPlaying)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
                .addAction(playPauseIcon, playPauseTitle, playPauseIntent)
                .addAction(android.R.drawable.ic_media_next, "Next", nextIntent);

        if (currentAlbum != null && !currentAlbum.isEmpty()) {
            builder.setSubText(currentAlbum);
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
        isForegroundRunning = false;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
