package org.bragi.nativeapp

import android.content.ComponentName
import android.content.ContentValues
import android.net.Uri
import android.provider.MediaStore
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import androidx.lifecycle.ViewModelProvider
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.runBlocking
import org.bragi.nativeapp.playback.PlaybackService
import org.bragi.nativeapp.playback.toMediaItem
import org.bragi.nativeapp.playback.SavedQueue
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.nio.ByteBuffer
import java.io.File
import java.nio.ByteOrder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Exercises Android's real media index, service/controller boundary and decoder. */
@RunWith(AndroidJUnit4::class)
@SdkSuppress(minSdkVersion = 29)
class NativePlaybackTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val app get() = instrumentation.targetContext.applicationContext as BragiApplication

    @Test fun deviceMusicCanBeDiscoveredPreparedPlayedAndSavedThroughTheService() {
        val uri = createSilentTestSong()
        val extraUris = mutableListOf<Uri>()
        var future: ListenableFuture<MediaController>? = null
        var controller: MediaController? = null
        try {
            repeat(16) { extraUris.add(createSilentTestSong()) }
            val song = runBlocking { app.library.tracks().firstOrNull { it.uri == uri.toString() } }
            assertNotNull("The real MediaStore song should appear in the device library", song)
            runBlocking { app.queueStore.write(SavedQueue(listOf(song!!), 0, 1_200)) }
            val connected = CountDownLatch(1)
            onMain {
                future = MediaController.Builder(app,
                    SessionToken(app, ComponentName(app, PlaybackService::class.java))).buildAsync()
                future!!.addListener({ connected.countDown() }, { it.run() })
            }
            assertTrue("Controller connection timed out", connected.await(15, TimeUnit.SECONDS))
            controller = future!!.get(5, TimeUnit.SECONDS)
            val ready = CountDownLatch(1)
            val playing = CountDownLatch(1)
            val restored = CountDownLatch(1)
            val player = controller
            onMain {
                player.addListener(object : Player.Listener {
                    override fun onEvents(player: Player, events: Player.Events) {
                        if (player.currentMediaItem?.mediaId == song!!.id) restored.countDown()
                    }
                })
                if (player.currentMediaItem?.mediaId == song!!.id) restored.countDown()
            }
            assertTrue("The service should restore its saved queue", restored.await(5, TimeUnit.SECONDS))
            onMain {
                assertFalse("Restoring a queue must never start music automatically", player.playWhenReady)
                assertEquals("Restoration should keep the seek position", 1_200L, player.currentPosition)
            }
            onMain {
                player.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_READY) ready.countDown()
                    }
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        if (isPlaying) playing.countDown()
                    }
                })
                // Silent generated PCM plus player-only mute: no device volume changes.
                player.volume = 0f
                player.setMediaItems(listOf(song!!.toMediaItem()))
                player.prepare()
            }
            assertTrue("The native player did not decode the local song", ready.await(15, TimeUnit.SECONDS))
            onMain { player.play() }
            assertTrue("Playback never started", playing.await(10, TimeUnit.SECONDS))
            onMain {
                player.seekTo(1_500)
                player.pause()
            }
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    ViewModelProvider(activity)[MusicViewModel::class.java].apply {
                        source.value = "Phone"
                        setLibraryAccess(true)
                    }
                }
                val device = UiDevice.getInstance(instrumentation)
                // UiObject re-resolves the selector instead of retaining a node across Compose updates.
                val openPlayer = device.findObject(UiSelector().description("Open player"))
                assertTrue("The activity should show the service's current song", openPlayer.waitForExists(10_000))
                val menu = device.findObject(UiSelector().description("Open menu"))
                assertTrue("Songs header should be visible initially", menu.waitForExists(5_000))
                assertTrue("The device songs should be loaded", device.wait(Until.hasObject(By.textContains("bragi-native-verification")), 10_000))
                device.swipe(device.displayWidth / 2, device.displayHeight * 7 / 10, device.displayWidth / 2, device.displayHeight / 4, 25)
                assertTrue("The header should scroll away with the song list", device.wait(Until.gone(By.desc("Open menu")), 5_000))
                val bounds = openPlayer.bounds
                device.swipe(bounds.centerX(), bounds.centerY(), bounds.centerX(), bounds.centerY() + 70, 12)
                SystemClock.sleep(350)
                assertFalse("A downward swipe on the collapsed player must not open it", device.findObject(UiSelector().description("Expanded player")).exists())
                assertTrue("The mini player should remain available after a downward swipe", openPlayer.exists())
                val openingTime = SystemClock.uptimeMillis()
                val openingX = bounds.centerX().toFloat()
                val openingY = bounds.centerY().toFloat()
                injectTouch(MotionEvent.ACTION_DOWN, openingX, openingY, openingTime)
                for (step in 1..8) { injectTouch(MotionEvent.ACTION_MOVE, openingX, openingY - 40f * step, openingTime); SystemClock.sleep(25) }
                val movingPanel = device.findObject(UiSelector().description("Expanded player"))
                assertTrue("A partial upward drag should reveal the player while held", movingPanel.waitForExists(5_000))
                val openingTop = movingPanel.bounds.top
                device.takeScreenshot(File(app.getExternalFilesDir(null), "verification-opening-drag.png"))
                injectTouch(MotionEvent.ACTION_MOVE, openingX, openingY - 1100f, openingTime)
                injectTouch(MotionEvent.ACTION_UP, openingX, openingY - 1100f, openingTime)
                assertTrue("The player should follow the upward drag without jumping fully open", openingTop in 1 until (bounds.top - 100))
                assertTrue("The full player should open", device.wait(Until.hasObject(By.desc("Lyrics")), 5_000))
                assertFalse("The close arrow should not be present", device.findObject(UiSelector().description("Close player")).exists())
                val panel = device.findObject(UiSelector().description("Expanded player"))
                assertTrue("The expanded player should be accessible", panel.waitForExists(5_000))
                val openingDeadline = SystemClock.uptimeMillis() + 5_000
                while (panel.bounds.top > 5 && SystemClock.uptimeMillis() < openingDeadline) SystemClock.sleep(50)
                val initialTop = panel.bounds.top
                assertTrue("The player should finish opening", initialTop <= 5)
                val startX = device.displayWidth / 2f
                val startY = device.displayHeight * 0.15f
                val downTime = SystemClock.uptimeMillis()
                fun touch(action: Int, y: Float) {
                    val event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, startX, y, 0)
                    event.source = InputDevice.SOURCE_TOUCHSCREEN
                    instrumentation.uiAutomation.injectInputEvent(event, true)
                    event.recycle()
                }
                touch(MotionEvent.ACTION_DOWN, startY)
                var firstDragTop = initialTop
                for (step in 1..8) {
                    touch(MotionEvent.ACTION_MOVE, startY + 40f * step)
                    SystemClock.sleep(25)
                    if (step == 4) { SystemClock.sleep(100); firstDragTop = panel.bounds.top }
                }
                SystemClock.sleep(200)
                val movedTop = panel.bounds.top
                device.takeScreenshot(File(app.getExternalFilesDir(null), "verification-closing-drag.png"))
                touch(MotionEvent.ACTION_UP, startY + 320f)
                assertTrue("The player should follow a downward drag while the finger is held", movedTop >= initialTop + 100)
                assertTrue("The player should continue following further finger movement", movedTop > firstDragTop + 50)
                assertTrue("A short drag should close the player", openPlayer.waitForExists(5_000))
                SystemClock.sleep(500)
                openPlayer.click()
                assertTrue("The player should reopen", device.wait(Until.hasObject(By.desc("Lyrics")), 5_000))
                SystemClock.sleep(500)
                device.findObject(UiSelector().description("Lyrics")).click()
                assertTrue("The lyrics canvas should be visible", device.wait(Until.hasObject(By.textContains("Lyrics are not available for phone files")), 5_000))
                device.swipe(device.displayWidth / 2, device.displayHeight / 5, device.displayWidth / 2, device.displayHeight * 4 / 5, 18)
                assertTrue("Swiping down should close the player while lyrics are visible", openPlayer.waitForExists(5_000))
                openPlayer.click()
                assertTrue("The player should reopen after closing with lyrics visible", device.wait(Until.hasObject(By.desc("Lyrics")), 5_000))
                SystemClock.sleep(500)
                device.takeScreenshot(File(app.getExternalFilesDir(null), "verification-player.png"))
                val favorite = device.findObject(UiSelector().description("Add to favorites"))
                assertTrue("Favorite action should be available", favorite.waitForExists(5_000))
                favorite.click()
                assertTrue("The song should become a favorite", device.wait(Until.hasObject(By.desc("Remove from favorites")), 5_000))
                device.findObject(UiSelector().description("Show play queue")).click()
                assertTrue("The current queue should open", device.wait(Until.hasObject(By.text("Play queue")), 5_000))
                device.pressBack()
                device.swipe(device.displayWidth / 2, device.displayHeight / 5, device.displayWidth / 2, device.displayHeight * 4 / 5, 18)
                assertTrue("Swiping down should close the player", openPlayer.waitForExists(5_000))
                assertFalse("Closing the player should preserve the song list position", menu.exists())
                SystemClock.sleep(500)
                val mini = openPlayer.bounds
                val shortDistance = device.displayHeight / 25
                device.swipe(mini.centerX(), mini.centerY(), mini.centerX(), mini.centerY() - shortDistance, 12)
                assertTrue("A slight swipe up should open the player", device.wait(Until.hasObject(By.desc("Lyrics")), 5_000))
                SystemClock.sleep(500)
                val swipeY = device.displayHeight / 5
                device.swipe(device.displayWidth / 2, swipeY, device.displayWidth / 2, swipeY + shortDistance, 12)
                assertTrue("A slight swipe down should close the player", openPlayer.waitForExists(5_000))
            }
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
            var saved = runBlocking { app.queueStore.read() }
            while ((saved?.positionMs !in 1_500L..1_750L || saved?.tracks?.singleOrNull()?.uri != uri.toString()) && System.nanoTime() < deadline) {
                Thread.sleep(50)
                saved = runBlocking { app.queueStore.read() }
            }
            assertTrue("Seek position must survive reopening", saved?.positionMs in 1_500L..1_750L)
            assertEquals("The saved queue must contain the playable content URI", uri.toString(), saved?.tracks?.single()?.uri)
            assertEquals("Queue duration metadata must survive the Media3 boundary", song!!.durationMs, saved?.tracks?.single()?.durationMs)
        } finally {
            onMain {
                controller?.let {
                    it.pause()
                    it.clearMediaItems()
                    it.volume = 1f
                }
            }
            // Allow the empty queue checkpoint to reach disk before the test disconnects.
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3)
            while (runBlocking { app.queueStore.read() } != null && System.nanoTime() < deadline) Thread.sleep(50)
            onMain { future?.let(MediaController::releaseFuture) }
            app.getSharedPreferences("local-song-stats", 0).edit().remove("favorite:device:${uri.lastPathSegment}").remove("plays:device:${uri.lastPathSegment}").apply()
            app.contentResolver.delete(uri, null, null)
            extraUris.forEach { app.contentResolver.delete(it, null, null) }
        }
    }

    private fun createSilentTestSong(): Uri {
        val values = ContentValues().apply {
            put(MediaStore.Audio.Media.DISPLAY_NAME, "bragi-native-verification-${System.currentTimeMillis()}.wav")
            put(MediaStore.Audio.Media.MIME_TYPE, "audio/wav")
            put(MediaStore.Audio.Media.RELATIVE_PATH, "Music/BragiNativeVerification")
            put(MediaStore.Audio.Media.TITLE, "Bragi Native verification")
            put(MediaStore.Audio.Media.ARTIST, "Bragi")
            put(MediaStore.Audio.Media.ALBUM, "Device test")
            put(MediaStore.Audio.Media.IS_MUSIC, 1)
            put(MediaStore.Audio.Media.DURATION, 5_000)
            put(MediaStore.Audio.Media.IS_PENDING, 1)
        }
        val resolver = app.contentResolver
        val uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)!!
        try {
            // Five seconds of mono 16-bit PCM at 8 kHz.
            val dataSize = 8_000 * 5 * 2
            val wav = ByteBuffer.allocate(44 + dataSize).order(ByteOrder.LITTLE_ENDIAN).apply {
                put("RIFF".toByteArray()); putInt(36 + dataSize); put("WAVEfmt ".toByteArray())
                putInt(16); putShort(1.toShort()); putShort(1.toShort()); putInt(8_000)
                putInt(16_000); putShort(2.toShort()); putShort(16.toShort())
                put("data".toByteArray()); putInt(dataSize)
            }.array()
            resolver.openOutputStream(uri)!!.use { it.write(wav) }
            resolver.update(uri, ContentValues().apply { put(MediaStore.Audio.Media.IS_PENDING, 0) }, null, null)
            return uri
        } catch (error: Exception) {
            resolver.delete(uri, null, null)
            throw error
        }
    }

    private fun onMain(action: () -> Unit) = instrumentation.runOnMainSync(action)

    private fun injectTouch(action: Int, x: Float, y: Float, downTime: Long) {
        val event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, x, y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        instrumentation.uiAutomation.injectInputEvent(event, true)
        event.recycle()
    }
}
