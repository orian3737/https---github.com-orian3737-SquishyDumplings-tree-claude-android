# Squishy Dumplings - Android starter project

Kotlin + Jetpack Compose prototype for a Tamagotchi-like dumpling companion
that can float over other Android apps with `WindowManager`.

## Getting It Running

1. Install Android Studio.
2. Open this `SquishyDumplings` folder with **File > Open**.
3. Let Gradle sync and accept any Android Studio version suggestions.
4. Run on a physical Android device. Overlay behavior is more reliable on a
   real phone than on an emulator.
5. Grant "Display over other apps" from the onboarding screen.
6. Tap **Let dumpling roam** from the home screen.

Android 13+ will also ask for notification permission before the foreground
overlay service starts.

## Implemented

- `model/Rarity.kt`: five-tier weighted rarity table.
- `model/PetStats.kt`: hunger, cleanliness, energy, happiness, care actions,
  and elapsed-time decay logic.
- `model/Pet.kt`: pet identity, rarity, evolution stage, stats, personality
  tags, and unboxing factory.
- `data/PetStore.kt`: saves the first pet locally with SharedPreferences so
  rarity, stats, and evolution stage survive app restarts.
- `data/OverlayPositionStore.kt`: saves the floating overlay's last screen
  coordinates locally.
- `overlay/BehaviorGraph.kt`: weighted ambient behavior picker with no
  immediate repeats and stat-biased movement choices.
- `overlay/OverlayService.kt`: foreground service hosting a real
  `TYPE_APPLICATION_OVERLAY` Compose window. The overlay can be dragged, reacts
  to taps with a small hop, saves its position, and glides around the screen
  without resizing into a large touch-blocking container. It displays a 2D
  dumpling sprite from drawable resources and reads saved pet stats from
  `PetStore` before choosing ambient behaviors.
- `ui/screens/OnboardingScreen.kt`: explains the overlay permission and links
  to the Android settings screen.
- `ui/screens/HomeScreen.kt`: stat bars, feed/clean/play/evolve buttons, and
  the start/stop control for ambient companion mode.

The pet art uses the PNG expression sprites in `drawable-nodpi`. Replace those
assets or expand `DumplingSprite()` when adding more animation frames.

## Not Implemented Yet

1. **Real decay ticking.** `PetStats.decayed()` exists, but no periodic job or
   app/service ticker applies it yet.
2. **Polished pet art.** The current sprite placeholders can become richer
   frame animation or later toon-shaded rendered assets.
3. **Unboxing screen.** `Pet.unboxNew()` exists, but there is no reveal flow or
   visible odds-disclosure screen yet.
4. **AI chat.** No backend proxy yet. Do not put provider API keys directly in
   the Android app.
5. **Accounts, cloud sync, purchases, marketplace, or Unity.** Keep those out
   until the overlay prototype feels good.

## Project Layout

```text
app/src/main/java/com/dumplings/pet/
  data/             PetStore and OverlayPositionStore
  model/            Pet, PetStats, Rarity
  overlay/          BehaviorGraph and OverlayService
  ui/screens/       OnboardingScreen and HomeScreen
  ui/theme/         Color and Theme
  MainActivity.kt
  SquishyDumplingsApp.kt
```

## Local Notes

This folder currently does not include a complete Gradle wrapper
(`gradlew.bat` and `gradle-wrapper.jar` are missing), and this shell does not
have Android SDK or Gradle commands on PATH. Android Studio should still be
able to open and sync the project, then it can generate or repair wrapper files
from the IDE.
