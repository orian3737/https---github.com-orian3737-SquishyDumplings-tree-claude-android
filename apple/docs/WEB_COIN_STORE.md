# Squishy Dumplings Web Coin Store

Status: approved architecture for PR 8 and PR 8.5; not implemented.

## Decision

Coin packs are sold by a separate, first-party website rather than by StoreKit
products. The iPhone app's eligible `Buy more coins` action opens that website in
the device's default browser. The player signs in with the same Supabase account,
completes a hosted checkout, and receives coins in the same server ledger used by
the Apple app and future platform clients.

The two stores have different jobs:

- The in-app Store accepts **only in-game coins**. It lets a player spend coins on
  disclosed skin-spin tiers and, later, fixed-price skins or habitat cosmetics.
  It contains no money price, card form, or cash checkout.
- The web coin store accepts **real money** for fixed coin packs. It does not sell
  or resolve skin spins, choose a random reward, or mutate skin inventory.

The bridge between them is only the signed-in player's canonical Supabase coin
balance. Buying a pack on the web adds coins; spending those coins on a skin spin
remains a separate, server-authoritative action initiated inside the game.

This removes Apple from payment processing. It does **not** remove App Store,
privacy, tax, consumer-protection, age-rating, or regional external-purchase
obligations. The website may exist globally, but the iPhone app must show a
purchase link only in storefronts where the submitted build is allowed and
configured to do so.

Initial commercial release policy:

- Enable the in-app web-store action for the United States App Store storefront
  only after a fresh App Review check and approval of the exact copy and flow.
- Hide the action in every other storefront by default. A region can be enabled
  only after its current entitlement, StoreKit API, reporting, fee, and disclosure
  requirements are implemented and reviewed.
- Do not silently infer eligibility from device locale, language, IP address, or
  billing country. Use the App Store storefront and a server-controlled allowlist.
- A web visitor may still navigate to the store independently. The iPhone client
  simply does not steer an ineligible storefront to it.

Apple's rules change. Before each commercial submission, re-check
[App Review Guidelines 3.1.1 and 3.1.1(a)](https://developer.apple.com/app-store/review/guidelines/)
and the current
[External Purchase documentation](https://developer.apple.com/documentation/storekit/external-purchase).

## Product flow

1. The signed-in player opens the in-app Store.
2. When the current App Store storefront is allowlisted, the Store shows
   `Buy more coins`. Final review copy may also name the approved first-party
   domain when the storefront rules require it.
3. The app opens one canonical HTTPS URL in the default browser, not a web view.
   It does not append a Supabase access token, refresh token, user ID, email
   address, price, or pack ID.
4. The website asks the player to sign in with the same Supabase account. An
   existing safe browser session may satisfy this step.
5. The site displays the server-owned pack catalog. Its authenticated server
   creates a pending order and a Stripe Checkout Session containing only that
   server-owned order reference.
6. The browser redirects to Stripe-hosted Checkout. Stripe resolves the configured
   Price; the browser never supplies a monetary amount or coin quantity.
7. Stripe sends a signed server-to-server webhook containing the Checkout Session
   and order reference. A successful browser redirect is never proof of payment.
8. The webhook handler verifies that the expected order is paid, records the
   Stripe event, and credits the order's bound account once in one database
   transaction.
9. The completion page tells the player that the coins were added and offers a
   `Return to Squishy Dumplings` link. On foreground or deep-link return, the app
   refreshes the canonical balance and recent ledger entries.

If the player buys through the wrong account, support uses the external order ID
and immutable ledger—not a client balance edit—to investigate. The checkout page
must show the signed-in email or other non-sensitive account label before payment.

## Repository and deployment boundary

PR 8.5 adds a separate root workspace:

```text
coin-store/
  app/                 # public pages, sign-in, catalog, completion, history
  server/              # Stripe Checkout Session creation and webhook
  tests/
  .env.example
```

The exact web framework remains an implementation decision; Stripe Checkout is
the selected payment provider. The store is independently deployable from
`apple/`, owns no Apple app secret, and uses the same Supabase project, Auth users,
database, and generated schema contract as every game client. Development and
production use separate Supabase projects, Stripe test/live modes, restricted API
keys, webhook secrets, domains, Products, and Prices.

Only the website/server runtime may hold the Stripe secret key, Stripe webhook
secret, or Supabase service-role credential. No secret enters Expo public
environment variables, browser JavaScript, a URL, analytics, or Git.

## Payment provider: Stripe

Direct Stripe Checkout is the selected checkout provider. Complete account and
business verification before production and describe the product accurately:
fixed packs of non-transferable game coins, issued and accepted only by Squishy
Dumplings, with no cash value, redemption, transfer, or player marketplace.

As reviewed on 2026-07-28:

- Stripe's current restricted-business policy distinguishes game operators by
  allowing the sale of in-game currency or items when the seller operates the
  virtual world. Squishy Dumplings is the operator of this game.
- Stripe Checkout lets the server create a session with a
  `client_reference_id` or metadata order ID, then redirects the buyer to a
  Stripe-hosted page. This removes manual purchase codes and email matching.
- Stripe signs webhook requests and retries failed deliveries. Events can arrive
  more than once or out of order, so the local event log and state transition
  remain idempotent and order-independent.
- Direct Stripe makes Squishy Dumplings responsible for configuring tax
  collection/remittance, receipts, refunds, disputes, privacy disclosures, and
  customer support. Stripe Tax may assist but does not replace review of those
  obligations.
- Buy Me a Coffee is not used for coin fulfillment. It may remain a separate
  support/tip channel if desired.
- Paddle is rejected for coin packs because its current Acceptable Use Policy
  lists virtual currency or stored value as prohibited.

References:

- [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe Checkout lifecycle](https://docs.stripe.com/payments/checkout/how-checkout-works)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)
- [Stripe pricing](https://stripe.com/pricing)
- [Paddle Acceptable Use Policy](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle)

For each checkout, the first-party site creates an opaque pending order bound to
the authenticated owner and expected catalog pack. The server—not the browser—
maps that pack to a Stripe Price and creates a single-use Checkout Session with
the order ID in `client_reference_id` and/or metadata. Do not place a Supabase
user ID, token, email, coin quantity, or other sensitive account data in Stripe
metadata when the opaque order ID is sufficient.

The signed webhook must return that order reference. The handler uses the webhook
object and, when fields are not expanded, a server-side Stripe retrieval to
validate the expected Session, PaymentIntent, Product/Price, amount, currency,
live/test mode, and paid state before fulfillment. Matching by customer email,
display name, success-page redirect, or a client-supplied Supabase user ID is
forbidden.

## Server-owned data model

PR 8 establishes the platform-neutral economy before the store is built:

- `coin_accounts`: one row per owner with the cached spendable balance.
- `coin_ledger`: append-only grants, spends, reversals, and support adjustments,
  each with source, amount, server timestamp, and idempotency key.

PR 8.5 adds the commerce records:

- `coin_pack_catalog`: stable pack IDs, Stripe Product/Price IDs, granted coin
  quantities, availability, and display ordering. Monetary amounts and provider
  mappings remain server-owned.
- `external_orders`: owner, pack, Stripe Checkout Session, PaymentIntent, and
  Charge IDs, currency, gross amount, status, expiration, and timestamps.
- `payment_events`: immutable webhook receipt keyed by provider event ID.

The ledger is canonical and the balance is a transactionally maintained cache.
Clients may read only their own account, ledger, and orders. No client may insert
a purchase grant, update a balance, choose a monetary amount, choose a coin
quantity, or mark an order paid.

The checkout-creation endpoint accepts only a stable catalog pack ID. It resolves
the authenticated user, Stripe Price, currency, and coin quantity on the server,
creates the pending order, and creates the corresponding Stripe Checkout Session.
The webhook verifies the `Stripe-Signature` against the raw request body, requires
the expected live/test mode, resolves the opaque order reference, validates the
provider objects and paid state, and atomically:

1. inserts the unique provider event;
2. transitions the order to its valid next state;
3. inserts the unique purchase ledger entry; and
4. updates the cached balance.

A repeated event, Session, PaymentIntent, Charge, redirect, retry, second device,
or concurrent webhook returns the already-recorded result without granting again.

For card and wallet launch methods, grant from a paid
`checkout.session.completed`. If delayed payment methods are enabled later, a
completed but unpaid Session remains pending; grant only after the corresponding
`checkout.session.async_payment_succeeded` or another verified paid state. Process
expiration, asynchronous failure, refunds, and disputes as separate valid state
transitions. Stripe webhook arrival order is not authoritative.

Refunds, reversals, disputes, partial refunds, and chargebacks create compensating
ledger entries and preserve the original purchase. Before launch, product and
support must approve how a reversal behaves when some purchased coins have
already been spent; the implementation may not delete history or fabricate a
client-side balance.

## Authentication and handoff

The website and game clients share Supabase Auth, so the stable join key is
`auth.users.id`. They do not share raw session credentials through a URL.

- Use normal Supabase browser authentication and allowlisted redirect URLs.
- Never put an access token, refresh token, password, service key, or user ID in
  the outbound app URL.
- Never trust an `owner_id`, email, price, quantity, success flag, or return URL
  supplied by the browser.
- Protect Checkout Session creation with an authenticated server session, CSRF
  defenses, origin validation, rate limits, and a short-lived server-created
  pending order.
- Redact tokens, payment details, and webhook bodies from logs and analytics.
- Use Stripe-hosted Checkout so card data does not pass through Squishy Dumplings
  infrastructure.

## App boundary

The Apple app knows only:

- whether the web-store action is enabled for the current storefront;
- the canonical HTTPS store URL and approved button copy;
- how to open the default browser;
- how to refresh balance and history when it becomes active again; and
- how to show a pending, delayed, failed, or support state without granting coins.

The app does not contain payment SDK keys, provider price IDs, card UI, webhook
logic, or a purchase-credit fallback. It never assumes that returning from the
browser means payment succeeded.

Rewarded ads remain a separate, optional grant source. They use the same ledger
and idempotency rules but do not share an order or masquerade as a purchase.

## Compliance and release gate

For each enabled storefront:

- confirm the current App Review rule and whether an entitlement and prescribed
  StoreKit external-purchase API are required;
- implement any required disclosure sheet, external purchase token capture,
  transaction reporting, fee reporting, and review-note disclosure;
- confirm whether in-app purchase parity is required for externally acquired
  consumables;
- retain the clear product boundary: money buys only fixed coin packs on the web,
  while coins buy skin spins or fixed cosmetics inside the game;
- verify tax calculation/remittance, receipts, refunds, chargebacks, customer
  support, privacy disclosures, and Stripe terms;
- place purchase opportunities behind a parental gate if the app enters the Kids
  Category or another rule requires it; and
- obtain product/legal review rather than describing this architecture as
  “no Apple compliance.”

If a storefront cannot meet the gate without adding StoreKit products, that
storefront keeps the external-purchase action hidden. The free earned-coin loop
and all care remain available.

## Acceptance criteria

- The web store and app resolve the same Supabase user and balance.
- The app opens an approved HTTPS page in the default browser only for an
  allowlisted storefront.
- A forged redirect, client request, price, pack quantity, or owner ID cannot
  mint coins.
- A Stripe Checkout Session can fulfill only its live, unused pending order for
  the same catalog pack, Price, amount, and currency.
- One settled provider payment produces exactly one purchase grant across
  duplicate, reordered, and concurrent webhooks.
- Failed, abandoned, pending, refunded, disputed, and charged-back orders produce
  the approved ledger state.
- The app reflects a completed grant after foreground refresh without requiring a
  reinstall, sign-out, or manual support edit.
- RLS proves that two users cannot read or mutate each other's balance, ledger, or
  orders.
- Payment and Supabase secrets are absent from the app bundle, browser bundle,
  repository, URLs, logs, and analytics.
- Storefront gating, review notes, disclosures, receipts, refund support, and
  regional reporting are verified before the button is enabled.
