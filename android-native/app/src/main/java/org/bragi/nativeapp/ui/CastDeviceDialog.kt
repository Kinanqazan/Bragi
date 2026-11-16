package org.bragi.nativeapp.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastContext

@Composable
fun rememberCastSelected(): Boolean {
    val context = LocalContext.current
    val router = remember { runCatching {
        CastContext.getSharedInstance(context)
        MediaRouter.getInstance(context)
    }.getOrNull() }
    val selector = remember { MediaRouteSelector.Builder()
        .addControlCategory(CastMediaControlIntent.categoryForCast(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID))
        .build() }
    fun isCastSelected(): Boolean {
        val route = router?.selectedRoute ?: return false
        if (route.isDefault) return false
        return route.matchesSelector(selector) || route.selectedRoutesInGroup.any { it.matchesSelector(selector) } ||
            router.routes.any { it.name == route.name && it.matchesSelector(selector) }
    }
    var selected by remember(router) { mutableStateOf(isCastSelected()) }
    DisposableEffect(router) {
        fun update() { selected = isCastSelected() }
        val callback = object : MediaRouter.Callback() {
            override fun onRouteSelected(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
            override fun onRouteUnselected(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
            override fun onRouteChanged(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
        }
        router?.addCallback(selector, callback, MediaRouter.CALLBACK_FLAG_UNFILTERED_EVENTS)
        update()
        onDispose { router?.removeCallback(callback) }
    }
    return selected
}

@Composable
fun CastDeviceDialog(currentTrackId: String?, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val router = remember { runCatching {
        CastContext.getSharedInstance(context)
        MediaRouter.getInstance(context)
    }.getOrNull() }
    val selector = remember { MediaRouteSelector.Builder()
        .addControlCategory(CastMediaControlIntent.categoryForCast(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID))
        .build() }
    var routes by remember { mutableStateOf(emptyList<MediaRouter.RouteInfo>()) }
    var selectedIds by remember { mutableStateOf(emptySet<String>()) }
    var phoneSelected by remember { mutableStateOf(true) }
    DisposableEffect(router) {
        fun update() {
            routes = router?.routes?.filter { it.isEnabled && !it.isDefault && it.matchesSelector(selector) } ?: emptyList()
            val selected = router?.selectedRoute
            phoneSelected = selected?.isDefault != false
            selectedIds = when {
                phoneSelected || selected == null -> emptySet()
                routes.any { it.id == selected.id } -> setOf(selected.id)
                // Cast can select a temporary group route for a discovered device.
                routes.count { it.name == selected.name } == 1 -> setOf(routes.first { it.name == selected.name }.id)
                else -> selected.selectedRoutesInGroup.map { it.id }.toSet()
            }
        }
        val callback = object : MediaRouter.Callback() {
            override fun onRouteAdded(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
            override fun onRouteRemoved(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
            override fun onRouteChanged(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
            override fun onRouteSelected(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
            override fun onRouteUnselected(router: MediaRouter, route: MediaRouter.RouteInfo) = update()
        }
        router?.addCallback(selector, callback, MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN)
        update()
        onDispose { router?.removeCallback(callback) }
    }
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(24.dp)) {
                Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    CastDeviceRow("This phone", BragiIcon.Phone, selected = phoneSelected) {
                        router?.unselect(MediaRouter.UNSELECT_REASON_STOPPED)
                    }
                    if (router == null) Text("Google Cast is unavailable on this device.", Modifier.padding(vertical = 8.dp), style = MaterialTheme.typography.bodyMedium)
                    else if (routes.isEmpty()) Text("Looking for Cast devices on your network…", Modifier.padding(vertical = 8.dp), style = MaterialTheme.typography.bodyMedium)
                    routes.forEach { route ->
                        CastDeviceRow(route.name, BragiIcon.Cast, selected = route.id in selectedIds,
                            enabled = currentTrackId?.startsWith("device:") != true) { router?.selectRoute(route) }
                    }
                    if (currentTrackId?.startsWith("device:") == true) {
                        Text("Phone files cannot currently be played on Cast devices. Choose a server song to cast.",
                            Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun CastDeviceRow(name: String, icon: BragiIcon, selected: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(shape = RoundedCornerShape(16.dp),
        color = if (selected) colors.primaryContainer else colors.surfaceVariant.copy(alpha = 0.55f),
        border = if (selected) BorderStroke(1.dp, colors.primary) else null,
        modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = { if (!selected) onClick() })
            .heightIn(min = 68.dp).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon.vector, contentDescription = null, modifier = Modifier.size(24.dp),
                tint = if (selected) colors.primary else colors.onSurfaceVariant.copy(alpha = if (enabled) 1f else 0.5f))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium,
                    color = colors.onSurface.copy(alpha = if (enabled) 1f else 0.5f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (selected) Text("Selected", style = MaterialTheme.typography.bodySmall, color = colors.primary)
            }
        }
    }
}
