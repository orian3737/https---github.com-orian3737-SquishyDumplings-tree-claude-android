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

class MainActivity : ComponentActivity() {
    private val hasOverlayPermission = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hasOverlayPermission.value = canDrawOverlays()

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
        hasOverlayPermission.value = canDrawOverlays()
    }

    private fun canDrawOverlays(): Boolean = Settings.canDrawOverlays(this)
}
