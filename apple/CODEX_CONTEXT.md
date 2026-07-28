# Codex Context: Apple App

## Current Objective

Continue the Apple version of Squishy Dumplings as an Expo/React Native iPhone app.

The current branch combines the habitat/reveal polish, the closed care loop, clearer
sleep and attention feedback, and the in-progress Supabase connection. App Store
Connect and EAS setup are complete: build `0.1.0 (1)` was uploaded to App Store Connect,
installed through TestFlight, and reviewed on a physical iPhone under bundle ID
`com.dinosaur5.squishydumplings`. The fixes from that review, tutorial, app icon
candidate, and splash shipped in build `0.1.0 (2)`; its current processing status has
not been rechecked in this handoff.

Since that pass, the **care loop has been closed**. Energy was a one-way ratchet —
petting spent it and nothing anywhere gave any back — and the elapsed-decay path had
never been called at all, so needs only moved when the player acted. Both are fixed,
meals now schedule the messes they produce, messes gate affection, and food lands
where it is thrown. See "The closed care loop" below.

**PR 7 is part-way done and is where the next session picks up.** Auth, session
persistence, the remote adapter, and the backup sync are built, wired, and green; what
is left is listed under "PR 7: where it stopped" below.

Night is now stasis: the dumpling sleeps through a configurable quiet window and
loses nothing while it does, and the daytime rates were slowed to match a real day.
Sleep now also halts the habitat pump, refuses throws, emits periodic `zzz`, adds a
view-based sleep mask, and plants a Do Not Disturb sign at the dumpling's feet.
Blocked attention uses crosses for mess/sated outcomes; only exhaustion keeps `zzz`.

Three sleep-and-icon defects were found and fixed after that work:

- **The mask went on a wide-awake dumpling.** `sleepy` meant both "a bit tired" and "out
  cold", and the mask keyed off it, so any energy under 15 masked a pet that was still
  fully pettable. There is now a distinct `asleep` state; `sleepy` is drowsy-but-awake
  and wears nothing. A test asserts across the whole energy range that the mask boundary
  is exactly the habitat's interaction gate, so the two definitions cannot drift apart
  again. `SLEEPING_ENERGY_THRESHOLD` is renamed `DROWSY_ENERGY_THRESHOLD` for what it
  actually controls.
- **Mask and sign geometry was misplaced.** Both were built symmetric around the middle
  of the sprite box, but the art is drawn 2.75% right of centre, so both sat about 5pt
  left of the face; the strap overhung into empty space past the cheek and covered the
  body outline at its ends; and the sign's base sank below the floor line as the dumpling
  walked back because its depth scale was applied twice. Measurements now live in
  `src/components/pet-art-geometry.ts`, and `pet-art-geometry.test.ts` re-measures the
  shipped PNGs so a redelivered sprite sheet fails rather than silently misplacing
  everything worn on the pet.
- **The onboarding header showed a laundry basket.** It used 🧺, which is the _basket_
  emoji — iOS renders it as a wicker basket with towels. It now renders the real drawn
  `DumplingSteamer`, which gained a `scale` prop for the purpose.

`docs/WORN_ITEM_GEOMETRY.md` writes up the placement method so hats, glasses, and skins
can reuse it instead of rediscovering the off-centre trap.

**None of this has been seen in the simulator.** It was verified by measuring the real
assets and compositing the geometry over them offline, which makes it trustworthy at the
pixel level, but nobody has watched the dumpling fall asleep on a device. Worth a look
during the next simulator pass: the placard covers a fair amount of the dumpling's lower
body at the near depth scale, which the sign's own docstring claims it does not.

The remaining care-tuning gaps are the poop-density curve and the decay rates, which
have never been played across a full week.

## Active Session

- Branch: `codex/apple`
- Backend access: schema applied by the repository owner via `supabase db push`
- Collaboration boundary: Android/Kotlin remains at the repository root;
  Apple-specific work belongs under `apple/` except shared CI

## Current Status

Complete and verified:

- Expo SDK 57, React Native, TypeScript, Expo Router, strict checks, path-filtered CI
- EAS production build `25206024-0147-4538-86e2-bcbec4f1e76b` compiled and
  submission `20e629f7-2fe8-4702-b4ed-7508a3695447` was accepted by App Store
  Connect on 2026-07-27. Build `0.1.0 (1)` was installed on a physical iPhone;
  its review produced the current wardrobe, steam, steamer, expression, and
  zero-energy sleep fixes.
- EAS production build `dd64e76a-5a56-4060-867e-486531e3abd5`
  (`0.1.0 (2)`) compiled successfully and submission
  `7a4b45e1-c2a5-44ac-b1dc-5afc596b965d` was accepted by App Store Connect on
  2026-07-27. Its current processing status and physical-device pass remain
  unverified in this handoff.
- **PR 2** — `src/domain/`: 20 modules of pure TypeScript with `Clock` and
  `RandomSource` injected. Needs, care, elapsed decay, rarity, evolution, lifecycle,
  personality, diet, food, hygiene, ambient behavior, semantic animation states, the
  one-dumpling `Pet`, versioned serialization, storage-agnostic repositories.
- **PR 3** — the hatch journey: session-restore routing, naming, the optional diet
  tap, rarity odds disclosed before the roll, steam-box reveal, local persistence.
- **PR 4** — the habitat: full-screen room, overlaid HUD, drag-spin glass action
  wheel, flick-to-feed with walk-over-and-eat, delayed messes, scrub-to-clean,
  rub-to-pet, and a native wardrobe sheet.
- Simulator-review polish is implemented locally: wardrobe cleanup gate, bounded
  pile placement, bamboo dumpling steamer, full-coverage layered steam, stable
  wardrobe navigation, and ambient tongue-out, wave, squat, face, bob, hop, nap,
  and walking behavior. The steamer now uses authentic cylindrical stacked tiers,
  slatted sides, a cross-woven lid, and a bamboo loop handle. Zero energy is a hard
  sleep mode with no walking, a Do Not Disturb sign, and one automatic Rest
  increment after a 9-second prototype nap.
- A one-time, skippable first-habitat tutorial covers Feed, Clean, Pet, and Sleep.
  Completion persists behind the storage port independently from pet state.
- A generated 1024×1024 opaque dumpling app-icon candidate is configured, with the
  existing transparent dumpling art used on a warm launch splash. Both still need
  final visual approval.
- **PR 6** — both migrations applied locally and to the linked project, with 21
  security assertions passing against real Postgres with RLS active.
- 646 tests, 31 test files. Formatting, lint, and strict typecheck are clean.
- Habitat-hook tests cover pump scheduling, queued meals, cleanup, sleep stasis,
  sleep puffs, attention feedback, unmount cleanup, and movement bounds.
- Production iOS bundle exports; test fixtures confirmed absent from it.

In progress:

- **PR 7** — auth, persisted sessions, the remote repository adapter, backup sync,
  and `hatch_pet` wiring are implemented. Hosted clean-account hatch verification,
  account deletion, and server validation of the client-provided first skin remain.

Not started:

- **PR 5** — lifecycle, death, revival.
- **PR 8** — coins, rolls, wardrobe equip.

## Relevant Files

Domain (`src/domain/`, all platform-neutral, no storage or network):

- `index.ts` barrel — screens and features import from here
- `pet.ts` one-dumpling identity, idempotent hatch, wardrobe, diet, favourite food
- `needs.ts` clamping, mood, neglect · `care.ts` care actions, overfeed, attention
- `decay.ts` elapsed time, clock skew, offline cap, and `advancePet` — the one
  place time is billed · `hygiene.ts` pile count from cleanliness plus the
  screen-reader summary
- `messes.ts` the offline-safe schedule a meal writes onto the pet
- `sleep-schedule.ts` the quiet window, its `LocalTime` port, and formatting
- `diet.ts` omnivore/vegetarian/vegan · `food.ts` food table, diet substitution,
  random pick, eating order
- `behavior.ts` ambient picker · `animation-state.ts` semantic vocabulary
- `rarity.ts`, `evolution.ts`, `lifecycle.ts`, `personality.ts`
- `serialization.ts` versioned snapshot with validation and repair
- `repository.ts` `PetRepository`, `CareEvent`, `CareEventQueue`
- `clock.ts`, `random.ts`, `ids.ts` injected dependencies
- `one-dumpling.test.ts` — the invariant suite. **Extend it whenever a new
  `Pet`-returning operation lands.**
- `__fixtures__/pet.ts` test-only builders, never imported by the app

App and features:

- `src/app/index.tsx` session gate · `_layout.tsx` root stack and repository injection
- `src/app/(onboarding)/` naming, diet, steam-box reveal
- `src/app/habitat.tsx` the habitat surface · `wardrobe.tsx` sheet · `settings.tsx`
- `src/app/unreadable.tsx` the corrupt-cache state, which offers only a retry
- `src/features/session/` session resolver and provider; owns hatch idempotency
- `src/features/habitat/use-habitat-loop.ts` feeding, walking, messes, particles
- `src/features/habitat/use-habitat-loop.test.ts` deterministic hook coverage
- `src/features/habitat/throw-aim.ts` where a flick sends the food
- `src/hooks/use-quiet-hours.ts` ticks the quiet window so the pet visibly settles
- `src/components/settings/bedtime-setting.tsx` the bedtime steppers
- `src/services/pet/pet-repository.ts` local persistence over a storage port
- `src/services/pet/skin-catalog.ts` provisional catalog and first-skin roll
- `src/services/storage/` `KeyValueStore` port plus the one Expo adapter
- `src/services/tutorial/tutorial-progress.ts` one-time tutorial persistence
- `src/components/pet-renderer.tsx` the semantic renderer boundary
- `src/components/use-pet-motion.ts` procedural motion per semantic state
- `src/components/habitat/do-not-disturb-sign.tsx` floor-planted sleep placard
- `src/components/habitat/` scene, wheel, glass, particles, piles, rub surface
- `src/test-support/` Node hook renderer and deterministic animation-frame shim
- `src/components/onboarding/` bamboo steamer and layered steam burst

Backend and docs:

- `supabase/migrations/` — foundation and PR 7 sync migrations, applied locally and
  to the linked project
- `supabase/tests/one_dumpling_security.sql` — 21 assertions against real Postgres
- `docs/BUILD_SPEC.md` product and architecture · `docs/PR_ROADMAP.md` plan
- `docs/ASSET_MANIFEST.md` renderer contract and sprite delivery rules
- `docs/MONETIZATION_STRATEGY.md` coin-pack, rewarded-ad, fairness, and measurement
  direction for commercial launch
- `docs/WEB_COIN_STORE.md` cross-platform checkout, webhook, ledger, security, and
  storefront-release contract for PR 8/8.5
- `../.github/workflows/apple-checks.yml` Apple-only CI

## PR 7: end-to-end on the cloud — PROVEN

The full cloud path works. Verified on 2026-07-28 against the linked project:

1. Sign-up from the app created a real user (`diag01@example.test`), auto-confirmed.
2. `hatch_pet` on the remote returns a complete row — including the new
   `sleep_start_minute: 1320`, `sleep_end_minute: 420`, `pending_messes_at: []`.
3. The app **adopted that server pet through sync** and played it: the habitat showed
   `CurlTest · Classic Steamer · Common` with needs ticking. That is the
   second-device-restore path working for real.
4. Session persistence survives a cold JS reload and a simulator reboot.

**Still unproven: the in-app hatch reveal.** The pet above reached the device through
sync, not onboarding, so the steam animation never ran. Hatching from a clean install
inside the app is the one journey left to watch.

### The config bug worth remembering

`.env` held `https://<ref>.supabase.co/rest/v1/` — the REST endpoint, not the project
URL. supabase-js appends `/auth/v1` itself, so auth calls went to
`.../rest/v1/auth/v1/signup` and failed **without an HTTP status**, which the error
mapper honestly renders as "could not reach the server". A configuration mistake
wearing a network error's clothes, and it would have failed identically in production.
`normalizeSupabaseUrl` now strips a trailing service segment, with 11 tests. `.env` is
gitignored, so every machine fixes its own copy — but now fails loudly.

### The transient failures, and how to diagnose them next time

Several attempts failed with `AuthRetryableFetchError: The network connection was
lost` (status 0) before eventually working. The thing that actually settled it was the
**API Gateway logs** (Logs → API Gateway in the dashboard): they showed `POST
/auth/v1/signup` returning 200 while the client reported failure, which proved
requests were landing and only responses were being lost. Check those logs before
suspecting the app — a client-side "network error" and a server that never heard from
you look identical from the device.

## PR 7: what remains

Done and verified:

- Both migrations are applied to the linked project `wnfprwzgghowwkvibihs`
  (`supabase migration list --linked` shows local and remote both at
  `20260728000001`). 21 SQL assertions pass against real Postgres with RLS active.
- **Email confirmation is OFF** on the hosted project. It was on, which would have
  blocked every new player at sign-up; changed in the dashboard and verified after a
  reload.
- Email + password auth, with `onAuthStateChange` as the single source of truth.
- **Session persistence works.** The Supabase session lives in the same SQLite store
  as the pet cache, so a cold JS reload goes straight to the habitat with no sign-in.
  Verified on device.
- Backup sync: local-first care, five-minute cadence plus foreground, conflicts
  resolved on `lastCaredAtMs`.
- Hatch goes through the `hatch_pet` RPC when a client is present.

Stopped mid-test. The app configuration points at the **cloud** project, but Expo is
not running at this handoff. What has NOT been verified end to end is a fresh sign-up
on the hosted project producing a server pet row through `hatch_pet`.

To resume: `cd apple && npx expo start --port 8001`, open `exp://127.0.0.1:8001`, sign
up with a new address, and confirm a row appears in `public.pets` for that user.

Two things to know before that test:

- The device still holds a local dumpling ("Momo") hatched before auth existed. It has
  no server row, and only `hatch_pet` may create one, so `syncPet` correctly reports
  `awaiting-hatch` and it will never back up. It also means signing in skips
  onboarding entirely, so **the local cache must be cleared to test the hatch path**.
  Signing out from Settings does this. Real users cannot reach this state.
- Local Supabase is not available at this handoff because the Docker daemon is not
  running. The app no longer points at it.

Still to build in PR 7: account deletion (App Review 5.1.1(v) requires it for any app
with accounts), and the skin-catalog gap — `hatch_pet` rolls rarity server-side but
takes `skin_id` from the client, which stays exploitable until the catalog lands and
the server can validate it.

## The closed care loop

The shape, and why each arrow exists:

```
waking time ──▶ hunger ↓, happiness ↓, energy ↑ (rest)
quiet hours ──▶ nothing falls at all; energy still ↑
throw food  ──▶ hunger ↑, energy ↑, and a mess is scheduled minutes out
mess lands  ──▶ cleanliness ↓, and happiness drains while it sits there
scrub       ──▶ cleanliness ↑, which unblocks affection
rub         ──▶ happiness ↑, energy ↓
energy out  ──▶ nap, come back later
```

Every need is fed by another action, so nothing is a dead end. The decisions that
hold it together:

- **Energy is stamina, not a need.** Spent only by rubbing; refilled by eating and by
  resting over time. The player cannot neglect it. Its job is pacing the session.
  `DecayRates` names the field `energyRecoveryPerMinute` precisely so no caller can
  read it as a drain — this used to be a one-way ratchet and the dumpling could get
  permanently stuck asleep.
- **Two recovery paths on purpose.** Time regen is ambient; the zero-energy nap
  (9 seconds, applies `rest`) is the emergency floor. They compose.
- **Sleeping has its own threshold**, far below the behavior module's low-energy
  bias. Looking tired and being unconscious are different states, and only one of
  them takes the screen.
- **Cleanliness is off the clock.** It moves only through meals and scrubbing. A meal
  schedules its mess on the `Pet` (`pendingMessesAtMs`), not in a timer, which is
  what lets a pile land while the app is closed.
- **`advancePet` walks the elapsed window in segments** split at each scheduled mess.
  The happiness penalty depends on how many piles were present during each stretch,
  so billing the whole window at the final count would punish the player for messes
  that landed at the very end, and billing at the starting count would let an
  overnight mess cost nothing.
- **A mess blocks affection outright**, and a blocked rub costs no energy. Charging
  stamina for an action that cannot pay out is the doom loop the food economy already
  rejects. Three distinct zero-gain reasons — mess, exhausted, sated — each get their
  own reaction, because with no affection meter the reaction is the only feedback.
  Successful attention emits three hearts; mess emits one cross; sated emits two
  crosses; exhaustion alone keeps one `zzz`.
- **Food lands where it is thrown.** The wheel passes its flick vector through;
  sideways travel aims across the room, upward travel sets depth, and a small scatter
  keeps it from reading as a UI element. The near edge of the landing band comes from
  the screen's real layout, so nothing lands under the action wheel.
- **Night is stasis.** Inside the pet's quiet window (default 22:00–07:00 local,
  editable in Settings) hunger and happiness stop entirely, energy still recovers,
  and scheduled messes still land so the morning has a tidy-up rather than a crisis.
  The habitat pump halts, in-flight walking is cancelled, throws are refused, and the
  sleeping dumpling emits a `zzz` immediately and every 2.2 seconds.
  People sleep; a pet that starves overnight punishes them for having a life. A
  zero-length window means never sleeps — reading it as always-asleep would freeze
  the game forever from one bad stored value.
- **Local time is a port, not `new Date()`.** A timezone-dependent test that only
  passes in one region is worse than no test. iOS also exposes no usable API for the
  user's real Sleep Focus schedule, so the window is ours.
- **Rates apply once, against accumulated totals.** `advancePet` walks the window a
  minute at a time counting awake minutes and mess-minutes, then applies the rates.
  Applying them per minute would floor each step on its own, and every current rate
  is below 1 per minute — they would all floor to zero forever.
- **The ambient loop is the retry for pending food.** `serveNext` fires once at
  landing and bails if the dumpling is busy, so without that retry a meal thrown
  mid-behavior was orphaned on the floor forever. Found by playing it, not by a test.

## Decisions and Constraints

Identity:

- One account has one dumpling, never a collection. Only `hatchPet` may create a
  `Pet`, and it returns the existing one unchanged when present. `withRevision`
  re-pins `id` and `bornAtMs` so no caller can rewrite them. The database enforces
  the same rule with `unique index pets_one_per_owner on pets (owner_id)`.
- The corrupt-cache state must never offer a fresh hatch. Treating unreadable state
  as "no pet yet" would destroy the dumpling the player already has.

Economy:

- **Food is free, unlimited, and outside the economy. Coins buy appearance, never
  survival.** Charging for food would create a neglect doom loop and force
  server-authoritative spends into the offline-first care path. More coin sinks
  should be cosmetic habitat decorations, never food.
- Nothing refuses food. Overfeeding fills hunger, turns the surplus into poop, and
  costs happiness as a tummy ache, both scaled to the waste so there is no cliff.
- Commercial launch may add coin packs purchased on a separate first-party web
  store and player-initiated rewarded ads. The site and game share Supabase Auth,
  the coin ledger, and the same user UUID. An eligible in-app action opens the site
  in the default browser; it starts enabled only for the United States App Store
  storefront and fails closed elsewhere until current regional requirements are
  implemented. The website sells fixed coin packs; the in-app Store accepts coins
  for skin spins and fixed cosmetics but never accepts money. Direct Stripe
  Checkout is the selected provider. The first-party server creates a pending
  order and Checkout Session with an opaque order reference; a signed Stripe
  webhook validates the paid Session and grants exactly once. Buy Me a Coffee is
  not used for coin fulfillment, and Paddle is rejected because its current
  policy prohibits virtual currency or stored value. The free earning path
  remains useful, purchased coins never expire, and no paid/ad path touches care
  or survival. Implementation is a separately gated PR 8.5 under
  `docs/WEB_COIN_STORE.md`.

Care and the habitat:

- The habitat is the screen, not a card. Hunger, energy, and happiness overlay the
  room. There is no persistent tab bar.
- Cleanliness has **no meter**. It is read from poop-pile concentration, with
  `hygieneSummary` giving screen readers the same information — pile density alone
  is invisible to VoiceOver.
- Messes are never instant. After eating, the dumpling waits, walks somewhere else,
  and leaves the pile there. Cleanliness stays the source of truth for how many are
  owed; the loop only materialises them.
- Rubbing is one gesture primitive (`RubSurface`) used twice: on the dumpling it
  pets, on a mess it scrubs. Both measure **path length**, not displacement —
  rubbing back and forth returns the finger to its start, so displacement would
  never pay out. A tap is the accessible equivalent for both.
- Attention costs energy even at full happiness, so petting a sated dumpling is not
  free. `annoyed` is the only signal that affection gain has hit zero.
- The action wheel holds feed, clean, and wardrobe; every segment acts over the
  habitat. Its layout is cyclic, and the glass track and icon arc derive from one
  radius so they cannot disagree.
- Wardrobe entry is blocked while cleanliness still owes a pile. A native alert
  asks the player to clean the habitat, preventing the sheet/lift from entering an
  invalid partial state.
- Mess Y positions are capped above the action wheel so every pile and its scrub
  target remain visible.
- Wardrobe is a sheet over the live habitat. The room lifts by an amount derived
  from the sheet's detent. **Skin preview must stay ephemeral: it must not call
  `equipSkin`, write to a repository, enqueue a care event, or bump the revision.**
- Diet is a `Pet` field that syncs, not a device preference. Excluded foods are
  substituted, not removed, so every diet's pool is the same size.

Animation:

- The production pipeline is **pre-rendered 3D**: models authored in 3D, exported as
  ordered 2D sprite frames, layered. There is no 3D and no animation runtime at
  runtime — the app draws images. Rive is parked; PR 2.5 was removed.
- A skin is a composited layer over one shared base body. Every skin layer must be
  rendered from the identical camera, rig, and frame count as the base, and both
  carry a rig version so a base change cannot silently desync skins.
- Long ambient states are a short seamless loop repeated, never one frame per
  duration tick. Fast one-shots get 24–30fps. Nothing below 12fps if it moves.
- Screens and game logic emit semantic pet states only. No file, layer, frame, or
  atlas name may reach domain or screen code. That boundary is what let the
  animation system change once already without touching either.
- Current motion is procedural squash and stretch on the project-owned PNG set,
  transform and opacity only, native-driven, with Reduce Motion holding a pose.
  The sleep mask is a native view effect driven only by the semantic `sleepy` state.
- The pure ambient picker now drives the habitat between care actions. It changes
  expressions and procedural motion and walks within safe X/Y bounds; care,
  feeding, and owed messes take priority.

Engineering:

- Game tuning is injected, never hard-coded. `PROVISIONAL_*` constants exist so
  tests and prototypes run; they are not approved values.
- Mood floors rather than rounds, matching the Android integer-division reference,
  because the evolution gate depends on the exact value.
- Client code must not call Supabase directly from UI components.
- The server's `hatch_pet` now owns rarity. Its `skin_id` still comes from the
  provisional client catalog; PR 7 must close that gap by validating against a
  server catalog.
- No secrets in this file or in source control. `.env` is gitignored.
- Use Node `^22.13.0` or `>=24.3.0`. The machine runs 25.9.0, which satisfies it.
  **`nvm` is not installed**, so the documented `nvm use` step fails; skip it.
- React Compiler lint rules are enabled and enforced. They caught four real issues
  this session: refs read during render, a self-recursive callback, a ref seeded from
  props, and mutable scratch that was not needed. Fix rather than suppress.

## Commands and Verification

- `cd apple && npm ci && npm run check` — format, ESLint, tsc, Vitest
- `cd apple && npm run check` at this handoff — 29 files, 617 tests passing;
  formatting, ESLint, and strict TypeScript clean.
- `npx expo start` then reload in Expo Go on a booted simulator. Route types live in
  `.expo/types/` and are generated by the dev server, not by `expo export` — delete
  them and hrefs stop being typechecked.
- `npx expo export --platform ios` — production bundle; last run 2.6MB
- `supabase start && supabase db reset --local` then
  `psql "$LOCAL_DB_URL" -f supabase/tests/one_dumpling_security.sql`
- Local Supabase ports are remapped to **54420–54429** so this stack can run
  alongside arbidocket's on 54321.
- `supabase migration list --linked` confirmed local and remote both at
  `20260728000001`.
- `npm audit --omit=dev` reports 11 moderate transitive Expo-toolchain findings;
  the full audit reports 20 findings (11 moderate, 9 high). Suggested automatic
  fixes cross Expo major versions, so no audit fix was applied.

## Errors and Failed Approaches

- ESLint 10 was incompatible with the Expo lint stack; 9.39.5 is pinned, and package
  overrides pin the TypeScript import resolver to 4.4.5.
- Nested route groups all resolved to `/` and collided with the session gate. Tab
  routes became real path segments (`/habitat`, `/wardrobe`, `/settings`), which is
  also what notification deep links will need.
- A square scene viewBox drawn `slice` on a tall phone scaled to the height and
  cropped the window and shelf off screen. The viewBox is now phone-shaped.
- The wheel's first layout placed segments by absolute index, pushing the whole set
  to one side and walking the last one off screen. It is cyclic now.
- Translating the whole habitat for the wardrobe exposed the root background and
  could push the pet too high. The read-only wardrobe now leaves the habitat
  anchored and uses a navigation lock to prevent duplicate native sheets.
- Rub distance measured from velocity under-counted, and from displacement never
  paid out. Path length is correct.
- Three test expectations were wrong rather than the implementation: feeding from 80
  hunger clamps at 100, and two animation-state cases left the fixture at happiness
  80, which legitimately resolves to `happy`.
- Bugs found only by running it on device: the reveal showed the raw typed name
  instead of the saved normalized one; the habitat lawn painted over the pet's name;
  the pet walked far enough left that its body hung off screen.

## Review Status

- Self-review: static gates, 617 tests, 21 SQL security assertions, an earlier iOS
  bundle export, and an earlier manual pass of the care loop on an iPhone 17
  simulator.
- A screen recording of the full loop was produced at the owner's request.
- Not reviewed by another account. No pull request has been opened.
- Human review still needed: minimum iOS, the poop density curve, the attention
  energy cost, decay rates, and whether notifications and Picture in Picture are
  MVP.
- The newest sleep mask, Do Not Disturb sign, sleep-puff placement, and cross
  feedback have automated behavior coverage but have not been rendered for visual
  approval.

## Git and Artifact State

- Branch `codex/apple`; `origin/codex/apple` is at `30deac7`.
- The current branch is two commits ahead at final handoff: the reconciled
  sleep/attention polish and this documentation/cleanup commit.
- The original uncommitted sleep/attention work is also preserved as `d668480` on
  `claude/inspiring-haibt-4ba2ec`; that worktree is clean.
- Tested: domain and habitat hook by unit tests, schema by SQL assertions. The newest
  sleep visuals still need a simulator/device pass.
- No secrets or build output committed. The iOS export goes to a scratch directory.

## Open Questions and Blockers

Blocking the next PRs:

- **Decay rates.** `PROVISIONAL_DECAY_RATES` is hunger -0.15/min, happiness
  -0.1/min plus -0.1/min per mess, energy +1/min, cleanliness untouched by time,
  and offline cap 12 hours. Hunger and happiness bill awake minutes; energy recovers
  through quiet hours. Paced against two real absences: eight hours asleep costs
  nothing, eight hours at work costs 72 of 100 hunger, and eleven waking hours
  starves a full dumpling. Nobody has yet played across a full week.
- **Default quiet hours** of 22:00–07:00, and the half-hour stepper resolution.
- **Poop-density curve.** `PROVISIONAL_HYGIENE_CONFIG` uses 20 cleanliness per pile,
  max 5, 20 restored per tap. The overfeed penalty rates are calibrated against the
  same curve. This now also sets the rhythm of the whole loop: with the affection
  gate, a mess is a hard stop on petting, so pile frequency is interruption
  frequency.
- **Mess delay window**, provisionally 8–22 minutes, and the 20 cleanliness one mess
  costs. One meal currently makes exactly one pile.
- **Attention energy cost** (10), **feed energy gain** (12), and the **exhaustion
  sleep threshold** (15) remain unapproved.
- Death threshold, grace period, warnings, and the revival anti-farming safeguard.
- Daily coin threshold and reward, skin-tier costs, odds, duplicate behaviour.

Not blocking:

- Apple and Expo identity. The App Store Connect name is `Squishy Dumplings Pet`,
  Apple bundle ID is `com.dinosaur5.squishydumplings`, App Store Connect app ID is
  `6795322665`, and EAS project `@dinosaur5/squishy-dumplings-apple` is linked with
  project ID `18584504-93a1-424c-8581-4087499a2128`.
- Whether Picture in Picture is MVP.
- **Push notifications are agreed in principle and deferred until the rates settle.**
  Four triggers: coins earned, room dirty, dumpling unhappy, dumpling hungry. Each
  sits on one arrow of the closed loop, and each fire time is computed from the decay
  schedule — which is exactly why they wait for it. Local scheduled notifications work
  in Expo Go and cover all four; remote push would need a development build, and
  nothing here requires it. Coins do not exist until PR 8. **Every one of them must
  respect the quiet window** — the whole point of stasis is undone by a 3am push.
- The habitat loop now has deterministic hook coverage through
  `react-test-renderer`; its visual composition and real gesture feel still require
  simulator/device review.
- Final approval of the configured icon/splash candidates, plus audio direction.
- First pre-rendered sprite delivery: one state, base plus one skin layer, to
  validate the delivery contract before bulk production.

## Exact Next Step

From the repository root:

1. Read `apple/AGENTS.md`, this file, and `apple/docs/CODEX_BUILD_METHOD.md`.
2. Start Expo with `cd apple && npx expo start --port 8001`. In the simulator, verify
   sleep-mask alignment, the sign's position at the feet, immediate/periodic `zzz`,
   crosses for sated/messy rubs, and that sleep halts walking and refuses throws.
3. Sign out to clear the pre-auth `"Momo"` cache, create a fresh hosted account,
   complete onboarding, and confirm `hatch_pet` creates exactly one `public.pets` row
   for that owner.
4. Finish PR 7 with account deletion and server validation of the initial skin, then
   run reconnect and second-device verification.

Do not tune the unresolved decay, attention-cost, or poop-density values without
approval, and do not add an animation runtime or a live 3D renderer.

## Last Updated

2026-07-28 (third update) — reconciled the separate worktrees. Sleep now halts the
habitat, emits periodic `zzz`, wears a view-based mask, and uses a floor-planted Do
Not Disturb sign. Blocked attention uses crosses except for genuine exhaustion.
Hook coverage is integrated; 617 tests in 29 files pass. The new visuals still need
to be seen, and the hosted clean-account `hatch_pet` test remains PR 7's next gate.

2026-07-28 (third update) — cloud path proven end to end: sign-up, hatch_pet, and sync-adopt all verified against the linked project. Fixed a .env URL that would have broken production. In-app hatch reveal still unwatched.

2026-07-28 (second update) — Supabase connected: schema pushed to the linked project, email+password auth, session persistence, and backup sync. Paused mid end-to-end test; see "PR 7: where it stopped".

2026-07-28 — care loop closed: energy became stamina, elapsed decay wired up for the
first time, meals schedule offline-safe messes, messes gate affection, throws are
aimed. Then night became stasis and the daytime rates slowed to a human pace, with a
bedtime control in Settings. Merged with the tutorial and ambient-behavior work from
build 2.
