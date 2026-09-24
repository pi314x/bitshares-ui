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

### Phase 1 — App shell & chrome — done
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
- Also done: the rail's brand mark is the real BitShares logo
  (`assets/logo-ico-blue.png`, the same asset `branding.js`'s `getLogo()`
  serves to the legacy Header), not a placeholder letter. Both the rail and
  topbar are responsive: below 860px (the reference mockup's own
  breakpoint) the rail collapses from a fixed-width side column into a
  horizontal, scrollable strip — brand name and group labels drop, nav
  items stay tappable — and the shell stacks vertically instead of side by
  side; the topbar wraps its chips instead of overflowing. Verified at
  1200px and 420px viewports, not just assumed from the CSS.
- Done: theme, decided and wired. 2 themes, not 3 — `NextShellContainer`
  reads the legacy `themes` setting and collapses `midnightTheme` into
  `dark` for display; writing from the new toggle only ever picks
  `darkTheme`/`lightTheme` via the real `SettingsActions.changeSetting`, so
  it changes the legacy theme for the whole app immediately (by design —
  `ThemeProvider` supports both controlled and uncontrolled modes now, see
  its own comment). Midnight is retired going forward for anyone who
  touches this toggle; screens not yet migrated are otherwise unaffected.
- Done: the 5 concrete gaps between the new shell and legacy Header/Footer
  identified when scoping the cutover are closed, each by *reusing* the
  legacy component/action rather than reimplementing it:
  - Wallet lock/unlock: `NextShellContainer`'s `onToggleLock` replicates
    `Header.jsx`'s `_toggleLock` exactly (same `WalletDb.isLocked()` check,
    same `rememberMe` / `setPasswordAccount(null)` path on lock) rather
    than a simplified rewrite — security-sensitive per AGENTS.md.
  - Node switching: the legacy `components/Utility/NodeSelector` (166
    lines, self-contained, already connects to `SettingsStore` itself) is
    rendered as-is inside the new `NodePicker` popover, not reimplemented.
  - Send/Deposit/Withdraw: the legacy `SendModal`/`DepositModal`/
    `WithdrawModalNew` are rendered as-is by `NextShellContainer`, with new
    trigger buttons in the topbar replacing their old location (hidden in
    Header's account dropdown) — visible buttons instead of a hidden menu
    item is a deliberate UX improvement, not just a port.
  - Language: new `LocaleSwitcher`, wired to the real
    `IntlActions.switchLocale` / `IntlStore.currentLocale` /
    `SettingsStore`'s `defaults.locale` list.
  - Browsing-mode banner: the legacy `Account/AccountBrowsingMode` is
    rendered as-is (via `useLocation()` for the `location` prop it needs).
  All verified: full app webpack build still only has the 2 known
  pre-existing `charting_library` errors (proving every new legacy
  import — `NodeSelector`, the 3 modals, `AccountBrowsingMode`,
  `IntlActions`/`IntlStore`, `GatewayStore` — resolves correctly), unit
  tests for every new component, and the preview harness screenshotted
  with the node picker and locale picker open.
- **Done: cutover complete, exit criteria met.** `App.jsx`'s render()
  now wraps every route's `<Switch>` in `AppShell` (renamed from the
  `/next`-only `NextShell` Loadable — it's no longer a special case)
  instead of `Layout/Header` + a `mainContainer` div + `Layout/Footer`.
  `Layout/Header.jsx` (785 lines), `Layout/Footer.jsx` (832 lines), and
  Header's exclusive supporting files (`HeaderDropdown.jsx`,
  `HeaderMenuItem.jsx`, `MenuDataStructure.js`, `MenuItemType.js`,
  `DropdownMenuItem.jsx`, `DividerMenuItem.jsx`, `SubmenuItem.jsx` —
  verified unused anywhere else first) are deleted. The `/next` demo route
  is gone too; there's no separate demo now that the real shell wraps
  everything.
  `NextShellContainer` takes the real `<Switch>` as its `content` prop
  (previously hardcoded demo text); the topbar's crumb is derived from the
  route path instead of a hardcoded "Phase 1 shell preview" label; the
  theme toggle moved to the rail's footer slot (matching the reference
  mockup's own "Appearance" placement), replacing `React.createRef()` for
  the two remaining string refs (`react/no-string-refs`) that this file's
  changes brought into `yarn lint:changed`'s scope.
  Verified: full app webpack build still only has the 2 known pre-existing
  `charting_library` errors — with `Header.jsx`/`Footer.jsx` deleted and
  the entire render tree restructured, this is the strongest signal this
  phase's tooling has produced so far. A live-browser screenshot of the
  cutover itself isn't possible in this sandbox (`AppInit.jsx` blocks all
  rendering on a real blockchain connection, same limitation noted since
  Phase 0); the preview harness and the 37 unit tests across 12 suites are
  what stand in for it, same as every other slice this phase.

### Phase 2 — Read-only / low-risk screens
- Migrate: Portfolio/balances list, account explorer, transaction/block
  explorer (`Blockchain/Transaction.jsx`, `Blockchain/Asset.jsx`), settings.
- No signing involved — good screens to prove out data-fetching patterns and
  build out unit + integration test conventions.
- Exit criteria: these routes fully removed from `app/components` (legacy
  versions deleted), test coverage in place per §8.

**Progress:**
- First slice, deliberately narrower than a full migration:
  `Dashboard/DashboardList.jsx` (reached via `/accounts`, the balances/
  contacts table) got a **visual-only** pass to the new design tokens —
  `app/components/Dashboard/DashboardList.scss`, classes added *alongside*
  every existing class/inline style, nothing removed. The diff touches
  only `className` attributes and one `import`; every line that computes
  balances/collateral/debt/open-orders, and all sort/filter/star logic, is
  byte-for-byte unchanged (verified via the diff itself, not just review).
  This is intentionally **not** a full Phase 2 migration: the file is
  still `.jsx`, still class-based, still not deleted — that's real
  financial-calculation code (`TotalBalanceValue`, live `ChainStore`
  aggregation) this sandbox cannot verify against a live node, so a full
  rewrite wasn't attempted without that verification available. A genuine
  TS/React rewrite of this screen, reusing `TotalBalanceValue` and the
  aggregation logic as-is rather than reimplementing the math (the "reuse,
  don't rewrite" principle), is the next step here — done by whoever can
  verify it against real account data, or once this sandbox can.
- Also fixed, because this file's changes brought it into
  `yarn lint:changed`'s scope: two unused `forEach` callback parameters
  (`no-unused-vars`) — dropped, not renamed, since nothing read them.
- Verified: full app webpack build still only has the 2 known pre-existing
  `charting_library` errors; confirmed via `git diff --stat` that no other
  file sharing the legacy `dashboard-table`/`table-hover` classes (15+
  files: `AccountPortfolioList.jsx`, `VotingAccountsList.jsx`,
  `MarketsTable.jsx`, etc.) was touched — the new styling is scoped to a
  new `dash-*` class family, not an override of the shared classes those
  files also use.
- Second slice, same additive-visual-only discipline, three screens:
  - `Settings/Settings.jsx`: new `Settings.scss` with `set-nav`/
    `set-nav-item`/`set-nav-item-active`/`set-content` classes layered onto
    the existing settings-nav list and content pane; the original `active`
    class on the selected nav item is kept (not replaced), so any other
    code or styling depending on it is unaffected. Also removed a dead
    method, `triggerModal(e, ...args) { this.refs.ws_modal.show(e, ...args); }`
    — confirmed via grep it was called from nowhere in the codebase and
    referenced a `ws_modal` ref that doesn't exist anywhere in the file, so
    this isn't a functional change, just deleting unreachable code.
  - `Explorer/Explorer.jsx`: a single `exp-panel` class added to the
    existing `bitshares-ui-style-guide` (antd) `<Tabs>` wrapper, for a
    panel background/border only. Deliberately minimal, documented in a
    comment at the top of the new `Explorer.scss`: this `<Tabs>` component
    is shared by many other screens (`VotingAccountsList`, `Settings`'
    `Form`/`Input`, `NodeSelector`'s `TreeSelect`, etc.), so restyling its
    internal classes would leak into all of them. The actual data tables
    inside each tab (`Blocks.jsx`, `Assets.jsx`, `Witnesses.jsx`, etc. —
    3,400+ lines total, all reading live chain data) stay out of scope for
    the same live-data-verification reason as `DashboardList.jsx` above.
  - `Dashboard/DashboardPage.jsx` (the `/` route's Starred/Featured Markets
    tabs) and `Dashboard/DashboardAccountsOnly.jsx` (the `/accounts`
    wrapper around `DashboardList`): both get the `dash-panel` class added
    onto their existing `tabs-container generic-bordered-box` wrapper divs,
    for visual consistency with the `DashboardList.jsx` pass above. No
    calculation or data-fetching code touched.
  - While in scope for `yarn lint:changed`, also removed three dead string
    refs surfaced by `react/no-string-refs`: `ref="appTables"` in
    `DashboardPage.jsx`, and `ref="wrapper"` / `ref="container"` in
    `DashboardAccountsOnly.jsx`. Confirmed via grep that none of these were
    ever read via `this.refs.*` anywhere in either file — unreachable dead
    code, same as `Settings.jsx`'s `triggerModal` above, not a behavior
    change.
  - Verified: `yarn lint:changed`-equivalent (`eslint` on all four changed
    files) clean; `yarn typecheck` clean; full Jest suite green (37/37
    across 12 suites); full app webpack build still shows only the 2 known
    pre-existing `charting_library` errors.
  - Deferred, same reasoning as the `DashboardList.jsx` slice: the real
    `.jsx`→`.tsx` rewrites of Settings, Explorer's sub-tables (Blocks,
    Assets, Witnesses, ...), and Dashboard's balance/collateral math stay
    out of scope until they can be verified against a live node or by
    someone who can run one.
- Third slice: the live-node verification the previous two slices were
  blocked on became available (this environment's egress allowlist got
  `node.xbts.io` added), so `Dashboard/DashboardList.jsx` and
  `Utility/TotalBalanceValue.jsx` got the real `.jsx`→`.tsx` rewrite
  those slices deferred — both `.jsx` files deleted, not just reskinned.
  - New: `app/next/dashboard/balanceCalculations.ts` — the actual
    balance/collateral/debt/open-orders math, ported line-for-line from
    the two legacy files (not reinterpreted), as typed pure(ish)
    functions taking a `getObject` lookup instead of reaching into
    `ChainStore` directly, so they're unit-testable without a live
    connection. Verified in
    `app/__tests__/next/dashboard/balanceCalculations-test.ts` against a
    static fixture captured from a real mainnet account (`alt-org`,
    `1.2.1813080` — picked for having real limit orders, call orders, and
    balances) fetched live from `wss://node.xbts.io/ws`; the fixture's
    "expected" values were computed independently from the raw JSON-RPC
    response, not through the code under test. 12/12 assertions pass
    against real numbers (open orders, collateral, debt aggregation,
    price conversion, total-value summation). The fixture is static JSON
    committed to the repo, so this test needs no network access and runs
    in CI like any other.
  - New: `app/next/hooks/useChainStoreTick.ts` — replaces
    `BindToChainState`'s propType-driven resolution machinery with the
    minimal equivalent for function components: subscribe to
    `ChainStore` on mount, re-render on every chain event, unsubscribe on
    unmount. `ChainStore.getObject`/`getAccount`/`getAsset` are still
    called directly from render (same as the legacy HOC did internally),
    not reimplemented.
  - New: `app/next/hooks/useMarketStatsSubscription.ts` — ports
    `MarketStatsCheck`'s direct-vs-indirect-market routing logic (which
    asset pairs need their price polled, and through which market) to a
    hook. The actual polling/order-book-derived price stats are reused
    as-is through the existing `MarketsActions`/`MarketsStore`, not
    reimplemented.
  - `DashboardList.tsx`/`TotalBalanceValue.tsx` reuse `ChainStore`,
    `marketUtils`, `SettingsStore`/`AccountStore`/`WalletUnlockStore`/
    `MarketsStore`, `SettingsActions`/`AccountActions`, and `WalletDb`
    exactly as the legacy files did — none of that is rewritten, only the
    React/component layer around it.
  - Known, accepted tradeoff: neither new component replicates the
    legacy `shouldComponentUpdate`/`MarketStatsCheck` fine-grained
    re-render gating (which market's stats changing should trigger a
    re-render). The hooks re-render more liberally instead. This can
    only make the display *more* up to date, never wrong — it's a perf
    tradeoff, not a correctness one — but if `DashboardList` feels
    noticeably slower on accounts with many rows, that gating is the
    place to add back, scoped narrowly.
  - `TotalBalanceValue.AccountWrapper`, an exported-but-unused static
    property on the legacy component, was dropped — confirmed via
    repo-wide grep it had zero consumers anywhere outside its own file.
  - Infra fixes needed to make this possible at all: `tsconfig.json`
    didn't mirror webpack's `resolve.modules` (`app/lib` isn't on TS's
    module path, so `common/market_utils` etc. didn't resolve) — added a
    `paths` mapping for `common/*`, `chain/*`, `feature_detect/*`,
    `workers/*`. `bitsharesjs`, `bitsharesjs-ws`,
    `react-translate-component`, `counterpart`, and
    `bitshares-ui-style-guide` ship no type declarations — added ambient
    `declare module` shims in the new `app/types/vendor-shims.d.ts`
    (same "treat as `any`, like the rest of the codebase already does
    via `allowJs`" approach the existing design-system `.d.ts` shims
    use).
  - `MarginPosition.jsx` and `AccountOverview.jsx` (the other two
    `TotalBalanceValue` consumers) were **not** touched — they import it
    by its unqualified path, so the `.tsx` swap is transparent to them;
    verified via a full webpack build that both still compile and no
    other file was touched (`git status` shows only the files listed
    above).
  - Verified: `eslint` clean (0 errors; pre-existing-style `any` warnings
    only, consistent with how the rest of the new-TS code treats
    untyped chain objects); `yarn typecheck` clean; full Jest suite
    green (49/49 across 13 suites, up from 37/12); full app webpack
    build still shows only the 2 known pre-existing `charting_library`
    errors.
  - Not done: a live-browser screenshot of the real running app against
    `node.xbts.io`. This sandbox's egress proxy intercepts and re-signs
    TLS, which Chromium doesn't trust by default (fixed with
    `ignoreHTTPSErrors`), but the proxy's WebSocket handling doesn't
    reliably survive this app's own multi-node latency-race/fallback
    connection dance — concurrent handshake attempts to the same host
    through the proxy intermittently fail with `400`/timeout. The
    underlying data and math are verified directly (see above); a real
    screenshot is still worth getting from an environment without this
    proxy constraint before calling this phase's exit criteria met.
  - Explorer's sub-tables (Blocks, Assets, Witnesses, ...) and Settings'
    remaining `.jsx`→`.tsx` work are still deferred — this slice only
    covered Dashboard, since that's where the live-data blocker was
    called out explicitly in the prior two slices.
- Fourth slice: `Explorer/Blocks.jsx` (the "/explorer/blocks" tab — stats
  row, block-time/tx-per-second charts, recent blocks/transactions
  tables) and its trivial `BlocksContainer.jsx` wrapper both got the real
  `.jsx`→`.tsx` rewrite, continuing the live-data unblock from the third
  slice. Lower risk category than Dashboard's balance math — read-only
  public chain-explorer data, no account balances or signing — so this
  didn't get a separate pure-function module or a committed fixture
  test; instead the block-time/tx-per-second arithmetic (copied
  verbatim from the legacy component) was manually verified against 20
  real consecutive mainnet blocks fetched live from `wss://node.xbts.io/ws`:
  the computed average block interval came out to exactly 3.0s, matching
  BitShares' known block time exactly.
  - `TransactionChart.jsx`, `BlocktimeChart.jsx`, `Operation.jsx`,
    `LinkToWitnessById.jsx`, `TimeAgo.jsx`, `FormattedAsset.jsx`, and
    `TransitionWrapper.jsx` are reused exactly as before, not touched.
  - Same tradeoffs as the Dashboard slice: `BindToChainState`/
    `AssetWrapper` replaced with `useChainStoreTick` + direct
    `ChainStore` reads; the legacy `shouldComponentUpdate`'s re-render
    gating isn't replicated (perf tradeoff, not correctness). One
    additional simplification here: the legacy
    `UNSAFE_componentWillReceiveProps` re-fetched blocks by reading
    `this.props` (the *old*, pre-update props) from inside a
    props-change handler — a subtle class-lifecycle quirk. The port's
    `useEffect` reads current props consistently instead, which
    converges to fetching the same blocks in practice.
  - Also dropped `animateEnter`, a piece of legacy component state that
    was set but never read anywhere in `render()` — confirmed by
    re-reading the whole render method, not just grepping the state
    name.
  - Infra: added `react-intl` to `app/types/vendor-shims.d.ts` (same
    untyped-legacy-package treatment as the third slice), and reused the
    existing `TypedNavLink`-style cast (`design-system/Rail.tsx`) for
    `react-router-dom` v5's `Link`, which hits the same
    `@types/react-router-dom` + modern TypeScript incompatibility
    `NavLink` did in Phase 1.
  - Verified: `eslint` clean (0 errors, `any`-only warnings); `yarn
    typecheck` clean; full Jest suite still green (49/49 — this slice
    added no new test file, per the lower-risk reasoning above); full
    webpack build still shows only the 2 known pre-existing
    `charting_library` errors.
  - Same live-browser-screenshot gap as the third slice, same reason
    (the sandbox's TLS-intercepting proxy doesn't reliably survive this
    app's multi-node connection dance) — not re-attempted here.
  - Still deferred: Explorer's other sub-tables (`Assets.jsx`,
    `Witnesses.jsx`, `CommitteeMembers.jsx`, `LiquidityPools.jsx`,
    `Accounts.jsx`) and Settings' `.jsx`→`.tsx` work.
- Fifth slice: `Settings/Settings.jsx` (the screen's tab menu and
  routing shell) and its trivial `SettingsContainer.jsx` wrapper got the
  real `.jsx`→`.tsx` rewrite. No account balances, signing, or live
  chain-data verification needed here — this is orchestration (which
  tab is active, syncing that with the URL) around already-working
  subcomponents (`AccountsSettings`, `WalletSettings`,
  `PasswordSettings`, `RestoreSettings`, `BackupSettings`,
  `AccessSettings`, `ResetSettings`, `SettingsEntry`,
  `WebsocketAddModal`), none of which were touched.
  - Three confirmed-dead things dropped, each verified by reading every
    consuming file, not just grepping the declaring one: `onReset()`
    (defined, never called/bound/referenced anywhere); the
    `apiLatencies` prop `SettingsContainer.jsx` injected into
    `Settings.jsx` (never read — `AccessSettings.jsx` fetches its own
    copy independently); and the `locales` prop plus the `{...this.state}`
    spread both passed to `SettingsEntry.jsx` (it only destructures
    `defaults`/`setting`/`settings` from its props, confirmed by reading
    its full render method).
  - Same infra pattern as the earlier slices: `react-router-dom`'s
    `useParams`/`useHistory` hooks replace the `match`/`history` props
    react-router injected into the class component; `useAltStore`
    replaces `SettingsContainer`'s `AltContainer`. Local component state
    (which tab is active, the add/remove-node modal visibility, etc.)
    is `useState`, with the two `UNSAFE_component*` lifecycle methods
    ported to `useEffect`s that mirror their original trigger
    conditions (documented inline in `Settings.tsx`).
  - Infra: added `lodash-es` to `app/types/vendor-shims.d.ts`. Also
    fixed a stale JSDoc `@returns` comment on `branding.js`'s
    `getFaucet()` — it was missing the `editable` field the function
    actually returns and that `Settings.tsx` reads, which TypeScript
    picks up from JSDoc on plain JS files even with `checkJs: false`.
    While in scope for `yarn lint:changed`, also turned a genuinely
    unused `testnet` chain-id variable in `branding.js`'s `_isTestnet()`
    into a comment (its own inline comment already said "just for the
    record" — clearly meant as a documentation reference, not accidental
    dead code, so it's kept as one instead of deleted outright).
  - Verified: `eslint` clean (0 errors, `any`-only warnings) on all
    touched files; `yarn typecheck` clean; full Jest suite still green
    (49/49); full webpack build still shows only the 2 known
    pre-existing `charting_library` errors.
  - Still deferred: Explorer's other sub-tables and the Settings
    *subcomponents* themselves (`AccountsSettings.jsx` etc. are still
    legacy `.jsx` — only the shell around them moved).
- Sixth slice: `Explorer/CommitteeMembers.jsx` (the
  "/explorer/committee-members" tab) got the real `.jsx`→`.tsx` rewrite.
  Same lower-risk category as Blocks.tsx (read-only public chain data),
  manually verified against real committee-member data from
  `wss://node.xbts.io/ws`: 11 active committee members resolved and
  ranked correctly by vote count (highest first — `abit`, `xeroc`,
  `johnr`, ... with real vote totals), matching the ported logic.
  - The legacy file split this into two `BindToChainState`-wrapped
    classes purely to apply two different loading-gate behaviors
    (`show_loader: true` vs. the default) — collapsed into one component
    with two early returns, since that split existed for HOC
    convenience, not application logic.
  - One `BindToChainState` implementation artifact deliberately *not*
    replicated: its `chain_objects_list` resolution has an off-by-one
    bug (`++index` runs before the array assignment, so the first
    resolved item lands at index 1, not 0). The legacy loading-gate
    check (`committee_members[1]`) was written to compensate for that
    bug — the actual table rows are built with `.filter()`/`.map()`,
    which skip the resulting sparse index-0 hole either way, so the
    real behavior is unaffected. This port resolves members into a
    normal 0-indexed array and gates on index 0 instead.
  - Two more confirmed-dead things dropped, verified by reading the
    whole render method: `cardView`/`cardViewCommittee` (fetched from
    `SettingsStore` but never read anywhere), and a local
    `activeCommitteeMembers` array built via a redundant for-in copy of
    `globalObject.active_committee_members` and then never used — the
    render already reads that field directly.
  - Not changed: the search placeholder's translation key is
    `"explorer.witnesses.filter_by_name"` (Witnesses' key, not this
    screen's own) in the legacy source — looks like a copy-paste content
    bug, but fixing displayed text isn't part of a structural port, so
    it's left exactly as it was, with a comment flagging it for whoever
    owns that content next.
  - Verified: `eslint` clean (0 errors, `any`-only warnings); `yarn
    typecheck` clean; full Jest suite green (49/49); full webpack build
    shows only the 2 known pre-existing `charting_library` errors.
  - Still deferred: `Assets.jsx`, `Witnesses.jsx`, `LiquidityPools.jsx`,
    `Accounts.jsx`, and the Settings subcomponents.
- **Bug fix, found via manual screenshot verification of the live-data
  rewrites (not by CI):** `Dashboard/DashboardList.tsx` (third slice)
  passed the bare `ChainStore.getObject` method reference into
  `aggregateOpenOrders`/`aggregateCollateralAndDebt`/
  `resolveAccountBalanceIds` instead of `id => ChainStore.getObject(id)`.
  `ChainStore`'s methods read `this.objects_by_id` internally, so the
  unbound reference threw `Cannot read properties of undefined (reading
  'objects_by_id')` the moment those functions' `.forEach` callback
  invoked it as a plain function call — for any account that actually
  has orders, call orders, or balances (i.e. every real, populated
  account; an empty account never called it, so the bug was invisible
  for those). Caught by rendering the real components against real
  captured mainnet data in a throwaway screenshot harness (not committed
  — see below) to visually verify this and the fifth/sixth slices; the
  existing `balanceCalculations-test.ts` unit tests couldn't have caught
  this because they pass their own mock `getObject`, never the real
  `ChainStore.getObject` the way the component actually does.
  - Fixed by wrapping each call site in an arrow function.
  - Added `app/__tests__/next/dashboard/DashboardList-test.tsx`: renders
    `DashboardList` against the real `bitsharesjs` `ChainStore` (seeded
    with the same `alt-org` fixture `balanceCalculations-test.ts` uses),
    the same way the component is used in production. Verified this
    test actually catches the bug by reverting the fix locally and
    confirming the test fails with the exact original error, then
    restoring the fix.
  - Verified: `eslint` clean, `yarn typecheck` clean, full Jest suite
    green (50/50, up from 49/13 — 14 suites), full webpack build shows
    only the 2 known pre-existing `charting_library` errors.
  - The throwaway screenshot harness itself (a temporary
    `app/next/_livepreview/` entry that seeded `ChainStore`/
    `BlockchainStore` directly with real captured mainnet data and
    rendered `CommitteeMembers`, `Blocks`, `DashboardList`, and
    `Settings` side by side) is **not** committed — it was deleted after
    use. It's recorded here because it's how this bug was actually found
    (screenshots of the migrated screens, requested directly, caught
    what the automated test suite didn't) and because reconstructing it
    is cheap if another slice needs the same visual sanity check:
    `ChainStore._updateObject(rawObject)` seeds chain objects directly
    (`_subTo(type, id)` first for `committee_member`/`witness` types,
    which `_updateObject` otherwise silently drops); a class-based Alt.js
    store's *real* mutable state is reachable at `store.state` (its
    public export is a wrapper `AltStore` instance, not the class
    instance — direct property assignment on the export is invisible to
    `getState()`); `Apis.instance` needs stubbing to a no-op so any
    unseeded live-fetch attempt fails silently instead of throwing
    synchronously and crashing the render; and `IntlProvider` needs to
    wrap the tree for any component using `FormattedDate`/
    `FormattedNumber`.
- Seventh slice: `Explorer/Witnesses.jsx` (the "/explorer/witnesses" tab)
  got the real `.jsx`→`.tsx` rewrite, same lower-risk category as
  Blocks.tsx/CommitteeMembers.tsx. Given the DashboardList bug above,
  this one was verified with a render, not just logic: rebuilt the
  throwaway live-data harness (same seeding technique, deleted after
  use again) and rendered it against 17 real active witnesses from
  `wss://node.xbts.io/ws` — real names, correct vote-based ranking, the
  current-witness row correctly highlighted, no runtime errors. The
  ranking/rank-vs-vote-order logic was separately checked against the
  same live data outside the component too.
  - Collapsed the legacy file's three pieces (`WitnessRow`, `WitnessList`,
    `Witnesses`) into one component, same reasoning as
    `CommitteeMembers.tsx`. This file had more dead code than that one,
    all confirmed by reading every render method fully, not just
    grepping the declaring site: `WitnessRow`, an entire ~70-line class
    building a `<tr>` per witness, was never rendered anywhere — the
    real table uses antd's `<Table>` with a `dataSource`/`columns`
    config, evidently from a later refactor that orphaned it.
    `_toggleView()` and the `cardView` state/prop it threaded through
    were never read. `_setSort()` and the `sortBy`/`inverseSort` state
    it drove were also dead — the antd `Table`'s own per-column `sorter`
    functions handle interactive sorting; nothing in the render path
    consulted this component's sort state at all.
  - Same off-by-one `BindToChainState` loading-gate artifact as
    `CommitteeMembers.tsx` (`witnesses[1]` → normalized to `[0]`), same
    reasoning.
  - Verified: `eslint` clean (0 errors, `any`-only warnings); `yarn
    typecheck` clean; full Jest suite green (50/50); full webpack build
    shows only the 2 known pre-existing `charting_library` errors.
  - Still deferred: `Assets.jsx`, `LiquidityPools.jsx`, `Accounts.jsx`
    (Explorer's remaining sub-tables), and the Settings subcomponents.
- Eighth slice: `Explorer/Accounts.jsx` (the "/explorer/accounts" tab's
  account search) and its trivial `AccountsContainer.jsx` wrapper got the
  real `.jsx`→`.tsx` rewrite (merged into one file, `AccountsContainer`
  deleted — `Explorer.jsx` now imports `Accounts.tsx` directly under the
  same local name it already used). Same lower-risk category as the
  other Explorer tables.
  - The legacy class's `_onAddContact`/`_onRemoveContact` called
    `this.forceUpdate()` after dispatching to `AccountStore`, because its
    `shouldComponentUpdate` only checked `searchAccounts`/`searchTerm`/
    `isLoading` — not `accountContacts` (read fresh from
    `AccountStore.getState()` every render) or `rowsOnPage`, so without
    `forceUpdate` those handlers plus `handleRowsChange` wouldn't have
    triggered a re-render at all. This port doesn't replicate that
    `shouldComponentUpdate` gate (same tradeoff as the rest of this
    phase), so state updates already re-render; `accountContacts`
    specifically now comes through `useAltStore(AccountStore)` instead
    of a direct `getState()` read + `forceUpdate()`, which is the one
    place a plain "just drop forceUpdate" port would have silently
    broken the two contact-toggle buttons.
  - Verified: `eslint` clean, `yarn typecheck` clean, full Jest suite
    green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors.
- Ninth slice: `Explorer/LiquidityPools.jsx` (the "/explorer/pools" tab)
  got the real `.jsx`→`.tsx` rewrite. `PoolExchangeModal`/
  `PoolStakeModal` — the actual trade/stake actions, which do involve
  signing — are reused exactly as before, not touched; this file only
  opens them, so it stays in the lower-risk read-only-listing category.
  - Pre-existing bug found, left as-is (not this port's job to silently
    change behavior — same reasoning as `CommitteeMembers.tsx`'s
    copy-pasted translation key): `_getLiquidityPools` destructured
    `GetLimit` from `this.state`, but no such field was ever set — only
    lowercase `limit` was. `GetLimit` was always `undefined`, so the
    rows-per-page selector never actually affected how many pools the
    API returns per fetch (it does still affect the antd `Table`'s
    client-side `pagination.pageSize`, which reads `limit` correctly).
    Preserved as an explicit `undefined` in the port rather than
    silently "fixed" to `limit`.
  - Also dropped, confirmed dead by reading the whole file:
    `this.state.total` and `this.state.lastPoolId` (a *local* state
    field, distinct from the `lastPoolId` *prop* from `PoolmartStore`,
    which the port does keep) were both written but never read anywhere.
  - The auto-pagination effect (fetch more as soon as new pools arrive,
    until the API returns nothing new) needed the same "compare against
    the value from before this update" semantics the legacy
    `componentWillReceiveProps(nextProps)` had by comparing against
    `this.props.lastPoolId` (the *old*, pre-update props value, since
    `this.props` hadn't been reassigned yet at that point in the
    lifecycle) — reproduced with a ref that's only updated *after* the
    comparison, one render behind, documented inline in the file.
  - Verified: `eslint` clean, `yarn typecheck` clean, full Jest suite
    green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors. Not separately verified
    against live pool data (attempted, but the sanity-check script's API
    call parameters were wrong and it wasn't worth further investment
    for a listing page in this risk tier — the row-building logic itself
    was verified by reading `PoolmartActions.js`'s fetch handler
    directly, which is where the `balance_a / 10^precision` etc.
    calculations this file merely displays actually originate).
- Tenth slice: `Explorer/Assets.jsx` (the "/explorer/assets" tab) and its
  trivial `AssetsContainer.jsx` wrapper got the real `.jsx`→`.tsx`
  rewrite (merged into one file, `AssetsContainer` deleted — `Explorer.jsx`
  now imports `Assets.tsx` directly under the same local name it already
  used). Same lower-risk, read-only Explorer-table category as the eighth
  and ninth slices.
  - Confirmed dead, dropped: two props `AssetsContainer.jsx` injected
    from `SettingsStore`'s `viewSettings` (`filterMPA`, `filterUIA`) but
    that `Assets.jsx` never read; a third injected prop name,
    `filterSearch`, that `AssetsContainer` never actually passed a value
    for either, so it was always `undefined` and behaved exactly like the
    port's own `useState(() => "")` local state; `_onFilter(type, e)`,
    defined but never called from anywhere in the render tree; and a
    `placeholder` variable computed via `counterpart.translate(...)` but
    never wired to any prop in either the original or the port (confirmed
    by `eslint`'s `no-unused-vars` after an initial faithful port still
    computed it).
  - The legacy "user" and "market" filter modes had byte-for-byte
    identical `columns` array definitions for the antd `Table` — only the
    filter *predicate* over `assets` differed between them — so this port
    consolidates them into one shared `columns` definition; nothing
    observable changes.
  - `_checkAssets`'s incremental-fetch/pagination logic (fetch 100 assets
    at a time, tracking progress against a localStorage-cached
    total-asset-count estimate to know when to stop showing the loading
    spinner) is ported with the same subtlety the class version had: its
    final "should we stop loading" check reads the fetch-count value
    *before* the same call's own update to that value has taken effect
    (React state/hook updates are deferred, not applied mid-function), so
    it's always one batch behind. The port reads the same plain variable
    throughout the function body, reproducing that exact staleness without
    needing to special-case it.
  - Verified: `eslint` clean (0 errors; only the expected `any` warnings
    already present throughout this phase), `yarn typecheck` clean, full
    Jest suite green (50/50 across 14 suites), full webpack build shows
    only the 2 known pre-existing `charting_library` errors. Not
    separately verified against live asset data for this slice — same
    lower-risk-tier tradeoff as `LiquidityPools.tsx`; the fetch/pagination
    logic was cross-checked by reading `AssetActions.js`'s
    `getAssetList` handler directly rather than standing up a live-data
    harness for a pure listing/search screen.
  - Follow-up fix, found later by a live-render screenshot check (not
    part of the original port): `rowsOnPage` is a string (it backs a
    `Select` whose options are string values) but was cast `as any`
    straight into antd's `pagination.pageSize`, which expects a number —
    harmless in practice (antd coerces it) but threw a PropTypes warning
    on every render. Fixed with `parseInt(rowsOnPage, 10)` at both
    pagination call sites. Re-verified: `eslint`/`yarn typecheck` clean,
    full Jest suite green (50/50), full webpack build shows only the 2
    known pre-existing `charting_library` errors.
- Eleventh slice: start of the Settings-subcomponent pass (per AGENTS.md,
  the wallet-backup/restore/password ones — `WalletSettings.jsx`,
  `BackupSettings.jsx`, `RestoreSettings.jsx`, `BackupFavorites.jsx`,
  `RestoreFavorites.jsx`, `PasswordSettings.jsx` — are deferred to last,
  with extra care, as security-sensitive). `Settings/SettingsEntry.jsx`
  (renders one generic row of the Settings tabs — locale, theme, browser
  notifications, fee asset, gateway filter, wallet lock timeout, and the
  generic dropdown/text-input fallback) got the real `.jsx`→`.tsx`
  rewrite. Pure display/local-UI-state, no wallet or signing involvement.
  - Confirmed dead, dropped (verified by reading this file plus its only
    caller, `Settings.tsx`): the `message` state, the `_setMessage(key)`
    method that set it, its `timer`/`componentWillUnmount` cleanup, and
    the `<div className="facolor-success">{this.state.message}</div>` it
    fed — `_setMessage` was never called anywhere in this file or its
    caller (`ResetSettings.jsx` has its own, unrelated, same-named
    method), so `message` was always `null`. Also dropped `optional` and
    `confirmButton`, both declared but never assigned by any switch
    branch, then rendered as always-`undefined`. Also dropped `noHeader`,
    declared `false` and never reassigned, so the local `EntryLayout`
    helper's `noHeader && children` branch could never be taken — inlined
    the unconditional `FormItem`-wrapped path it always fell through to.
  - The legacy `shouldComponentUpdate` skipped re-rendering the
    "filteredServiceProviders" entry unless its own local modal-visibility
    state changed. Not replicated, same tradeoff as elsewhere in this
    phase: that entry's output never actually depends on `settings` or
    `defaults`, so it's output-invisible either way.
  - Added a `notifyjs` ambient module shim to `app/types/vendor-shims.d.ts`
    (this file is the first TS port to import it, for the
    browser-notification permission check).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Twelfth slice: `Settings/AccountsSettings.jsx` (the Settings screen's
  "My accounts" tab — list, hide/unhide, and link to permissions for each
  account the wallet controls keys for) got the real `.jsx`→`.tsx`
  rewrite. Read-only listing plus a hide/unhide toggle that only writes
  local UI state (`AccountStore`'s `myHiddenAccounts`) — no signing, so
  this stays out of the wallet-security-sensitive tier.
  - Replaced the legacy `alt-react` `connect(AccountsSettings, {listenTo,
    getProps})` wrapper with `useAltStore(AccountStore)` (same adapter
    pattern as every other ported component this phase), then reads
    `AccountStore.getMyAccounts()` fresh in the render body — it's a
    plain method, not part of `getState()`, same treatment as
    `ChainStore.getAccount()` calls elsewhere in this phase's ports.
  - The legacy `shouldComponentUpdate` shallow-compared `myAccounts` (via
    `utils.are_equal_shallow`, since `getMyAccounts()` returns a brand-new
    array every call even when unchanged) and `hiddenAccounts` to skip
    re-renders. Not replicated, same tradeoff as elsewhere in this phase:
    a perf guard only, and this component's render body (sort + map over
    a short account list) is cheap enough that it isn't worth the code.
  - Verified: `eslint` clean (0 errors, one expected `any` warning),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Thirteenth slice: `Settings/FeeAssetSettings.jsx` (the "current fee
  asset" display + "change default fee asset" button embedded in
  `SettingsEntry`'s `fee_asset` row) got the real `.jsx`→`.tsx` rewrite.
  Read-only display plus a local modal toggle — the actual fee-asset
  preference write happens inside `SetDefaultFeeAssetModal` (unchanged,
  reused as-is), not here.
  - The legacy class only ever used its `fee_asset` prop (from the
    alt-react `connect(..., {listenTo: [SettingsStore], getProps})`
    wrapper) once, in the constructor, to seed `state.current_asset` —
    there's no lifecycle method re-deriving it later, so subsequent
    `fee_asset` setting changes never updated this component's
    `current_asset` after mount (only the modal's own `onChange` did).
    Ported with `useState(() => ...)`'s lazy initializer, which runs
    exactly once on mount, matching that same one-time seed.
  - The legacy `shouldComponentUpdate` always returned `true`, so this
    component re-rendered on every SettingsStore change, even unrelated
    ones — which, though clearly incidental rather than deliberate
    design, was this component's only mechanism for ever re-reading
    `ChainStore.getAsset(current_asset)` after mount if that asset object
    became available asynchronously. Kept `useAltStore(SettingsStore)`
    (discarding its returned value) to preserve that same incidental
    re-render trigger, rather than either dropping it (behavior-changing)
    or adding a ChainStore-tick mechanism the original never had
    (over-fixing beyond what a faithful port calls for).
  - Verified: `eslint` clean (0 errors, one expected `any` warning),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Fourteenth slice: `Settings/ResetSettings.jsx` (the Settings screen's
  "reset" tab — a button that clears all stored settings and navigates
  away) got the real `.jsx`→`.tsx` rewrite. Straightforward hooks port —
  local `message`/timer state and the `willTransitionTo`/
  `SettingsActions.clearSettings` calls carried over unchanged, no dead
  code found. Local UI-state-only, no wallet or signing involvement.
  - Verified: `eslint` clean (0 errors, 0 warnings), `yarn typecheck`
    clean, full Jest suite green (50/50), full webpack build shows only
    the 2 known pre-existing `charting_library` errors.
- Fifteenth slice: `Settings/WebsocketAddModal.jsx` (the "add node" /
  "remove node" modal pair used by the Settings screen's node picker) got
  the real `.jsx`→`.tsx` rewrite. Only touches which RPC node the app
  talks to, not wallet/signing state.
  - Confirmed dead, dropped (verified by reading the whole file — no
    other file references these): the `type`/`remove` state fields,
    never read anywhere after being set in the constructor; the `close()`
    method and the `isModalVisible` state field it wrote, never called or
    read by anything (visibility is entirely controlled by the
    `isAddNodeModalVisible`/`isRemoveNodeModalVisible` props); and the
    string ref `ref="ws_modal_add"` on the add modal, never read via
    `this.refs` anywhere (kept the `id="ws_modal_add"` in case anything
    external targets it by DOM id).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Sixteenth slice: `Settings/AccessSettings.jsx` (the Settings screen's
  node picker — active node, available/personal/hidden/testnet node
  lists, latency re-check) got the real `.jsx`→`.tsx` rewrite. This was
  the largest remaining non-wallet-sensitive Settings file (677 lines,
  three classes: `AutoSelectionNode`, `ApiNode`, and the default-exported
  `AccessSettings` — the first two are internal to the file, never
  exported). Only changes which RPC node the app talks to, not
  wallet/signing state.
  - Biggest confirmed-dead find of this phase: grepped the whole app for
    every `<AccessSettings` usage (`Settings.tsx` and `SyncError.jsx`,
    the only two) and read both fully — neither ever passes a `popup`
    prop, so the `props.popup ? (...) : (...)` ternary present in *all
    three* classes always took the non-popup branch. Dropped the
    popup-only JSX entirely from all three (the compact popup list
    variant, `popupCount`, the popup 5-item cap) — only the non-popup
    rendering is ported. Also dropped the `faucet` and `onChange` props
    on `AccessSettings` itself (both passed by every caller, neither ever
    read in the file), and `ApiNode.defaultProps = {node: {}}` (`ApiNode`
    is only ever instantiated from this file's own `renderNode()`, which
    already guards `if (node == null) return null;` first, so `node` is
    always defined when it actually renders).
  - `Settings.tsx`'s own `<AccessSettings>` call site had to drop the
    `faucet`/`onChange` props it was passing, once `AccessSettingsProps`
    stopped declaring them — TypeScript now catches what plain JS
    silently let through as ignored extra props.
  - The legacy `_recalculateLatency`'s `this.forceUpdate()` (after
    `routerTransitioner.doLatencyUpdate(...)` resolves) is load-bearing:
    `backgroundPinging` reads
    `routerTransitioner.isBackgroundPingingInProgress()` fresh every
    render with no store/state backing it, so nothing else would ever
    trigger a re-render to show the ping finishing. Replicated with the
    standard hooks forceUpdate substitute (a dummy `useState` setter).
  - Found in passing while reading `SyncError.jsx` as one of
    `AccessSettings`'s two callers (not itself touched by this slice):
    it renders the already-ported `WebsocketAddModal` without ever
    passing `changeConnection`, even though
    `WebsocketAddModal.onRemoveSubmit` calls it when the removed node was
    the active one — a pre-existing latent crash in that specific call
    path, present before this port and left as-is (not this slice's
    file to fix).
  - Added `app/types/global-defines.d.ts` declaring `__TESTNET__` (a
    webpack `DefinePlugin` compile-time global this file's `isTestNet()`
    reads) - the first TS port to need one of these; same "add as needed"
    approach as `vendor-shims.d.ts`'s untyped-package shims.
  - Not separately verified against live node/latency data — the
    highest-value check for this slice was the exhaustive static
    "does anything actually pass `popup`" grep (stronger than a
    screenshot could confirm, since a screenshot only shows the current
    call site's rendering, not whether some other caller exists), which
    was done. `AutoSelectionNode`/`ApiNode`'s rendering logic itself was
    ported line-for-line from the always-taken branch.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Seventeenth slice: start of the wallet-security-sensitive tier per
  AGENTS.md (`WalletSettings.jsx`, `PasswordSettings.jsx`,
  `BackupSettings.jsx`, `RestoreSettings.jsx`,
  `BackupFavorites.jsx`, `RestoreFavorites.jsx` — deferred to last with
  extra care). `PasswordSettings.jsx` (8 lines, a trivial wrapper around
  the untouched `WalletChangePassword`) and `WalletSettings.jsx` (wallet
  switch/delete + balance-claim lookup + brainkey-sequence reset UI) got
  the real `.jsx`→`.tsx` rewrite. Both are minimal, mechanical hooks
  translations with no logic changes — per AGENTS.md's "prefer minimal,
  well-tested diffs over refactors" for anything touching wallet
  internals. Neither file holds key material or does any crypto itself:
  `ChangeActiveWallet`, `WalletDelete`, `BalanceClaimActive`, and
  `WalletChangePassword` (all reused unchanged) hold the actual
  switching/deletion/balance-claim/password logic; the one direct call
  into wallet internals this slice's files make,
  `WalletDb.resetBrainKeySequence()`, passes straight through to the
  untouched, already-audited `WalletDb` module exactly as before.
  - Verified: `eslint` clean (0 errors, one expected `any` warning),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Eighteenth slice: `Settings/BackupFavorites.jsx` and
  `Settings/RestoreFavorites.jsx` got the real `.jsx`→`.tsx` rewrite.
  Despite living among the wallet-backup-named Settings files (and
  originally flagged for the extra-care tier by name alone before being
  read), reading both in full showed they only export/import the user's
  *starred markets* (favorite trading pairs) as JSON — no key material,
  no wallet state, no crypto anywhere in either file. Reclassified to the
  standard (non-wallet-sensitive) treatment once that was confirmed;
  their same-directory, actually-sensitive namesakes
  (`BackupSettings.jsx`/`RestoreSettings.jsx`) stay in the extra-care
  tier.
  - `BackupFavorites`: replaced the `alt-react` `connect()` wrapper with
    `useAltStore(SettingsStore)`, reading `starredMarkets` from state.
  - `RestoreFavorites`: no store subscription needed, purely local
    `json`/`error` state plus `SettingsActions` calls — ported as-is, no
    dead code found.
  - Added a `file-saver` ambient module shim to
    `app/types/vendor-shims.d.ts` (first TS port to import it, for the
    JSON blob download in `BackupFavorites`).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Nineteenth slice: `Settings/BackupSettings.jsx` and
  `Settings/RestoreSettings.jsx` got the real `.jsx`→`.tsx` rewrite -
  the last of the wallet-security-sensitive Settings tier, closing it out
  per AGENTS.md. Both are minimal, mechanical hooks translations with no
  logic changes. Neither file holds key material or does crypto itself:
  they're tab switchers between `BackupCreate`/`BackupBrainkey`
  (`BackupSettings`) and `BackupRestore`/`ImportKeys`/
  `CreateWalletFromBrainkey` (`RestoreSettings`) - all reused unchanged,
  holding the actual wallet-file/brainkey backup-and-restore/key-import
  logic - plus the already-ported, confirmed non-sensitive
  `BackupFavorites`/`RestoreFavorites`.
  - `RestoreSettings`'s `default:` switch branch intentionally covers
    both the "key" and "legacy" restore types by rendering the same
    `ImportKeys` with `privateKey` toggled by `restoreType === 1` -
    preserved exactly, documented inline as intentional, not a bug.
  - Verified: `eslint` clean (0 errors, 0 warnings), `yarn typecheck`
    clean, full Jest suite green (50/50), full webpack build shows only
    the 2 known pre-existing `charting_library` errors.
  - This closes out every file from the "Mach alles" Phase 2 punch list:
    Explorer's Assets/LiquidityPools/Accounts sub-tables and all twelve
    Settings subcomponents (SettingsEntry, AccountsSettings,
    FeeAssetSettings, AccessSettings, ResetSettings, WebsocketAddModal,
    then the wallet-sensitive tier: WalletSettings, PasswordSettings,
    BackupFavorites, RestoreFavorites, BackupSettings, RestoreSettings)
    are now all `.tsx`. `app/components/Settings/` contains no remaining
    `.jsx` files. `app/components/Explorer/` still has three -
    `Explorer.jsx` itself (the tab-menu shell around all the ported
    sub-tables) and the chart-only `BlocktimeChart.jsx`/
    `TransactionChart.jsx` - none of which were in this pass's scope.
- Twentieth slice: the three files left over in `app/components/Explorer/`
  got the real `.jsx`→`.tsx` rewrite, closing out that directory entirely.
  - `Explorer.jsx` (the "/explorer" tab-menu shell wrapping Blocks/
    Assets/Pools/Accounts/Witnesses/CommitteeMembers/Markets/Fees) →
    functional component. Its `this.state.tabs` was set once in the
    constructor and never touched by any `setState` anywhere in the file
    — not real state, just a constant table — ported as a plain
    module-level array. `history`/`location` came from react-router-dom's
    injected route props; ported with `useHistory`/`useLocation`, the
    same hooks `Settings.tsx` already uses for the equivalent purpose.
    Renamed the `AssetsContainer`/`AccountsContainer` import aliases to
    `Assets`/`Accounts` (both functional components since their own
    earlier slices; "Container" was a leftover from when they had a
    separate `connect()`-wrapping file).
  - `BlocktimeChart.jsx`/`TransactionChart.jsx` (the block-time and
    tx-per-block charts on the Blocks tab) → kept as **class components**
    rather than converted to hooks, a deliberate exception to this
    phase's usual functional-component default. Both `shouldComponentUpdate`s
    do an *imperative* Highcharts update (`chart.series[0].addPoint(...)`
    + `chart.redraw()`) to animate new blocks in incrementally instead of
    forcing a full chart rebuild on every new block — a side-effecting
    SCU with no clean, low-risk hooks equivalent (a `React.memo`
    comparator with side effects is itself an anti-pattern, and a
    `useEffect`-based translation would change exactly when/how the chart
    mutates relative to React's render cycle). Preserving this existing,
    working behavior exactly mattered more than uniformity with the rest
    of this phase, per AGENTS.md's "prefer minimal, well-tested diffs
    over refactors." Legacy string refs (`ref="chart"`/`ref="trx_chart"`)
    replaced with `React.createRef()`.
  - Confirmed bug, preserved exactly in `BlocktimeChart.tsx` (not this
    port's job to silently fix it): `_getData()` is declared with *no*
    parameter and always reads `this.props` internally, yet both call
    sites pass an argument (`nextProps` from `shouldComponentUpdate`,
    `this.props` from `render`) as if it mattered — the `nextProps`
    argument in `shouldComponentUpdate` is silently ignored, so that
    pre-redraw data computation always uses the *current* props, not the
    incoming ones. Confirmed as a genuine, isolated bug (not an
    intentional pattern) by comparing against the sibling
    `TransactionChart.jsx`, whose `_getData(props)` correctly takes and
    uses its argument at both call sites. Also dropped a confirmed-dead
    line in the same method: a `blockTimes.filter(a => a[0] >=
    head_block - 30)` call whose result was never assigned back to
    anything (the real trimming is the `takeRight(blockTimes, 30)` two
    lines later) — since that was `head_block`'s only use anywhere in the
    file, the prop is now unread by this component.
  - Found while verifying `BlocktimeChart.tsx`'s new typed prop contract
    against its caller: `Blocks.tsx` was passing `head_block_number` to
    `<BlocktimeChart>`, which has only ever declared/destructured a
    `head_block` prop (already unused either way, per above). Untyped JS
    never caught this; the new `BlocktimeChartProps` interface does.
    Renamed the call site's prop to `head_block` — zero behavioral
    change, since the value was unread on the receiving end before and
    after — documented inline in `Blocks.tsx`'s own header comment as a
    follow-up from this slice.
  - Added `react-highcharts` to `app/types/vendor-shims.d.ts` (first TS
    port to import it).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only —
    one `@typescript-eslint/no-unused-vars` line disabled inline for
    `BlocktimeChart`'s intentionally-ignored, bug-preserving parameter,
    documented at its declaration), `yarn typecheck` clean, full Jest
    suite green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors.
  - This closes out `app/components/Explorer/` entirely — no `.jsx`
    files remain in that directory.
- Twenty-first slice: `Blockchain/Transaction.jsx` (2427 lines — renders
  a decoded, human-readable view of one transaction's operations; used
  by `Block.jsx` when viewing a block's contained transactions, and by
  `TransactionConfirm.jsx`, the app-wide pre-broadcast confirmation
  dialog) got the real `.jsx`→`.tsx` rewrite. Before starting, this file
  and its much larger sibling `Blockchain/Asset.jsx` (2461 lines, also
  named in Phase 2's own scope line) were structurally mapped first:
  `Transaction.jsx` turned out to be purely read-only display — no
  `TransactionBuilder`, no `.broadcast(`/`.sign(` calls, no
  operation-building forms anywhere, just a ~40-case switch mapping
  known chain operation types to display rows — safe to port as a single
  file. `Asset.jsx`, by contrast, is route-reached directly
  (`/asset/:symbol`) and wires five live transaction-submitting forms
  (`AssetOwnerUpdate`, `AssetPublishFeed`, `AssetResolvePrediction`,
  `BidCollateralOperation`, `FeePoolOperation`) into its "Actions" tab
  via prop injection, plus three layered Alt.js `connect()`/
  `AssetWrapper` HOCs — deferred to its own slice, to be handled with the
  same extra care as the wallet-security-sensitive Settings tier rather
  than folded into this one.
  - Confirmed dead, dropped (verified by reading the whole file):
    `import {Link, DirectLink} from "react-scroll"` — `DirectLink` was
    never referenced anywhere, and the `Link` name was always shadowed
    by a local `let Link = ...` inside `linkToAccount`/`linkToAsset`
    before any JSX used it, so the react-scroll import was never actually
    reached (`Link` from `react-router-dom`, aliased `RealLink`, is what
    those methods really used). Also the `proposal_create` case's local
    `var operations = []` — populated via a loop but never read
    afterward (`proposalsText` computes straight from
    `op[1].proposed_ops.map(...)`). Also `Transaction`'s own
    `this.state = {}` (never read or set) and `OperationTable`'s
    `opCount`/`index` props (passed by every call site, including the
    `opCount` variable computed in `Transaction` just to feed them, but
    never read inside `OperationTable`'s own render).
  - `OpType`'s `shouldComponentUpdate` (perf-only re-render gate on the
    `type` prop) dropped, same as this migration's other legacy SCU
    gates elsewhere.
  - The one wallet-adjacent call, `WalletUnlockActions.unlock()` (used
    only to decrypt-and-show a transfer/issue memo inline, not to sign
    or broadcast anything), is reused exactly as before; its
    `this.forceUpdate()` after unlock is load-bearing (the decrypted
    memo text is recomputed fresh from `PrivateKeyStore.decodeMemo` on
    every render, with no other trigger to re-render after unlocking) —
    replicated with the standard hooks forceUpdate substitute.
  - `Transaction` was missing a `block` prop from its own
    `propTypes`/`defaultProps` even though `render()` reads
    `this.props.block` in the `htlc_create` case — `Block.jsx` passes
    it, `TransactionConfirm.jsx` doesn't (falls back to `new Date()`,
    unchanged). Declared in the new `TransactionProps` interface since
    it's genuinely read.
  - Added `react-json-inspector` to `app/types/vendor-shims.d.ts` (first
    TS port to import it).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Twenty-second slice: `Blockchain/Asset.jsx` (2461 lines — the
  "/asset/:symbol" details page) got the real `.jsx`→`.tsx` rewrite,
  closing out Phase 2's own explicitly-named scope
  (`Blockchain/Transaction.jsx, Blockchain/Asset.jsx`). This is the
  highest-risk file ported this phase: it computes financial figures
  itself (margin ratios, collateral-bid ordering, settlement prices via
  the `CallOrder`/`CollateralBid`/`FeedPrice` classes from
  `common/MarketClasses`, fed by live `Apis.instance().db_api().exec(...)`
  calls) and its "Actions" tab wires five real transaction-submitting
  child forms (`AssetOwnerUpdate`, `AssetPublishFeed`,
  `AssetResolvePrediction`, `BidCollateralOperation`, `FeePoolOperation` —
  all reused completely unchanged) into props via prop injection.
  Confirmed with the user before starting, given the size and risk
  profile; ported as a careful, mechanical, line-for-line translation
  with no logic changes and no restructuring/splitting (an agent's own
  structural-mapping suggestion to split the file into smaller modules
  was explicitly not taken, per AGENTS.md's "prefer minimal, well-tested
  diffs over refactors").
  - Structural change (the same substitution pattern already applied to
    every other legacy `BindToChainState`/`connect`/`AssetWrapper`-
    wrapped file this phase, not a one-off redesign): the original's
    three-layer HOC chain (`AssetSymbolSplitter` → `AssetContainer`,
    wrapped with `AssetWrapper(..., {withDynamic: true})` → `connect(...)`
    + `AssetWrapper(Asset, {propNames: ["backingAsset", "coreAsset"]})`)
    collapsed into two components: `AssetContainer` (does all the
    ChainStore resolution directly via `ChainStore.getAsset`/
    `ChainStore.getObject` + `useAltStore(AccountStore)`, gated by
    `useChainStoreTick()`) and `Asset` (receives already-resolved props,
    exactly as before). `ChainStore.getAsset`'s `null`-vs-`undefined`
    contract (confirmed by reading its source: `null` = confirmed not
    found, `undefined` = still loading) is exactly what
    `BindToChainState`/`AssetWrapper` already relied on internally, so
    the original's `=== null` / `!x.get` guards are preserved verbatim.
  - Confirmed dead, dropped (verified by reading the whole file): the
    `marginTableSort`, `collateralTableSort`, and `sortDirection` state
    fields (initialized in the constructor, never read anywhere else),
    and `renderPriceFeed`/`renderSettlement`'s early-return `<div
    header={title} />` (both functions) — `title` was only declared
    later in the same method via `var title = (...)`, hoisted but always
    `undefined` at that earlier point in execution; since React omits
    `undefined` prop values from the rendered DOM regardless of prop
    name, this always rendered identically to a plain `<div />`.
  - `UNSAFE_componentWillMount`'s margin/collateral-bid fetch →
    `useEffect(..., [])`, mount-only, matching the original's own
    mount-only timing exactly (it never re-ran on asset-prop changes
    either, only via the `onUpdate` callback after placing/canceling a
    bid) — documented inline that this means navigating between two
    different assets without an intervening full remount would, in both
    the original and this port, leave stale margin/collateral-bid data
    displayed against the new asset; a pre-existing characteristic, not
    something this port changes.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only —
    this file legitimately has the most of any port this phase, given
    how much of it is untyped Immutable-Map/chain-object manipulation),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
    A live-render screenshot check of both the "Info" and "Actions" tabs
    against fixture chain data (to confirm the Actions tab's five forms
    mount without crashing and receive correctly-wired props) was run
    separately, given this file's risk profile — confirmed all six
    Actions-tab sections render correctly (fee pool fund/claim ×3, asset
    owner update, feed publish; no collateral-bid or resolve-prediction
    sections, correctly, since the fixture is neither globally settled
    nor a prediction market), all five real forms wired with correct
    props (funding account, current owner, MCR/MSSR prefill, fee-pool
    balances all traced to the seeded fixture values), zero console
    errors. Harness note for reuse: `BindToChainState`/
    `ChainTypes.ChainAccount`-consuming components (like
    `AssetOwnerUpdate`/`AssetPublishFeed` here) default
    `autosubscribe=true`, which calls `fetchFullAccount()` on first
    access and hangs forever against a stubbed `Apis` unless the fixture
    also pre-marks the seeded accounts as subscribed via
    `ChainStore.get_full_accounts_subscriptions.set(id/name, true)`.
  - This closes out Phase 2's explicitly-named scope from §7's own text.
    `app/components/Blockchain/` still has other `.jsx` files (`Block.jsx`,
    `Operation.jsx`, `Fees.jsx`, `MemoText.jsx`, `AssetOwnerUpdate.jsx`
    and its four form siblings, etc.) that were never named in Phase 2's
    scope and were not touched by this pass — `MemoText.jsx` in
    particular decrypts memos with wallet keys and would need the same
    extra-care treatment as this slice, at minimum.

### Phase 3 — Account & portfolio actions
- Migrate: account creation/import (non-key-bearing parts), permissions,
  voting, asset creation/update (`AccountAssetCreate.jsx`,
  `AccountAssetUpdate.jsx`), notifications.
- Exit criteria: legacy equivalents deleted; unit + integration tests for
  every form/validation path.
- Unlike Phase 2, this phase is *not* scoped as signing-free — several
  files here build and submit real transactions themselves
  (`AccountAssetCreate.jsx`/`AccountAssetUpdate.jsx` most obviously;
  `AccountPermissions.jsx`'s `onPublish` almost certainly submits an
  `account_update`). Each slice's risk tier is assessed on its own
  merits rather than assumed from the phase, same discipline Phase 2
  applied to `Asset.jsx`.

**Progress:**
- First slice: the Account Voting screen's three tab panes,
  `Account/Voting/Committee.jsx`, `Witnesses.jsx`, `Workers.jsx` (84/101/
  213 lines), got the real `.jsx`→`.tsx` rewrite. Chosen as the lower-
  risk on-ramp into this phase: pure display/local-modal-toggle
  orchestration, no transaction-building of their own — the actual vote-
  adding/removing logic lives in caller-supplied handler props from
  `AccountVoting.jsx` (911 lines, not yet ported, still the files'
  common parent), and the join/create-witness/committee flows are
  delegated unchanged to `JoinWitnessesModal`/`JoinCommitteeModal`.
  - Confirmed dead, dropped in `Workers.tsx`: the legacy
    `shouldComponentUpdate` compared `nextProps.workerTableIndex`
    against `this.state.workerTableIndex` as its final OR-condition —
    but `workerTableIndex` was never actually destructured from props
    anywhere in the file (only ever set via local state), and grepping
    the component's only caller (`AccountVoting.jsx`) confirms it never
    passes a `workerTableIndex` prop either. That means
    `nextProps.workerTableIndex` was always `undefined` while
    `this.state.workerTableIndex` was always a real number, so that
    condition — and therefore the whole SCU, being OR'd with four others
    — always evaluated `true`. The gate was already a complete no-op
    (identical to not having `shouldComponentUpdate` at all), not a
    working optimization this port needed to replicate.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Second slice: `Account/AccountPermissionsList.jsx` (293 lines — a
  reusable list-building UI for one authority's accounts/keys/addresses
  and their weights, used inside `AccountPermissions.jsx`, not yet
  ported) got the real `.jsx`→`.tsx` rewrite. This component itself
  doesn't build or submit any transaction — it only maintains local
  selection/input state and calls back into caller-supplied `onAddItem`/
  `onRemoveItem`/`validateAccount` props; `AccountPermissions.jsx` is
  where the actual `account_update` operation gets assembled and
  published, and stays unported (and on the extra-care list) for its own
  slice.
  - The legacy `accounts` prop was typed `ChainTypes.ChainObjectsList`
    and resolved by the outer `BindToChainState(AccountPermissionsList,
    {autosubscribe: false})` wrap before this component's own render ran.
    Replicated by accepting the same raw id list `AccountPermissions.jsx`
    already computes and resolving each id via `ChainStore.getObject`
    directly (the same generic per-item resolution `ChainObjectsList`
    itself does under the hood), gated by `useChainStoreTick()`. `keys`/
    `addresses` were never chain-resolved in the original either (no
    propType declared for them at all, just plain prop arrays of pubkey/
    address strings) — unchanged.
  - `AccountPermissionRow`'s `shouldComponentUpdate` (shallow prop-
    equality gate) dropped, same as this migration's other legacy SCU
    gates elsewhere — perf-only, doesn't change output.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Third slice: `Account/VotingAccountsList.jsx` (388 lines — the
  witness/committee-member table used inside `Committee.tsx`/
  `Witnesses.tsx`, this phase's first slice) got the real `.jsx`→`.tsx`
  rewrite. Purely display/local-vote-toggle orchestration — clicking a
  row calls the caller-supplied `onAddItem`/`onRemoveItem` props (which
  build and submit the actual vote-change transaction elsewhere, still
  in the not-yet-ported `AccountVoting.jsx`), this file only decides
  which handler to call per row and renders the table.
  - Substantial confirmed-dead find (verified by reading the whole file
    — no `AccountSelector` or any add-item form is rendered anywhere in
    `render()`): the `selected_item`/`item_name_input`/`error` state,
    and the class's own `onItemChange`/`onItemAccountChange`/
    `onAddItem` methods — all bound in the constructor but never wired
    to any JSX element's event handler (not to be confused with the
    `onAddItem` *prop*, which the file's own per-row vote toggle does
    use — only the internal same-named method was dead). Also dropped
    the `action` prop (`defaultProps: {action: "remove"}`) — never read;
    every use of the identifier `action` in the file is a *local*
    per-row variable of the same name, computed inside the items-to-rows
    `.map()`.
  - `validateAccount`/`label`/`placeholder`/`tabIndex` are dead in the
    exact same way (only read inside the now-removed
    `onItemAccountChange`, or not read at all) — but since both current
    callers (`Committee.tsx`/`Witnesses.tsx`) still forward them from
    their own parent `AccountVoting.jsx`, they're kept as accepted-but-
    unused props rather than chasing the cascade up into that 900+ line
    file, which is out of this slice's scope — flagged inline as a
    revisit once `AccountVoting.jsx` itself gets ported.
  - Replaced `BindToChainState(VotingAccountsList)` (the default,
    autosubscribing wrap) with direct `ChainStore.getObject` resolution
    per item id, gated by `useChainStoreTick()`.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean (confirms `Committee.tsx`/`Witnesses.tsx`
    still type-check cleanly against the new prop contract), full Jest
    suite green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors.
- Fourth "slice" was a deletion, not a port: `Account/AccountVotingProxy.jsx`
  (256 lines) turned out to be entirely orphaned — a case-insensitive
  grep across the whole `app/` tree found zero references to it anywhere
  outside its own file (no imports, no dynamic-import strings). Its
  `static propTypes` block even references a `PropTypes` global the file
  never imports, which would throw `ReferenceError: PropTypes is not
  defined` the moment the module was ever evaluated — moot in practice,
  since nothing ever imports it, so webpack never includes it in any
  bundle. `AccountVoting.jsx` (not yet ported) implements the live
  account-voting-proxy feature entirely inline instead (92 references to
  "proxy" in that file). Removed rather than ported — translating dead
  code to TypeScript would add a maintenance burden for zero benefit.
  Verified: full Jest suite green (50/50), full webpack build shows only
  the 2 known pre-existing `charting_library` errors (confirming nothing
  else referenced it).
- Fifth slice: `Account/AccountPermissionsMigrate.jsx` (214 lines) got
  the real `.jsx`→`.tsx` rewrite — the first genuinely
  wallet-security-sensitive file in Phase 3, handled with the same extra
  care as this migration's wallet-tier Settings files. It calls
  `WalletDb.generateKeyFromPassword` directly to derive candidate
  active/owner/memo keys from a user-entered password, for migrating an
  account to a password-derived key model. The actual key-generation
  math and the eventual `account_update` submission both stay entirely
  inside `WalletDb`/the caller-supplied `onAddActive`/`onAddOwner`/
  `onSetMemo`/`onRemoveActive`/`onRemoveOwner` props (all in the
  not-yet-ported `AccountPermissions.jsx`) — this file only derives
  candidate keys for display and forwards user actions to those
  callbacks, unchanged.
  - One pre-existing quirk preserved exactly, not "fixed": in
    `_onUseKey`, the remove-branch handler lookup
    (`role === "active" ? "onRemoveActive" : "onRemoveOwner"`) falls
    through to `onRemoveOwner` for `role === "memo"`, which looks like a
    bug at a glance. In practice it's unreachable — the memo row's "use"
    button is only ever visible (and thus clickable) exactly when the
    add branch, not the remove branch, would fire, since
    `visibility: hidden` hides it whenever `memoInUse` is true. Kept
    byte-for-byte identical rather than resolved either way, since
    that's a judgment call on intent this port isn't the place to make.
  - Two purely mechanical TS-driven adjustments, verified to have zero
    behavioral effect: `visibility: ""` (React's CSS property types
    reject an empty string) → `visibility: "visible"` (CSS-equivalent —
    an unset `visibility` and an explicit `"visible"` render
    identically). An initial draft also accidentally added
    `e.preventDefault()` to the form's `onSubmit` handler where the
    original was a genuine empty no-op (form submission, e.g. pressing
    Enter in the password field, was never actually prevented) — caught
    before committing and reverted to the same empty no-op, since
    "fixing" that wasn't this port's call to make either.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only —
    plus one `@typescript-eslint/no-empty-function` disabled inline for
    the intentionally-empty `onSubmit`, documented at its declaration),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Sixth slice: `Account/AccountPermissions.jsx` (546 lines) got the real
  `.jsx`→`.tsx` rewrite — the central wallet-security-sensitive file this
  whole family of slices was building up to. Its `onPublish` assembles
  and submits the real `account_update` operation via
  `ApplicationApi.updateAccount`, unchanged; `createPaperWalletAsPDF`
  (the "create paperwallet" button) is likewise reused completely
  unchanged.
  - The legacy class kept ~25 related fields (active/owner
    accounts/keys/addresses/weights/thresholds, `memo_key`, a `prev_`
    shadow copy of each for change-detection, and the password-derived
    candidate keys) as one flat `this.state` object, updated via React
    class `setState`'s shallow-merge semantics — `updateAccountData`/
    `onReset` each replace many fields in one call, and `onAddItem`
    directly *mutates* the `*_weights` plain-object sub-field in place
    before a separate `setState` call for just the list array (relying
    on object-reference mutation being visible on next read, not on that
    field going through its own `setState`). Replicated with a single
    `useState<any>({})` plus a small `mergeState` helper doing the same
    shallow merge `this.setState(partialObject)` did — kept as one state
    bag rather than decomposed into ~25 independent hooks, to preserve
    that mutation-then-sibling-setState pattern exactly and match how
    the original genuinely modeled this data (one cohesive object), not
    accidentally-coupled fields split apart by a mechanical translation.
  - `UNSAFE_componentWillMount` did two things: seed state from
    `account`, and pre-warm `accountUtils.getFinalFeeAsset(account,
    "account_update")` (return value discarded — almost certainly a
    cache-warming call, since `onPublish` calls the same function again
    by id later and needs a synchronous result).
    `UNSAFE_componentWillReceiveProps` re-seeded state whenever the
    `account` prop changed, but did *not* repeat the fee-asset pre-warm.
    Split into two effects to preserve that exact asymmetry: one
    `useEffect` on `[account]` (mount + every subsequent account change,
    matching the reseed), a separate `useEffect(() => {...}, [])` for the
    pre-warm (mount-only, never repeated on account change — even though
    that looks like it could be a gap when navigating between two
    different accounts' permissions pages, faithfully preserved rather
    than "fixed").
  - A new `if (!state.active_accounts) { return null; }` guard was added
    before the main render — not present in the original, and not a
    behavior change to flag, but a necessary timing adaptation: the
    class's `UNSAFE_componentWillMount` ran synchronously *before* first
    render, so `this.state` was always populated by the time `render()`
    first ran; hooks' `useEffect` runs *after* first paint, so without
    the guard the initial render would call `.map()`/`.filter()` on
    `undefined` state fields and crash. Renders `null` for one frame
    instead, matching the original's actual on-screen result once the
    effect runs.
  - Confirmed dead, dropped: the string refs `ref="appTables"` and
    `ref="memo_key"` — neither was ever read via `this.refs` anywhere in
    the file.
  - `validateAccount(collection, account)` is a real, actively-passed
    callback (to `AccountPermissionsList`'s `validateAccount` prop), but
    its body is `return null;` unconditionally, ignoring both
    parameters — the "already in this permission list" duplicate-account
    validation is effectively a disabled no-op stub in the original too,
    not something this port restores or removes; kept exactly as-is
    (with an inline `eslint-disable-next-line` for the now-flagged
    unused parameters, since plain JS never enforced that).
  - One purely mechanical TS-driven adjustment: the threshold `<input>`'s
    `size="5"` (string, valid HTML/legacy JSX) became `size={5}` (number)
    since React's TS types for `<input>` type `size` as numeric —
    identical rendered/parsed value, zero behavioral difference.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only —
    plus one `@typescript-eslint/no-unused-vars` disabled inline for
    `validateAccount`'s intentionally-unused parameters), `yarn
    typecheck` clean, full Jest suite green (50/50), full webpack build
    shows only the 2 known pre-existing `charting_library` errors.
- Seventh slice, and the last in the Permissions/Voting family:
  `Account/AccountVoting.jsx` (911 lines) got the real `.jsx`→`.tsx`
  rewrite — the parent orchestrator every already-ported Voting-family
  file (`Committee.tsx`/`Witnesses.tsx`/`Workers.tsx`/
  `VotingAccountsList.tsx`) depended on for real vote-adding/removing
  logic. Its `publish` (called from `onPublish`/`onRemoveProxy`) submits
  the real `account_update` operation via `ApplicationApi.updateAccount`,
  reused unchanged — same wallet-security-sensitive care as the rest of
  this family.
  - Structural change (the same substitution this migration has applied
    to every other legacy `BindToChainState`-wrapped file): the original
    `BindToChainState(AccountVoting)` wrap — resolving `initialBudget`/
    `globalObject`/`proxy` (all `ChainTypes...isRequired`) and gating
    render behind a `<span/>` placeholder until every required prop
    resolves — is collapsed into an `AccountVotingContainer` + `AccountVoting`
    split (the same split used for `Asset.tsx`/`AssetContainer`): the
    container resolves all three via `ChainStore.getObject`/`getAccount`
    under `useChainStoreTick()` and renders the placeholder itself,
    preserving the original guarantee that the actual component's
    state-seeding logic (formerly the constructor, now `useState`'s lazy
    initializer) never runs against an unresolved chain object. The
    `withRouter(FillMissingProps)` wrap became a plain `FillMissingProps`
    function — `history`/`location` are read with `useHistory()`/
    `useLocation()` directly inside `AccountVoting` instead.
  - `all_witnesses`/`all_committee` are the one exception to the
    established flat-state-bag+`mergeState` pattern (used for everything
    else, ~20 fields): the legacy `_getVoteObjects` intentionally bypasses
    `setState` entirely, mutating `this.state.all_${type}` directly and
    calling `this.forceUpdate()` to pick up the mutation — a real,
    deliberate anti-pattern in the original, not a bug to "fix" into a
    normal `setState`. Replicated with `useRef` (the mutation target) plus
    a small `useForceUpdate` helper (a dummy counter bumped to force a
    re-render), preserving the exact mutate-then-force-rerender behavior.
  - `UNSAFE_componentWillMount` + `componentDidMount` (five calls total,
    none observably depending on an intervening render) collapsed into one
    mount-only effect. `UNSAFE_componentWillReceiveProps`'s two behaviors
    split: the account-changed branch became a `[account]`-keyed effect
    guarded to skip its first (mount) run; the unconditional
    `getBudgetObject()` call (fired on *every* prop change, not just
    `account`) has no exact hooks equivalent — approximated with an effect
    keyed on `[account, location.pathname]`, the two props that actually
    change while this component stays mounted in practice (account
    switches, and tab switches via `/account/:name/voting/:tab`, which
    change `location.pathname` without remounting). `settings`/
    `viewSettings` changing without triggering this approximation is a
    known, accepted narrowing — `getBudgetObject` is a cheap, idempotent,
    display-only refresh that never touches the vote-submission
    transaction.
  - Wherever the original used `this.setState(partial, callback)`
    specifically so the callback would see the just-applied value
    (`onReset`, `onProxyAccountFound`, `getBudgetObject`'s own recursive
    self-calls), replicated by passing that already-known value explicitly
    as a parameter override instead of emulating `setState`'s callback
    timing with an effect — functionally identical, since in each case the
    callback only ever read the single field the preceding `setState` had
    just written.
  - Confirmed dead, dropped: the `this.refs.voting_proxy` guard at the top
    of `onReset` (no such ref exists anywhere in the file); `onCreateTicket`
    and `onClearProxy` (both defined, neither ever called or passed as a
    prop anywhere); and `validateAccount`/the `validateAccountHandler`
    closure built from it — deferred exactly to this slice by
    `VotingAccountsList.tsx`'s own earlier comment ("revisit when
    AccountVoting.jsx itself gets ported"). With the full chain now
    traceable (`AccountVoting` → `Committee`/`Witnesses`
    (`validateAccountHandler` prop) → `VotingAccountsList`
    (`validateAccount` prop)), confirmed dead at every link and removed
    end to end: dropped from `AccountVoting.tsx`, the now-fully-dead
    `validateAccountHandler` prop removed from `Committee.tsx`/
    `Witnesses.tsx`, and `validateAccount`/`placeholder` (the latter never
    supplied by any caller either) removed from `VotingAccountsList.tsx`'s
    prop interface. `label`/`tabIndex` stay as accepted-but-unused there —
    both are still actively supplied real values by
    `Committee.tsx`/`Witnesses.tsx`.
  - One pre-existing bug preserved exactly, not fixed: `onReset` restores
    `current_proxy_input: s.prev_proxy_input` — but no field named
    `prev_proxy_input` is ever set anywhere in the file (only
    `prev_proxy_account_id` is maintained), so this always evaluates to
    `undefined` — "reset" clears the proxy search box's text rather than
    restoring its previous contents. Kept byte-for-byte identical, since
    fixing it either way is a judgment call on intent this port isn't the
    place to make.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only,
    across `AccountVoting.tsx` and the three touched Voting-family files),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.

**Phase 3's Permissions/Voting family is now complete** — every file in
that group (`AccountPermissions.jsx`, `AccountPermissionsList.jsx`,
`AccountPermissionsMigrate.jsx`, `AccountVoting.jsx`, and the three
Voting tab panes plus `VotingAccountsList.jsx`) has been ported, with the
one orphaned file (`AccountVotingProxy.jsx`) removed outright.

- Eighth slice: `Account/AccountAssetCreate.jsx` (1374 lines) got the
  real `.jsx`→`.tsx` rewrite — the "create a new user-issued asset" form
  (primary details, description, optional bitAsset/MPA options,
  permissions, flags). Unlike every file ported so far in this phase,
  `createAsset` (the confirm button's handler) builds and submits the
  real `asset_create` transaction itself, via `AssetActions.createAsset`,
  reused unchanged.
  - State-management design differs from this family's other slices
    (`AccountPermissions.tsx`/`AccountVoting.tsx`, both a
    `useState<any>({})` + shallow-merge `mergeState`): this class
    overwhelmingly favors *directly mutating* `this.state`'s nested
    objects (`update`, `bitasset_opts`, `core_exchange_rate`,
    `flagBooleans`, `permissionBooleans`) in place and calling
    `this.forceUpdate()`, rather than going through `setState`'s merge —
    and even its few genuine `setState({field: value})` calls almost
    always pass back a reference that was *already* mutated in place
    first (e.g. the flag/permission toggles). Rather than force this into
    the `useState`+`mergeState` shape field by field, state is held in a
    single `useRef` (matching a class instance's `this.state` object
    identity/mutability exactly) plus a small `useForceUpdate` helper —
    `updateState(partial)` (`Object.assign` into the ref, then force a
    re-render) replicates `setState`'s observable shallow-merge behavior
    exactly, since nothing in this file ever compares the whole state
    object by reference.
  - The one `this.setState(update, callback)` use (cursor-position
    restoration after typing in the symbol/max_supply fields, so the
    caret doesn't jump to the end on every keystroke) needed a real hooks
    adaptation: the callback must run *after* the DOM reflects the new
    input value, to compute the right selection range. Replicated with a
    ref holding the pending restore request plus a no-dependency-array
    `useEffect` (runs after every commit) that performs and clears it
    when set — the closest hooks equivalent to `setState`'s post-commit
    callback timing.
  - Structural change (same substitution used throughout this migration):
    `BindToChainState(AccountAssetCreate)` (`core`/`globalObject`, both
    `.isRequired`) and `BindToChainState(BitAssetOptions)` (`backingAsset`,
    also `.isRequired`) each replaced with a Container + component split.
  - Confirmed dead, dropped (verified by reading the whole file and
    grepping every method name against the rest of the file and
    `AccountAssetUpdate.jsx`, the only other importer of `BitAssetOptions`):
    `_hasChanged()`, `_onInputCoreAsset()`, and `_onFoundCoreAsset()` — all
    three defined, none ever called or bound to any JSX element anywhere
    (the live core-exchange-rate handler is the separate, actually-wired
    `_onCoreRateChange`). Losing `_onFoundCoreAsset` also removes a
    pre-existing bug that would otherwise need preserving: it read a
    top-level `state.max_supply` that never exists (the real field is
    nested at `state.update.max_supply`) — moot, since the method was
    unreachable. Also dropped: three local variables in the original
    `resetState(props)` (`precision`, `corePrecision`,
    `coreRateBaseAssetName`) computed but never read, which meant
    `resetState` no longer needed a `props` parameter at all; the
    `ref="appTables"` on the render root (never read via `this.refs`);
    `BitAssetOptions`'s `isUpdate` propType (never read internally, and
    never actually supplied by either caller); and a stale, already-
    superseded commented-out overflow-check block inside the
    `max_supply` input handler.
  - Two purely mechanical TS-driven adjustments, verified to have zero
    behavioral effect: `rows="1"` (string) on the description textarea
    became `rows={1}` (number); the original also had `rows="1"` on two
    plain `<input type="text">` elements specifically — not a valid HTML
    attribute for `<input>` at all (browsers silently ignore it there)
    and not a valid React prop either — dropped entirely rather than
    cast, an inert attribute either way.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors
    (and confirms `AccountAssetUpdate.jsx`'s still-legacy `import
    {BitAssetOptions} from "./AccountAssetCreate"` resolves cleanly
    against the new module).

- Ninth slice, and the last in Phase 3: `Account/AccountAssetUpdate.jsx`
  (1747 lines) got the real `.jsx`→`.tsx` rewrite — the "update an
  existing user-issued asset" counterpart to `AccountAssetCreate.tsx`:
  primary details/CER, whitelist, description, optional bitAsset options,
  permissions, flags, and feed producers. `updateAsset` builds and
  submits the real `asset_update` transaction via
  `AssetActions.updateAsset`, reused unchanged.
  - Same `useRef`-holds-the-whole-state-object + `useForceUpdate` +
    `updateState(partial)` design as `AccountAssetCreate.tsx`, for the
    same reason: this class also mixes direct in-place mutation-then-
    `forceUpdate()` with genuine `setState(partial)` calls throughout.
    This file's `errors` state field is *fully replaced*, never merged,
    every time it's set — preserved exactly via `updateState({errors:
    {...}})`, matching `Object.assign`/real `setState`'s per-top-level-key
    overwrite behavior precisely.
  - Structural change (same substitution used throughout this migration):
    `BindToChainState(AccountAssetUpdate)` (`globalObject`) and
    `AssetWrapper(AccountAssetUpdate, {propNames: ["asset", "core"],
    withDynamic: true})` (resolving `asset`/`core`, both `.isRequired`,
    plus a `getDynamicObject` helper via the nested
    `DynamicObjectResolver`) collapsed into one
    `AccountAssetUpdateContainer` resolving all three via `ChainStore`
    under `useChainStoreTick()`. `getDynamicObject(id)` implemented as a
    direct `ChainStore.getObject(id)` read — the same simplification
    already validated for `Asset.tsx`/`AssetContainer`
    (`DynamicObjectResolver`'s own version just searches a
    `ChainObjectsList`-resolved array for the same id, resolving through
    `ChainStore.getObject` internally either way). The outer route-level
    `AssetUpdateWrapper` (`withRouter`, reading `match.params.asset`)
    became a plain function reading the same param with `useParams()` —
    the same substitution already used for `Asset.tsx`/
    `AssetSymbolSplitter`; `history`/`location`/`match` were never read
    anywhere else in this file.
  - `_onInputCoreAsset`/`_onFoundCoreAsset` are the *live* counterparts of
    the same-named methods confirmed fully dead in the sibling
    `AccountAssetCreate.tsx` — here they're actively wired to the
    quote/base `AssetSelector`s. `_onFoundCoreAsset`'s pre-existing bug is
    therefore preserved exactly, not dropped: it calls
    `_validateEditFields({max_supply: this.state.max_supply, ...})`,
    reading a top-level `state.max_supply` that never exists (the real
    field is nested at `state.update.max_supply`) — so selecting a new
    quote/base asset always resets the max-supply error to "too large"
    regardless of the actual value. The same bug, for the same reason, is
    also triggered by `_onFlagChange` (calls `_validateEditFields({})`)
    and `onChangeFeedProducerList` (calls `_validateEditFields(
    {feedProducers: current})`) — neither passes a `max_supply` key
    either. All three preserved byte-for-byte.
  - Confirmed dead, dropped: `_onClaimInput` and the `claimFeesAmount`
    state field it wrote to (destructured in `render()` but never read
    afterward, never wired to any element, and not among the arguments
    passed to `AssetActions.updateAsset`); the `ref="appTables"` on the
    render root; `ConfirmModal`'s `showModal` and `_cancelConfirm` props
    (both passed by the parent, neither ever read inside `ConfirmModal` —
    `_cancelConfirm`'s own wrapper method is dropped too, since passing
    it to `ConfirmModal` was its only use); the blanket `{...this.props}`
    spread onto `<ConfirmModal>` (verified by reading its whole render
    body that it only ever reads `visible`/`tabsChanged`/`hideModal`/
    `_updateAsset`); and a stale, already-superseded commented-out
    overflow-check block inside `_onUpdateInput`'s `max_supply` case,
    same category as `AccountAssetCreate.tsx`'s equivalent drop.
  - `onChangeTab` (`<Tabs onChangeTab={i => this.setState({activeTab:
    i})}>`) sets an `activeTab` field that's written but never read
    anywhere else — not dropped, though, since the `setState` call itself
    has a real, easy-to-miss effect: it forces a fresh render pass on
    every tab switch, independent of chain-store-driven re-renders.
    Preserved as `stateRef.current.activeTab = i; forceUpdate();`.
  - `_updateAsset`'s delayed reset (`setTimeout(() => {...this.setState(
    this.resetState(this.props))...}, 3000)`) reads `this.props` at
    *fire* time in the original — always current, since `this` is a live
    class instance. Replicated with a small ref updated on every render
    to hold the latest `asset`/`core`/`globalObject`/`account`, read by
    the timeout callback instead of the closure's own (potentially
    3-seconds-stale) values — the closest hooks equivalent to a class's
    always-current `this.props`.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.

**Phase 3 is now complete.**

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

**Progress:**
- Starting-point decision: given the scale here (`Exchange.jsx` alone is
  3,683 lines — over 2x the largest file ported in Phase 3 — and the
  `app/components/Exchange` directory totals ~16,000 lines across 28
  files), plus this phase's explicit call to introduce Redux Toolkit (a
  new dependency/architecture not used anywhere else in this migration
  yet), starting directly on `Exchange.jsx` or the Redux store was judged
  too large a first step to take without an established foothold in this
  directory. Confirmed with the user: start with the smallest, most
  self-contained satellite component first, matching how both Phase 2 and
  Phase 3 opened with a lower-risk on-ramp before their largest files.
  Redux Toolkit's introduction is deferred to a later slice, once there's
  concrete evidence (from porting a few of the read-heavy satellites)
  about `MarketsStore`'s actual update-frequency/consumer shape. Also
  noted: the plan's `QuickTrade.jsx` no longer exists in the codebase —
  trading-form logic now lives in `BuySell.jsx`/`ScaledOrder.jsx`/
  `ScaledOrderTab.jsx` instead; the file list above is stale and this
  phase's actual scope will be re-derived from the current directory
  listing as slices proceed.
- First slice: `Exchange/ConfirmOrderModal.jsx` (65 lines) got the real
  `.jsx`→`.tsx` rewrite — a purely presentational confirmation dialog
  shown before an order that would cancel/replace existing orders; no
  chain state, no store, just props in and two callbacks
  (`onForce`/`hideModal`) out. Chosen as the lowest-risk possible on-ramp
  into this phase. Straightforward mechanical translation, no logic
  changes, no dead code found.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Second slice, a batch of three small satellites:
  - `Exchange/MarketsContainer.jsx` (34 lines) + `Exchange/Markets.jsx`
    (59 lines) collapsed into one `MarketsContainer.tsx`. Confirmed dead:
    `MarketsContainer.jsx`'s entire purpose was an `AltContainer` wrap
    injecting `starredMarkets`/`viewSettings`/`lookupResults`/
    `marketBase` onto its child `<Markets/>` — but `Markets.jsx` never
    read any of those four props anywhere (its own logic only tracks a
    local `height` state from a window resize listener, sized for its
    `MyMarkets` child, which resolves its own store data independently).
    Collapsed into one component under the `MarketsContainer` name
    (`Explorer.tsx`'s external contract, its only importer), folding in
    `Markets.jsx`'s real logic; `Markets.jsx` itself removed rather than
    kept as a pass-through, since it had no other importer.
  - `Exchange/PriceStat.jsx` (117 lines) deleted outright, not ported —
    a whole-app case-insensitive grep found zero importers anywhere.
    (Its internal class happened to be named `PriceStatWithLabel`, a
    copy-paste artifact confusingly shared with the separate, actually-
    used `PriceStatWithLabel.jsx` — unrelated files, not to be conflated.)
  - `Exchange/PriceStatWithLabel.jsx` (113 lines, used repeatedly by
    `ExchangeHeader.jsx`, not yet ported) got the real `.jsx`→`.tsx`
    rewrite. Its `shouldComponentUpdate` is the first SCU gate in this
    migration confirmed to be a *genuine* render throttle rather than a
    no-op: it blocks re-render unless `volume2`/`base`/`price`/`ready`
    change, so a `quote`/`content`/`toolTip`/`onClick`/
    `ignoreColorChange`-only change doesn't show until one of those four
    also changes — plausible given this tile sits in the Exchange price
    ticker, this phase's own "state-heaviest, highest-update-frequency"
    part of the app. Preserved via `React.memo` with a comparator that's
    the exact logical inverse of the original SCU (memo's comparator
    returns true to *skip*, the opposite sense). Its
    `UNSAFE_componentWillReceiveProps` (computing the pulsing `change`/
    `marketChange` state) becomes a no-dependency-array effect — but
    since `React.memo` skips calling the component entirely on throttled
    updates (unlike the class, whose `componentWillReceiveProps` always
    ran even when `shouldComponentUpdate` then blocked the render), this
    port only observes `market` prop changes that coincide with a memo-
    passing render. Documented as an accepted, narrow approximation gap —
    invisible to the user either way, since nothing paints during a
    throttled update in either version — rather than pursued further with
    a larger restructuring (an always-rendering outer tracker component)
    a mechanical port isn't the place to introduce.
  - Verified (all three files together): `eslint` clean (0 errors,
    expected `any` warnings only), `yarn typecheck` clean, full Jest
    suite green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors.
- Third slice, a batch of four more satellites:
  - `Exchange/ExchangeInput.jsx` (31 lines) — a numeric-only text input
    used across the Exchange order forms and a couple of other modals.
    Extended `DecimalChecker.jsx`, a shared base class still extended by
    four other, not-yet-ported components — left untouched, and this port
    instead inlines the two methods `ExchangeInput` actually used
    (`onPaste`/`onKeyPress`), reading `allowNaN`/the caller's own
    `onKeyPress` from props directly.
  - `Exchange/MarketPickerHelpers.js` (132 lines) — pure helper functions
    for the market picker's asset search/sort, used by `MarketPicker.jsx`
    (not yet ported) and reused unchanged by `CreatePoolModal.jsx`/
    `QuickTrade/QuickTrade.jsx`. Mechanical `.js`→`.ts`, no JSX involved.
    (Noted in passing: the plan's `QuickTrade.jsx` actually lives at
    `app/components/QuickTrade/QuickTrade.jsx`, not under `Exchange/` —
    confirms the earlier note that this phase's file-list references are
    stale and being re-derived from the actual tree as slices proceed.)
  - `Exchange/MarketRow.jsx` (362 lines) — one row of the markets list
    (`MyMarkets.jsx`, not yet ported, its only caller). Structural change:
    `AssetWrapper(MarketRow, {propNames: ["quote", "base"], withDynamic:
    true, defaultProps: {tempComponent: "tr"}})` replaced with the
    established Container split; the `tempComponent: "tr"` customization
    is preserved (the loading-gate placeholder is `<tr />`, not this
    migration's usual `<span />`, since this component always renders as
    a table row). `withRouter` replaced with `useHistory()`/
    `useLocation()` — the caller (`MyMarkets.jsx`) also passes explicit
    `location`/`history` props, but those were always shadowed by
    `withRouter`'s own injected values in react-router v5, so they were
    already inert. `shouldComponentUpdate`'s shallow-prop-equality check
    is, by construction, the same comparison `React.memo`'s *default* (no
    custom comparator) behavior performs — preserved via a plain
    `React.memo(MarketRow)`, a real optimization for a component rendered
    in a list inside the highest-update-frequency part of the app, not
    dropped like this migration's previously-confirmed no-op SCU gates.
  - `Exchange/PriceAlert.jsx` (353 lines) — the "set a price alert" modal;
    purely local form-state (an array of alert rules) plus `onSave`/
    `hideModal` callbacks out, no transaction submission. Structural
    change: `AssetWrapper(PriceAlert, {propNames: ["quoteAsset",
    "baseAsset"]})` replaced with the established Container split.
    `componentDidUpdate`'s "did `visible` just transition from false to
    true" check became a `[visible]`-keyed effect, guarded to skip its
    first (mount) run.
  - Verified (all four files together): `eslint` clean (0 errors,
    expected `any` warnings only), `yarn typecheck` clean, full Jest
    suite green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors.
- Fourth slice, a batch of five more satellites:
  - `Exchange/MarketPicker.jsx` (337 lines) — the "pick a market to
    trade" modal (three components in one file: `MarketListItem`,
    `MarketPickerWrapper`, `MarketPicker`). Confirmed dead, dropped:
    `MarketPicker`'s local `open`/`smallScreen` state (neither ever read
    anywhere, letting `UNSAFE_componentWillMount` and the constructor's
    state go too), `MarketPicker.show()` (never called), the
    `assetsLoading` prop the original `connect(..., {getProps...})`
    injected (never read anywhere), and a dynamic-string
    `ref={this.props.modalId}` on the modal (never read). `alt-react`'s
    `connect` replaced with `useAltStore(AssetStore)`.
    `MarketPickerWrapper`'s `UNSAFE_componentWillReceiveProps` re-runs
    `assetFilter` using `this.props.searchAssets`/etc. (the values from
    *before* the update that triggered it), not `nextProps` — preserved
    exactly via a ref tracking the previous render's props, not "fixed"
    to read the fresh values. Its `shouldComponentUpdate` is the second
    confirmed-real (non-no-op) SCU gate found in this phase — narrower
    than all props, since it receives a wide spread from `Exchange.jsx`
    — preserved via a `React.memo` comparator; the state-change half of
    the original check needs no replication, since a functional
    component's own `useState` updates always trigger its re-render
    regardless of `React.memo`.
  - `Exchange/MarketHistory.jsx` (265 lines) + `Exchange/View/MarketHistoryView.jsx`
    (173 lines) — the trade-history panel. `rowCount` was state but never
    once updated via `setState` anywhere — kept as a plain constant.
    `componentDidUpdate(prevState) {...if (prevState.showAll != showAll)}`
    has a genuine pre-existing bug, preserved exactly: React always
    passes `(prevProps, prevState, snapshot)`, so the single parameter
    here is actually `prevProps`, mislabeled — since nothing passes a
    `showAll` *prop*, this comparison is `undefined != <boolean>`, always
    `true`, so the branch fires unconditionally on every update, not
    conditionally as it appears to. Replicated with a no-dependency-array
    effect that always runs it. The third confirmed-real SCU gate this
    phase has found (checking `history`/`baseSymbol`/`quoteSymbol`/
    `className`/`activeTab`/`currentAccount`/`isPanelActive`/
    `hideScrollbars`, but *not* `myHistory`/`base`/`quote`/`isNullAccount`/
    several style-ish props render also reads) is preserved the same way.
    `MarketHistoryView`'s two internal refs (`refs.history`/
    `refs.historyTransition`, reached by the parent via
    `this.refs.view.refs...`) become plain ref props, since both files
    were ported together in this same slice and the double-indirection a
    class needed is unnecessary for a functional child.
  - `Exchange/OpenSettleOrders.jsx` (197 lines) — confirmed dead, dropped:
    the whole `TableHeader` class (defined, never exported, never
    rendered anywhere in the file) and `quoteSymbol`/`baseSymbol` props
    (declared, even required via `propTypes`, but never read in
    `render()` — presumably meant for the dead `TableHeader`). Its SCU
    (checking only `currentAccount`/`orders`, not `base`/`quote`) is the
    fourth confirmed-real gate this phase has found, preserved the same
    way.
  - `Exchange/View/MarketOrdersView.jsx` (211 lines) — unlike
    `MarketHistoryView.tsx`, this file's caller, `MyOpenOrders.jsx` (541
    lines), is *not* part of this slice and stays legacy for now, still
    reaching into `MarketsOrderView` via `this.refs.view.refs.container`.
    Since a plain function component can't be given a ref at all,
    `MarketsOrderView` is wrapped in `React.forwardRef` with
    `useImperativeHandle` exposing an object shaped exactly like the old
    class instance's `.refs` (`{refs: {container: <getter>}}`), so
    `MyOpenOrders.jsx`'s existing access keeps resolving correctly,
    completely unmodified, until it too gets ported (at which point this
    can be simplified to a direct ref/prop, same as `MarketHistoryView`).
  - Verified (all five files together): `eslint` clean (0 errors,
    expected `any` warnings only), `yarn typecheck` clean, full Jest
    suite green (50/50), full webpack build shows only the 2 known
    pre-existing `charting_library` errors.
- Fifth slice, and the first file from this phase's larger tier:
  `Exchange/ExchangeHeader.jsx` (486 lines) — the Exchange screen's top
  bar (quote/base symbol pair, market-picker toggles, favorite star, and
  the price-ticker stats strip built from `PriceStatWithLabel.tsx`,
  already ported). Rendered by `Exchange.jsx` (not yet ported, its only
  caller).
  - Confirmed dead, dropped: the local `isModalVisible` state field —
    initialized, never read or set again anywhere.
  - Confirmed accepted-but-unused (kept in the props interface since the
    still-legacy caller supplies them, but never read in `render()`):
    `showVolumeChart`, `lowestAsk`, `highestBid`. `tinyScreen` is the
    inverse case — it *is* read (a font-size ternary), but
    `Exchange.jsx`'s call site never actually supplies it, so that
    ternary always currently resolves to its `false` branch in practice.
    Neither "fixed" here — that belongs to whoever ports `Exchange.jsx`
    itself.
  - `shouldComponentUpdate` is unlike this phase's other confirmed-real
    SCU gates (which compared specific prop subsets): `if
    (!nextProps.marketReady) return false; return true;` is an
    unconditional "block all renders while the market isn't ready,
    otherwise never block" gate, not a shallow comparison. Preserved via
    a `React.memo` comparator that's the direct translation
    (`!nextProps.marketReady`).
  - `UNSAFE_componentWillReceiveProps` unconditionally re-syncs local
    `selectedMarketPickerAsset` state from the incoming prop on every
    update (no condition at all — a prop-seeded, locally-overridable-
    until-the-next-external-update pattern, since a click handler also
    sets this state directly). Replicated with a
    `[selectedMarketPickerAsset (prop)]`-keyed effect, guarded to skip
    its first (mount) run.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Sixth slice: `Exchange/MyOpenOrders.jsx` (541 lines) got the real
  `.jsx`→`.tsx` rewrite — the "my open orders" / "open settlement
  orders" panel, rendered twice by `Exchange.jsx` with different
  `activeTab` values. Exports a named `MarketOrders`, matching the
  file's pre-existing external contract (`import {MarketOrders} from
  "./MyOpenOrders"`) — the filename and the exported name have never
  matched in this codebase, kept as-is. Closes the loop on this phase's
  earlier `MarketOrdersView`/`OpenSettleOrders` slice: this was that
  file's one deferred caller, still legacy at the time.
  - `MarketOrdersRow`'s `shouldComponentUpdate` is another confirmed-real
    SCU gate (checking `order.for_sale`/`order.id`/`quote`/`base`/
    `order.market_base`/`selected`, not `price` or `onCancel`) —
    preserved via `React.memo`. `onCancel` is a confirmed-dead prop
    (passed via a fresh `.bind()` on every render, never read inside
    `MarketOrdersRow`) — kept as accepted-but-unused, not dropped, since
    it's genuinely supplied. `price`, also never read *inside*
    `MarketOrdersRow`, is not dead: the parent's render sorts the
    still-unmounted `<MarketOrdersRow price={price} .../>` React
    elements by reading `.props.price` directly off each element object
    before it's ever rendered — an unusual but legitimate pattern,
    preserved exactly (a function component's elements still carry the
    same externally-readable `.props`).
  - `MarketOrders` closely mirrors `MarketHistory.tsx`'s structure (both
    adapted from a shared original) — same `componentDidUpdate(prevState)`
    mislabeled-parameter bug, replicated the same way (an always-running,
    mount-skipped effect); same SCU-gate treatment via `React.memo`. One
    real difference: `render()` here genuinely reads `state.activeTab`
    (not `props.activeTab` with an override), so unlike
    `MarketHistory.tsx`'s write-only shadow copy, this one is actually
    displayed. Its `UNSAFE_componentWillReceiveProps` activeTab check
    also differs subtly: it compares `nextProps.activeTab` against
    `this.state.activeTab` (not `this.props.activeTab`) — preserved
    exactly, via an effect reading the latest state value when it fires.
  - Confirmed accepted-but-unused: `orders`, `flipMyOrders`,
    `smallScreen`, `hidePanel`, `isPanelActive` — all passed by
    `Exchange.jsx`, none ever read anywhere in this file (`_getOrders()`
    computes orders from `currentAccount` directly, never from
    `props.orders`).
  - Two separate refs feed `updateContainer`: one threaded into the
    already-`forwardRef`-wrapped `MarketsOrderView` (reading
    `.current.refs.container`, matching that component's exposed
    backward-compatible shape from the earlier slice), and one attached
    directly to the `TransitionWrapper` this component renders itself
    (a plain, direct ref — `TransitionWrapper` is still an untouched
    class component).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Seventh slice: `Exchange/DepthHighChart.jsx` (520 lines) got the real
  `.jsx`→`.tsx` rewrite — the order-book depth chart (a Highcharts area
  chart of cumulative bids/asks, plus call/settle overlays), rendered by
  `Exchange.jsx`. `ReactHighchart` (the third-party wrapper) is reused
  completely unchanged.
  - `shouldComponentUpdate` is an unusually elaborate confirmed-real SCU
    gate: compares `orders`/`call_orders` via the imported
    `didOrdersChange` (a real order-list-aware diff, reused unchanged
    from `common/MarketClasses`), plus `feedPrice` *twice* — once via a
    NaN-guarded check, once via a bare `!==` — meaning whenever
    `feedPrice` is consistently `NaN` across renders, `NaN !== NaN`
    being always `true` in JS forces a re-render on every props change
    regardless of anything else. Preserved exactly via a `React.memo`
    comparator, not "fixed" with an `Object.is`-style check. The gate
    checks `height`/`isPanelActive`/`activePanels`/`LCP`/
    `showCallLimit`/`hasPrediction`/`marketReady` but deliberately not
    `base`/`quote`/the `flat_*` series arrays/`theme`/`centerRef`/
    `invertedCalls`/`onClick`, all of which `render()` does read.
  - `UNSAFE_componentWillUpdate`/`componentDidUpdate` together snapshot
    and restore an *external* `centerRef` element's `scrollTop` around
    this component's own re-render, so this component's DOM changes
    don't visibly shift an ancestor/sibling's scroll position. Hooks
    have no direct equivalent to `UNSAFE_componentWillUpdate`'s "runs
    during the render phase, before commit, but not on mount" timing —
    replicated by reading `centerRef.scrollTop` synchronously in the
    function body itself (the same render-phase timing guarantee, just
    also harmlessly exercised on the first render, whose captured value
    is never used since the restore effect is mount-skipped same as the
    original).
  - Confirmed accepted-but-unused: `settles`, `spread` — both supplied
    by `Exchange.jsx`, neither ever read anywhere in this file. Two
    stale, already-commented-out draft plot-line blocks omitted as
    informationally inert, same category as earlier such drops.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Eighth slice: `Exchange/Personalize.jsx` (781 lines) got the real
  `.jsx`→`.tsx` rewrite — the Exchange screen's settings modal (chart
  options, order-book grouping/orientation, panel grouping, general
  display toggles). Purely presentational/local-state; every toggle
  just forwards to a caller-supplied callback prop, no transaction
  logic.
  - Confirmed dead, dropped: the local `open`/`smallScreen` state fields
    — both initialized (the latter via `UNSAFE_componentWillMount`, from
    `window.innerWidth`), neither ever read anywhere (every actual
    screen-size check in `render()` reads the *prop*
    `smallScreen`/`tinyScreen`, not this local state) — dropping both
    made `UNSAFE_componentWillMount` itself removable too. Also dropped
    the dynamic-string `ref={this.props.modalId}` on `<Modal>`, never
    read anywhere — the same pattern as `MarketPicker.jsx`'s equivalent
    earlier in this phase.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Ninth "slice" was a deletion, not a port: `Exchange/ScaledOrder.jsx`
  (844 lines — `ScaledOrderForm`, `ScaledOrderModal`, and the default-
  exported `ScaledOrderModalContainer`, a modal/drawer-based "place a
  scaled order" UI with real fee/total math and order-submission logic).
  A whole-app grep for any importer of this file's default export found
  zero matches. Cross-checked `Exchange.jsx` itself: it has
  `showScaledOrderModal()`/`hideScaledOrderModal()` methods and an
  `isScaledOrderModalVisible` state flag, but that flag is only ever
  *set* (constructor default, and by those two methods) — never *read*
  anywhere in `render()` — so `<ScaledOrderModalContainer>` is never
  actually rendered by anything reachable in the app. Confirmed the
  scaled-order feature is live elsewhere: `Exchange.jsx`'s real
  `_createScaledOrder(orders, feeID)` method (builds `LimitOrderCreate`
  objects, calls `MarketsActions.createLimitOrder2`) is passed as the
  `createScaledOrder` prop to `Exchange/ScaledOrderTab.jsx` (not yet
  ported), the tab-based UI that actually superseded this older modal.
  Deleted outright rather than ported, matching the
  `AccountVotingProxy.jsx`/`PriceStat.jsx` precedent for confirmed-
  orphaned whole files.
  - Verified: `yarn typecheck` clean, full Jest suite green (50/50),
    full webpack build shows only the 2 known pre-existing
    `charting_library` errors (unrelated to this deletion).
- Tenth slice: `Exchange/ScaledOrderTab.jsx` (1058 lines) got the real
  `.jsx`→`.tsx` rewrite — the live "place a scaled order" tab (bid and
  ask), wired to `Exchange.jsx`'s real `_createScaledOrder` handler
  (`MarketsActions.createLimitOrder2`) via the `createScaledOrder` prop.
  Security-sensitive per AGENTS.md: kept as a strictly mechanical
  translation of the fee/total math and order-preparation logic.
  - `ScaledOrderForm` (an antd v3 `Form.create({})`-wrapped component,
    reached by `ScaledOrderTab` via `wrappedComponentRef`) became a
    `React.forwardRef` function component exposing
    `useImperativeHandle(ref, () => ({props: {form}}))` — confirmed
    correct against `rc-form`'s actual `createBaseForm.js` source (`Form.create()`'s
    wrapper does a generic `formProps.ref = wrappedComponentRef` assignment,
    not a class-only one), same technique already used for
    `MarketOrdersView.tsx`'s legacy-caller `wrappedComponentRef`/string-ref
    contract in an earlier slice.
  - Confirmed dead, dropped: the `Col`/`Row` (unused style-guide imports)
    and `TranslateWithLinks` imports (never referenced anywhere);
    `_getPreviewDataSource()` (defined, never called); `ScaledOrderTab`'s
    `handleCancel()`/its `hideModal` prop (bound in the constructor but
    never wired to any control, and neither of `Exchange.jsx`'s two
    `<ScaledOrderTab>` call sites ever passes a `hideModal` prop — calling
    it would have thrown). Also collapsed a no-op `if (expirationType ===
    "SPECIFIC") {...} else {...}` in `prepareOrders` whose two branches
    computed the exact same expression.
  - **Not** dropped despite looking unused: `getFieldDecorator("action",
    {initialValue: ...})(<Radio.Group>...)` is computed every render but
    its result is never placed into the rendered JSX — the Buy/Sell radio
    buttons are never shown. Read `rc-form`'s `createBaseForm.js` to
    confirm this is not simply dead: `getFieldDecorator(name, opt)`
    registers the field's `initialValue` as a synchronous side effect of
    being *called* (inside its own `getFieldProps`), independent of
    whether the decorated element it returns is ever rendered. Since the
    radio group is never mounted, no `onChange` ever fires, so the
    "action" field stays permanently pinned to its `initialValue` — `BUY`
    on the bid tab, `SELL` on the ask tab. Dropping the call would leave
    `values.action` `undefined` and silently break
    `prepareOrders`/`_isMarketFeeVisible`/`_getMarketFeePercentage` (real
    order-submission logic), so it is kept, called purely for its
    registration side effect with the decorated element discarded, exactly
    matching the original's (accidental-looking but load-bearing)
    behavior.
  - `ScaledOrderTab`'s `componentDidUpdate(prevProps)` has two independent
    prop-diff checks (`baseAsset.get("id")` changed → `resetFields()`;
    `lastClickedPrice` changed → `setFieldsValue({priceLower: ...})`).
    Ported via a single no-dependency-array, mount-skipped effect using
    two refs to track each previous prop value directly (rather than a
    dependency-array-keyed effect), to exactly replicate `prevProps`
    comparison semantics — including the original's requirement that
    *both* the previous and current `baseAsset` be present before
    comparing IDs, which a naive dependency-array approach would not
    reproduce identically for an undefined→defined transition.
  - `ScaledOrderForm`'s always-unconditional `componentDidUpdate()` (no
    params — checks whether the form's live `orderCount` value differs
    from a tracked `orderCount` state, and if so, re-runs
    `_checkFeeAssets()`) ported the same way: a no-dependency-array,
    mount-skipped effect (`componentDidMount`'s initial
    `_checkFeeAssets()` call is a separate, mount-only effect).
  - Preserved verbatim (not "fixed"): `_checkFeeAssets`/`checkFeeAssets`
    calls `.then` directly on `_getAccountAssetsFeeStatus()`'s return
    value, which can be the literal `false` (not a `Promise`) when
    `currentAccount`/its balances aren't ready yet — a latent
    pre-existing throw risk in the original, replicated exactly rather
    than defensively guarded.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Eleventh slice: `Exchange/MyMarkets.jsx` (1223 lines) got the real
  `.jsx`→`.tsx` rewrite — the starred/find-markets list panel (used both
  as an Exchange satellite and, via the already-ported
  `MarketsContainer.tsx`, as the Explorer's "Markets" tab), depending on
  the already-ported `MarketRow.tsx`. No transaction logic; only reads
  market/asset data and dispatches view-setting/star toggles.
  - `MarketGroup`'s real `shouldComponentUpdate` (checks `markets`
    shallow-equality plus `starredMarkets`/`marketStats`/`userMarkets`
    reference equality) preserved via `React.memo` with the exact
    logical-inverse comparator; its
    `UNSAFE_componentWillReceiveProps` → a `[findMarketTab]`-keyed,
    mount-skipped effect, with the same narrow, accepted approximation
    gap already documented for `PriceStatWithLabel.tsx` (a memo-skipped
    render also skips the effect that would have re-derived local state)
    — considered low-risk here since `markets` is recomputed fresh
    whenever `findMarketTab` flips at both real call sites.
  - `MyMarkets`'s own `shouldComponentUpdate` both gated renders *and*
    ran a real side effect inline (`this.setState`/`_changeTab` calls
    from inside `shouldComponentUpdate` itself — a pattern with no direct
    hooks equivalent). Traced its two branches separately: the "a local
    state change is already pending" branch turned out to be a harmless,
    always-converging *redundant* re-invocation of whatever call already
    triggered it (confirmed by tracing every `_changeTab` call site), so
    it's dropped, not replicated. The "the `activeTab` *prop* changed and
    the tabHeader UI isn't in use" branch is real and live — confirmed
    `Exchange.jsx` genuinely drives this component's active tab via its
    own `activeTab` prop (`tabVerticalPanel`) — kept as an
    `[activeTab prop]`-keyed, mount-skipped effect. The render-gating
    half of the original SCU (its boolean return) is *not* replicated via
    `React.memo` here, since it's entangled with that setState-in-SCU
    side effect in a way a static comparator can't safely reproduce —
    documented as an accepted change: the component now re-renders
    somewhat more eagerly, bounded as before by the still-applied
    `debounceRender(…, 50, {leading: false})` wrapper (confirmed
    implementation-agnostic to class vs. function components by reading
    `node_modules/react-debounce-render/lib/index.js` directly before
    relying on it).
  - Confirmed dead, dropped: `MarketGroup._onToggle()` (never wired to
    any click handler — the collapsible list can only ever open via its
    initial-state derivation); its already-commented-out
    `_onSelectBase`; the `maxRows`/`allowChange` props passed to
    `MarketGroup` by both of its call sites but never read inside it
    (dropped on both ends, since this slice ports both files together);
    `MyMarkets`'s own `_inverseSort`/`_changeSort` methods and their
    `inverseSort`/`sortBy` state (an unused copy-paste duplicate of
    `MarketGroup`'s own, actually-used version — `MyMarkets` never
    renders its own sortable headers); `_goMarkets()` and `clearInput()`
    (both defined, never called); the `assetNameError` state (read once
    behind a ternary, never `setState`-assigned anywhere, so that branch
    was provably always `null`); `UNSAFE_componentWillMount`'s `if
    (this.props.currrent)` block — a three-r typo meaning this "seed
    activeMarketTab from the current market" block never actually ran
    (confirmed via a whole-app grep: nothing anywhere passes a prop
    literally spelled `currrent`); `UNSAFE_componentWillReceiveProps`'s
    `findSearchInput.focus()` call, gated on a `myMarketTab` *prop* that
    (unlike the same-named locally-derived `const`) is never actually
    passed by either real caller (confirmed via a whole-app grep); the
    `MyMarketsWrapper` passthrough class (added no logic beyond spreading
    props, collapsed away — `connect()`'s replacement now wraps the
    debounced component directly); and a render-time `const translator =
    require("counterpart")` that re-imported the exact same singleton
    already imported at module scope under the name `counterpart` —
    replaced with that existing import.
  - Preserved verbatim (not "fixed"): `MarketGroup`'s real, used
    `_inverseSort()` sends `SettingsActions.changeViewSetting({
    myMarketsInvert: !this.state.myMarketsInvert})` — but the actual
    state field is named `inverseSort`, not `myMarketsInvert` (another
    typo), so this persisted view-setting is always sent as `true`
    regardless of the real toggled direction, even though the local
    `inverseSort` state (set correctly right below it, by the same
    method) does track it correctly.
  - `location`/`history` are no longer threaded through `MarketGroup` to
    `<MarketRow>`: already confirmed dead there during the `MarketRow.tsx`
    slice (shadowed by `withRouter`'s own injected values) and no longer
    even part of that component's props interface.
  - `connect(MyMarketsWrapper, {listenTo, getProps})` (listening to
    `SettingsStore`/`MarketsStore`/`AssetStore`) became three
    `useAltStore` calls, with `getProps()`'s field list read directly off
    each store's state and merged with the JSX-supplied props.
  - `SearchInput.jsx` declares its optional props only via a separate
    `SearchInput.defaultProps` object (not in the destructured function
    signature), which TS's JS inference doesn't treat as making them
    optional — pre-existing, out of scope; imported through a local `any`
    alias rather than widening that shared component's real prop types.
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors.
- Twelfth slice: `Exchange/OrderBook.jsx` (1495 lines) got the real
  `.jsx`→`.tsx` rewrite — the order book panel (vertical `StickyTable`
  layout and horizontal split-table layout), its four row components, and
  `GroupOrderLimitSelector` (also imported by the already-ported
  `Personalize.tsx`). No transaction-submission logic; only reads order
  data via a caller-supplied `onClick` and manages its own scroll/
  animation/grouping UI state.
  - `Exchange.jsx` (not yet ported) still reaches into this component
    from the outside via a legacy string ref (`ref="order_book"` then
    `this.refs.order_book.verticalStickyTable.current.scrollData
    .scrollWidth`, to measure the vertical order book's panel width) —
    kept working via `React.forwardRef` + `useImperativeHandle` exposing
    `{verticalStickyTable: <the same ref object used internally>}` (the
    ref object itself, not a snapshot), matching this migration's
    established deferred-legacy-caller pattern.
  - The four row components' real `shouldComponentUpdate`s preserved via
    `React.memo` with the exact logical-inverse comparator, including the
    two vertical row components' deliberate early `return false` when an
    order's `market_base` differs (a "don't re-render this row instance
    across a market switch" guard, not a bug).
    `OrderBookRowVertical`'s SCU also compares `isPanelActive`, but
    `OrderBook.render()` never actually passes that prop down to it
    (confirmed via a whole-file grep) — kept in the memo comparator
    anyway, at zero cost, since it's always `undefined !== undefined`
    (always `false`) in practice.
  - `OrderBook`'s own `shouldComponentUpdate` always returned `true` (a
    deliberate unconditional re-render, not a real gate), so it needed no
    `React.memo` replication — only its two inline side effects
    (perfect-scrollbar destroy/reinitialize + `TransitionWrapper
    .resetAnimation()`, run when `showAllAsks`/`showAllBids` toggle while
    horizontal+`hideScrollbars`) needed porting, as two
    `useLayoutEffect`s keyed on those state values (mount-skipped, to
    match the original's pre-commit timing as closely as hooks allow).
  - `componentDidUpdate`'s market/direction-change branch ended, for the
    vertical layout only, with a same-value `this.setState({autoScroll:
    this.state.autoScroll})` — meaningless as a value change, but (since
    this class's own SCU always returns `true`) it still forced one
    additional render + `componentDidUpdate` pass, apparently so
    `centerVerticalScrollBar()`'s DOM measurements would re-run once the
    reset scroll positions/animations had settled. A `useState` setter
    would bail out on an unchanged value (unlike a class's `setState`,
    which doesn't), so this is replicated with a small `useReducer`-based
    forced-update counter instead, to reproduce the same "one extra
    render" behavior rather than silently dropping it.
  - Confirmed dead, dropped: `OrderRows`'s own string ref (`ref={isBid ?
    "bidTransition" : "askTransaction"}` — note "askTransaction", a typo
    for "askTransition"), never read anywhere, not even inside
    `OrderRows` itself; `OrderBook`'s `state.flip` (set from
    `props.flipOrderBook` in the constructor, never read anywhere else);
    `componentDidUpdate`'s `if (this.refs.vert_bids) this.refs.vert_bids
    .scrollTop = 0;` (no element anywhere in `render()` is ever given
    `ref="vert_bids"`, so this ref is always `undefined`); the
    `bids`/`asks`/`orders` `propTypes`/`defaultProps` (never read
    anywhere in the file — confirmed `Exchange.jsx` doesn't even pass
    `bids`/`asks`; it does pass `orders`, `calls`, `invertedCalls`, and
    `marketReady`, all four also confirmed unread here, kept
    accepted-but-unused since `Exchange.jsx` stays a legacy caller this
    slice); `shouldComponentUpdate`'s already-commented-out `if
    (!nextProps.marketReady) return false;`; and
    `GroupOrderLimitSelector`'s `getDerivedStateFromProps`, which
    unconditionally overwrote `state.groupLimit` with
    `props.currentGroupOrderLimit` on every render with no condition at
    all — reading the prop directly is a zero-behavioral-difference
    simplification.
  - `queryStickyTable`'s `ReactDOM.findDOMNode(verticalStickyTable
    .current)` call is preserved as-is (with a scoped
    `eslint-disable-next-line react/no-find-dom-node` and a comment): the
    third-party `StickyTable` class component (react-sticky-table,
    untouched/out of scope) exposes no ref-forwarded DOM node of its own,
    so `findDOMNode` remains the only way to reach its rendered DOM, same
    as the original class did.
  - Added `react-debounce-render`/`react-sticky-table` vendor-shims
    entries (the latter also needed here, `react-debounce-render` carried
    over from the previous `MyMarkets.tsx` slice).
  - Verified: `eslint` clean (0 errors, expected `any` warnings only),
    `yarn typecheck` clean, full Jest suite green (50/50), full webpack
    build shows only the 2 known pre-existing `charting_library` errors
    (confirms `Personalize.tsx`'s existing `{GroupOrderLimitSelector}
    from "./OrderBook"` import keeps resolving correctly).

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
