package org.bragi.nativeapp.library

import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.net.Socket
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import javax.net.ssl.X509ExtendedTrustManager
import javax.net.ssl.SSLSocketFactory
import okhttp3.OkHttpClient

/** An explicitly trusted private server may use renewed certificates for its hostname. */
object ServerTls {
    private val systemFactory = HttpsURLConnection.getDefaultSSLSocketFactory()
    @Volatile private var trustedFactory: SSLSocketFactory? = null
    @Volatile private var trustedManager: X509TrustManager? = null

    fun imageClient(): OkHttpClient {
        val factory = trustedFactory
        val manager = trustedManager
        return if (factory != null && manager != null) OkHttpClient.Builder().sslSocketFactory(factory, manager).build()
            else OkHttpClient()
    }
    fun trustServerCertificate(host: String, port: Int): String? {
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        factory.init(null as KeyStore?)
        val system = factory.trustManagers.filterIsInstance<X509TrustManager>().first()
        var systemTrusted = false
        val probeTrust = object : X509TrustManager {
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                systemTrusted = try { system.checkServerTrusted(chain, authType); true } catch (_: CertificateException) { false }
            }
        }
        val probe = SSLContext.getInstance("TLS").apply { init(null, arrayOf(probeTrust), SecureRandom()) }
        val fingerprint = (probe.socketFactory.createSocket(host, port) as SSLSocket).use { socket ->
            socket.soTimeout = 15000
            socket.startHandshake()
            if (!HttpsURLConnection.getDefaultHostnameVerifier().verify(host, socket.session)) {
                throw CertificateException("The certificate does not match the server address.")
            }
            MessageDigest.getInstance("SHA-256").digest(socket.session.peerCertificates.first().encoded)
        }
        if (systemTrusted) {
            trustedManager = null
            trustedFactory = null
            HttpsURLConnection.setDefaultSSLSocketFactory(systemFactory)
            return null
        }
        val fingerprintHex = fingerprint.joinToString("") { "%02x".format(it) }
        val pinned = object : X509ExtendedTrustManager() {
            override fun getAcceptedIssuers(): Array<X509Certificate> = system.acceptedIssuers
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = system.checkClientTrusted(chain, authType)
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String, socket: Socket) = checkClientTrusted(chain, authType)
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String, engine: SSLEngine) = checkClientTrusted(chain, authType)
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                system.checkServerTrusted(chain, authType)
            }
            private fun checkForHost(chain: Array<X509Certificate>, authType: String, peerHost: String?, peerPort: Int) {
                try { system.checkServerTrusted(chain, authType) } catch (error: CertificateException) {
                    if (!host.equals(peerHost, ignoreCase = true) || port != peerPort || chain.isEmpty()) throw error
                    chain[0].checkValidity()
                }
            }
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String, socket: Socket) =
                checkForHost(chain, authType, (socket as? SSLSocket)?.handshakeSession?.peerHost, socket.port)
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String, engine: SSLEngine) =
                checkForHost(chain, authType, engine.peerHost, engine.peerPort)
        }
        val trusted = SSLContext.getInstance("TLS").apply { init(null, arrayOf(pinned), SecureRandom()) }
        trustedManager = pinned
        trustedFactory = trusted.socketFactory
        HttpsURLConnection.setDefaultSSLSocketFactory(trusted.socketFactory)
        return fingerprintHex
    }
}
