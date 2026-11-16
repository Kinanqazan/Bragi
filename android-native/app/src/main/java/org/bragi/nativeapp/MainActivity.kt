package org.bragi.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.core.content.ContextCompat
import org.bragi.nativeapp.ui.BragiApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.rgb(17, 18, 20)),
        )
        setContent { BragiApp() }
    }
}

val musicPermission: String
    get() = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO
        else Manifest.permission.READ_EXTERNAL_STORAGE

fun android.content.Context.hasMusicAccess(): Boolean =
    ContextCompat.checkSelfPermission(this, musicPermission) == PackageManager.PERMISSION_GRANTED
