# Squishy Dumplings: Product Overview

## One-sentence pitch

Squishy Dumplings is a cozy pocket companion whose appearance and personality
grow from the small care choices its owner makes each day.

## Product promise

Opening the app should feel like checking in on a tiny friend, not servicing a
dashboard. The dumpling communicates its needs through expression and behavior;
the stat UI explains those signals without overpowering them.

## Audience

- People who enjoy Tamagotchi-like care loops
- Cozy-game and cosmetic-collection fans
- Users who want brief, low-pressure daily interactions
- Friends who enjoy comparing the personalities and looks their pets develop

Each user has one persistent dumpling. The product is about caring for and
customizing that companion, not collecting separate pets. Skins change the
same dumpling's appearance without creating a new identity.

## Core loop

1. Hatch a first skin from a steam box that opens into a large cloud of steam.
2. Notice the dumpling's mood or need.
3. Flick food from the action wheel into the room and watch the dumpling walk over
   to eat it, rub the dumpling for attention and hearts, or scrub a mess away in a
   burst of bubbles.
4. Receive an immediate visual, motion, sound, and optional haptic response.
5. Return later as needs change with elapsed time and notifications.
6. Build sufficient wellbeing and history to evolve.
7. If sustained neglect causes death, return the dumpling to the steam box and
   revive the same dumpling with a newly rolled skin.

The loop should work in sessions shorter than a minute while leaving room for
longer playful observation.

## Experience principles

### Pet first

The habitat and dumpling are the visual center. Meters and buttons support the
relationship instead of making the product feel clinical.

### Consequences with a recovery ritual

Neglect may eventually cause death, but it must never feel arbitrary. The app
warns the owner clearly and gives reasonable recovery opportunities. Death
leads to a hopeful steam-box revival and a new skin rather than a permanent
dead end. The dumpling keeps its name, identity, history, and unlocked wardrobe.

### Legible cause and effect

Every action visibly changes the relevant need. Time-based changes are
consistent and explainable.

### Platform-authentic

Android's pet may roam through a system overlay. iPhone's pet lives richly
inside the app. Its planned outside-app presence is an experimental PiP mini
habitat, opt-in notifications, and potentially later widgets, Live Activities,
or Dynamic Island surfaces.

### Care-funded collection with optional acceleration

Keeping a dumpling happy earns coins once per day. Commercial launch may also
offer coin packs through a first-party web store and opt-in rewarded ads. An
eligible in-app action opens the web store in the default browser; checkout and
the app share the player's Supabase account and coin ledger. The website sells
fixed coin quantities; the in-app Store uses coins for skin spins and fixed
cosmetics but never accepts money. These paths
accelerate cosmetic collecting; they never replace the useful free earning path
or touch care and survival. Every roll still shows its cost, pool, exact odds, and
duplicate rules so the system feels fair and understandable.

**Coins buy appearance, never survival.** Food is free and unlimited and sits entirely
outside the economy. Charging for it would mean a neglected dumpling could not afford
to be fed, so the player who most needs to recover would be the one least able to —
and it would build the shape of "buy currency to feed your starving pet," which
becomes the business model by accident the moment coins are purchasable.

## MVP product scope

### Onboarding

- Explain the care loop and the iPhone experience honestly.
- Create or restore a session.
- Open a steam box into a large steam cloud, reveal the first skin, and name the
  dumpling.

### Habitat

- The environment is the screen. The dumpling lives in a room that fills it.
- Overlay hunger, energy, happiness, and mood on that room. Rarity and evolution are
  reachable without leaving it.
- Feed by flicking food from the action wheel into the room. It lands, and the
  dumpling walks over and eats it — hunger changes when it eats, not when you throw.
- Give attention through a rubbing gesture that produces hearts. Once the dumpling is
  as happy as it gets, it says so instead, since there is no meter for affection
  headroom.
- **Cleanliness has no meter.** It is read entirely from how many messes are on the
  floor. The dumpling wanders off and leaves them a little while after eating; scrub
  one and it lifts in a burst of bubbles. Screen readers get the same information from
  a spoken summary, because pile density on its own is invisible to them.
- Offer an understandable rest interaction.
- Animate immediate reactions and ambient idle behavior.
- At zero energy, hold a full sleeping mode: no walking, a visible Do Not Disturb
  state, and a short uninterrupted nap before energy begins to recover.

### Return and presence

- Use opt-in push notifications for meaningful needs and lifecycle events.
- Explore a PiP mini habitat that keeps the dumpling visible over other apps.

### Persistence and sync

- Continue offline using the last known local state.
- Reconcile with the signed-in user's Supabase state.
- Never expose one user's pet to another user.

### Coins and skins

- Award coins at most once per server day when the dumpling meets the approved
  happiness requirement.
- Show coin balance and daily reward status without turning care into a chore.
- Offer skin-roll tiers with different coin costs, pools, and disclosed odds.
- Save unlocked skins and allow the user to equip an owned skin.
- Keep all rewards, spends, and rolls server-authoritative and retry-safe.

### Settings and trust

- Sound and haptic controls
- Account/session state
- Privacy and support links
- Sign out and account deletion entry points
- App version/build identifier

## Success signals

Initial product metrics should answer:

- Do users finish onboarding and meet a dumpling?
- Do they return the next day and within seven days?
- Which care actions are used?
- Do users understand why evolution is or is not available?
- How often do sync errors or crashes interrupt care?

No analytics event may contain pet names, email addresses, auth tokens, or
message contents.

## Commercial opportunities

- Coin packs through a separate, cross-platform web store backed by the same
  Supabase project
- Optional, player-initiated rewarded ads for a disclosed coin grant
- Fixed coin-price wrappers and habitat decorations as a non-random alternative
- A one-time fixed web coin pack and coin-priced seasonal cosmetic collections
- The detailed safeguards and test ideas in `MONETIZATION_STRATEGY.md`

## Future opportunities

- AI conversation mediated by a server-side proxy
- Widgets and Live Activities for lightweight check-ins
- Shared challenges or friend visits
