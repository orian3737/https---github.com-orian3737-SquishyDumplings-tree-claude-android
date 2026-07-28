# Squishy Dumplings Monetization Strategy

Status: product direction for commercial launch; not implemented in the current
TestFlight prototype.

## Principle

Monetization pays for customization, not care. Food, cleaning, attention, rest,
revival, and the ability to keep a dumpling healthy remain free. A player must
never watch an ad or spend money to prevent neglect.

Coins may come from three clearly labeled sources:

1. Care rewards earned through play.
2. Coin packs purchased on the first-party Squishy Dumplings website.
3. Optional rewarded ads that grant a disclosed number of coins after a completed
   view.

All three enter one append-only server ledger with `earned`, `purchase`, or
`rewarded_ad` provenance. The client displays the spendable total, while support
and fraud tooling retain the source breakdown.

## Store shape

The in-app Store should feel like a cozy customization counter rather than a
casino. It never accepts money:

- `Earn`: daily happiness reward, current progress, and an optional rewarded-ad
  offer.
- `Skin spins`: coin-priced tiers with the pool, exact odds, duplicate behavior,
  and any protection rule visible before confirmation.
- `Featured skins`: fixed coin-price wrappers alongside randomized spins. A
  visible direct path gives players who dislike chance a clear alternative.
- `Habitat`: cosmetic room themes, plants, steamer styles, and seasonal decor as
  additional coin sinks.
- `History`: recent grants, purchases, reversals, and spends in friendly language,
  plus receipts and support entry points.
- `Buy more coins`: an eligible outbound action that opens the separate
  first-party web store in the default browser.

The web coin store has a small set of fixed packs and no skin-spin UI. Working
pack sizes for testing are 100, 550, and 1,200 coins; prices and bonus percentages
remain provisional until the spin economy is simulated.

Potential marketable offers:

- A one-time web welcome pack containing a fixed base quantity plus disclosed
  bonus coins.
- Fixed coin-price seasonal cosmetic collections inside the game that return
  later; avoid false scarcity.
- A first-roll discount funded by earned coins.
- A duplicate-protection meter or crafting credit that makes every roll useful.
- An optional ad-supported daily bonus that never interrupts habitat play.

## Rewarded-ad rules

Rewarded ads are opt-in and initiated from the store. Do not use automatic
interstitials in the habitat.

- Show the exact reward before playback, for example, “Watch one ad for 20 coins.”
- Pay only after the ad provider reports completion. Use a server-verified callback
  when the selected network supports one and an idempotency key for every reward.
- Start with a provisional cap of three rewarded views per server day, separated by
  a cooldown. Tune only after retention and player-sentiment review.
- Never place the offer in a hunger warning, death/revival flow, onboarding, or
  immediately after a failed roll.
- A failed, unavailable, or closed ad produces no penalty and leaves care fully
  usable.
- Provide a visible way to report inappropriate ads. Ads must match the app's age
  rating, privacy disclosures, consent flow, and tracking choices.

## Purchasable-coin rules

- Coin packs are web products, not StoreKit products. The iPhone app never accepts
  card details and never grants coins based on a browser redirect.
- The web checkout sells a disclosed, fixed number of coins. Skin spins happen
  later inside the game as a separate coin spend; the payment provider never
  resolves a random cosmetic result.
- The web store uses the same Supabase Auth users and database as the game. The
  player signs in on the website; app session tokens and user IDs are never passed
  through the outbound URL.
- Stripe-hosted Checkout handles payment details. Its signed server-to-server
  webhook is the only payment authority.
- Purchased coins do not expire.
- Record provider orders and events idempotently, then grant exactly once across
  webhook retries, relaunches, and devices.
- Handle created, pending, abandoned, failed, refunded, disputed, and charged-back
  orders with immutable ledger entries rather than inventing client-side balance.
- Show localized price, coin quantity, and any bonus before confirmation.
- Maintain a useful free earning path. Purchases accelerate cosmetic choice; they
  do not unlock care or survival.
- The web store may be globally reachable, but the app's purchase link is
  storefront-gated. It starts enabled only for the United States App Store
  storefront and fails closed elsewhere until the current regional Apple
  entitlement, API, reporting, fee, and disclosure requirements are implemented.

See `WEB_COIN_STORE.md` for the authentication, Stripe Checkout Session, webhook,
ledger, provider-verification, storefront, security, and deployment contract.

## Random rewards and trust

If purchased or ad-earned coins can fund a randomized wrapper roll:

- Disclose the exact odds for every obtainable rarity or item before confirmation.
- Keep result selection and balance mutation atomic and server-authoritative.
- Publish duplicate behavior and any pity/protection rule beside the odds.
- Do not create near-miss animations, countdown pressure, disguised spending, or
  repeated purchase prompts after a loss.
- Review age rating, regional rules, App Review notes, and store copy before
  enabling paid currency in production.

## Measurement

Evaluate marketability without collecting pet names or private account content:

- Store visit to purchase conversion
- Rewarded-ad opt-in and completion rate
- Free-earner versus purchaser seven- and thirty-day retention
- Direct wrapper versus randomized roll preference
- Duplicate frustration, refund rate, and support contacts
- Revenue per daily active user alongside care-session satisfaction

No monetization experiment ships unless crash-free sessions, checkout and webhook
reliability, privacy disclosure, storefront compliance, and the free care loop
remain healthy.
