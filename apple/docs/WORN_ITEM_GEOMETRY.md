# Worn Item Geometry

How to place something _on_ the dumpling — a hat, glasses, a scarf, a held prop — so it
lands on the character instead of near it.

This is the method the sleep mask uses. It exists because the obvious approach is wrong
in a way you cannot see until you look closely, and then cannot unsee.

## The trap

The dumpling is not drawn in the middle of its own sprite box.

Every prototype PNG is 512×512, and the character sits at **x = 0.5275** of that box on
the frames we currently draw over — not 0.5. An overlay built symmetric around the
middle of the box therefore sits about 2.75% of the sprite's width left of the face. On
the habitat's 184pt pet that is a 5pt slip. Across a 92pt-wide sleep mask, that is
plainly visible: the pad sits off the eyes and the strap hangs into empty space past one
cheek while falling short of the other.

The same trap has a second form. The habitat centres the pet's _layout box_ on its walk
position, so a separate element centred the same way — the Do Not Disturb sign — drifts
off the character by the same amount.

**Never assume 0.5. Measure.**

## The coordinate system

All geometry is expressed as **fractions of the sprite box**, never in points.

```ts
export type ArtRect = Readonly<{
  left: number; // 0..1
  top: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}>;
```

Fractions work because `PetRenderer` draws the sprite with `contentFit="contain"` into a
square `size × size` box, and the art is square. Under those two conditions the image
exactly fills the box, so a fraction of the box is a fraction of the art. Multiply by
`size` at render time and the item tracks the pet at any scale — including the habitat's
depth scaling, which changes `size` as the dumpling walks toward and away from the
camera.

> If a future sprite is ever non-square, or the renderer stops using `contain`, this
> equivalence breaks and every worn item silently misplaces. That assumption is stated
> in `pet-art-geometry.ts` — update it there if it changes.

## Where the constants live

`src/components/pet-art-geometry.ts` is the single source of truth. It holds:

| Constant                     | Meaning                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `PET_ART_CENTER_X`           | Horizontal centre of the character                                  |
| `PET_ART_EYE_LINE_Y`         | Vertical centre of the closed eyes                                  |
| `PET_ART_HEAD_WIDTH_AT_EYES` | Silhouette width at the eye line                                    |
| `PET_ART_OUTLINE_WIDTH`      | Thickness of the character's dark outline                           |
| `PET_ART_CENTER_OFFSET`      | `PET_ART_CENTER_X - 0.5`, for callers positioning a sibling element |

The module deliberately imports nothing from React Native, so the measurements can be
checked in a plain Node test.

## Step 1 — Measure the anchor

Do not eyeball this off a screenshot. Decode the actual PNG and measure it.

`pet-art-geometry.test.ts` contains a small PNG decoder built on `node:zlib` — the
prototype assets are 8-bit RGBA and non-interlaced, so no image dependency is needed.
Reuse its `decodePng`, `silhouetteRow`, and `isInk` helpers.

For a new attachment point you generally need two things:

**The silhouette span at the row you are attaching to**, which gives both the centre and
the available width:

```ts
const bitmap = loadFrame('sleepy');
const row = silhouetteRow(bitmap, 0.46); // { center, width } in fractions
```

**The feature you are aligning to**, found by looking for ink — opaque, dark pixels —
inside the face region. The eyes, mouth, and outline are all ink; group the pixels into
column runs and the outermost two runs are the eyes.

Sample several rows rather than one. The body narrows going up, so a single row will
happily tell you an item fits when its top corners actually hang off the character.

## Step 2 — Build the rect from the anchor

Never write a literal `left`. Derive it, so the intent survives a re-measure:

```ts
const centredOnFace = (width: number, height: number): ArtRect => ({
  height,
  left: PET_ART_CENTER_X - width / 2,
  top: PET_ART_EYE_LINE_Y - height / 2,
  width,
});

export const SLEEP_MASK_PAD: ArtRect = centredOnFace(0.5, 0.15);
```

A hat sits on the crown rather than the eye line, so it wants its own helper anchored to
a measured `PET_ART_CROWN_Y` — same shape, different vertical anchor.

### The outline rule

Anything spanning the full width of the head must stop **at least one
`PET_ART_OUTLINE_WIDTH` short on each side**:

```ts
export const SLEEP_MASK_STRAP: ArtRect = centredOnFace(
  PET_ART_HEAD_WIDTH_AT_EYES - 2 * PET_ART_OUTLINE_WIDTH,
  0.045,
);
```

Drawn out to the exact silhouette width, the item's ends cover the character's dark
outline. The break in that edge reads as the item being driven _through_ the dumpling.
Going much narrower is also wrong — the ends then float inside the body instead of
disappearing behind it. One outline width is the value that reads correctly; it was
picked by rendering the alternatives and looking at them, not by taste.

## Step 3 — Render it

Scale the rect to points and position it absolutely:

```ts
function rectStyle(rect: ArtRect, size: number) {
  return {
    height: size * rect.height,
    left: size * rect.left,
    top: size * rect.top,
    width: size * rect.width,
  } as const;
}
```

**Put the item inside the motion wrapper, not beside it.** In `PetRenderer` the sprite
and everything worn over it live in the same `Animated.View`, so the item inherits the
squash, stretch, and tilt from `usePetMotion`. An item mounted as a sibling stays rigid
while the dumpling breathes underneath it, and slides around on top of it.

```tsx
<Animated.View style={{ height: size, width: size, transformOrigin: 'bottom', ...motion }}>
  <Image source={...} style={{ height: size, width: size }} />
  <MyWornItem size={size} />
</Animated.View>
```

Z-order is document order. Glasses go after the sprite; something the dumpling stands
behind would go before it.

### Fade timing

If the item fades in and out, match its duration to the sprite cross-fade
(`SPRITE_FADE_MS`). The frames are not vertically aligned with each other — the sleepy
frame sits 0.073 higher in its box than idle — so during a state change the item is
briefly over art it was not measured against. An item that outlasts the swap finishes
its fade sitting in the wrong place.

## Step 4 — Positioning a sibling element instead

Some things are not worn on the pet but must line up with it — the Do Not Disturb sign
stands on the floor in front of the dumpling. Those are positioned by the _caller_, and
there are two separate traps.

**Use the offset.** The caller centres the pet's box, so shift by the art's own
off-centre centre:

```tsx
translateX: petSize * PET_ART_CENTER_OFFSET - SIGN_WIDTH / 2;
```

**Do not apply a scale twice.** If the child scales itself with a transform, its _layout
box stays full size_, and `transformOrigin` decides which point is pinned. The sign uses
`transformOrigin: 'bottom'`, which pins the bottom-centre of the unscaled box — so the
caller must offset by the **unscaled** dimensions:

```tsx
top: petFeetY + 2 - SIGN_HEIGHT,          // not SIGN_HEIGHT * depthScale
```

Multiplying by the scale here double-counts it. That bug sank the sign roughly 11pt
below the floor line and slid it 7pt sideways at the far depth scale, and it looked
plausible enough at scale 1.0 to survive review.

## Step 5 — Test against the real pixels

Constants that describe art must be tested against that art, or they rot the first time
a sprite is redelivered. `pet-art-geometry.test.ts` asserts:

- The measured centre matches the constant, across several frames and several rows.
- The eye line actually falls on the eyes.
- The item covers what it is supposed to cover — every eye pixel is inside the pad.
- The item stays on the character across its **full height**, not just its centre row.
- It clears the outline on both sides.
- It is wider than the feature it covers but narrower than the head, so it reads as worn
  rather than cut to fit or swallowing the character.

Allow about one source pixel (`1 / 512`) of slack. The exported constants are rounded
and the silhouette is not perfectly symmetric, so demanding exact agreement asserts
precision the measurements do not have.

**Verify the test can fail.** Temporarily set the anchor back to `0.5`, run the suite,
and confirm it goes red. A geometry test that passes against wrong constants is worse
than no test.

### Also look at it

Measurement alone missed something real here: the strap's ends were fully on the
character by every numeric check, but they _covered the outline_, which reads as the
strap bursting out of the dumpling. Composite the geometry over the real PNG and look at
the picture before calling it done. Scripts to do this offline — no simulator, no dev
server — are straightforward with Pillow, replicating the same rect math.

## The constraint on multi-state items

Everything above is currently scoped to the **sleepy frame**, because both of today's
overlays appear only while the pet is asleep.

That scoping is not a convenience. The prototype frames are not framed consistently with
each other:

| Frame                      | Centre     |
| -------------------------- | ---------- |
| `idle`, `sleepy`, `tongue` | 0.5275     |
| `wave`, `squat`            | ~0.51–0.52 |
| `happy`, `hop`             | ~0.467     |

An item worn across _all_ states — skins, a permanent hat — cannot be placed by one
anchor against art framed like this. It would visibly jump sideways whenever the
dumpling got happy. Two ways out:

1. **Fix the art.** One registration point across every state. This is recorded as a
   requirement in `ASSET_MANIFEST.md`, and it is the right answer for the real sprite
   delivery.
2. **Per-frame anchor table.** Replace the single constant with a `Record<PrototypeFrame,
ArtRect>` measured per frame. Works, but it multiplies the measurement burden by the
   frame count and has to be redone on every delivery.

Prefer (1). Do not ship a worn item across inconsistently-framed states and hope.

## Checklist

- [ ] Anchor measured from the actual PNG, not estimated
- [ ] Geometry expressed as fractions, derived from the anchor, no literal `left`
- [ ] Full-width items inset by at least one outline width per side
- [ ] Rendered inside the motion wrapper so it moves with the pet
- [ ] Fade duration matches the sprite cross-fade
- [ ] Sibling elements use `PET_ART_CENTER_OFFSET` and do not double-apply a scale
- [ ] Tests measure the real asset and cover the item's full extent
- [ ] Test confirmed to fail when the anchor is wrong
- [ ] Composited over the sprite and visually checked
- [ ] If worn across multiple states, framing consistency confirmed first

## Reference

- `src/components/pet-art-geometry.ts` — the constants and rects
- `src/components/pet-art-geometry.test.ts` — the PNG decoder and the assertions
- `src/components/pet-renderer.tsx` — `rectStyle` and how the mask is mounted
- `src/app/habitat.tsx` — the Do Not Disturb sign, as the sibling-element example
- `docs/ASSET_MANIFEST.md` — the sprite delivery contract, including the framing rule
