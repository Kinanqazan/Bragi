package org.bragi.nativeapp.ui

import androidx.compose.animation.core.SeekableTransitionState
import androidx.compose.animation.core.tween
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

internal const val PlayerTransitionDurationMs = 180

/** Maps finger travel to the shared player transition; completed gestures settle to an endpoint. */
class PlayerGestureState(
    val transition: SeekableTransitionState<Boolean>,
    private val scope: CoroutineScope,
) {
    private var pendingSeek: Job? = null
    private var settling: Job? = null
    private var fraction = 0f
    private var initialFraction = 0f
    private var target = false
    var dragging = false
        private set

    fun drag(opening: Boolean, delta: Float, distance: Float) {
        if (distance <= 0f) return
        // A downward pull on a fully collapsed player must not start an opening transition.
        if (!dragging && opening && delta >= 0f && !transition.currentState && !transition.targetState) return
        if (!dragging) {
            settling?.cancel()
            target = opening
            // Continue from the currently displayed position when a settling animation is interrupted.
            val expanded = when {
                transition.currentState == transition.targetState -> if (transition.currentState) 1f else 0f
                transition.targetState -> transition.fraction
                else -> 1f - transition.fraction
            }
            fraction = if (opening) expanded else 1f - expanded
            initialFraction = fraction
            dragging = true
        }
        val movement = if (opening) -delta else delta
        fraction = (fraction + movement / distance).coerceIn(0f, 1f)
        val position = fraction
        val destination = target
        pendingSeek?.cancel()
        pendingSeek = scope.launch { transition.seekTo(position, destination) }
    }

    fun finish(velocityY: Float = 0f, cancelled: Boolean = false) {
        if (!dragging) return
        val velocityTowardTarget = if (target) -velocityY else velocityY
        val complete = !cancelled && when {
            velocityTowardTarget > 1100f -> true
            velocityTowardTarget < -1100f -> false
            fraction - initialFraction > 0.005f -> true
            fraction - initialFraction < -0.005f -> false
            else -> fraction >= 0.5f
        }
        val destination = if (complete) target else !target
        val finalSeek = pendingSeek
        dragging = false
        settling?.cancel()
        settling = scope.launch {
            finalSeek?.join()
            transition.animateTo(destination, tween(PlayerTransitionDurationMs))
        }
    }

    fun animateTo(expanded: Boolean) {
        pendingSeek?.cancel()
        settling?.cancel()
        dragging = false
        settling = scope.launch { transition.animateTo(expanded, tween(PlayerTransitionDurationMs)) }
    }
}
