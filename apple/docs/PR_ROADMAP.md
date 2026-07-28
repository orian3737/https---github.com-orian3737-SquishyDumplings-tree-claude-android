# Apple PR Roadmap

## Roadmap invariant

Every PR must preserve one persistent dumpling per account. A skin is only an
appearance for that dumpling. Hatching, rolling, equipping, death, and revival
must never create a second pet identity.

Keep PRs independently reviewable. Each PR includes its tests and documentation
updates and leaves the Apple project runnable.

## PR 0 — Decisions, flows, and contracts

Objective: remove decisions that would change foundational implementation.

Scope:

- Complete the read-only Supabase audit.
- Resolve auth, decay, death grace, attention energy cost, notification scope,
  minimum iOS, environment, and MVP economy tuning.
- Approve low-fidelity flows for hatch, habitat, wardrobe, death/revival, and
  tiered skin rolls.
- Approve the one-dumpling schema, RLS rules, and the semantic renderer contract.

Verification:

- The build spec, context, feature audit, asset manifest, and roadmap agree.
- No unresolved item can change app identity, navigation, or data ownership.

Non-scope: production code or backend mutation.

## PR 1 — Expo foundation

Objective: create a runnable, testable Apple workspace.

Depends on: PR 0 identity and environment decisions.

Scope:

- Scaffold strict TypeScript, Expo Router, path aliases, environment validation,
  and development/preview/production EAS profiles.
- Add formatting, linting, type checking, unit-test infrastructure, CI, loading
  route, error boundary, and placeholder habitat/wardrobe/settings routes.
- Copy the shared PNG prototype assets into `apple/assets/prototype/`.
- Add the semantic pet-renderer interface with a PNG fallback implementation.

Verification:

- Expo Go launches on `/`.
- Clean formatting, lint, type check, and starter tests pass.
- No secret or Android build artifact enters the Apple bundle.

Non-scope: Supabase, real game rules, animation delivery, PiP, or production UI.

## PR 2 — One-dumpling domain engine — DELIVERED

Delivered 2026-07-27. 437 unit tests at handoff.

Objective: port and test platform-neutral pet rules.

Depends on: PR 1.

Scope:

- Model exactly one dumpling identity, needs, mood, rarity, evolution,
  lifecycle, diet, favorite food, equipped skin, wardrobe references, and semantic
  animation states.
- Port care and ambient behavior rules as pure TypeScript, including the
  diet-filtered food pool and the overfeed poop/tummy-ache rule.
- Inject clock and randomness dependencies.
- Define repository interfaces without choosing local or remote storage.

Verification:

- Boundary/table-driven tests cover stats, care, mood, behavior transitions,
  evolution, serialization, and the one-dumpling invariant.
- No domain operation can create a second pet.

Non-scope: UI, persistence, backend, coins, or delivered animation frames.

## PR 2.5 — Animation runtime spike (REMOVED)

Removed 2026-07-27. This was a Rive integration spike. Rive is not the animation
system: the pipeline is pre-rendered 3D sprite sequences, so there is no runtime to
integrate and nothing to spike.

What replaced it is smaller and needs no native dependency — extend the renderer
from one image per state to ordered frame playback across composited layers. That
work lives in PR 10, and the constraints it has to satisfy are the pre-rendered
sprite delivery contract in ASSET_MANIFEST.

## PR 3 — Local hatch and identity — DELIVERED

Delivered 2026-07-27. Repeated taps and relaunches restore the same dumpling and
cannot hatch a second; verified on device, including wiping the store to confirm the
empty-storage path.

Objective: deliver the first complete local onboarding journey.

Depends on: PR 2.

Scope:

- Build session restore routing, naming, the optional diet choice, steam-box
  opening, large steam cloud, first provisional skin reveal, and transition into
  the habitat.
- Persist the one dumpling and its first unlocked/equipped skin locally.
- Use PNG/view prototypes through the renderer boundary.

Verification:

- Repeated taps and relaunches restore the same ID and cannot hatch again.
- The flow works on small and large iPhone simulators with VoiceOver labels and
  Reduce Motion.

Non-scope: production roll authority, authentication, coins, or death.

## PR 4 — Local habitat and tactile care — DELIVERED

Delivered 2026-07-27 and verified on an iPhone 17 simulator. Two decisions changed
during the build and are recorded here because the scope below predates them:

- Cleaning became a **scrub**, not a tap, sharing the rub gesture and particle system
  with petting. A tap remains the accessible path.
- Messes are **delayed**: the dumpling waits, walks elsewhere, and leaves the pile
  there. A pile appearing under it mid-swallow read as a bug.

The former feeding-tutorial gap is closed by a skippable, persisted first-habitat
walkthrough covering feeding, cleaning, petting, and zero-energy sleep.

Also still unapproved and now visible on screen: the poop-density curve.

Objective: make the core relationship loop playable offline.

Depends on: PR 3.

Scope:

- Build the full-screen habitat environment with need indicators overlaid on it
  rather than listed in cards below it.
- Build the bottom action wheel with its feed, clean, and wardrobe segments,
  replacing the persistent tab bar. Every segment acts over the habitat; none
  navigates away. Move settings to a quiet habitat-corner control.
- Build swipe-to-throw feeding: one swipe throws one randomly chosen,
  diet-appropriate item, it lands in the environment, the dumpling walks over to
  it, and hunger updates when it eats. No food picker. Several items can be on the
  ground at once and the dumpling goes to its favorite first.
- Food is free and unlimited. Overfeeding is never refused: the surplus becomes
  poop and a tummy ache that costs happiness.
- Build rubbing/hearts, tappable poop piles, rest, and immediate pet reactions.
- Express cleanliness through poop-pile concentration only. There is no Stinky
  meter and no cleanliness meter.
- Add non-gesture accessibility alternatives, including for the wheel and the
  swipe-to-throw gesture, plus the screen-reader equivalent for pile density.
- Save local pet state and queued idempotent care events.

Verification:

- Gesture hit-testing, duplicate prevention, stat changes, poop removal,
  accessibility fallbacks, restart, and offline behavior pass.
- Food landing, walk-over, and eat resolve correctly, including for a throw that
  lands in an awkward spot, and a second swipe cannot double-feed.
- A vegetarian or vegan dumpling is never thrown meat, across a long run of random
  throws, and its pool is the same size as an omnivore's.
- Overfeeding is accepted, adds poop, costs happiness, plays the tummy-ache
  reaction, and cannot drive any need outside 0–100 however hard it is spammed.
- No coin balance, price, or spend appears anywhere in the feeding path.
- The wheel and every food item meet the 44-point target at the largest supported
  text size, and VoiceOver can reach every action without the radial gesture.
- Overlaid indicators never cover the dumpling or a tappable object on the
  smallest and largest supported iPhone.
- All actions affect the existing dumpling only.

Depends on the section 14 decisions for the poop-density curve and whether the
three foods differ in effect.

Non-scope: Supabase sync, coins, wardrobe rolls, notifications, or PiP.

## PR 5 — Lifecycle, evolution, death, and revival

Objective: complete the local care lifecycle.

Depends on: PR 4 and approved lifecycle values.

Scope:

- Add elapsed-time decay, offline cap, warnings, evolution, death, and
  steam-box revival.
- Preserve the same dumpling ID, name, history, and unlocked wardrobe.
- Use a provisional injected revival skin roll and equip its result.
- Add the approved anti-farming safeguard.

Verification:

- Injected-clock tests cover thresholds, grace, clock skew, offline cap, death,
  and idempotent revival.
- Revival never creates a new pet row or erases previously unlocked skins.

Non-scope: production roll authority, paid features, or additional pets.

## PR 6 — Supabase schema and security — SCHEMA DELIVERED

The one-dumpling foundation migration is applied locally and to the linked
project, with 15 assertions passing against real Postgres with RLS active:
two-user isolation, idempotent hatching, hostile-update resistance, replayed care
keys rejected, and anonymous lockout. Economy schema and functions move together
in PR 8 so the delivered PR 6 foundation remains closed and reproducible.

Objective: establish the canonical shared backend contract.

Depends on: PRs 2 and 5 plus the read-only audit.

Scope:

- Add reviewed migrations for profiles, the unique one-per-owner pet, and care
  events.
- Add the atomic/idempotent hatch function. Later lifecycle and economy functions
  extend this foundation in their owning PRs.
- Add constraints, indexes, triggers, RLS, migration, and rollback notes.

Verification:

- Two-user policy tests fail closed.
- Concurrent hatch calls return the same one pet.
- Mutation retries do not duplicate care, grants, spends, or skins.

Non-scope: Apple authentication UI or app sync.

## PR 7 — Authentication and local-first sync — IN PROGRESS

Auth for MVP is **email only**. The backend already enforces one pet per owner and
the app now uses `hatch_pet`, persists the Supabase session, and backs up local-first
care. Rarity is server-rolled; `skin_id` still comes from the client and must be
validated against the catalog before this PR closes.

Objective: connect the playable app to each user's canonical Supabase data.

Depends on: PR 6.

Scope:

- Done: approved email/password auth, session lifecycle, local/remote repository
  adapters, queued backup writes, conflict resolution, foreground/five-minute sync,
  sign-out cache clearing, and server-authoritative hatch rarity.
- Pending: hosted clean-account hatch verification, second-device and reconnect
  journey verification, account deletion, and server validation of the first skin.
- Revival authority remains with PR 5 because revival itself is not implemented.

Verification:

- Clean account, existing account, offline care, reconnect, retry, second
  device, sign-out, and deletion journeys pass.
- Every path restores or mutates the same one dumpling.

Non-scope: coin/roll screens, production animation art, or PiP.

## PR 8 — Earned coins, tiered skin rolls, and wardrobe

Objective: ship the platform-neutral cosmetic economy and the MVP progression
loop without enabling real-money commerce.

Depends on: PR 7.

Scope:

- Build the Store screen with daily happiness eligibility, coin balance/ledger
  UI, capped streak if approved, coin-priced skin-spin tier cards, costs, pools,
  exact odds, confirmation, reveal, and duplicate behavior. The Store accepts no
  money.
- Add reviewed migrations for skin catalog, roll tiers, owned skins, coin
  accounts, and the append-only coin ledger. Add atomic/idempotent server
  functions for the daily grant, tiered roll, equip, reversal, and support
  adjustment.
- Add the append-only, source-aware coin ledger and cached balance that every
  platform and the future web store will share. Only server functions may grant,
  spend, reverse, or adjust coins.
- Add a server-controlled web-store capability state. The `Buy more coins` action
  is presentationally complete but disabled and absent from the first TestFlight
  economy until PR 8.5 passes its storefront and commerce gates.
- Add the owned-skin wardrobe sheet and equip flow for the one dumpling. The sheet
  rises over the live habitat, previews a selected skin on the dumpling in
  context, and commits only on explicit confirm.
- Ensure revival and normal rolls use their approved pools and safeguards.

Verification:

- Server-day, clock-tampering, concurrency, insufficient-balance, atomic spend,
  seeded odds, duplicate, retry, inventory, and equip tests pass.
- Previewing a skin writes nothing: no equip, no repository write, no queued care
  event, no revision bump. Dismissing the sheet without confirming leaves the
  equipped appearance unchanged across a relaunch.
- Two-user RLS and direct API tests prove that clients cannot forge a grant,
  balance edit, ledger source, roll result, or spend.
- No payment product, enabled web checkout, purchasable coin, paid roll, or
  second pet exists.

Non-scope: real-money monetization or marketplace trading.

## PR 8.5 — Web coin store and rewarded ads

Objective: add optional cosmetic monetization without putting care or survival
behind money or advertising.

Depends on: PR 8's verified free economy, approved pricing, an ad-network/privacy
decision, a verified Stripe account configured for the disclosed game-coin
product, and the safeguards in
`MONETIZATION_STRATEGY.md` and `WEB_COIN_STORE.md`.

Scope:

- Add a separately deployed first-party website that uses the same Supabase Auth
  users and database, displays a server-owned coin-pack catalog, creates a pending
  order and Stripe Checkout Session, and redirects the player to Stripe-hosted
  Checkout.
- Keep the commerce boundary explicit: the website sells fixed coin quantities;
  the in-app Store separately spends coins on skin spins and never accepts money.
- For an approved App Store storefront, make the PR 8 `Buy more coins` action
  open the website in the default browser. Start with the United States
  storefront only; all others fail closed until their current external-purchase
  requirements are implemented and approved.
- Create pending orders on the server and grant coins only when a verified Stripe
  webhook returns the matching opaque order reference and server-side Stripe
  validation confirms the expected paid Session, Price, amount, and currency. The
  browser, app, redirect, and payment metadata supplied by a client never choose
  the owner, price, or coin quantity.
- Add a player-initiated rewarded-ad offer inside that store with a disclosed
  reward, daily cap, cooldown, completion verification, and inappropriate-ad
  reporting.
- Record `purchase` and `rewarded_ad` ledger provenance and handle pending,
  abandoned, failed, refunded, disputed, charged-back, duplicate, and
  cross-device orders.
- Keep fixed coin-price wrappers and habitat cosmetics visible as non-random
  alternatives inside the game.

Verification:

- Stripe test events and TestFlight-to-browser paths grant exactly once across
  duplicate or reordered webhooks, reused/expired/wrong-pack Sessions, retry,
  delayed payment, relaunch, second device, foreground refresh, refund, and
  dispute scenarios.
- Forged redirects, catalog values, owner IDs, prices, quantities, and unsigned
  webhooks cannot grant coins. Payment and Supabase server secrets are absent
  from the app, browser bundle, URLs, logs, and repository.
- The app never shows the link outside an explicitly allowlisted storefront.
  Each enabled region passes its current App Review, entitlement/API, reporting,
  fee, privacy, tax, receipt, refund, and support gates.
- Ad cancellation, no-fill, offline state, duplicate callback, cooldown, and daily
  cap never mint extra coins or block the free care loop.
- Exact odds are shown before any randomized spend, regardless of coin source.
- App privacy, age rating, metadata, review notes, and support copy disclose ads
  and purchases accurately.

Non-scope: paid food, paid revival, forced interstitials, expiring purchased coins,
marketplace trading, an in-app card form, or a StoreKit coin-pack product.

## PR 9 — Notifications, if included in MVP

Objective: bring users back for meaningful pet needs without spam.

Depends on: PR 7 and approved cadence.

Scope:

- Add benefit-first permission prompt, categories, frequency caps, settings,
  deep links, and lifecycle cancellation/rescheduling.

Verification:

- Opt-in/out, quiet behavior, deep links, expired sessions, death/revival, and
  privacy-safe payloads pass on a physical iPhone.

Non-scope: widgets, Live Activities, or marketing campaigns.

## Conditional early spike — PiP mini habitat

Run immediately after PR 1 if PiP is selected for MVP.

Scope:

- Prototype the Swift/AVKit bridge, user-initiated start/stop, miniature
  habitat background, renderer feed, supported sizes, lifecycle, and fallback.
- Test on a physical iPhone and document App Review positioning.

Exit:

- Promote PiP into a scoped implementation PR only if native feasibility,
  performance, product value, and review risk are acceptable.

Non-scope: Android-style transparency or code-controlled screen movement.

## PR 10 — Animation integration and experience polish

Objective: replace single-frame prototypes as pre-rendered sprite deliveries
arrive.

Depends on: PRs 4 and 8; can be updated incrementally.

Scope:

- Extend the renderer to ordered frame playback across composited layers, with
  loop/one-shot handling, completion callbacks, and a Reduce Motion hold frame.
- Map delivered sprite atlases through the semantic renderer adapter.
- Retain safe single-frame fallbacks for undelivered states.
- Verify the frame budget and atlas packing against the bundle-size targets.
- Finalize habitats, steam box, food, poop, hearts, coins, skin reveals,
  haptics, sound controls, Dynamic Type, VoiceOver, and Reduce Motion.
- Tune rendering on the oldest supported iPhone.

Verification:

- Asset manifest mappings, fallback states, animation transitions,
  accessibility, screen matrix, and performance checks pass.

Non-scope: changing game rules to fit animation files.

## PR 11 — TestFlight and release readiness

Objective: produce and verify the actual release candidate.

Depends on: every selected MVP PR and release gate.

Scope:

- Add final icons/splash, metadata, privacy details, legal/support URLs,
  analytics/crash tooling, screenshots, production configuration, EAS Submit,
  App Review notes, and rollout/rollback plan.
- Complete security, regression, migration, backup/restore, clean-install,
  upgrade, artifact, and release checklists.

Verification:

- Production-signed candidate installs on physical devices and passes the full
  critical journey.
- The exact verified build uploads to TestFlight.

Non-scope: deferred features.

## Post-MVP work

- Web coin packs and opt-in rewarded ads are planned in PR 8.5
- Widgets and Live Activities
- AI chat backend and privacy design
- Social features
