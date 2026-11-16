package org.bragi.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.bragi.nativeapp.library.ServerLibrary
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.net.ServerSocket
import java.net.URLDecoder
import java.security.MessageDigest
import kotlin.concurrent.thread

@RunWith(AndroidJUnit4::class)
class ServerLibraryTest {
    @Test fun connectsAuthenticatesAndBuildsPlayableSongs() {
        ServerSocket(0).use { server ->
            val requests = java.util.Collections.synchronizedList(mutableListOf<String>())
            val worker = thread {
                repeat(3) {
                    server.accept().use { socket ->
                        val input = socket.getInputStream().bufferedReader()
                        val request = input.readLine()
                        while (!input.readLine().isNullOrEmpty()) { }
                        val target = request.split(" ")[1]
                        requests.add(target)
                        val query = target.substringAfter('?').split('&').associate { part ->
                            val bits = part.split('=', limit = 2)
                            URLDecoder.decode(bits[0], "UTF-8") to URLDecoder.decode(bits.getOrElse(1) { "" }, "UTF-8")
                        }
                        val expected = MessageDigest.getInstance("MD5").digest(("secret" + query["s"]).toByteArray()).joinToString("") { "%02x".format(it) }
                        val body = when {
                            query["u"] != "listener" || query["t"] != expected -> """{"subsonic-response":{"status":"failed","error":{"message":"Bad credentials"}}}"""
                            target.startsWith("/music/rest/search3") -> """{"subsonic-response":{"status":"ok","searchResult3":{"song":[{"id":"42","title":"Song","artist":"Artist","album":"Album","duration":60,"genre":"Jazz","coverArt":"cover","moods":["Relax"],"playCount":7,"starred":null}]}}}"""
                            target.startsWith("/music/rest/getGenres") -> """{"subsonic-response":{"status":"ok","genres":{"genre":[{"value":"Jazz"}]}}}"""
                            else -> """{"subsonic-response":{"status":"ok"}}"""
                        }
                        val bytes = body.toByteArray()
                        socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray() + bytes)
                    }
                }
            }
            val client = ServerLibrary("http://127.0.0.1:${server.localPort}/music/app/", "listener", "secret")
            val (tracks, genres) = runBlocking { client.load() }
            assertEquals(listOf("Jazz", "Relax"), genres)
            assertEquals("Song", tracks.single().title)
            assertEquals(60_000L, tracks.single().durationMs)
            assertEquals(7L, tracks.single().playCount)
            assertFalse(tracks.single().starred)
            assertTrue(tracks.single().uri.contains("/music/rest/stream?"))
            assertTrue(tracks.single().artworkUri!!.contains("/music/rest/getCoverArt?"))
            runBlocking { client.setFavorite(tracks.single().id, true) }
            assertTrue(requests.any { it.startsWith("/music/rest/star?") && it.contains("id=42") })
            worker.join(5000)
        }
    }
}
