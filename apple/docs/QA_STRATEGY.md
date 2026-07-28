# Apple QA Strategy

## Quality gates

Every PR must pass:

- Formatting and linting
- TypeScript strict check
- Unit tests relevant to changed logic
- No committed secrets
- Manual smoke test of changed user flows
- Review of accessibility labels and error states for changed UI

## Test layers

### Unit

Cover pure domain behavior:

- Stat clamping at 0 and 100
- Every care action
- Food landing bounds, the walk-over, eating rather than throwing changing hunger,
  and duplicate-feed prevention
- Rub path length rather than displacement, the deliberate-gesture threshold, heart
  feedback, the annoyed reaction once affection gain hits zero, and the tap fallback
- Scrub progress per mess, resetting when the finger moves to a different one, removal
  feedback, cleanliness changes, and the pile-count curve
- The screen-reader hygiene summary, since pile density alone is invisible
- Mood and neglect thresholds
- Elapsed-time decay and catch-up cap
- Death grace/warning boundaries and idempotent revival
- First-hatch and revival-roll idempotency
- Daily coin eligibility, server-day boundaries, and duplicate-grant prevention
- Atomic coin spending, insufficient balance, roll odds configuration,
  duplicate handling, inventory, and equip behavior
- Web coin grants across created, pending, abandoned, failed, duplicate-webhook,
  refunded, disputed, charged-back, and second-device orders when PR 8.5 is
  included
- Stripe Checkout Session creation from a server-owned Price, webhook signature
  and live/test-mode verification, duplicate/out-of-order events, completed
  Sessions that are not yet paid, delayed success/failure, expiration, refund, and
  dispute when PR 8.5 is included
- Forged redirects, unsigned webhooks, modified pack IDs/Prices/amounts/coin
  quantities, cross-account order access, storefront gating, browser return, and
  foreground balance refresh when PR 8.5 is included
- Rewarded-ad completion, cancellation, no-fill, offline state, cooldown, daily
  cap, and duplicate callback behavior when PR 8.5 is included
- All rarity boundaries using injected rolls
- Evolution eligibility and maximum stage
- Behavior weights and forbidden transitions
- Serialization/migration of locally cached state

### Hook

Cover the scheduling no pure module owns. The habitat loop decides _when_ work
happens, which is where a landed meal was once dropped for the rest of the session,
so these drive the loop itself rather than a screen:

- A meal that landed while the dumpling was busy is still eaten once it frees up
- Rapid throws are served as separate meals, never merged and never double-counted
- Unmounting mid-walk cancels the frame loop and every pending timer
- A mess owed by cleanliness materialises exactly once, not once per heartbeat
- Scrub progress restarts when the finger moves to a different mess
- The dumpling never walks past the deepest usable point on the floor

These run in Node with `react-test-renderer`. The loop returns a plain object and
renders no host components, so no DOM, no simulator, and no React Native preset is
involved, and the pure-domain tests stay in the same fast environment. Fake timers
plus an injected `requestAnimationFrame` make walks and timers deterministic — see
`src/test-support/`. Never make these sleep.

### Component

Cover:

- Stat values and accessible labels
- Disabled/in-flight care actions
- Locked and unlocked evolution explanations
- Loading, error, offline, pending-sync, and empty states
- Large text and Reduce Motion variants
- Renderer state mapping and fallback behavior for undelivered states
- First-habitat tutorial order, Back/Next/Skip/Done controls, accessible copy, and
  one-time persistence independent from pet state

### Sprite animation

- Verify every semantic state resolves to something drawable, including states with
  no delivered frames, so a missing asset degrades instead of blanking the pet.
- Verify a base state and a skin layer stay in lockstep: same frame count, same
  anchor, no drift across a full loop.
- Verify loops join seamlessly and one-shots settle into their declared state.
- Verify Reduce Motion holds the designated frame rather than playing the sequence.
- Verify animation frames do not rerender the habitat.
- Measure decode and draw cost on the oldest supported iPhone during the busiest
  habitat moment, not on an idle loop.

### Integration

Use a non-production Supabase environment:

- Session create/restore/refresh/sign-out
- Create one pet idempotently
- Apply one care event once despite retries
- Offline queue and reconnect
- Optimistic-concurrency conflict
- Account deletion
- Coin ledger and owned-skin isolation
- Two-device simultaneous daily claims and skin rolls
- Schema migration from the preceding release

### Security

Automate two-user tests proving:

- User A cannot read or mutate User B's profile, pet, or events.
- A client cannot insert another `owner_id`.
- An anonymous session has only explicitly intended access.
- Service-role and private keys are absent from bundles/logs.
- Account changes clear prior-user cache and cancel stale requests.

### End-to-end/manual

Critical journey:

1. Install clean build.
2. Complete auth/onboarding.
3. Name and reveal one pet.
4. Confirm the first habitat visit presents Feed, Clean, Pet, and Sleep in order.
   Exercise Back once, then finish or skip; relaunch and confirm it does not
   reappear while the pet snapshot continues to restore.
5. Flick food from the wheel and confirm it lands, the dumpling walks over, and
   hunger changes on eating rather than on throwing. Rub the dumpling for hearts, and
   once it is fully happy confirm it shows the annoyed reaction instead. Wait for a
   mess to be left, scrub it away, and exercise the rest interaction. Force energy
   to zero and confirm the pet stays asleep without walking, shows Do Not Disturb,
   blocks pet/feed/wardrobe interaction with the sleep notice, and recovers one
   Rest increment after the uninterrupted prototype nap.
6. Force-close and restore.
7. Go offline, care for pet, relaunch, reconnect, and verify one application.
8. Reach/evaluate evolution.
9. Sign out and verify private state disappears.
10. Restore on a second device/account session.
11. Earn the daily coin reward, complete each roll tier with seeded test
    outcomes, equip an owned skin, and verify the same balance/inventory on a
    second device.
12. Request account deletion.

If included in the candidate, also verify notification opt-in, cadence,
deep-link destinations, and the PiP mini habitat on a physical iPhone.

## Device matrix

At minimum:

- Smallest supported iPhone screen
- A current standard-size iPhone
- A large/Dynamic Island iPhone
- Oldest supported iOS version
- Current public iOS version
- Current iOS Simulator for fast regression
- Physical device for haptics, lifecycle, auth redirects, notifications,
  purchases, PiP, and performance

Test light/dark appearance if both are supported, portrait orientation, largest
accessibility text sizes, VoiceOver, Reduce Motion, Low Power Mode, slow
network, airplane mode, and interrupted auth.

## Time-dependent testing

Inject a clock into domain and repository code. Never make unit tests sleep.
Test:

- Future/skewed device clocks
- DST and timezone changes
- Minutes, hours, days, and periods beyond the catch-up cap
- App background/foreground transitions
- Server timestamps differing from device time

## Animation and asset QA

- No clipping at safe areas or tab bars
- Stable frame rate on the oldest supported device
- Correct behavior-to-animation mapping
- Graceful fallback when an asset fails to load
- No immediate behavior repeats or forbidden transitions
- Reduced Motion alternative
- Audio respects mute/settings and does not unexpectedly interrupt other audio

## Release regression

Before TestFlight promotion:

- Run the entire critical journey against production-like configuration.
- Verify build number, environment, bundle ID, signing, deep links, legal URLs,
  analytics, crash reporting, and deletion endpoint.
- Review bundle/config/logs for secrets and development endpoints.
- Confirm database backup and migration rollback procedures.
- Record known issues and App Review notes.
