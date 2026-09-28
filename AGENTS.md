# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`bitshares-ui` is the reference web/Electron wallet for the BitShares
blockchain. Keys are handled client-side (`app/stores/WalletDb.js`); treat
any change touching wallet unlock, key import/export, backup, or
transaction signing/serialization as security-sensitive: prefer minimal,
well-tested diffs over refactors, and never log or persist private keys,
passwords, or brainkeys.

## Current stack (pre-migration)

- React 16 (class components), Alt.js flux (`app/actions`, `app/stores`),
  react-router-dom v5, SCSS, no TypeScript.
- Chain logic (tx building, serialization, keys) lives in the `bitsharesjs`
  npm package; UI-side wallet state, gateway bridges (BlockTrades, Citadel,
  RuDex, Gdex, Xbtsx, Bitspark, Piratecash) live under `app/stores` and
  `app/lib`.
- Ships as both a static web build and an Electron desktop app
  (`resources/`, `electron-builder`).

A migration to a modern stack (React 18+, TypeScript, Redux Toolkit, CSS
Modules) is planned incrementally — see `docs/UI_MIGRATION_PLAN.md` before
starting any large refactor or new-screen work, and follow its
screen-by-screen strangler-fig approach rather than large rewrites in a
single PR.

**The app shell/chrome (nav rail, topbar, account switcher, node picker,
theme, wallet lock) is already migrated** — `app/next/NextShellContainer`
+ `app/design-system` now wrap every route in `App.jsx`; the old
`Layout/Header.jsx`/`Layout/Footer.jsx` are deleted. Individual screens
(Dashboard, Exchange, Account, Settings, etc.) still render their original
class-component/Alt.js internals inside that new shell — that's Phases 2+.

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
- Format check (pre-commit hook): `pretty-quick --staged` (via husky)

`.github/workflows/ci.yml` runs lint:changed + typecheck + test on every
PR — this is new as of the Phase 0 migration work; before it, there was no
lint/test CI gate at all.

## Conventions

- Commit messages and all documentation/comments: English only, even for
  agent-generated commits.
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
