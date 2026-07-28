# Feature Audit

Status reflects the repository as inspected and checked on 2026-07-28.

| Capability                          | Android prototype                    | Reusable for Apple                         | Apple MVP disposition                                          |
| ----------------------------------- | ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| Single persistent dumpling identity | Android has one saved pet            | Ported; enforced in code and in Postgres   | Done — unique index per owner                                  |
| Four needs                          | Implemented                          | Ported values and action math              | Done — cleanliness is internal only                            |
| Time decay formula                  | Function exists, not scheduled       | Elapsed-time approach ported               | Live; rates and offline cap remain unapproved                  |
| Local persistence                   | SharedPreferences                    | Behavior only, not code                    | Done — expo-sqlite behind a storage port                       |
| Rarity roll                         | Client-side weighted roll            | Odds ported; server roll live              | hatch_pet rolls rarity; client skin ID still needs validation  |
| Evolution                           | Basic gate/action                    | Rules ported with a blocked-reason         | Engine done; no UI yet (PR 5)                                  |
| Personality tags                    | Model only                           | Port enum                                  | Persist now; deeper behavior later                             |
| Ambient behavior graph              | Implemented                          | Ported as a pure picker                    | Live — expressions, bobbing, hops, naps, and safe-area walking |
| Pet artwork                         | Four PNG expressions now implemented | Project-owned and reusable                 | MVP starting point                                             |
| Sprite animation                    | Single-frame PNGs only               | Pre-rendered frames arrive incrementally   | Procedural motion live; frames in PR 10                        |
| Home/habitat                        | Basic Compose screen                 | Concept only; Apple went environment-first | Done — full-screen room, overlaid HUD                          |
| Unboxing/reveal                     | Model factory only                   | Concept                                    | Done — steam-box reveal with odds shown                        |
| Steam-box hatch                     | Not implemented                      | Product direction                          | Done — idempotent across taps and relaunch                     |
| Gesture feeding/attention           | Not implemented                      | None                                       | Done — flick to throw, rub to pet                              |
| Poop cleanup                        | Not implemented                      | None                                       | Done — scrub to clean; density, no meter                       |
| Habitat action wheel                | Not applicable                       | None                                       | Done — drag-spin glass wheel, no tab bar                       |
| First-habitat care tutorial         | Not implemented                      | None                                       | Done — feed, clean, pet, sleep; skippable and persisted        |
| Death and steam-box revival         | Not implemented                      | None                                       | Scope confirmation required                                    |
| Android overlay                     | Implemented                          | Not portable                               | No iOS parity                                                  |
| PiP mini habitat                    | Not implemented                      | Product direction                          | MVP timing unresolved                                          |
| Widgets/Live Activities             | Not applicable                       | None                                       | Post-MVP                                                       |
| Authentication                      | Not implemented                      | None                                       | Email/password and persisted session live; deletion remains    |
| Supabase                            | Not implemented                      | Schema and adapters implemented            | Connected; hosted fresh-account hatch still needs E2E proof    |
| Offline sync                        | Not implemented                      | None                                       | Local-first care and backup sync implemented                   |
| AI chat                             | Not implemented                      | None                                       | Deferred                                                       |
| Purchases                           | Not implemented                      | Rarity-policy note only                    | Deferred                                                       |
| Initial/revival skin rolls          | Not implemented                      | Rarity concept only                        | Required if revival ships                                      |
| Skin inventory/wardrobe             | Not implemented                      | None                                       | Stable read-only sheet; equip/preview PR 8                     |
| Daily happiness coins               | Not implemented                      | None                                       | Required                                                       |
| Tiered coin skin rolls              | Not implemented                      | Rarity concept only                        | Required                                                       |
| Web coin packs                      | Not implemented                      | Shared Supabase identity and ledger        | PR 8.5; storefront-gated web flow                              |
| Opt-in rewarded ads                 | Not implemented                      | None                                       | Planned commercial-launch PR 8.5; store-only and capped        |
| Push notifications                  | Android service notification only    | Product intent only                        | MVP timing unresolved                                          |
| Settings/privacy                    | Not implemented                      | None                                       | Bedtime and sign-out live; deletion/privacy work remains       |
| Accessibility                       | Minimal/default Compose semantics    | Product intent only                        | Labels, tap fallbacks, Reduce Motion done                      |
| Automated tests                     | Not present                          | None                                       | 617 tests + 21 SQL security assertions                         |
| CI/release automation               | Not present                          | None                                       | Apple path-filtered CI added                                   |

## Asset audit

The Android tree now contains transparent PNG expressions in `app/sprites/`:
idle, happy, sleepy, hop, tongue-out, wave, and squat at 512×512, plus a
1254×1254 reference sheet.
They share a consistent canvas and are technically suitable for an Apple
prototype. A 1024×1024 opaque Apple icon candidate and configured launch splash
now live under `apple/assets/`; final brand approval is still required. The
repository still has no delivered sprite frames, fonts, or audio. The repository
owner has confirmed the sprites are project-owned, first-party assets approved
for Apple reuse.

Use PNGs and simple React Native effects only as view prototypes. Production pet
motion is pre-rendered 3D exported as ordered 2D sprite frames, mapped through the
semantic contract in `ASSET_MANIFEST.md`.

For these and future assets:

1. Record whether each asset is project-owned or third-party.
2. Keep editable/source files separate from runtime exports.
3. Record dimensions, color profile, compression, and animation state names.
4. Preserve a single canonical asset ID across Android, Apple, and Supabase.
5. Optimize Apple copies rather than referencing Android resource folders.

## Backend audit required

Before creating migrations or connecting client code, inspect the selected
Supabase project for:

- Existing tables, functions, triggers, storage buckets, and Edge Functions
- Auth providers and redirect/deep-link configuration
- RLS status and policies
- Existing Android contracts the Apple schema must preserve
- Development versus production separation
- Secrets and environment ownership
- Backup, migration, and rollback process

Propose migrations for review before running them. The foundation migration followed
this: written, verified against a local Postgres with RLS active, reviewed, and then
applied by the repository owner rather than by an agent.

## Apple implementation status

Repository checks are current as of 2026-07-28. The last recorded simulator and
physical-device reviews predate the newest sleep visuals and PR 7 integration.

Implemented:

- Expo SDK 57, Expo Router, strict TypeScript, path-filtered CI
- A platform-neutral domain engine with time and randomness injected throughout, and
  the one-dumpling invariant enforced structurally rather than by convention
- The hatch journey: session-restore routing, naming, the optional diet choice, odds
  disclosed before the roll, steam-box reveal, local persistence
- The habitat: full-screen illustrated room, overlaid need indicators, drag-spin glass
  action wheel, flick-to-feed with walk-over-and-eat, delayed messes the dumpling
  wanders off to leave, scrub-to-clean, rub-to-pet, stable wardrobe sheet, and a
  persisted first-visit tutorial for feed, clean, pet, and sleep
- Procedural pet motion driven by semantic animation states
- Sleep stasis that halts ambient work and refuses throws, with periodic `zzz`, a
  view-based sleep mask, and a floor-planted Do Not Disturb sign
- Attention feedback that reserves hearts for successful care, uses crosses for
  sated or messy outcomes, and reserves `zzz` for exhaustion and sleep
- Supabase email/password auth, persisted sessions, the server `hatch_pet` path,
  and local-first backup sync
- A Supabase schema applied to the linked project, with two-user isolation,
  idempotent hatching, and anonymous lockout proven by 21 SQL assertions against
  real Postgres

Not yet complete:

- A hosted clean-account sign-up/hatch pass, account deletion, and server validation
  of the first skin supplied to `hatch_pet` (remaining PR 7)
- Visual approval of the sleep mask alignment and Do Not Disturb sign placement
- Lifecycle, death, and revival (PR 5)
- Coins, tiered rolls, and wardrobe equip (PR 8)
- Frame playback and layer compositing for delivered sprites (PR 10)

Still unapproved, and now visible on screen: the poop-density curve, the attention
energy cost, and the decay schedule with its offline cap. All three are injected
`PROVISIONAL_*` configuration rather than baked into the engine.
