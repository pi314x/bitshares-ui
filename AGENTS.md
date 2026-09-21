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

## Commands

- Install: `yarn install`
- Dev server: `yarn start`
- Production build: `yarn build`
- Electron dev: `yarn start-electron` (after `yarn prestart-electron`)
- Market/wallet-action tests (Mocha): `yarn test:market`
- Unit tests (Jest): `npx jest` — coverage is currently minimal; add tests
  for anything you touch rather than relying on existing coverage.
- Format check (pre-commit hook): `pretty-quick --staged` (via husky)

There is currently no lint/test CI gate (see `.github/workflows/`) — run
`npx jest`, `yarn test:market`, and a production build locally before
proposing changes, since CI will not catch regressions for you yet.

## Conventions

- Commit messages and all documentation/comments: English only, even for
  agent-generated commits.
- Prefer editing existing components/stores over introducing a second,
  parallel implementation unless working from `docs/UI_MIGRATION_PLAN.md`'s
  explicit strangler-fig pattern.
- Locale files live in `app/assets/locales/*.json`; keep keys in sync
  across locales when adding user-facing strings (English is the source of
  truth).
