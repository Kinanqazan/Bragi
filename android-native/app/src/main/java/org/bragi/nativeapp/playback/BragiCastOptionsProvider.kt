package org.bragi.nativeapp.playback

import android.content.Context
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider

class BragiCastOptionsProvider : OptionsProvider {
    override fun getCastOptions(context: Context): CastOptions = CastOptions.Builder()
        .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
        .setResumeSavedSession(false)
        .setEnableReconnectionService(false)
        .setStopReceiverApplicationWhenEndingSession(true)
        .setRemoteToLocalEnabled(true)
        .build()

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider> = emptyList()
}
