# Apple Workspace Instructions

These instructions apply to everything under `apple/`.

## Mission

Build the iPhone version of Squishy Dumplings as an Expo + React Native +
TypeScript app. Preserve the product's personality and shared data behavior
without pretending iOS can reproduce Android's unrestricted system overlay.

## Source of truth

Read these files before implementation:

1. `CODEX_CONTEXT.md`
2. `docs/CODEX_BUILD_METHOD.md`
3. `docs/PRODUCT_OVERVIEW.md`
4. `docs/BUILD_SPEC.md`
5. `docs/FEATURE_AUDIT.md`
6. `docs/ASSET_MANIFEST.md`
7. `docs/PR_ROADMAP.md`
8. `docs/MONETIZATION_STRATEGY.md`
9. `docs/WEB_COIN_STORE.md`
10. `docs/QA_STRATEGY.md`
11. `docs/RELEASE_CHECKLIST.md`

If the documents disagree, use this priority:

1. The user's latest explicit instruction
2. `docs/BUILD_SPEC.md`
3. `CODEX_CONTEXT.md`
4. The remaining planning documents

Update the relevant document when a product or architecture decision changes.

## Engineering rules

- Keep Apple code and configuration inside `apple/` unless a shared,
  platform-neutral package is intentionally introduced.
- Use TypeScript with strict type checking and Expo Router.
- React Compiler lint rules are enabled and enforced. Fix what they flag rather than
  suppressing it: this session they caught refs read during render, a self-recursive
  callback, a ref seeded from props, and mutable scratch state that was not needed.
- Platform modules stay behind a port. Storage is reached through `KeyValueStore` with
  exactly one Expo adapter, which is what keeps the layers above it unit-testable in
  Node with no simulator and no mocked runtime.
- Start with Expo Go. Move to an Expo development build only when a required
  native dependency or capability demands it.
- Keep routes in `app/`; keep components, hooks, services, state, types, and
  tests outside `app/`.
- Use kebab-case filenames.
- Prefer Expo-supported packages and Continuous Native Generation. Do not
  commit a generated `ios/` directory until native customization is required
  and the team records that decision.
- Never place a Supabase service-role key, Apple private key, purchase secret,
  or AI provider secret in the app or in Git.
- Only `EXPO_PUBLIC_` values safe for client exposure may enter the bundle.
- Apply Row Level Security to every user-owned Supabase table before the app
  writes production data.
- Treat the Android implementation as behavioral reference, not code that can
  be copied directly. The project-owned assets under `app/sprites/` are approved
  for reuse in the Apple app; preserve their formats and canonical filenames.
- The production animation pipeline is pre-rendered 3D: models authored in 3D,
  rendered to ordered 2D sprite frames, layered into animations. There is no 3D and
  no animation runtime at runtime — the app draws images. Rive is parked.
- Until real deliveries arrive, use the shared single-frame PNGs and simple React
  Native view effects behind the same pet-renderer interface.
- Screens and game logic must depend on semantic pet states, never on an animation
  source's file, layer, sequence, or input names.
- Do not add `expo-gl`, three.js, a live 3D runtime, or an animation runtime without
  an explicit revision to `BUILD_SPEC.md` section 2.
- Keep randomness that affects paid rewards server-authoritative and auditable.
- Do not add paid spins, marketplace features, AI chat, PiP, widgets, Live
  Activities, or Dynamic Island support to MVP unless `BUILD_SPEC.md` is
  explicitly revised.

## iOS product constraints

- iOS does not offer Android's `TYPE_APPLICATION_OVERLAY` equivalent.
- The MVP pet lives inside the app.
- Picture in Picture is an experiment: it is system-positioned, rectangular,
  media-oriented, non-transparent, and carries App Review risk for this use.
- Widgets and Live Activities are later Apple-native extensions, not MVP.

## Verification

For each implementation change:

- Run formatting, linting, TypeScript checks, and relevant tests.
- Exercise the affected flow on iOS Simulator when possible.
- Use a physical iPhone for haptics, notifications, background behavior,
  purchases, and any PiP experiment.
- Record material manual results in the PR.
- Do not call a feature complete until its acceptance criteria in
  `BUILD_SPEC.md` and relevant checks in `QA_STRATEGY.md` pass.
