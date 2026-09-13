package org.bragi.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.google.android.gms.cast.CastMediaControlIntent;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;
import com.google.android.gms.cast.framework.media.CastMediaOptions;
import com.google.android.gms.cast.framework.media.MediaIntentReceiver;
import com.google.android.gms.cast.framework.media.NotificationOptions;
import java.util.ArrayList;
import java.util.List;

public class CastOptionsProvider implements OptionsProvider {
    @NonNull
    @Override
    public CastOptions getCastOptions(@NonNull Context context) {
        List<String> actions = new ArrayList<>();
        actions.add(MediaIntentReceiver.ACTION_SKIP_PREV);
        actions.add(MediaIntentReceiver.ACTION_TOGGLE_PLAYBACK);
        actions.add(MediaIntentReceiver.ACTION_SKIP_NEXT);
        actions.add(MediaIntentReceiver.ACTION_STOP_CASTING);

        int[] compatActionIndices = new int[]{ 0, 1, 2 };

        NotificationOptions notificationOptions = new NotificationOptions.Builder()
                .setActions(actions, compatActionIndices)
                .setSkipToPrevSlotReserved(true)
                .setSkipToNextSlotReserved(true)
                .setTargetActivityClassName(MainActivity.class.getName())
                .setSmallIconDrawableResId(R.drawable.ic_notification_icon)
                .build();

        CastMediaOptions mediaOptions = new CastMediaOptions.Builder()
                .setNotificationOptions(notificationOptions)
                .setMediaIntentReceiverClassName(CastMediaIntentReceiver.class.getName())
                .setMediaSessionEnabled(true)
                .build();

        return new CastOptions.Builder()
                .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
                .setCastMediaOptions(mediaOptions)
                .setStopReceiverApplicationWhenEndingSession(true)
                .setSessionTransferEnabled(true)
                .build();
    }

    @Nullable
    @Override
    public List<SessionProvider> getAdditionalSessionProviders(@NonNull Context context) {
        return null;
    }
}
