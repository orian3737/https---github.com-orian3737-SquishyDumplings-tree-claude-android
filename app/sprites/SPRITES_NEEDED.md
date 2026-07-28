# Sprite backlog

Running log of art the code needs but does not have yet. `README.md` in this
folder documents what already **exists**; this file tracks what is **missing**.

**Maintenance rule:** whenever a feature introduces a new visual state, add a row
here in the same change that introduces it — even if the code ships with a
placeholder. Move the row to `README.md` once the real asset lands, and delete it
from this file.

All assets: 512×512 transparent PNG, identical canvas sizing, lowercase filename
(Android drawable resource names disallow uppercase). Ship into
`app/src/main/res/drawable-nodpi/`.

## Needed

| Sprite | Filename | Needed by | Placeholder in use | Notes |
|---|---|---|---|---|
| Eating | `dumpling_eating.png` | Drag-and-drop feeding (step 3) | `dumpling_happy.png` | Mouth open / mid-chomp. Held ~400ms on a successful food drop, then resolves to `happy`. |
| Annoyed | `dumpling_annoyed.png` | Over-stimulation from petting (step 4) | `dumpling_idle.png` | Turned away or frowning. Must read as "stop" at a glance — it is the only signal the player gets that affection gain has hit zero. |
| Sick | `dumpling_sick.png` | Overfeed tummy ache (Apple habitat) | `dumpling_idle.png` | Queasy, briefly held. Overfeeding is never refused, so this plus the extra poop is the whole signal that food was wasted. Distinct from `annoyed`, which means "stop touching me" rather than "I ate too much". |
| Walk | `dumpling_walk.png` | Travelling to a thrown food item (Apple habitat) | `dumpling_idle.png` | Mid-stride or leaning into the direction of travel. Needed because Apple feeding lands food in the environment and the dumpling walks over to eat it rather than catching it at a fixed mouth target. |
| Food items | `food_pork_chop.png`, `food_mixed_vegetable.png`, `food_tofu.png`, `food_scallion.png` | Thrown item and landed item | none — blocking | Four items. Mixed vegetables replaces the pork chop for a vegetarian or vegan dumpling, so draw it as a first-class dish rather than a consolation side. Smaller canvas than the dumpling (256×256 is likely right). No per-item wheel icons needed — the throw is random, so the feed control shows one icon. Items carry no hunger differences; the only preference is which one the dumpling walks to first, so no `preferredBy` value is needed. |

## Deliberately not needed

Squash-and-stretch during squish/rub is procedural — `graphicsLayer` scale and
rotation applied to the existing sprites. Do not commission deformation frames.

## Deferred

- Evolution stage art. `Pet.evolutionStage` goes to 4 for Legendary and every
  stage currently renders identically, so evolving is invisible. Not blocking the
  feed/pet work.
- Rarity-tinted variants. `Rarity.colorHex` exists and is unused by any sprite.
