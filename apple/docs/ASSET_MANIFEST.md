# Apple Asset Manifest

Status: living manifest  
Current rendering: project-owned single-frame PNGs plus React Native view effects  
Production pipeline: **pre-rendered 3D**. Models authored in 3D (Meshy), rendered
to ordered 2D sprite frames, layered to build animations. The semantic renderer
contract below is durable and independent of that pipeline.

## Asset strategy

UI and game logic must emit semantic pet states into a renderer interface. They
must not depend on any animation runtime's filenames, artboards, animations, state
machines, or input names. That is what allows PNG states to be replaced one at a
time, and what let the animation system change once already without touching
domain or screen code.

Because the pipeline is pre-rendered, there is no 3D at runtime. The app draws
images. A live 3D runtime would be a separate architectural decision requiring
BUILD_SPEC section 2 to be revised, and is not planned.

Prototype assets are for layout, interaction, and flow validation. They are not
evidence that final animation, timing, transitions, or visual QA is complete.

## Available prototype assets

Shared source directory: `app/sprites/`

| Asset | Size | Format | Prototype use |
|---|---:|---|---|
| `dumpling_idle.png` | 512×512 | Transparent RGBA PNG | Default and unmapped fallback |
| `dumpling_happy.png` | 512×512 | Transparent RGBA PNG | Attention, eating, success |
| `dumpling_sleepy.png` | 512×512 | Transparent RGBA PNG | Low energy, rest, nap |
| `dumpling_hop.png` | 512×512 | Transparent RGBA PNG | Hop and playful reaction |
| `dumpling_sprite_sheet.png` | 1254×1254 | RGBA PNG | Reference only; do not render at runtime |

The runtime Apple copies belong under `apple/assets/prototype/` once the Expo
app is scaffolded. Do not make runtime imports reach outside the Apple project
directory because EAS build context may not include parent files.

## Prototype-only view effects

Until delivered sprite frames arrive, build these with ordinary React Native views
and animations:

- Hearts during rubbing/attention
- Thrown-food arc, landing position, and the dumpling walking over to eat
- Little tappable poop piles and cleanup feedback
- Overlaid need indicators sitting on the habitat rather than in cards
- The bottom action wheel and its collapsed state
- Steam-box opening and steam cloud
- Coin reward and skin-roll reveal effects
- Simple habitat and PiP mini-habitat backgrounds

There is no Stinky-meter fill to build. Cleanliness is expressed by poop-pile
concentration in the environment (BUILD_SPEC FR-4 and FR-5).

Keep these effects behind feature components so a sprite delivery can replace their
visuals without changing domain rules or backend events.

## Semantic pet renderer contract

The app-side contract should support at least:

| Semantic state/event | Required behavior | Prototype fallback |
|---|---|---|
| `idle` | Calm looping base state | Idle PNG |
| `happy` | Positive reaction | Happy PNG |
| `sleepy` | Low-energy/rest state | Sleepy PNG |
| `hop` | Short playful hop | Hop PNG with translation |
| `eat` | Receive and eat food | Happy PNG plus food view effect |
| `attention` | React to rubbing/petting | Happy PNG plus hearts |
| `walk` | Travelling to a landed food item or across the habitat | Idle PNG plus translation |
| `sick` | Brief tummy ache after being overfed | Idle PNG plus wobble |
| `dirty` | Uncomfortable/dirty reaction | Idle PNG plus habitat poop |
| `cleaned` | Relief/cleanup reaction | Happy PNG |
| `evolve` | Evolution transition | Hop PNG plus view effect |
| `dead` | Approved non-graphic death state | Dimmed idle PNG |
| `hatch` | First steam-box reveal | Idle PNG revealed through steam |
| `revive` | Steam-box revival and new skin | New skin revealed through steam |

The renderer also needs numeric need/mood inputs and Reduce Motion behavior. Any
asset-specific naming stays inside the renderer adapter.

## Pre-rendered sprite delivery contract

This is the active contract. Record these for every delivered animation state:

| Field | Requirement |
|---|---|
| Semantic state | One of the states in the table above |
| Layer | `base` or a skin id, plus z-order |
| Rig version | The base rig the frames were rendered against; see the skin rules |
| Frame count | Ordered frames; must match the base for that state exactly |
| Frame rate | Target fps for playback; see the frame budget |
| Loop or one-shot | One-shots must report completion so the renderer can settle |
| Settle state | Which semantic state a one-shot resolves into |
| Canvas and anchor | Identical canvas and registration point across every frame in a state |
| Reduce Motion frame | Which frame index the renderer holds |
| Packing | Delivered as a packed atlas, not loose per-frame files |
| Provenance | Tool, version, and whether the source model is project-owned |

Rules the pipeline has to respect:

- **Identical canvas and anchor across all frames of a state.** A drifting
  registration point makes the dumpling jitter, and it is invisible in review until
  it is animating in the habitat.
- **One registration point across every state, not just within a state.** The
  prototype PNGs fail this and it has already cost real time: `idle`, `sleepy`, and
  `tongue` centre the character on 0.5275 of the box, while `happy` and `hop` centre
  near 0.467 and `wave` and `squat` land in between, and the sleepy frame sits 0.073
  higher in its box than idle. Anything worn on the pet — the sleep mask today, skins
  in PR 10 — has to be placed against a measured anchor, so an inconsistent one means
  either a per-frame anchor table or a visibly sliding overlay. Today's overlays dodge
  this only because they appear on the sleepy frame alone; see
  `src/components/pet-art-geometry.ts`, which is the measured anchor and the test that
  keeps it honest.
- **Atlas packing is required.** Loose per-frame PNGs inflate the bundle and make
  Metro's asset registry noisy.
- **Reduce Motion.** Every state needs a designated single representative frame the
  renderer holds instead of playing the sequence.
- **Oldest supported iPhone.** Measure decode and draw cost for the busiest habitat
  moment — walking to food while poop piles are on screen — not for one idle loop.

### Skins are a layer over a shared base

Decided 2026-07-27. A skin is a composited layer drawn over one shared base body,
not a full re-render per skin.

Why: a fix to the walk cycle happens once in the base instead of once per skin, and
adding a skin later does not mean re-rendering and re-shipping the whole dumpling.
It also makes the wardrobe sheet's live preview cheap, since previewing swaps only
the skin layer.

The constraint this creates, and it is the one that will hurt if ignored:

- **Every skin layer must be rendered from the identical camera, rig, and frame
  count as the base state it draws over.** A skin one frame short, or rendered from
  a nudged camera, slides against the base and reads as broken.
- **Record a rig version on the base and on every skin.** A base rig change
  invalidates every skin rendered against the previous version. Without a recorded
  version this desync is silent and only shows up in the habitat.
- **Skins decorate within the base silhouette.** Recoloring, patterns, and
  accessories that sit inside the body outline compose safely. A skin that changes
  the dumpling's silhouette cannot be a pure overlay — it needs an explicit
  full-replacement layer for the states where it differs, declared per skin.
- Layers share one frame clock. The renderer advances a single frame index and draws
  every layer at that index, so mismatched lengths are a delivery error, not
  something the renderer papers over.

### Frame budget

The requirement is that motion never reads as choppy. That is not one frame rate,
because a breathing idle and a sprint need different treatment. Derive the budget
from the behavior durations in `src/domain/behavior.ts`.

**Looping ambient states — author a short seamless loop, not the full duration.**

A 6-second nap at 12fps is 72 unique frames, doubled by the skin layer. Instead
author an 8–16 frame seamless cycle and repeat it for the behavior's duration. Frame
count is the loop length, not the duration, and this is what keeps the budget sane.

| Kind | Frames | Rate | Notes |
|---|---|---|---|
| Near-static loop (idle-sit, nap, sleepy) | 8–16 | 8–12fps | Must loop seamlessly; first and last frame have to join invisibly |
| Moving loop (waddle, pace) | 12–16 | 12–16fps | Anything with visible translation needs 12fps minimum or it strobes |
| Playful expression loop (tongue-out, wave, squat) | 8–16 | 12–16fps | Keep the face readable and settle back into the shared idle pose |

**One-shot reactions — author the full sequence, but keep them short.**

| Kind | Frames | Rate | Notes |
|---|---|---|---|
| Fast one-shot (hop, sprint, wobble) | up to 24–30 | 24–30fps | These are where choppiness is most visible; do not economize here |
| Slower one-shot (stretch, yawn, eat, sick) | 12–24 | 12–24fps | Settles into a shared pose |

Hard floors:

- Nothing below 12fps if the sprite visibly translates or changes pose quickly.
- 8fps is acceptable only for near-static breathing.
- One-shots stay at or under about one second, matching the existing behavior
  durations, so the frame count stays bounded.
- Avoid authored transition sequences between states. Settle one-shots into a shared
  pose so states can be entered and left without a matrix of transitions.

Acceptance is measured, not eyeballed in isolation: play the busiest habitat moment
on the oldest supported iPhone and confirm no dropped frames and no visible strobing
with the skin layer composited.

Renderer work this implies, currently unbuilt: `PetRenderer` shows one static image
per state. It needs ordered frame playback, layer compositing, loop/one-shot
handling with a completion callback, and the Reduce Motion hold. That lands with
the first real delivery; single-frame PNGs carry PR 3 and PR 4 prototyping until
then.

## Still needed

- First pre-rendered sprite delivery for one state, end to end, base plus one skin
  layer, to validate the contract above before bulk production
- A recorded base rig version, so skin desync is detectable rather than silent
- Final habitat backgrounds, sized for a full-screen environment rather than a
  card
- Steam-box art
- Production replacements for the prototype tongue-out, wave, and squat frames
- Food assets: pork chop, mixed vegetables, tofu, and scallion. Each needs a
  thrown state and an in-habitat landed state at a smaller canvas than the
  dumpling (256×256 is the working assumption). Mixed vegetables stands in for the
  pork chop on a vegetarian or vegan diet, so it needs the same treatment as a
  first-class item rather than reading as a downgrade. No per-item wheel icons are
  needed: the throw is random, so the feed segment shows one icon.
- A tummy-ache reaction for overfeeding, distinct from the over-petting annoyed
  state
- Poop-pile art at the densities the cleanliness curve produces, since pile
  concentration is now the only cleanliness display
- Action wheel furniture: segment backgrounds, three segment icons (feed, clean,
  wardrobe), and the collapsed state
- A quiet habitat-corner control for settings, kept low-emphasis so it does not
  compete with the wheel
- Overlaid need-indicator treatment that stays legible against every habitat
  background
- Coin and roll-tier visuals
- Skin catalog thumbnails for the wardrobe sheet, plus owned, equipped, and
  previewing treatments for each row
- App icon and splash assets
- Audio and haptic direction
