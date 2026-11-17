package org.bragi.nativeapp

import android.app.Application
import org.bragi.nativeapp.library.DeviceLibrary
import org.bragi.nativeapp.playback.QueueStore
import org.bragi.nativeapp.playback.SoundEqualizer
import kotlinx.coroutines.flow.MutableStateFlow

class BragiApplication : Application() {
    val library by lazy { DeviceLibrary(this) }
    val queueStore by lazy { QueueStore(this) }
    val equalizer by lazy { SoundEqualizer(this) }
    val castError = MutableStateFlow<String?>(null)
    val castHandoff = MutableStateFlow(false)
}
