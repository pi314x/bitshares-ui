# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`bitshares-ui` is the reference web/Electron wallet for the BitShares
blockchain. Keys are handled client-side (`app/stores/WalletDb.js`); treat
any change touching wallet unlock, key import/export, backup, or
transaction signing/serialization as security-sensitive: prefer minimal,
well-tested diffs over refactors, and never log or persist private keys,
passwords, or brainkeys.

## Current stack

- React 18 (`createRoot` in `app/index.js`), TypeScript for new and migrated
  code (about 470 `.ts`/`.tsx` files vs. about 76 remaining `.js`/`.jsx`,
  mostly `app/lib` services and a few legacy entry points; 14 files still
  contain class components - kept on purpose, see
  `docs/UI_MIGRATION_PLAN.md` §7.9), react-router-dom v6, SCSS.
- State: the Alt.js store/action API (`app/stores`, `app/actions`) is kept
  as a facade over Redux Toolkit slices (`app/store`); components read a
  slice with `useReduxState(selectX)` (`app/next/hooks/useReduxState.ts`, no
  `<Provider>` needed), while class components and the action files still use
  the facades, so legacy and migrated call sites coexist. `useAltStore` is
  left only for `WalletDb` and `BrainkeyStore`. Don't add new Alt.js stores -
  add a slice.
- Chain logic (tx building, serialization, keys) lives in the `bitsharesjs`
  npm package; UI-side wallet state and the Xbtsx/Piratecash gateway
  bridges live under `app/stores` and `app/lib`.
- Ships as both a static web build and an Electron desktop app
  (`resources/`, `electron-builder`).

The migration to a modern stack (React 18+, TypeScript, Redux Toolkit, CSS
Modules) is nearly complete — see `docs/UI_MIGRATION_PLAN.md` before
starting any large refactor or new-screen work, and follow its
screen-by-screen strangler-fig approach rather than large rewrites in a
single PR.

**The app shell/chrome (nav rail, topbar, account switcher, node picker,
theme, wallet lock) is already migrated** — `app/next/NextShellContainer`
+ `app/design-system` now wrap every route in `App.jsx`; the old
`Layout/Header.jsx`/`Layout/Footer.jsx` are deleted. Individual screens
(Dashboard, Exchange, Account, Settings, etc.) still render their original
class-component/Alt.js internals inside that new shell — that's Phases 2+.

The left rail's entries live in `app/next/navigation.ts` (a test checks every
entry points at a route registered in `App.jsx`); add a screen to the menu
there. The **Lending** group holds Credit offers and the SameT funds page
(`app/components/Account/SametFund/`, pure money/operation logic in
`app/lib/common/sametFunds.ts`); see `docs/UI_MIGRATION_PLAN.md` §7.8.

The `bitshares-ui-style-guide` npm package (an antd v3 wrapper) and `antd`
itself have both been **removed** - nothing under `app/` imports either;
use `app/design-system/*` (Button, Modal, Form, Input, Select, Table,
Tabs, DatePicker, Collapse, List, Carousel, TreeSelect, ...). Don't
reintroduce either package. The global look of the legacy screens still
depends on one trimmed stylesheet, `app/assets/stylesheets/vendors/
legacy-base.css` (the former 1.6 MB antd/BitShares theme with every rule
that requires an unused `ant-*` class pruned, proven computed-style
identical; committed with `git add -f` because of the broad `assets` rule
in `.gitignore`). A few legacy markup spots still carry `ant-*` class
names (`ant-form-item-label`, `ant-input`) because that stylesheet and the
`$ant-fix` SCSS selector suffix key off them - leave those alone until the
SCSS-to-CSS-Modules work reaches them. See `docs/UI_MIGRATION_PLAN.md`
§7.3 for the details and what is left.

## Commands

- Install: `yarn install`
- Dev server: `yarn start`
- Production build: `yarn build`
- Electron dev: `yarn start-electron` (after `yarn prestart-electron`)
- Unit tests (Jest): `yarn test`
- Market/wallet-action tests (Mocha): `yarn test:market` (local, watch mode)
  / `yarn test:market:ci` (one-shot; has 5 known pre-existing failures in
  `CallOrder` math, see the note in `app/test/marketTests.js` — not yet
  wired into CI)
- Typecheck (new TS code): `yarn typecheck`
- Lint changed files (what CI actually gates on): `yarn lint:changed`. Full
  legacy-inclusive lint (`yarn lint`) currently has ~800 pre-existing
  errors and is not a useful signal yet — don't try to fix those as a side
  effect of an unrelated change.
- Standalone preview of an `app/next` screen, without booting the full
  legacy app shell (which blocks on a live blockchain connection): `yarn
  build-preview`, then serve `build/preview/`. Use this to screenshot new
  screens for phase sign-off (see `docs/UI_MIGRATION_PLAN.md` §6.5).
- Boot-test a built bundle (catches what Jest/tsc cannot - frozen-state
  mutations, missing router props, broken assets, CSS specificity clashes):
  `npx webpack --env prod --optimization-emit-on-errors --output-path
  build/dist_smoke`, then `python3 scripts/smoke-boot.py build/dist_smoke
  --routes /,/settings/access --shots build/smoke-shots` (needs the
  `playwright` Python package and Chromium; it stubs the chain connection;
  add `--live-node https://node.xbts.io/ws` to relay to a real node over
  HTTPS for real accounts/markets - this is what finds first-render bugs
  that unit tests with hand-built props cannot).
  Add `--fonts` to also fail on any visible text that is not IBM Plex and
  `--colors` to fail on neutral-gray leftovers (see Conventions). A custom `--output-path` build lacks the CopyPlugin
  files (`dictionary.json`, locale files); the script serves them from the
  sources, so wallet creation works in the harness.
  See `docs/UI_MIGRATION_PLAN.md` §7.4 and §7.6. A `yarn build-preview`
  screenshot does not load the legacy global CSS, so check new screens in the
  real app too.
- Format check (pre-commit hook): `pretty-quick --staged` (via husky)

`.github/workflows/ci.yml` runs lint:changed + typecheck + test on every
PR — this is new as of the Phase 0 migration work; before it, there was no
lint/test CI gate at all.

## Conventions

- Commit messages and all documentation/comments: English only, even for
  agent-generated commits.
- Styles: new component styles go in a `*.module.scss` next to the
  component (CSS Modules + the CSS custom properties from
  `app/design-system/theme.scss`); don't add classes to the global SCSS
  partials. Moving an existing global class into a module is only safe if
  one component uses it and no other stylesheet mentions it
  (`python3 scripts/scss-isolation-inventory.py`); verify with a before/
  after computed-style diff of the affected routes (see plan §7.5).
- Typography: IBM Plex Sans (all text) and IBM Plex Mono (code) are the only
  families, self-hosted via `app/design-system/fonts.ts`. Use the
  `--font-sans`/`--font-mono` tokens (or the `Plex*` SCSS mixins in
  `base/_fonts.scss`); never hardcode another family, not even in an inline
  style. `python3 scripts/smoke-boot.py <dist> --fonts --routes ...` checks it
  against the real bundle.
- Colours: never write a hex value in new code. Raw values live only in
  `app/design-system/_palette.scss` (mirrored in `tokens.ts`, checked by
  `app/__tests__/design-system/palette-test.ts`); components use the CSS custom
  properties (`var(--surface)`, `var(--up)`, `--hover`, `--line`, ...), legacy
  theme sheets use `$palette-*`. Change a colour in the palette and `tokens.ts`
  together. `python3 scripts/smoke-boot.py <dist> --colors --routes ...` fails
  when a screen paints more than 2% of its area in a neutral gray, i.e. a
  hard-coded colour that bypasses the palette (plan §7.7).
- Form controls: use the design-system `Button`/`Input`/`Select`/... Legacy
  `.button` and native `input`/`textarea`/`select` are styled by
  `app/design-system/legacy-controls.scss` from the same `--control-h`,
  `--radius`, `--field-*` tokens (see `docs/UI_MIGRATION_PLAN.md` §7.6). Give
  fields `min-height`, not `height`; an input that must be invisible
  (e.g. an autofill trap) needs inline `minHeight: 0`. Sibling buttons are
  spaced at the call site (16px inline margin is the convention).
- Prefer editing existing components/stores over introducing a second,
  parallel implementation unless working from `docs/UI_MIGRATION_PLAN.md`'s
  explicit strangler-fig pattern.
- Locale files live in `app/assets/locales/*.json`; keep keys in sync
  across locales when adding user-facing strings (English is the source of
  truth).

## i18n (Phase 8)

- The `counterpart` npm package has been replaced by
  `app/lib/i18n/counterpartShim.js`, a local reimplementation of the
  specific subset of counterpart's API this app actually uses (verified
  by grepping every call site), covered by a characterization-test suite
  (`app/__tests__/i18n/counterpartShim-test.js`) comparing its output
  against the real `counterpart` package (kept only as a devDependency,
  for that test) across every key in `locale-en.json`/`locale-de.json`
  plus every real `.localize()` call site's type/format/locale
  combination. A build-time module alias (`webpack.config.js`'s
  `resolve.alias`, and Jest's `moduleNameMapper` in `package.json`)
  transparently redirects every `import ... from "counterpart"` -
  including `react-translate-component`'s own internal one - to this
  shim. **Do not `import` the real `counterpart` package directly**
  (other than in that one characterization test, which intentionally
  bypasses the alias via a relative path) - existing `import counterpart
  from "counterpart"` call sites across the app need no changes at all,
  since the alias handles it. See the shim's file header for the full
  design rationale and what was deliberately not replicated (pluralization,
  `scope` prefixing, fallback-key resolution - all grep-confirmed unused
  anywhere in this codebase).
