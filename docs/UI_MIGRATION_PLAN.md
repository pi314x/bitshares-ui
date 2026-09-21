# BitShares UI — Migration Plan

Status: draft for review
Owner: UI/frontend maintainers
Scope: the entire `app/` frontend (web + Electron desktop) of bitshares-ui

## 1. Why this plan exists

The current UI is built on a 2016-era stack (React 16 class components, a
forked Alt.js flux implementation, react-router v5, Babel `stage-0`, no
TypeScript, ~127k lines across 412 components) with almost no automated test
coverage and no CI test gate. A visual/UX refresh was requested (see the
"BitShares Desk" reference design linked in the task) that leans on a dark,
trading-terminal aesthetic and an extension-based signing model. Reskinning
412 ad-hoc components in place is not realistic; this plan instead defines an
incremental, strangler-fig rewrite that replaces the UI screen by screen
behind a shared shell, while carrying the wallet/chain logic forward
carefully and raising test coverage from "almost none" to "real" as we go.

## 2. Current state (inventory)

| Area | Current | Notes |
|---|---|---|
| React | 16.14.0, class components | 3 majors behind, no hooks-first code |
| State | Alt.js flux (`alt`, `alt-container`, `alt-react`) | forked GitHub packages, not on npm registry |
| Routing | react-router-dom ^5.1.2 | v5 API |
| Styling | SCSS, 101 files, 3 themes (light/dark/midnight) | no CSS Modules / styled-components |
| Components | 412 files, 127,012 lines | largest: `Exchange.jsx` (3,683 lines), `BlockTradesBridgeDepositRequest.jsx` (2,874), `Asset.jsx` (2,461), `Transaction.jsx` (2,427) |
| Design system | `bitshares-ui-style-guide` (external, partially adopted) | half-finished migration, `*StyleGuide.jsx` variants exist next to originals |
| i18n | react-intl v2 **and** counterpart, in parallel | 10 locale files under `app/assets/locales`; `app/help/` covers only 6 |
| TypeScript | none | 0 `.ts`/`.tsx` files |
| Tests | Jest (ancient config, 2 real test files) + Mocha (`app/test`, market math + wallet action tests) | no e2e, no CI test gate |
| CI | `npm-build-and-deploy.yml`, `build-release-binaries.yml` | build + deploy only, no lint/test step |
| Electron | deep integration (`resources/`, electron-builder, mac/win/linux/snap packaging) | dual web + desktop targets |
| Chain logic | `bitsharesjs` ^6.0.3 (193 files) | primitives externalized, but wallet state (`WalletDb.js`, 854 lines), key unlock, brainkey/paper-wallet import, and 7 gateway bridge integrations (BlockTrades, Citadel, RuDex, Gdex, Xbtsx, Bitspark, Piratecash) live in this repo |
| Legacy risk | `foundation-apps` (abandoned since ~2016), several git-fork deps, Babel `stage-0` (blocks Babel upgrade), Node 16 / Electron 16 (both EOL) | opportunity to shed during rewrite |

## 3. Target direction

The reference mockup ("BitShares Desk") establishes the visual target:
dark-first trading-desk theme (light mode as an explicit opt-in, not a
`prefers-color-scheme` default), a fixed left rail with Account/Markets
navigation, tabular-numeral price/amount formatting, and a clear separation
between the brand accent color and the semantic up/down (price direction)
colors. Typography is IBM Plex Sans + IBM Plex Mono throughout (the
mockup's original Archivo display face was dropped in favor of a single
IBM-only family — Plex is IBM's own type family, SIL Open Font License 1.1,
fully open source), self-hosted via `@fontsource/ibm-plex-sans` /
`@fontsource/ibm-plex-mono` rather than the Google Fonts CDN: the Electron
build has no business depending on network access to render its own UI
font.

It also implies a product-level decision the current codebase does not
support today: **signing via an external wallet extension** ("keys never
leave the extension", post-quantum memo key) rather than the current
in-browser `WalletDb` (password-encrypted keys in IndexedDB, brainkey/paper
wallet import). This is materially larger than a UI reskin — it means
designing/shipping a companion browser extension and a signing-request
protocol between the web UI and that extension. This plan treats it as a
**separate, gated work-stream** (Phase 6) rather than a prerequisite for
every other screen, so the rest of the migration is not blocked on it. See
§7 open decisions.

## 4. Goals / non-goals

**Goals**
- Replace the UI incrementally, screen by screen, without a long-lived
  feature freeze or a single big-bang cutover.
- Land on a modern, typed, testable baseline (React 18+, TypeScript,
  function components, one state library, one styling approach, one i18n
  library).
- Every migrated screen ships with unit tests; every signing/money-movement
  flow ships with a regression test *before* the old implementation is
  removed.
- Keep both the web build and the Electron desktop build working throughout.
- Remove the abandoned/forked dependencies (`foundation-apps`,
  `alt`/`alt-container`/`alt-react` forks, dual i18n) rather than migrating
  them as-is.

**Non-goals (for this plan)**
- Changing the on-chain protocol, `bitsharesjs`, or account/key formats.
- Deciding the browser-extension wallet's own architecture in detail (that
  is a separate design doc once §7 is resolved) — this plan only defines the
  integration seam.
- A full TypeScript rewrite of `bitsharesjs` itself (out of this repo).

## 5. Key decisions and recommendations

These need explicit sign-off before Phase 1 starts; each row gives the
recommended default so work isn't blocked, but they should be confirmed.

| Decision | Recommendation | Alternative considered |
|---|---|---|
| Rewrite strategy | Incremental strangler-fig: new shell + new screens live behind a route-level toggle next to the legacy app, old screens removed once parity + tests are signed off | Big-bang rewrite — rejected: too high risk for a wallet handling funds, no working UI during the rewrite |
| Framework | React 18, function components + hooks | Next.js/Remix — rejected for now: app is a static SPA (also packaged into Electron), a server framework adds little and complicates Electron packaging |
| Language | TypeScript, adopted incrementally (`allowJs: true`, new files typed, old files converted opportunistically per phase) | Full upfront TS rewrite — rejected: blocks all other work for months |
| State management | Redux Toolkit (or Zustand for local/UI state) replacing Alt.js flux | Keep Alt.js — rejected: forked, unmaintained, blocks hiring/onboarding, incompatible with idiomatic hooks code |
| Styling | CSS Modules (or vanilla-extract) + design tokens matching the reference mockup's token set (`--ground`, `--accent`, `--up`/`--down`, etc.) | Tailwind — viable alternative, decide with design; styled-components — rejected: runtime cost, team has no prior experience with it here |
| i18n | Consolidate to `react-intl` (current major), drop `counterpart` | Keep both — rejected: is the source of translation drift already visible between `app/assets/locales` and `app/help/` |
| Wallet signing model | Keep in-browser `WalletDb` signing as-is for Phases 1–5; add extension-based signing as an additive, opt-in Phase 6 once its own design is approved | Make extension signing the only method — rejected: no extension exists yet; would block every other screen on an unscoped, separate product |
| Electron | Keep shipping mac/win/linux/snap builds throughout, using the same shell for web and Electron (as today) | Deprioritize Electron — rejected without explicit product sign-off: it's a current distribution channel, dropping it needs a business decision, not an engineering default |

If any recommendation is not acceptable, flag it — it changes the phase
order and effort estimate below.

## 6. Migration strategy

1. **Strangler fig, not a fork.** A new `app-next/` (or `src/`) tree is
   built alongside `app/`, sharing the same `bitsharesjs`/API/store data
   where practical. `App.jsx`'s router grows a per-route switch: routes that
   have been migrated render the new tree, everything else still renders the
   legacy component. This means the app is shippable after every single PR.
2. **Adapter layer, not a parallel backend.** New screens read from the
   existing Alt.js stores through a thin adapter (`useAltStore(store)` hook)
   until Phase 4 introduces Redux Toolkit; this avoids having two disjoint
   sources of truth for account/balance/market data while both stacks are
   live.
3. **Design system first.** No feature screen is migrated before its
   underlying primitives (button, input, table, modal, nav rail, theme
   tokens) exist in the new design system, sourced from the reference
   mockup's token set. This is what makes screen-by-screen migration produce
   a *consistent* UI instead of 40 different one-off reskins.
4. **Delete, don't just add.** Each phase ends by deleting the legacy
   components/routes/stores it replaced, plus the now-dead flux
   actions/stores and `*StyleGuide.jsx` duplicates. The plan explicitly
   budgets time for this — "migrate" means net-negative line count, not two
   copies living forever.
5. **Screenshot every phase.** Every phase's exit criteria includes
   screenshots of what it shipped, in both dark and light theme, attached to
   its PR/report — not just "tests pass." The legacy app blocks its entire
   render tree on a live blockchain connection during startup (`AppInit.jsx`),
   which makes screenshotting a `/next`-mounted screen through the full app
   shell impractical in a sandboxed/offline environment; `app/next/preview-entry.tsx`
   + `webpack.preview.config.js` (`yarn build-preview`) mount a single
   `app/next` screen standalone, without the legacy shell/chain-connection
   bootstrap, specifically so it can be screenshotted (Playwright or
   equivalent) in isolation. Use it for design review each phase; it's not a
   replacement for testing the real, fully-wired route once a phase reaches
   the app shell (Phase 1+).

## 7. Phases

Each phase lists exit criteria; a phase is not "done" until its tests pass
in CI and the legacy code it replaces is deleted.

### Phase 0 — Foundations (infra, no user-visible change)
- Add TypeScript tooling (`tsconfig.json`, `ts-jest` or `vitest`,
  `allowJs`), ESLint flat config + `@typescript-eslint`, update Prettier.
- Add CI: lint + typecheck + unit tests on every PR (this repo currently has
  none of this — see §2). Fail the build on lint/type errors.
- Stand up the new design-system package (tokens, primitives) from the
  reference mockup; Storybook (or equivalent) for isolated review.
- Introduce the route-level strangler switch in `App.jsx`.
- Exit criteria: CI enforces lint+typecheck+test on PRs; a "hello world"
  route renders through the new shell in both web and Electron builds.

### Phase 1 — App shell & chrome
- Migrate: top nav/rail, theme switcher (dark default, light opt-in),
  connected-node indicator, account switcher, layout/footer.
- These are the highest-visibility, lowest-financial-risk components — good
  for validating the new stack end-to-end before touching money-moving
  screens.
- Exit criteria: every legacy screen renders inside the new shell (even
  while still using old internals); old `Layout/Header`, `Layout/Footer`,
  `Layout/Menu` deleted.

**Progress:**
- Done: `design-system/Rail` (left nav) and `design-system/Topbar` (crumb +
  connection + account chips) built and reviewed at `/next`
  (`NextShellContainer`), reading real data from the legacy
  `stores/AccountStore` / `stores/BlockchainStore` via the new
  `next/hooks/useAltStore` adapter — the same stores
  `Layout/Header.jsx`/`Layout/Footer.jsx` read today, not a parallel mock.
  Nav links are real react-router paths (Dashboard/Accounts/Settings,
  Trade/Liquidity pools/Explorer), not the reference mockup's fake in-page
  view toggle. Split into a presentational `NextShell` (props in, no store
  imports) + `NextShellContainer` (reads the stores) specifically so the
  `yarn build-preview` harness can keep rendering screens without pulling
  in `bitsharesjs` and its Node-polyfill requirements — that split is worth
  keeping as the pattern for every later screen, not just this one.
  Unit-tested (`Rail-test`, `Topbar-test`, `useAltStore-test`,
  `NextShell-test`); full app build verified clean (webpack, real stores,
  real route) beyond the pre-existing `charting_library` gap.
- Not done yet, and exit criteria isn't met until it is: the shell is only
  reachable at `/next`, not wrapping the other real routes yet; legacy
  `Layout/Header.jsx` (785 lines) and `Layout/Footer.jsx` (832 lines) are
  untouched and still render for every other route — they hold real
  functionality (node switcher, account dropdown, notifications, wallet
  lock/unlock, latency/block-height display) that a straight swap would
  need to fully account for first, so cutting the app over to the new
  shell and deleting these is its own follow-up slice, not rushed into the
  same commit as building the shell.
- Theme toggle is intentionally still local-only (see `NextShellContainer`
  vs. `NextShell`'s comments): wiring it to `SettingsActions.changeSetting`
  needs a decision on mapping the legacy 3-theme setting
  (dark/light/midnight) onto the new 2-theme system first, since firing
  that action changes the legacy theme for the whole app immediately.

### Phase 2 — Read-only / low-risk screens
- Migrate: Portfolio/balances list, account explorer, transaction/block
  explorer (`Blockchain/Transaction.jsx`, `Blockchain/Asset.jsx`), settings.
- No signing involved — good screens to prove out data-fetching patterns and
  build out unit + integration test conventions.
- Exit criteria: these routes fully removed from `app/components` (legacy
  versions deleted), test coverage in place per §8.

### Phase 3 — Account & portfolio actions
- Migrate: account creation/import (non-key-bearing parts), permissions,
  voting, asset creation/update (`AccountAssetCreate.jsx`,
  `AccountAssetUpdate.jsx`), notifications.
- Exit criteria: legacy equivalents deleted; unit + integration tests for
  every form/validation path.

### Phase 4 — Trading (Exchange)
- Migrate the single largest component, `Exchange.jsx` (3,683 lines) and its
  satellites: `OrderBook.jsx`, `BuySell.jsx`, `QuickTrade.jsx`. Split into
  the sub-components the reference mockup implies (order book, order form,
  market stats strip, chart panel).
- Introduce Redux Toolkit here for order-book/market data (replacing the
  Alt.js `MarketsStore`), since this is the state-heaviest, highest-update-
  frequency part of the app.
- Exit criteria: full parity with legacy Exchange (manual test matrix +
  automated tests below) signed off before legacy `Exchange/*` deletion;
  `MarketClasses.js` math logic reused as-is (do not rewrite proven order-
  matching math — port its existing Mocha tests to the new test runner
  unchanged). **Known finding from Phase 0 CI bring-up:** `test:market:ci`
  (`app/test/marketTests.js`) was not actually runnable before Phase 0 — its
  `CallOrder` tests crashed on a missing constructor argument. That's fixed,
  but 5 of those tests still fail: 2 on values that don't match a plausible
  `mcr` guess, and 3 on a BigNumber.js "more than 15 significant digits"
  error inside `CallOrder.assignMaxDebtAndCollateral`. Root-cause and fix
  these — with a second reviewer, per the risk register below — before
  relying on this suite as a regression net for the Exchange rewrite.

### Phase 5 — Wallet & signing-critical flows
- Migrate: transfer/send, key import (`ImportKeys.jsx`), backup/restore,
  brainkey creation, withdraw modals, HTLC.
- Highest-risk phase: this is where funds move and keys are handled. No
  screen in this phase ships without: (a) a reviewed threat-model note, (b)
  signing/transaction-building covered by tests against fixed test vectors,
  (c) a second reviewer sign-off in addition to normal review.
- `WalletDb.js` itself is *ported*, not rewritten from scratch, in this
  phase — wrap it behind a typed interface and add characterization tests
  first, then refactor internals with the safety net in place.
- Exit criteria: legacy `Wallet/*`, `Modal/*Withdraw*`, `Modal/HtlcModal.jsx`
  deleted; full send/receive/backup/restore test suite green.

### Phase 6 — Extension-based signing: the BitShares wallet browser extension
- Adds the BitShares wallet browser extension (e.g. Beet, or a
  purpose-built "BitShares" extension — **name/repo/injected-API needs
  confirming with the requester before implementation starts**; nothing
  here assumes a specific protocol) as an **additional** signing method,
  alongside — not replacing — Phase 5's in-browser `WalletDb` signing, per
  the reference mockup's "Signed by: Extension" flow. Users keep the
  in-browser wallet unless they opt into the extension.
- A generic `ExternalSigner` interface (see
  `app/wallet-extension/types.ts`, added in Phase 0 as a placeholder) is
  the seam: connect/detect, request public keys for an account, and
  sign-and-broadcast a built transaction. The concrete adapter for the
  chosen extension is implemented once its real message protocol
  (injected `window` object vs. `postMessage`, request/response shape) is
  confirmed — do not guess at a wire protocol for a wallet that moves
  funds.
- Exit criteria: extension signing available as an opt-in method on
  Send/Trade; no regression to existing in-browser signing; the same
  fixed-test-vector + second-reviewer bar as Phase 5 applies here too,
  since this is still money-moving code.

### Phase 7 — Gateways & deposit/withdraw bridges
- Migrate the 7 gateway integrations (BlockTrades, Citadel, RuDex, Gdex,
  Xbtsx, Bitspark, Piratecash) one at a time — these are independently large
  (`BlockTradesBridgeDepositRequest.jsx` alone is 2,874 lines) and each has
  its own external API quirks; do not batch them.
- Exit criteria: each gateway migrated + deleted individually, with its own
  integration test using recorded/mocked API fixtures (never hit the live
  gateway APIs in CI).

### Phase 8 — i18n consolidation & remaining long tail
- Drop `counterpart`, consolidate on `react-intl`, reconcile the 10
  `app/assets/locales` files against the 6-language `app/help/` set (or
  formally scope down help to match locales).
- Migrate whatever remaining components didn't fall into Phases 1–7
  (Showcases/guided flows, Explorer edge screens, misc modals).

### Phase 9 — Legacy removal & dependency cleanup
- Delete `app/` legacy tree, `alt-instance.js`, Alt.js deps, the
  `bitshares-ui-style-guide` external dependency (superseded by the new
  design system), `foundation-apps`, react-router v5, `Babel stage-0`
  preset, react-hot-loader.
- Bump Node/Electron off their EOL versions.
- Exit criteria: `app-next/` promoted to `app/`; zero references to removed
  packages; bundle-size and Lighthouse/perf comparison published against the
  pre-migration baseline.

## 8. Testing strategy ("Vergiss Tests nicht")

Today: 2 real Jest unit tests, a handful of Mocha market/wallet tests, zero
e2e, zero CI enforcement. Target, phased in from Phase 0 onward:

1. **CI gates (Phase 0, before any migration work merges)**
   - Lint + typecheck + unit tests required on every PR; nothing lands
     otherwise. This alone is a bigger change than most of the phases above,
     since none of it exists today.
2. **Unit tests**
   - Framework: Jest (modern config) or Vitest — pick one, retire the
     current pre-Jest-20-style config either way.
   - Every migrated component gets tests for its rendering states, form
     validation, and error states (React Testing Library, behavior-focused,
     not snapshot-only).
   - Port `app/test/marketTests.js`/`wallet_action_test.js` (Mocha) to the
     chosen unit runner rather than discarding them — this is the only
     existing coverage of order-matching math and wallet actions and must
     not regress.
3. **Integration tests**
   - Per-phase: data-fetching + store interaction (or Redux slice + async
     thunk) tests using MSW (Mock Service Worker) or equivalent to stub the
     node RPC layer — never hit a live BitShares node in CI.
   - Gateway integrations (Phase 7) get fixture-based integration tests per
     gateway.
4. **End-to-end tests (net-new — none exist today)**
   - Introduce Playwright (already pre-configured in this environment's
     tooling, low setup cost) driving the app against a local/mocked chain
     node or a stubbed API layer.
   - Golden-path e2e suites, added per phase as screens migrate:
     unlock/login, view portfolio, place & cancel a limit order, send a
     transfer, create an account, import a backup.
   - Run e2e in CI on PRs touching migrated routes; run the full suite
     nightly.
5. **Security-sensitive tests (Phase 5–6 specifically)**
   - Fixed test vectors for transaction building/serialization/signing
     (compare byte-for-byte against known-good output from the current
     `bitsharesjs` integration) before any refactor of `WalletDb.js` or
     introduction of extension signing.
   - Encryption/decryption round-trip tests for the wallet password and
     brainkey flows.
6. **Visual regression**
   - Snapshot the new design-system primitives and key screens
     (Chromatic, Percy, or Playwright's built-in screenshot diffing) so the
     dark/light theme and the mockup's token set don't silently drift once
     multiple contributors touch shared components.
7. **Electron smoke tests**
   - At minimum, a scripted smoke pass (app launches, connects to a node,
     core navigation works) against packaged Electron builds in CI for
     mac/win/linux, since Electron has its own packaging failure modes that
     web-only tests won't catch.
8. **Definition of done per migrated screen**: unit tests for the
   component(s), an integration test for its data flow, and (for anything
   reachable from a "golden path") an e2e test — *before* the legacy
   component is deleted, not after.

## 9. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Wallet/key logic regression during `WalletDb.js` port | Loss of funds/keys | Characterization tests before refactor, fixed signing test vectors, second-reviewer sign-off (Phase 5) |
| Two state systems (Alt.js + Redux Toolkit) live simultaneously | Data drift, bugs | Adapter hook pattern (§6.2), delete Alt.js stores phase-by-phase rather than leaving them "just in case" |
| Gateway integrations break silently (external APIs change) | Deposit/withdraw failures | Fixture-based integration tests per gateway, not live-API tests in CI (Phase 7) |
| i18n regression while consolidating react-intl/counterpart | Broken/missing translations | Automated "no missing key" check per locale in CI before Phase 8 merges |
| Electron packaging breaks for one platform during shell migration | Desktop users blocked | Electron smoke tests in CI from Phase 1 onward, not just at the end |
| Forked deps (`alt`, `alt-container`, `alt-react`, `bitshares-ui-style-guide`) have undiscovered bugs relied upon by legacy code | Behavior changes when replaced | Keep forked deps only until the store/component depending on them is migrated; don't upgrade them, replace them |
| Scope creep from the extension-wallet idea absorbing the whole plan | Migration stalls | Phase 6 is explicitly gated and additive; Phases 1–5 and 7–9 do not depend on it |
| No rollback path if a migrated screen has a critical bug in production | User-facing incident | Route-level strangler switch (§6.1) doubles as a kill switch — flip the route back to the legacy component without a full revert/redeploy |

## 10. Open decisions for sign-off (§5 recap)

1. Confirm rewrite strategy (incremental strangler-fig, recommended) vs.
   alternatives.
2. Confirm target stack (React 18 + TS + Redux Toolkit + CSS Modules,
   recommended).
3. Confirm the wallet-extension signing model is Phase 6 (additive, gated),
   not a Phase 1 prerequisite.
4. Confirm Electron stays in scope for the whole migration.
5. Confirm i18n consolidates on `react-intl`, and that `app/help/`'s
   6-language coverage either expands to match the 10 UI locales or the UI
   locale list is trimmed to match.

## 11. Rough sequencing (not calendar estimates)

Phase 0 → 1 → 2 run mostly sequentially (each depends on the design system
and shell from the previous one). Phases 3, 4, and 7 (gateways) can run in
parallel across separate workstreams once Phase 2 is done, since they touch
disjoint component trees. Phase 5 (wallet/signing) should not be
parallelized with anything else touching `WalletDb.js`. Phase 6 starts only
once its own design is approved, independent of the rest of the timeline.
Phase 8 (i18n) and Phase 9 (cleanup) close out the project.
