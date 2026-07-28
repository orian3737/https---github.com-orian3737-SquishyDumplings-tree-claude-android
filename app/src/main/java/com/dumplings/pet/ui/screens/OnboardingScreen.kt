package com.dumplings.pet.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Shown on first launch (or whenever overlay permission is missing). Android
 * won't let us trigger a normal runtime permission dialog for this one - it
 * has to deep-link to system settings, so this screen exists to explain why
 * before dumping the user into a settings page cold.
 */
@Composable
fun OnboardingScreen() {
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "\uD83E\uDD5F",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Your dumpling wants to live on your screen",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "To let your pet wander around while you use other apps, " +
                "Android needs you to grant \"Display over other apps\" " +
                "permission. Squishy Dumplings only uses it to show your pet - never ads.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            )
            context.startActivity(intent)
        }) {
            Text("Grant permission")
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Come back here after granting it - we'll pick up automatically.",
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center
        )
    }

    // Caller (MainActivity) is responsible for re-checking Settings.canDrawOverlays()
    // in onResume once the user returns from Settings.
}
