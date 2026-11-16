package org.bragi.nativeapp

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.bragi.nativeapp.library.SavedServer
import org.bragi.nativeapp.library.ServerSettings
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ServerSettingsTest {
    @Test fun encryptsCredentialsAndRestoresSourceAcrossInstances() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val id = UUID.randomUUID().toString()
        val name = "server-settings-test-$id"
        val alias = "server-settings-test-$id"
        try {
            val settings = ServerSettings(context, name, alias)
            assertNull(settings.selectedSource)
            assertNull(settings.loadServer())
            val server = SavedServer("https://example.test", "listener", "secret password", "fingerprint")
            settings.saveServer(server)
            val preferences = context.getSharedPreferences(name, Context.MODE_PRIVATE)
            assertFalse(preferences.all.values.any { it is String && it.contains(server.password) })
            val restored = ServerSettings(context, name, alias)
            assertEquals("Server", restored.selectedSource)
            assertEquals(server, restored.loadServer())
            restored.selectPhone()
            val phone = ServerSettings(context, name, alias)
            assertEquals("Phone", phone.selectedSource)
            assertEquals(server, phone.loadServer())
        } finally {
            context.getSharedPreferences(name, Context.MODE_PRIVATE).edit().clear().commit()
            context.deleteSharedPreferences(name)
            KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(alias) }
        }
    }
}
