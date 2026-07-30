package com.dumplings.pet

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

class SquishyDumplingsApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createOverlayNotificationChannel()
        setupPostHog()
    }

    private fun setupPostHog() {
        val apiKey = BuildConfig.POSTHOG_PROJECT_TOKEN
        val host = BuildConfig.POSTHOG_HOST
        if (apiKey.isEmpty()) {
            if (BuildConfig.DEBUG) {
                error("POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured")
            }
            return
        }
        val config = PostHogAndroidConfig(
            apiKey = apiKey,
            host = host.ifEmpty { "https://us.i.posthog.com" }
        ).apply {
            captureApplicationLifecycleEvents = true
            captureScreenViews = true
            captureDeepLinks = true
            errorTrackingConfig.autoCapture = true
        }
        PostHogAndroid.setup(this, config)
    }

    private fun createOverlayNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                OVERLAY_CHANNEL_ID,
                "Dumpling companion",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shown while your dumpling is out and about on your screen."
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val OVERLAY_CHANNEL_ID = "dumpling_overlay_channel"
    }
}
