package com.dumplings.pet.data

import android.content.Context

class OverlayPositionStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(defaultX: Int, defaultY: Int): Pair<Int, Int> {
        val x = prefs.getInt(KEY_X, defaultX)
        val y = prefs.getInt(KEY_Y, defaultY)
        return x to y
    }

    fun save(x: Int, y: Int) {
        prefs.edit()
            .putInt(KEY_X, x)
            .putInt(KEY_Y, y)
            .apply()
    }

    private companion object {
        const val PREFS_NAME = "overlay_position"
        const val KEY_X = "x"
        const val KEY_Y = "y"
    }
}
