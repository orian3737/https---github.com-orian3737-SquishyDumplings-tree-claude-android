# Apple Release Checklist

## Product

- [ ] MVP scope matches `BUILD_SPEC.md`; deferred features are not half-enabled.
- [ ] Final name, icon, splash, screenshots, subtitle, description, keywords,
      category, age rating, and review notes are approved.
- [x] A technically valid 1024×1024 opaque icon candidate and launch splash are
      configured; final visual approval remains part of the item above.
- [ ] Pet art, audio, fonts, and third-party licenses are documented.
- [ ] No placeholder emoji, copy, URL, or account remains.

## Accounts and ownership

- [x] Expo project belongs to the intended owner/organization
      (`@dinosaur5/squishy-dumplings-apple`).
- [ ] Apple Developer membership, agreements, tax, and banking status are valid.
- [x] Bundle identifier and App Store Connect app match production config.
- [ ] Team access follows least privilege; recovery owners are documented.
- [ ] Production Supabase project and backup owners are documented.

## Build and signing

- [ ] `development`, `preview`, and `production` EAS profiles are validated.
- [ ] Production environment variables point only to production services.
- [x] Version and build numbers are correct and unique for the first TestFlight
      candidate (`0.1.0 (1)`).
- [x] Distribution certificate, provisioning, entitlements, and capabilities
      match the app.
- [x] A clean production build completes through EAS.
- [x] Build `0.1.0 (1)` was uploaded to TestFlight and installed on a physical
      iPhone. Its review findings are included in build `0.1.0 (2)`, which was
      accepted by App Store Connect and still needs the same device pass before it
      becomes the release candidate.

## Backend and security

- [ ] Reviewed migrations are applied and recorded.
- [ ] RLS is enabled on every user-owned/exposed table.
- [ ] Two-user isolation and idempotency tests pass.
- [ ] Daily coin grants, ledger balance, roll spends/results, inventory, and
      equip operations pass retry and concurrency tests.
- [ ] No service-role key, Apple private key, AI key, or secret is in the app,
      repository, source map, logs, or EAS public variables.
- [ ] Rate limits/abuse controls exist for privileged endpoints.
- [ ] Backup restore and migration rollback have been rehearsed.
- [ ] Account deletion removes or schedules removal of associated data.

## Privacy and policy

- [ ] Privacy policy and support URLs are public and accurate.
- [ ] App Store privacy answers match actual SDK/data behavior.
- [ ] Required purpose strings and privacy manifests are present.
- [ ] Tracking is absent or consent is correctly implemented.
- [ ] Sign in with Apple requirements are satisfied if third-party login exists.
- [ ] Data retention, export, deletion, and support processes are documented.
- [ ] Export compliance and content rights answers are complete.

## Quality

- [ ] All automated quality gates pass from a clean checkout.
- [ ] Critical journey passes on the full minimum device matrix.
- [ ] VoiceOver, Dynamic Type, contrast, Reduce Motion, and 44-point targets pass.
- [ ] Offline/reconnect, clock skew, session expiry, and second-device restore
      pass.
- [ ] Hatch, gesture care, death warnings, and revival behavior match the
      approved lifecycle rules.
- [ ] The Feed/Clean/Pet/Sleep tutorial is readable, skippable, accessible, and
      appears only once after completion or skip.
- [ ] Every earned skin-roll tier displays its coin cost, pool, exact odds, and
      duplicate behavior.
- [ ] The first TestFlight economy contains no enabled web checkout, purchasable
      currency, rewarded ad, or real-money purchase prompt unless PR 8.5 is
      explicitly included in that candidate.
- [ ] Included notifications respect opt-in, frequency controls, settings, and
      deep links.
- [ ] Crash and error monitoring receive a release-candidate test event without
      private data.
- [ ] No known P0/P1 defects remain; accepted lower-severity issues are listed.

## Web purchases and rewarded ads, when PR 8.5 is included

- [ ] The first-party store, verified Stripe account, server-owned pack catalog,
      Product/Price mappings, prices, tax behavior, receipts, refunds, disputes,
      and support ownership are approved.
- [ ] Stripe onboarding accurately describes non-transferable game coins used for
      cosmetic spins, with no cash value, redemption, transfer, or player
      marketplace.
- [ ] The website sells fixed coin quantities only. The in-app Store accepts only
      coins for skin spins/fixed cosmetics and contains no money checkout.
- [ ] The in-app link is enabled only for explicitly allowlisted App Store
      storefronts. The United States is the initial target; every other storefront
      fails closed until its current external-purchase rules are implemented.
- [ ] Each enabled storefront's App Review, entitlement/API, reporting, fee,
      disclosure, and in-app-purchase-parity requirements are documented and pass.
- [ ] The default browser—not a web view—opens a canonical first-party HTTPS URL
      without a Supabase token, user ID, email, pack, or price in the URL.
- [ ] Exact randomized reward odds appear before purchase.
- [ ] Purchased coins do not expire. A verified Stripe webhook grants
      exactly once across retries, reordered callbacks, relaunches, and devices.
- [ ] Created, pending, abandoned, failed, refunded, disputed, charged-back, and
      duplicate orders are tested with immutable ledger history.
- [ ] Forged browser success, user/owner IDs, catalog values, prices, quantities,
      and unsigned webhooks cannot grant coins.
- [ ] The signed Stripe webhook returns the opaque server order reference, and
      server-side Stripe validation confirms the expected paid Session, Price,
      amount, and currency. No grant is matched by buyer email, display name, or
      redirect alone.
- [ ] Stripe and Supabase server secrets are absent from the app,
      browser bundle, repository, URLs, logs, and analytics.
- [ ] Rewarded ads are opt-in, store-only, age-appropriate, capped, cooldown
      protected, completion-verified, and offer inappropriate-ad reporting.
- [ ] Ad cancellation, no-fill, offline behavior, and duplicate callbacks never
      mint coins or block care.
- [ ] Store copy, App Review notes, privacy disclosures, age rating, receipts,
      refunds, and support explain the system.

## PiP/extensions, only if included

- [ ] Native capability and background modes are justified and minimal.
- [ ] Behavior matches Apple's documented API purpose.
- [ ] PiP begins through an appropriate user action.
- [ ] System-controlled position/size and non-transparent presentation are
      reflected in product copy.
- [ ] Widgets/Live Activities contain no unavailable interaction promises.
- [ ] Early App Review risk and fallback behavior are documented.

## Submission and rollout

- [ ] Internal TestFlight sign-off is recorded.
- [ ] App Review demo account/instructions work and expose all reviewed features.
- [ ] App Review notes explain Supabase auth and any non-obvious behavior.
- [ ] Phased release decision, monitoring owner, rollback response, and support
      coverage are set.
- [ ] Release tag/changelog matches the submitted build.
- [ ] Post-release dashboards and first-day checks are scheduled.
