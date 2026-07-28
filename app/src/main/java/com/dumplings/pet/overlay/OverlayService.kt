package com.dumplings.pet.overlay

import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.dumplings.pet.MainActivity
import com.dumplings.pet.SquishyDumplingsApp
import com.dumplings.pet.data.OverlayPositionStore
import com.dumplings.pet.data.PetStore
import com.dumplings.pet.model.PetStats
import com.dumplings.pet.ui.theme.SquishyDumplingsTheme
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * Hosts the pet as a real floating window over other apps (WindowManager
 * overlay), which is what SYSTEM_ALERT_WINDOW actually gives us on Android
 * that iOS can't. This service:
 *  1. Keeps the overlay itself dumpling-sized so it never becomes a large
 *     touch-blocking transparent container.
 *  2. Glides the overlay window around the screen using [BehaviorPicker].
 *  3. Runs as a foreground service with a persistent notification, which
 *     Android requires for anything long-lived and off-screen.
 */
class OverlayService : Service(), LifecycleOwner, ViewModelStoreOwner, SavedStateRegistryOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val viewModelStore = ViewModelStore()
    private val savedStateRegistryController = SavedStateRegistryController.create(this)
    override val savedStateRegistry: SavedStateRegistry get() = savedStateRegistryController.savedStateRegistry

    private lateinit var windowManager: WindowManager
    private lateinit var overlayPositionStore: OverlayPositionStore
    private lateinit var petStore: PetStore
    private var overlayView: ComposeView? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var tapSignal by mutableIntStateOf(0)
    private var userDragging = false

    private val behaviorPicker = BehaviorPicker()
    private var currentStats = PetStats()

    override fun onCreate() {
        super.onCreate()
        savedStateRegistryController.performAttach()
        savedStateRegistryController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayPositionStore = OverlayPositionStore(this)
        petStore = PetStore(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
        if (overlayView == null) addOverlayView()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        removeOverlayView()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        viewModelStore.clear()
        super.onDestroy()
    }

    private fun buildNotification() =
        NotificationCompat.Builder(this, SquishyDumplingsApp.OVERLAY_CHANNEL_ID)
            .setContentTitle("Your dumpling is out")
            .setContentText("Tap to open Squishy Dumplings and check in.")
            .setSmallIcon(android.R.drawable.ic_dialog_info) // TODO: replace with real app icon asset
            .setContentIntent(
                PendingIntent.getActivity(
                    this, 0, Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE
                )
            )
            .setOngoing(true)
            .build()

    private fun addOverlayView() {
        val overlayType =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val savedPosition = overlayPositionStore.load(defaultX = 40, defaultY = 200)
        val params = WindowManager.LayoutParams(
            /* width = */ OVERLAY_WIDTH_DP.dpToPx(),
            /* height = */ OVERLAY_HEIGHT_DP.dpToPx(),
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = savedPosition.first
            y = savedPosition.second
        }
        layoutParams = params

        val composeView = ComposeView(this).apply {
            setViewTreeLifecycleOwner(this@OverlayService)
            setViewTreeViewModelStoreOwner(this@OverlayService)
            setViewTreeSavedStateRegistryOwner(this@OverlayService)
            setOnTouchListener(createDragTouchListener())
            setContent {
                SquishyDumplingsTheme {
                    OverlayPetContent()
                }
            }
        }
        overlayView = composeView
        windowManager.addView(composeView, params)
    }

    private fun removeOverlayView() {
        overlayView?.let { windowManager.removeView(it) }
        overlayView = null
    }

    private fun createDragTouchListener(): View.OnTouchListener {
        val touchSlop = ViewConfiguration.get(this).scaledTouchSlop
        var startRawX = 0f
        var startRawY = 0f
        var startWindowX = 0
        var startWindowY = 0
        var moved = false

        return View.OnTouchListener { _, event ->
            val params = layoutParams ?: return@OnTouchListener false

            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    userDragging = true
                    startRawX = event.rawX
                    startRawY = event.rawY
                    startWindowX = params.x
                    startWindowY = params.y
                    moved = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - startRawX).roundToInt()
                    val dy = (event.rawY - startRawY).roundToInt()
                    if (abs(dx) > touchSlop || abs(dy) > touchSlop) moved = true
                    params.x = startWindowX + dx
                    params.y = startWindowY + dy
                    overlayView?.let { windowManager.updateViewLayout(it, params) }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    userDragging = false
                    overlayPositionStore.save(params.x, params.y)
                    if (!moved && event.actionMasked == MotionEvent.ACTION_UP) {
                        tapSignal += 1
                    }
                    true
                }

                else -> false
            }
        }
    }

    private suspend fun glideWindowBy(deltaX: Int, deltaY: Int, durationMillis: Long) {
        val params = layoutParams ?: return
        val startX = params.x
        val startY = params.y
        val target = clampOverlayPosition(startX + deltaX, startY + deltaY)
        val frameCount = (durationMillis / FRAME_DURATION_MS).coerceAtLeast(1)

        repeat(frameCount.toInt()) { frame ->
            if (userDragging) return

            val progress = (frame + 1f) / frameCount
            val eased = FastOutSlowInEasing.transform(progress)
            params.x = (startX + ((target.first - startX) * eased)).roundToInt()
            params.y = (startY + ((target.second - startY) * eased)).roundToInt()
            overlayView?.let { windowManager.updateViewLayout(it, params) }
            delay(FRAME_DURATION_MS)
        }

        overlayPositionStore.save(params.x, params.y)
    }

    private fun clampOverlayPosition(x: Int, y: Int): Pair<Int, Int> {
        val screenWidth = resources.displayMetrics.widthPixels
        val screenHeight = resources.displayMetrics.heightPixels
        val maxX = (screenWidth - OVERLAY_WIDTH_DP.dpToPx()).coerceAtLeast(0)
        val maxY = (screenHeight - OVERLAY_HEIGHT_DP.dpToPx()).coerceAtLeast(0)
        return x.coerceIn(0, maxX) to y.coerceIn(0, maxY)
    }

    private fun Int.dpToPx(): Int =
        (this * resources.displayMetrics.density).toInt()

    /** The actual floating pet UI. Picks a new behavior and glides the window on a timer. */
    @androidx.compose.runtime.Composable
    private fun OverlayPetContent() {
        var ambientExpression by remember { mutableStateOf(DumplingExpression.IDLE) }
        var reactionExpression by remember { mutableStateOf<DumplingExpression?>(null) }
        val offsetX = remember { Animatable(0f) }
        val offsetY = remember { Animatable(0f) }

        LaunchedEffect(Unit) {
            while (true) {
                currentStats = petStore.loadOrCreate(defaultName = "Baozi").stats
                val behavior = behaviorPicker.pickNext(currentStats)
                ambientExpression = behavior.toDumplingExpression()

                when (behavior) {
                    Behavior.WADDLE_LEFT -> glideWindowBy(-72.dpToPx(), 0, behavior.durationMillis)
                    Behavior.WADDLE_RIGHT -> glideWindowBy(72.dpToPx(), 0, behavior.durationMillis)
                    Behavior.PACE -> {
                        val distance = if (Random.nextBoolean()) 120.dpToPx() else (-120).dpToPx()
                        glideWindowBy(distance, Random.nextInt(-24, 25).dpToPx(), behavior.durationMillis)
                    }
                    Behavior.SPRINT -> {
                        val distance = if (Random.nextBoolean()) 160.dpToPx() else (-160).dpToPx()
                        glideWindowBy(distance, Random.nextInt(-18, 19).dpToPx(), behavior.durationMillis)
                    }
                    Behavior.HOP_TRICK, Behavior.WOBBLE -> offsetX.animateTo(0f, tween(300))
                    else -> delay(behavior.durationMillis)
                }

                if (behavior !in setOf(Behavior.WADDLE_LEFT, Behavior.WADDLE_RIGHT, Behavior.PACE, Behavior.SPRINT)) {
                    offsetX.animateTo(0f, tween(200))
                }
            }
        }

        LaunchedEffect(tapSignal) {
            if (tapSignal > 0) {
                reactionExpression = DumplingExpression.HOP
                offsetY.snapTo(0f)
                offsetY.animateTo(-24f, tween(120))
                offsetY.animateTo(0f, tween(220))
                reactionExpression = DumplingExpression.HAPPY
                delay(450)
                reactionExpression = null
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Transparent),
            contentAlignment = Alignment.Center
        ) {
            DumplingSprite(
                expression = reactionExpression ?: ambientExpression,
                modifier = Modifier.offset {
                    IntOffset(offsetX.value.roundToInt(), offsetY.value.roundToInt())
                }
            )
        }
    }

    private fun Behavior.toDumplingExpression(): DumplingExpression =
        when (this) {
            Behavior.NAP, Behavior.YAWN -> DumplingExpression.SLEEPY
            Behavior.HOP_TRICK -> DumplingExpression.HOP
            Behavior.SPRINT, Behavior.STRETCH, Behavior.LOOK_AROUND, Behavior.WOBBLE -> DumplingExpression.HAPPY
            else -> DumplingExpression.IDLE
        }

    companion object {
        private const val NOTIFICATION_ID = 42
        private const val OVERLAY_WIDTH_DP = 132
        private const val OVERLAY_HEIGHT_DP = 124
        private const val FRAME_DURATION_MS = 16L
    }
}
