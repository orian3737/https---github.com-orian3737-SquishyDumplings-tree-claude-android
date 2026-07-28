# Apple MVP Build Specification

Status: partially implemented. PRs 2, 3, and 4 are delivered, the PR 6 schema is
applied, and PR 7 auth, session persistence, remote persistence, and backup sync are
implemented. PR 7 still requires hosted hatch verification, account deletion, and
server validation of the first skin. The economy, lifecycle, notification, and PiP
sections remain plan only.
Target: iPhone, Expo + React Native + TypeScript
Last reviewed: 2026-07-28

## 1. Goal

Ship a TestFlight-quality iPhone MVP in which a user can create or restore an
account, meet one dumpling, care for it inside an animated habitat, earn daily
happiness coins, roll and equip skins, close and reopen the app without losing
progress, and sync only their own state through Supabase.

## 2. Non-goals

The product supports exactly one persistent dumpling per account. Skins are
cosmetic appearances for that dumpling and never create additional pets.

The current TestFlight MVP does not include an Android-style outside-app overlay,
widgets, Live Activities, Dynamic Island, real-money purchases, purchasable
currency, rewarded ads, AI chat, social features, marketplace trading, multiple
active pets, or 3D/Unity. Purchasable coins and opt-in rewarded ads are planned as
a separately gated commercial-launch work unit after the free economy is proven.
Push
notifications, death/revival, and Picture in Picture are requested product
features whose MVP versus first-post-MVP placement must be confirmed.

## 3. Proposed app structure

```text
apple/
  app/
    _layout.tsx         root stack; injects the pet repository
    index.tsx           session gate
    (onboarding)/       naming, diet, steam-box reveal
    habitat.tsx         the primary surface
    wardrobe.tsx        presented as a native sheet over the habitat
    settings.tsx
    unreadable.tsx      corrupt local cache; offers only a retry
  assets/
  src/
    components/
    features/
      auth/
      onboarding/
      pet/
      settings/
    services/
      supabase/
      persistence/
      sync/
    state/
    theme/
    types/
    utils/
  tests/
  app.config.ts
  eas.json
  package.json
  tsconfig.json
```

`wardrobe` lists skins owned by the signed-in user and equips one appearance on
their single dumpling.

Routes are flat rather than grouped. Nested groups all resolved to `/` and collided
with the session gate, and the real path segments are also what notification deep
links will need.

The habitat is the app's single primary surface. There is no persistent tab bar,
so the environment is never pushed into a fraction of the screen.

- Feed, clean, and wardrobe are reached from the habitat's action wheel
  (section 8). All three act over the habitat without navigating away.
- Wardrobe is presented as a partial-height sheet over the live habitat, not a
  separate destination, so a skin can be previewed on the dumpling in context.
- Settings is the only care-adjacent full route, reached from a quiet habitat
  control rather than the wheel.

## 4. Architecture

### Client

- Expo Router owns native stack/tab navigation and deep-link routing.
- Screens read state through feature hooks/selectors.
- A pet repository owns local persistence, Supabase reads/writes, migration,
  and conflict handling.
- UI components never import the Supabase client directly.
- The app remains usable during temporary network loss.

### Local persistence

Persist:

- Current session metadata through the supported Supabase/Expo storage adapter
- Last known pet snapshot
- Last successful sync timestamp
- Pending idempotent care mutations
- User preferences

Do not persist secrets outside the platform facilities selected by the auth
library. Treat local pet state as a cache, not an authorization boundary.

### Supabase

Use:

- Auth for user identity
- Postgres for canonical pet and care data
- Row Level Security for per-user isolation
- Edge Functions or Postgres RPC for privileged/randomized operations
- Storage only if remote content management is required

The app bundle receives only:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Service-role keys and Apple/server secrets remain server-side.

## 5. Proposed data contract

Names are provisional until the existing Supabase project is audited.

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key; references `auth.users.id` |
| `display_name` | `text` | Optional, validated length |
| `created_at` | `timestamptz` | Server default |
| `updated_at` | `timestamptz` | Server maintained |

### `pets`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | References `auth.users.id`; indexed |
| `name` | `text` | Required; trimmed and length-limited |
| `rarity` | `text` | Checked enum value |
| `evolution_stage` | `smallint` | Non-negative |
| `hunger` | `smallint` | 0–100 |
| `cleanliness` | `smallint` | Internal 0–100 value; never shown as a meter. Drives poop-pile count |
| `energy` | `smallint` | 0–100 |
| `happiness` | `smallint` | 0–100 |
| `personality_tags` | `text[]` | Checked against supported values |
| `diet` | `text` | `omnivore`, `vegetarian`, or `vegan`; filters the food pool |
| `favorite_food` | `text` | Base-pool item; only affects eating order |
| `skin_id` | `text` | Current project-owned skin/content identifier |
| `lifecycle_status` | `text` | `alive`, `dead`, or `reviving` |
| `born_at` | `timestamptz` | Server time |
| `died_at` | `timestamptz` | Nullable; server time |
| `last_cared_at` | `timestamptz` | Basis for elapsed-time decay |
| `revision` | `bigint` | Monotonic optimistic-concurrency value |
| `created_at` | `timestamptz` | Server default |
| `updated_at` | `timestamptz` | Server maintained |

Product invariant: exactly one pet row per owner after hatching. Enforce a
unique constraint on `owner_id`; death and revival update that same row.

### `care_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Client-generated idempotency key |
| `pet_id` | `uuid` | References `pets.id` |
| `owner_id` | `uuid` | Enables direct RLS checks and indexing |
| `action` | `text` | `feed`, `attention`, `clean`, `rest`, `evolve`, `revive` |
| `occurred_at` | `timestamptz` | Client observation |
| `received_at` | `timestamptz` | Server default |
| `result_revision` | `bigint` | Revision produced by the mutation |

Care changes should be applied atomically through an RPC/function so retrying
an event ID cannot apply its effect twice.

### `skins` and `skin_roll_tiers`

The server-managed catalog defines stable skin IDs, rarity, asset references,
availability, and tier membership. Each active roll tier defines a coin cost
and weighted pool. Client odds are rendered from the same canonical
configuration used by the server roll.

### `user_skins`

Stores each unlocked appearance by `owner_id` and `skin_id`, including its
unlock source and time. These are wardrobe items for the owner's one dumpling,
not separate pets. The current equipped skin remains referenced by that pet.

### `coin_ledger`

An append-only ledger records every grant and spend with owner, signed integer
amount, reason, server timestamp, and unique idempotency key. Balance is derived
or transactionally cached from the ledger; clients cannot write balances
directly.

PR 8 may add a one-row-per-owner `coin_accounts` balance cache maintained in the
same transaction as the ledger. PR 8.5 adds the server-owned coin-pack catalog,
external orders, and immutable payment-event receipts described in
`WEB_COIN_STORE.md`. Clients can read their own commercial history but cannot
choose a price, coin quantity, owner, order state, grant, reversal, or balance.

### Required RLS behavior

- A signed-in user can select/update only rows whose `owner_id = auth.uid()`.
- A user cannot choose a different `owner_id` during insert.
- Care events are readable/insertable only by their owner.
- Coin-ledger and owned-skin rows are readable only by their owner and writable
  only through approved server functions.
- Skin catalog and roll-tier configuration are readable but not client-writable.
- No anonymous broad read policies.
- Server-only operations are not exposed as unrestricted client table writes.

## 6. Ported game rules

All stat values are integers from 0 through 100.

| Rule | MVP value |
|---|---|
| Initial stats | 80 each |
| Feed | Hunger +25, energy +12 |
| Clean | Cleanliness +35 |
| Attention/rub | Happiness +20, energy -10 |
| Rest | Energy +30 |
| Full sleep | At energy 0, movement and pet interaction stop; one uninterrupted 9-second prototype nap applies Rest |
| Mood | Integer average of four stats |
| Neglected | Hunger <20 or cleanliness <20 |
| Evolution gate | Mood >=70 and stage below rarity maximum |
| Overfeed waste | Hunger the feed would push past 100 |
| Overfeed poop | Cleanliness -1 per wasted hunger point (provisional) |
| Overfeed tummy ache | Happiness -0.5 per wasted hunger point (provisional) |

Overfeed penalties are floored, so a feed that wastes nothing costs nothing. Both
rates are provisional and tied to the poop-density decision in section 14.

### Energy is stamina, not a need

Resolved. Energy is **spent only by rubbing** and refilled by eating and by resting
over time. It is deliberately not a neglect axis: the player cannot fail at it, and
nothing but their own interaction lowers it. Its job is pacing — it caps how much
affection can be banked in one sitting, then the dumpling naps and the player comes
back later.

Two recovery paths, and both are wanted. Time-based regen is the ambient one that
means a rested dumpling is always ready. The zero-energy nap is the emergency floor
for a player who spent the bar all at once.

A rub blocked by a mess or exhaustion costs no energy — see the affection gate
below. Charging stamina in either case would let a player who has not worked out the
rule drain their dumpling for nothing. Rubbing a fully content dumpling still costs
energy and produces the annoyed reaction; pestering a sated dumpling is intentionally
not free.

Sleeping has its own threshold, well below the behavior module's low-energy bias.
Being a bit tired reads as a slower dumpling; being asleep takes the screen and
blocks interaction, so it must mean genuinely spent.

### Cleanliness is driven by meals, not by the clock

Resolved. Cleanliness does not decay with time. A meal schedules the mess it will
produce for some minutes later, and that schedule is persisted on the pet rather
than held in a timer, so a pile lands while the app is closed. Cleanliness remains
the single source of truth for how many piles exist; the habitat only materialises
what it is owed.

Messes left standing drag happiness for as long as they sit there. The elapsed-time
catch-up therefore bills the window in segments split at each scheduled mess — the
penalty depends on how many piles were present during each stretch of time, not on
how many are present at the end.

### The affection gate

Resolved. **Any mess on the floor blocks affection outright.** Rubbing a dumpling
standing next to its own mess gains nothing and costs nothing, and the dumpling
plays a distinct reaction. Cleaning is the prerequisite for petting, which is what
makes feed → mess → clean → pet a loop rather than a set of parallel chores.

Three different situations produce a zero gain — a mess, an empty stamina bar, and
a dumpling already fully content — and each gets its own reaction. There is no
affection meter, so the reaction is the only feedback the player receives, and an
ambiguous one would leave "why did nothing happen?" unanswerable.

Only successful attention produces hearts. A rub blocked by mess or full happiness
produces crosses; exhaustion keeps the sleepy mark because that failure is genuinely
about tiredness.

### The dumpling sleeps at night

Resolved. The dumpling has a quiet window in device local time, defaulting to
**22:00-07:00** and editable in Settings. Inside it the dumpling is in stasis:

- Hunger and happiness stop entirely, including the per-mess drain.
- Energy still recovers, because that is what sleep is for.
- A mess a meal already scheduled still lands, so the morning has a small tidy-up
  waiting rather than a crisis.
- Ambient work halts, an in-flight walk is dropped, and new food throws are refused.
- The dumpling wears a sleep mask, gives off one `zzz` immediately and every 2.2
  seconds, and has a floor-planted Do Not Disturb sign.

People sleep, and a pet that starves overnight punishes the player for having a life.
A zero-length window means the dumpling never sleeps — deliberately, because reading
it as always-asleep would freeze the game forever from one bad stored value.

The window rides on the pet like `diet` does, so it follows the owner to a second
device. It is not read from the system: **iOS exposes no usable API for the user's
Sleep Focus schedule.** HealthKit carries retrospective sleep *records*, behind an
entitlement and a permission prompt, and says nothing about intent.

### Decay schedule

PROVISIONAL, and now actually running — nothing called the elapsed-decay path before.
Hunger -0.15/minute, happiness -0.1/minute plus -0.1/minute for each mess present,
energy **+1/minute recovered**, cleanliness unchanged by time, and a 12-hour offline
catch-up cap. Hunger and happiness bill **awake minutes only**; energy recovers
through all elapsed minutes, including quiet hours.

Picked against two real absences rather than by feel:

| Absence | Hunger cost, from full |
|---|---|
| Eight hours asleep | 0 |
| Eight hours at work | 72 of 100 |
| Eleven waking hours | 99 of 100 |

So the player comes home needed but not punished. -2/minute emptied a full dumpling
in fifty flat minutes; -0.2 was tried next and still drained it to exactly zero
across one working day, which is the same failure in a politer disguise.

Happiness barely moves on the clock. It is meant to be driven by messes and petting,
and three piles roughly quadruple its drain — that is what makes cleaning urgent when
there is no meter to show it.

Elapsed time is billed by walking the window a minute at a time and applying the
rates **once** against the accumulated totals. Applying them per minute would floor
each step independently, and any rate below 1 per minute would then floor to zero
every single time and never move the need at all.

### Rarity reference

| Tier | Weight | Displayed probability | Max stage |
|---|---:|---:|---:|
| Common | 60 | 60.0% | 2 |
| Uncommon | 25 | 25.0% | 2 |
| Rare | 10 | 10.0% | 3 |
| Epic | 4 | 4.0% | 3 |
| Legendary | 1 | 1.0% | 4 |

The first hatch grants a skin through a server-authoritative free roll. The
client must not be the authority for skin or rarity if users can reinstall,
retry, revive, or later attach economic value to the result.

## 7. Functional requirements and acceptance criteria

### FR-1 Launch and routing

- Cold launch shows a lightweight branded loading state while local/auth state
  is restored.
- A new user reaches onboarding; an established user reaches the habitat.
- Every state has a deterministic next route; no blank or flashing screen.

### FR-2 Authentication

- The selected auth method creates/restores a Supabase session.
- Session refresh works across foreground/background transitions.
- Sign-out clears private local cache and returns to the auth route.
- Account deletion has a clear in-app entry point and server-side workflow.
- If Sign in with Apple is included, it is tested on a physical device.

### FR-3 Meet a dumpling

- A user without a pet can name and reveal exactly one pet.
- Names are trimmed, length-limited, and safe to display.
- Repeated taps/network retries cannot create multiple active pets.
- Subsequent sessions can never hatch a second dumpling; they restore the
  existing identity and wardrobe.
- The first reveal appears as a bamboo dumpling steamer with a visible opening
  action and layered steam blobs that rise across the whole screen. The cloud
  completely obscures the screen at its peak; subtle gray variation gives it
  depth before it clears to the dumpling.
- The reveal grants and clearly shows the first skin and rarity, then saves
  before navigation.
- Onboarding offers the diet choice (omnivore, vegetarian, or vegan) as one
  optional tap. It defaults to omnivore and never gates hatching — the first thing
  a new player does should not be a dietary form. It is editable later in settings.

### FR-4 Habitat

The habitat is an environment, not a form. It fills the primary surface, the
dumpling lives inside it, and status is overlaid on that environment instead of
being listed in cards stacked below it.

- The habitat fills the primary surface on every supported iPhone size.
- Hunger, energy, and happiness appear as a compact overlaid indicator cluster,
  kept clear of the safe areas, the dumpling's movement range, and the action
  wheel.
- Cleanliness has no meter. It is read from the environment: the dirtier the
  dumpling, the more poop piles are present. See FR-5.
- Mood, stage, and rarity are reachable from the habitat without leaving it.
- Overlaid indicators must never cover the dumpling or any tappable habitat
  object, at any supported size or text size.
- Important values have accessible labels and do not rely only on color.
- Empty, loading, stale/offline, and retry states are designed.

### FR-5 Care

Care happens in the environment. The action wheel at the bottom of the habitat
selects what the player is doing; the habitat itself is where they do it.

On the first habitat visit, a skippable four-card tutorial introduces feeding,
cleaning, petting, and zero-energy sleep. Completing or skipping it is persisted
separately from pet state, so care-state repair does not replay onboarding. Every
gesture description includes its tap-based accessible alternative.

#### Feeding

Food is free, unlimited, and unrestricted. It is never bought, never rationed, and
never gated by coins, a cooldown, or a quantity cap. See section 12 for why.

- There is no food picker. One upward swipe on the wheel's feed segment throws one
  randomly chosen item into the habitat. Keeping the app's most-repeated
  interaction to a single gesture is the point; variety comes from seeing
  different foods over time rather than from selecting one.
- The item lands at a point in the environment rather than travelling to a fixed
  mouth target.
- The dumpling notices the landed food, walks over to it, and eats it there.
  Hunger updates when the dumpling actually eats, not when the item is thrown.
- Several items can be on the ground at once. The dumpling walks to its favorite
  food first, then to the rest in the order they landed.
- Every dumpling has a favorite food, rolled at hatch. It only affects that eating
  order. It never blocks a food, penalizes a throw, or changes what a throw
  produces, so it reads as character the player notices rather than a rule to
  learn. There are no other per-item differences.
- Food that lands somewhere unreachable resolves rather than stranding the
  dumpling or leaving the item on screen forever.

The food set:

| Item | Served to |
|---|---|
| Pork chop | Omnivore |
| Mixed vegetables | Vegetarian and vegan, in place of the pork chop |
| Tofu | Every diet |
| Scallion | Every diet |

- A vegetarian or vegan dumpling is never thrown meat. The excluded item is
  **substituted**, not removed, so every diet draws from a pool of the same size
  and choosing a meat-free diet never means less variety.
- Filtering the pool rather than refusing on landing matters: a refusal the player
  did not cause reads as the game punishing them for its own random pick.
- If the food set ever grows, keep the meat-free pool at parity so a diet choice
  cannot quietly become the mechanically worse option.

#### Overfeeding

Nothing refuses food. Overfeeding is always accepted and has consequences instead
of a block, so the limit is the dumpling's body rather than the player's wallet
and no one can be soft-locked.

- Hunger fills to full and the surplus is wasted.
- The wasted food comes back out as poop, raising the pile count in the habitat.
- The dumpling gets a brief tummy ache and loses happiness.
- Both penalties scale with how much was wasted, so there is no threshold cliff:
  topping up a nearly-full dumpling costs a little, stuffing a full one costs a
  lot, and feeding a hungry one costs nothing.
- The habitat should warn before a deliberate mess and play the tummy-ache
  reaction when one happens, rather than silently applying the penalty.

#### Attention

- Rubbing across the dumpling produces hearts, gives attention, and updates
  happiness only after a deliberate gesture threshold.
- Hearts appear only when happiness actually increases. A sated or dirty dumpling
  produces crosses, while an awake but exhausted dumpling produces `zzz`.

#### Cleaning

- Low internal cleanliness produces poop piles in the habitat. Their
  concentration is the only cleanliness display: there is no Stinky meter and no
  cleanliness meter.
- Piles spawn only inside the visible, cleanable floor area. The bottom action
  wheel must never cover a pile or its touch target.
- The player taps each pile directly to remove it. Every successful tap gives
  immediate feedback and improves cleanliness.
- Because pile density is a purely visual signal, the habitat must expose an
  accessible equivalent: each pile carries its own label, and the habitat
  provides a summary a screen reader can read (for example, how many piles remain
  and whether the dumpling is getting uncomfortable). Removing the meter must not
  remove the information from VoiceOver.

#### All care actions

- Each care action supports VoiceOver and a non-gesture alternative. The wheel
  and the swipe-to-throw gesture are both convenience layers over an accessible
  control, never the only way to act.
- Controls prevent accidental rapid duplicate mutations.
- Failed sync does not silently discard the action.
- A retried idempotent action affects the canonical pet once.

### FR-6 Death and revival

- A dumpling can die only after the approved need threshold, grace period, and
  warning sequence; these values remain a blocking product decision.
- Death never happens merely because a background timer failed to run.
- A dead dumpling returns to the steam box for revival.
- Revival is user-initiated, idempotent, and resolved server-side.
- The box opens with the same large steam-cloud language as the first hatch and
  grants a newly rolled skin.
- Revival updates the same pet row and preserves its ID, name, history, and
  previously unlocked skins. The newly rolled skin is unlocked and equipped.

### FR-7 Time and decay

- Needs reflect elapsed time rather than requiring a continuous background
  timer.
- Server timestamps are authoritative when connected.
- Clock skew and long offline periods cannot produce values outside 0–100.
- The chosen catch-up cap prevents a returning user from facing an
  unrecoverable pet state.

### FR-8 Evolution

- The UI explains the unmet condition when evolution is locked.
- An eligible pet advances one stage per confirmed action.
- It never exceeds its rarity's maximum.
- Repeated requests are idempotent.

### FR-9 Ambient behavior

- The pet uses the Android reference pool: idle sit, stretch, look around,
  yawn, nap, waddle left/right, pace, sprint, peek, hop, and wobble, extended on
  iOS with tongue-out, wave, and squat expressions.
- No behavior repeats immediately.
- A nap does not transition directly to sprint, hop, or waddle; a yawn does
  not transition directly to sprint or hop.
- Low energy biases sluggish behavior; high happiness biases playful behavior.
- At zero energy or during quiet hours, ambient selection is suspended: the
  dumpling holds the sleepy state, never walks, refuses food throws, wears a sleep
  mask, emits periodic `zzz`, and shows a floor-planted Do Not Disturb sign.
- Falling asleep cancels an in-flight walk so a stale activity cannot animate behind
  the sleep treatment.
- Reduced Motion replaces large motion with gentle state changes.

### FR-10 Offline and sync

- The last synced pet is viewable offline.
- Local actions queue with stable event IDs.
- Reconnection retries automatically with bounded backoff.
- Conflicts resolve through server revision/order rules, never last-render wins.
- The user sees a non-alarming status if changes remain pending.

### FR-11 Notifications

- Notification permission is requested only after the user sees a clear
  benefit and opts in.
- Notifications may communicate meaningful hunger, stink/poop, attention,
  danger, death, revival, or evolution events.
- Frequency is capped, quiet behavior is respected, and notification types can
  be disabled.
- Tapping a notification deep-links to the relevant habitat state.
- Final notification copy, cadence, and MVP scope require approval.

### FR-12 Coins, skin rolls, and store

- A living pet meeting the approved happiness threshold receives one coin grant
  at most once per server day.
- Eligibility and grant time use server time. Reinstalling, changing the device
  clock, retrying, or using a second device cannot duplicate the reward.
- The app shows balance, today's eligibility/claimed state, and any capped
  streak bonus.
- Each roll tier shows its coin cost, eligible pool, exact rarity/skin odds,
  and duplicate behavior before confirmation.
- The in-app Store accepts coins for skin rolls and fixed cosmetics only. It does
  not accept money or embed the web checkout.
- A roll atomically verifies balance, spends coins, selects the result, records
  the result, and unlocks the skin.
- Failed or repeated requests cannot spend twice or produce multiple results.
- The wardrobe sheet lists owned skins and lets the user equip one.
- Selecting a skin in the sheet previews it live on the dumpling and persists
  nothing. Only an explicit confirm equips, and dismissing reverts to the equipped
  appearance. A previewed-but-unconfirmed skin must not survive a relaunch.
- The free economy ships and is measured before commerce is enabled.
- Commercial launch may add coin packs sold by the separate first-party website
  and optional rewarded ads under `MONETIZATION_STRATEGY.md` and
  `WEB_COIN_STORE.md`.
- Paid and ad-funded coins never gate food, cleaning, attention, rest, revival,
  or any survival path.

### FR-13 Settings and trust

- Sound and haptics can be disabled independently.
- The dumpling's diet can be changed at any time with no penalty and no
  confirmation beyond the normal control. It affects only which foods future
  throws draw from, and a favorite that becomes unavailable resolves to its
  substitute rather than being lost.
- Settings show account state, privacy, support, app version, and licenses.
- Sign-out and deletion use clear confirmation language.

## 8. Visual and interaction direction

- Use the Android color tokens as a starting palette, then validate contrast.
- The habitat is the screen, not a panel on it. Status overlays the environment;
  it does not sit in a stack of cards below it.
- Use native stack headers and safe-area-aware scroll containers.
- Prefer continuous rounded corners, restrained haptics, and motion tied to
  pet state.
- Use SF Symbols through Expo Image where a system symbol fits; do not make
  Android icons the visual source of truth.
- The MVP renderer is the project-owned PNG set from `app/sprites/` plus simple
  native view effects, all behind a semantic pet-renderer interface.
- The production animation pipeline is **pre-rendered 3D**: models are authored in
  3D (Meshy), rendered out to ordered 2D sprite frames, and layered to build each
  animation. Rive is not the target and is parked.
- This keeps the section 2 no-3D non-goal intact. There is no 3D at runtime, no
  `expo-gl`, no three.js, no development build, and no GPU cost beyond drawing
  images. The 3D lives entirely in authoring.
- The renderer interface stays exactly as it is: screens and game logic depend only
  on semantic pet states. Swapping the animation source is an adapter change.
- The renderer itself must grow from "show one image per state" to "play an ordered
  frame sequence across composited layers," with per-state loop or one-shot
  behavior and a completion signal for one-shots. See ASSET_MANIFEST for the
  delivery contract.
- Frame sequences are the main new bundle-size risk. Every state multiplies frames
  by layers, so the asset manifest sets frame budgets and requires atlas packing.

### Habitat action wheel

The habitat's only persistent chrome is a wheel anchored to the bottom of the
screen. It replaces the tab bar so the environment keeps the full surface.

Every segment acts over the habitat. Nothing in the wheel navigates away, so the
player never loses sight of the dumpling and the control has one mental model.

| Segment | Behavior |
|---|---|
| Feed | Reveals the food arc. Swiping a food item upward throws it into the habitat. |
| Clean | Puts the habitat into cleanup emphasis so poop piles are obvious and easy to hit. |
| Wardrobe | Raises the wardrobe sheet over the habitat. See below. |

Settings is deliberately not in the wheel. It is a rarely used destination that
owns account state, privacy, and deletion, so it stays a full route reached from a
quiet, low-emphasis control in a habitat corner rather than sharing a control with
moment-to-moment care.

Design constraints this shape has to satisfy:
- Every segment and every food item is at least 44 by 44 points, including at the
  largest supported text size.
- The wheel must not cover the dumpling's resting position or the poop-pile area.
- Rotation, arcs, and swipe-to-throw all need a Reduce Motion form and a
  non-gesture alternative. A radial control is the hardest common pattern to make
  accessible, so its VoiceOver order, labels, and focus behavior are acceptance
  criteria, not polish.
- The wheel collapses to something unobtrusive when the player is not using it.

### Wardrobe sheet and live preview

Picking a skin is browsing, not a separate destination, so the wardrobe rises as a
partial-height sheet over the habitat instead of replacing it.

- The sheet occupies roughly half the screen at rest and can be raised further for
  a longer wardrobe. The habitat stays visible and live behind it.
- If the habitat contains any mess, wardrobe entry is blocked with a short prompt
  to clean the habitat first. The sheet never enters a partial preview state while
  cleanup is still required.
- Selecting a skin previews it on the actual dumpling, in the actual habitat, at
  the actual size. The preview is the point of the sheet: the player evaluates the
  appearance in context rather than from a detached thumbnail.
- The sheet must not cover the dumpling at its resting position. If the dumpling
  would be hidden at the sheet's resting detent once live preview ships, move the
  dumpling independently into the visible region. Never translate the entire
  habitat, which exposes the root background during the native sheet transition.
- **Preview is ephemeral.** Selecting a skin changes only local view state. It must
  not call `equipSkin`, write to a repository, enqueue a care event, or bump the
  pet's revision. Only an explicit confirm commits, and dismissing the sheet
  reverts to the equipped appearance.
- Confirming equips through the normal domain path, so the equipped skin is always
  one the owner has unlocked.
- Implement with the native iOS sheet presentation (Expo Router's `formSheet`
  presentation with detents) rather than a hand-rolled animated panel, so drag,
  dismiss, and accessibility behavior come from the platform.
- The sheet needs a VoiceOver-reachable list with each skin's name and its
  owned/equipped/previewing state. Preview cannot be a visual-only affordance.

### Animation authoring boundary

Sprite frames are produced in the 3D authoring tool and exported as ordered 2D
frames. Codex owns the renderer, the semantic adapter, frame playback, layer
compositing, fallbacks, and test harnesses. Character modelling, rigging, and
expressive motion are the art workflow.

Screens and game logic emit semantic pet states only. No file name, layer name,
frame index, or atlas coordinate may reach domain or screen code. That boundary is
what allowed the animation system to change once already without touching either.

## 9. Accessibility

- Support Dynamic Type without hiding actions or values.
- Meet WCAG AA contrast for functional text and controls.
- Provide VoiceOver labels, hints, roles, and logical focus order.
- Respect Reduce Motion and system sound/haptic preferences where applicable.
- Minimum interactive target is 44 by 44 points.
- Pet needs are expressed with text/value and iconography, not color alone.
- Any state communicated only by the environment needs an accessible equivalent.
  Cleanliness is the current case: it has no meter, so the poop piles and a
  habitat summary carry that information for screen-reader users.
- Radial and gesture-driven controls expose an accessible non-radial,
  non-gesture path to the same action.

## 10. Performance and reliability

- No user-perceived hang during session restore or sync.
- Keep habitat animations smooth on the oldest supported iPhone.
- Avoid unnecessary full-screen rerenders on animation frames.
- Cancel stale requests on account changes.
- Log errors without tokens, names, or private user content.
- Crash-free sessions and sync success rate become release gates once tooling
  is selected.

## 11. Build and environment strategy

Use three EAS profiles:

- `development`: development client for team devices
- `preview`: internal distribution, production-like configuration
- `production`: App Store/TestFlight signing and production backend

Prefer separate Supabase development and production projects. If only one
project exists initially, use separate schemas/data isolation only as a
temporary documented compromise.

Environment validation must fail the build when required variables are absent.
Never commit `.env` files containing real values.

## 12. Coin and skin economy

**Coins buy appearance, never survival.** Food is free, unlimited, and completely
outside the economy. This is a hard boundary, not a tuning choice:

- Charging for food creates a neglect doom loop. Coins are earned by keeping the
  dumpling happy, so a neglected dumpling could not afford to be fed, and the
  player who most needs to recover would be the one least able to.
- Coin spends are server-authoritative and idempotent by design; care is
  offline-first by design. Putting a spend in the feeding path forces those two
  requirements into conflict and would either break feeding offline or require
  optimistic currency with rollback in the app's most-used action.
- It would also build the shape of "buy currency to feed your starving pet," which
  becomes the business model by accident the moment coins are ever purchasable.

If more coin sinks are wanted later, add cosmetic habitat decorations. Never food,
and never anything on the survival path.

Implement the earned economy first:

- A living dumpling that meets an approved happiness threshold earns a
  server-authoritative reward at most once per server day.
- Consider a capped happiness streak bonus, but do not punish a missed day with
  negative currency or an unrecoverable economy disadvantage.
- Define tiered coin-funded skin rolls. Every tier shows its coin cost, eligible
  skin pool, rarity odds, duplicate behavior, and any pity/protection rule
  before confirmation.
- Use an append-only server ledger for coin grants and spends. Daily grants and
  roll purchases require idempotency keys and cannot be decided by the client
  clock.
- Ensure keeping a dumpling alive and happy is the best route to skins. A free
  death/revival reroll needs a cooldown, restricted pool, reset cost, or another
  safeguard so deliberate neglect is not an efficient farming strategy.
- Coins remain earned-only in the first TestFlight economy.
- Disclose exact reward odds before every randomized roll, whether earned or
  paid.
- Keep skin ownership and random reward resolution server-authoritative.
- Make coin grants, spends, and roll results idempotent.
- Define duplicate-skin behavior and any pity/protection rule.

Commercial launch may add web coin packs and opt-in rewarded ads after the earned
loop is verified. Coin packs are purchased on a separately deployed first-party
website using the same Supabase Auth identity and ledger; they are not StoreKit
products. The app opens the website in the default browser only when its current
App Store storefront is explicitly allowlisted, starting with the United States.
Other storefronts fail closed until their current entitlement, StoreKit external
purchase API, reporting, fee, disclosure, and in-app-purchase-parity requirements
are implemented and approved.

That work is separately gated by a verified Stripe account configured for the
disclosed game-coin product, server-created Checkout Sessions, signed Stripe
webhook validation, an append-only source-aware ledger, refund/dispute handling,
server-verified and idempotent ad rewards, privacy/age-rating/tax/support review,
and complete App Review disclosures. The website sells only fixed coin
quantities; the in-app Store separately spends coins on skin rolls. A browser
redirect never grants coins. Purchased currency does not expire. If any currency
can fund a randomized result, exact odds remain visible before the spend. See
`MONETIZATION_STRATEGY.md` and `WEB_COIN_STORE.md`.

## 13. PiP exploration and release gate

Prototype separately with a small Swift native module and
`AVPictureInPictureController`. Success criteria must acknowledge:

- PiP is media-oriented and user-initiated.
- The system controls window placement and sizing.
- The content is rectangular and cannot behave like Android's transparent
  overlay.
- The accepted design is a miniature habitat: the dumpling appears over a
  small background derived from the main in-app habitat rather than attempting
  transparency.
- The mini habitat should remain recognizable and uncluttered at every
  system-controlled PiP size.
- The feature needs physical-device testing and an early App Review strategy.
- Failure of the experiment must not compromise the main pet experience.

If PiP is promoted into MVP, this section becomes a release requirement and a
development build/native spike moves ahead of feature-complete status.

## 14. Open product decisions blocking implementation

Resolved since first draft: the food and coin boundary (section 12), the habitat and
wheel interaction model (sections 3 and 8), the wardrobe sheet with ephemeral preview,
the animation pipeline and layered-skin contract, and the MVP auth method — **email
only**, with Sign in with Apple deferred.

Still open, in the order they block work:

1. Auth method and guest-account policy — resolved to email only; guest policy moot,
   because going auth-first removed the guest-to-account merge problem entirely
2. Final decay schedule and offline cap. The path runs, the rates are paced
   against a real day, and night is stasis (section 6). What remains is living
   with them: nobody has yet played across a full week. The 12-hour cap now only
   bites past about eight waking hours, so it may want revisiting alongside the
   death threshold in item 8.
3. Bundle ID, app name, Expo slug/owner, and Apple team
4. Supabase development/production topology
5. Minimum iOS version
6. Analytics/crash reporting selection
7. Privacy, support, and account-deletion endpoints
8. Death threshold/grace period, warnings, and revival anti-farming safeguard
9. Whether notifications and PiP ship in MVP or immediately after it
10. ~~Whether attention/rubbing replaces play and whether it reduces energy~~ —
    resolved. Rubbing is the only energy cost, at -10 per round, and energy is
    stamina rather than a need (section 6). Still untuned: the -10 itself, the
    +1/minute regen, and the +12 a meal restores.
11. MVP coin economy: happiness threshold, rewards, roll tiers/costs,
    duplicates, odds, and revival safeguard
12. Poop-pile density curve: how many piles appear at which internal cleanliness
    values, the maximum on screen at once, and how much cleanliness one tap
    restores. Needed because pile concentration is now the only cleanliness
    display, and the overfeed penalty rates depend on the same curve. Now also
    governs how often the player is interrupted: with the affection gate, a mess
    is a hard stop on petting, so this curve sets the rhythm of the whole loop.
13. Mess delay window, provisionally 8–22 minutes after a meal, and the 20
    cleanliness one mess costs. One meal currently produces exactly one pile.
14. Default quiet hours, provisionally 22:00–07:00. The mechanism is resolved
    (section 6); the default and the half-hour stepper resolution are not.

Resolved: food items carry no hunger differences. Their only distinctions are the
diet substitution and which one the dumpling walks to first. The Android sprite
backlog's implied `preferredBy` preference is dropped — a three-item pool is too
small for hidden per-item values to be discoverable.

Resolved: food is free, unlimited, and outside the economy; coins never touch the
survival path (section 12).
