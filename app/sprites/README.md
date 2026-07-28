# Dumpling sprite assets

Android-ready transparent PNG assets for the dumpling overlay prototype.

Art the code needs but does not have yet is tracked in `SPRITES_NEEDED.md`.

## Files

- `dumpling_idle.png` — neutral default state
- `dumpling_happy.png` — happy tap reaction
- `dumpling_sleepy.png` — sleepy state
- `dumpling_hop.png` — raised-arm expression for the hop animation
- `dumpling_sprite_sheet.png` — 2×2 reference sheet (idle, happy, sleepy, hop)

Each individual asset is a 512×512 PNG with transparency and identical canvas sizing. Keep the filenames lowercase so they are valid Android drawable resource names.

## Android placement

Copy the four individual PNG files into:

`app/src/main/res/drawable-nodpi/`

Use `drawable-nodpi` so Android does not apply density-based bitmap scaling. Control the displayed overlay size in Compose or the overlay view.

## Suggested state mapping

```kotlin
enum class DumplingExpression {
    IDLE,
    HAPPY,
    SLEEPY,
    HOP
}
```

Map the values to `R.drawable.dumpling_idle`, `R.drawable.dumpling_happy`, `R.drawable.dumpling_sleepy`, and `R.drawable.dumpling_hop`.

On tap, show `HOP` while translating the sprite upward and back down, briefly show `HAPPY`, then return to `IDLE`. The PNG itself should not be stretched or squashed during state changes unless that motion is intentional.
