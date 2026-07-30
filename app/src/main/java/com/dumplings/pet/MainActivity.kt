package com.dumplings.pet

import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import com.dumplings.pet.ui.screens.HomeScreen
import com.dumplings.pet.ui.screens.OnboardingScreen
import com.dumplings.pet.ui.theme.SquishyDumplingsTheme
import com.posthog.PostHog

class MainActivity : ComponentActivity() {
    private val hasOverlayPermission = mutableStateOf(false)
    private var previousOverlayPermission = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        previousOverlayPermission = canDrawOverlays()
        hasOverlayPermission.value = previousOverlayPermission

        setContent {
            SquishyDumplingsTheme {
                val canFloat by hasOverlayPermission

                if (canFloat) {
                    HomeScreen()
                } else {
                    OnboardingScreen()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        val hasPermission = canDrawOverlays()
        if (hasPermission && !previousOverlayPermission) {
            PostHog.capture(event = "overlay_permission_granted")
        }
        previousOverlayPermission = hasPermission
        hasOverlayPermission.value = hasPermission
    }

    private fun canDrawOverlays(): Boolean = Settings.canDrawOverlays(this)
}
