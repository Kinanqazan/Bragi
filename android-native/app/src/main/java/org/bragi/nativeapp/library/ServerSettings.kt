package org.bragi.nativeapp.library

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class SavedServer(val address: String, val username: String, val password: String, val fingerprint: String? = null)

/** Credentials are encrypted with a non-exportable, device-local Android Keystore key. */
class ServerSettings(private val context: Context, private val preferenceName: String = "server-settings", private val keyAlias: String = "bragi-server-credentials") {
    private val preferences = context.getSharedPreferences(preferenceName, Context.MODE_PRIVATE)
    val selectedSource: String? get() = preferences.getString("source", null)
    val address: String get() = preferences.getString("address", "") ?: ""
    val username: String get() = preferences.getString("username", "") ?: ""

    val phoneFolder: String get() = preferences.getString("phone_folder", "") ?: ""
    fun setPhoneFolder(path: String) { check(preferences.edit().putString("phone_folder", path).commit()) }
    fun clearServer() { check(preferences.edit().remove("address").remove("username").remove("fingerprint").remove("password_iv").remove("password_ciphertext").putString("source", "Setup").commit()) }

    fun selectPhone() { check(preferences.edit().putString("source", "Phone").commit()) }

    fun saveServer(server: SavedServer) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(create = true))
        val ciphertext = cipher.doFinal(server.password.toByteArray(Charsets.UTF_8))
        check(preferences.edit().putString("address", server.address).putString("username", server.username)
            .putString("fingerprint", server.fingerprint)
            .putString("password_iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("password_ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .putString("source", "Server").commit())
    }

    fun loadServer(): SavedServer? {
        val iv = preferences.getString("password_iv", null) ?: return null
        val ciphertext = preferences.getString("password_ciphertext", null) ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(create = false), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
        return SavedServer(address, username, cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)).toString(Charsets.UTF_8), preferences.getString("fingerprint", null))
    }

    private fun key(create: Boolean): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        check(create) { "The saved server credentials are unavailable." }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
}
