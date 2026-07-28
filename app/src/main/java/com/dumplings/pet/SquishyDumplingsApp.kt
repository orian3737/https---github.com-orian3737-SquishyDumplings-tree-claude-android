package com.dumplings.pet

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class SquishyDumplingsApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createOverlayNotificationChannel()
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
