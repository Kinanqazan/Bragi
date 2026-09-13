package org.bragi.app;

import android.content.Intent;
import android.util.Log;
import android.view.KeyEvent;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.google.android.gms.cast.framework.Session;
import com.google.android.gms.cast.framework.media.MediaIntentReceiver;

public class CastMediaIntentReceiver extends MediaIntentReceiver {
    private static final String TAG = "CastMediaReceiver";

    @Override
    protected void onReceiveActionSkipNext(@NonNull Session session) {
        Log.d(TAG, "onReceiveActionSkipNext - delegating to Bragi next track");
        MainActivity.handlePlaybackAction(PlaybackService.ACTION_NEXT);
    }

    @Override
    protected void onReceiveActionSkipPrev(@NonNull Session session) {
        Log.d(TAG, "onReceiveActionSkipPrev - delegating to Bragi previous track");
        MainActivity.handlePlaybackAction(PlaybackService.ACTION_PREVIOUS);
    }

    @Override
    protected void onReceiveActionMediaButton(@NonNull Session session, @Nullable Intent intent) {
        if (intent != null && intent.hasExtra(Intent.EXTRA_KEY_EVENT)) {
            KeyEvent keyEvent = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
            if (keyEvent != null && keyEvent.getAction() == KeyEvent.ACTION_DOWN) {
                int keyCode = keyEvent.getKeyCode();
                if (keyCode == KeyEvent.KEYCODE_MEDIA_NEXT) {
                    MainActivity.handlePlaybackAction(PlaybackService.ACTION_NEXT);
                    return;
                } else if (keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS) {
                    MainActivity.handlePlaybackAction(PlaybackService.ACTION_PREVIOUS);
                    return;
                }
            }
        }
        super.onReceiveActionMediaButton(session, intent);
    }
}
