BitShares-UI
============
[中文版](README_zh.md) (the original text, not yet updated for this branch)

This is the reference wallet of the BitShares blockchain. It is a browser wallet that connects to BitShares nodes (*bitshares-core*), and this branch is **the migration of its interface**: a new application shell and design system, a dashboard, and a modern stack under it (React 18, TypeScript, Redux Toolkit, CSS Modules), done screen by screen next to the code that was already there.

*Your keys are stored locally in your browser and never leave it.* Transactions are signed in the browser before they are sent to a node. Never expose your keys to anyone.

<p align="center">
  <img src="docs/screenshots/readme-dashboard-dark.png" width="900" alt="The dashboard: total value, balance over time, holdings and allocation">
</p>

> All screenshots on this page are of the public `committee-account`, read from the live chain. Nothing was signed.

## What is in it

- **Dashboard**: what the account is worth in a unit of your choice (wallet, pools, open orders, settlements, collateral, debt), what needs attention (a margin position near a call, orders about to expire, a stale node), holdings, positions, allocation and recent activity.
- **Account**: portfolio, assets, vesting, permissions, voting, signed messages.
- **Payments**: send, deposit, withdraw, timed transfer.
- **Markets**: the order-book trade page with a chart, **liquidity pools**, instant trade (sell now at what the book already offers), prediction markets.
- **Lending**: credit offers and **SameT funds** (flash loans: borrowed and repaid inside one transaction).
- **Network**: an explorer for blocks, assets, accounts, witnesses, committee and fees.
- **More**: the Spotlight hub (barter, HTLC, direct debit, paper wallet, borrowing), **Advanced operations** (the chain's operations that have no screen of their own), **Lifetime membership** (what a membership costs, after how many trades it pays for itself, and what your own account has paid in fees), settings and help.
- **Signing** with the local wallet, or with the [BitShares wallet browser extension](https://github.com/pi314x/bitshares-wallet-browser-extension) (opt-in, Settings → Signing).
- **Ten languages** (English, German, French, Spanish, Italian, Russian, Japanese, Korean, Turkish, Chinese), a light and a dark theme.
- **AI assistants** can read the chain through an optional MCP server, and, if you switch it on, *prepare* an order that you review and sign yourself (off by default, see [docs/MCP.md](docs/MCP.md)).

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/readme-portfolio.png" alt="Portfolio"><br><sub><b>Portfolio</b>: balances, orders and positions of an account</sub></td>
    <td width="50%"><img src="docs/screenshots/readme-trade.png" alt="Trade page with the chart"><br><sub><b>Trade</b>: chart, order book, and a hint when a liquidity pool is cheaper</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/readme-pools.png" alt="Liquidity pools"><br><sub><b>Liquidity pools</b>: your share, reserves, fees</sub></td>
    <td><img src="docs/screenshots/readme-instant-trade.png" alt="Instant trade"><br><sub><b>Instant trade</b>: see what you get before you confirm</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/readme-credit-offers.png" alt="Credit offers"><br><sub><b>Credit offers</b>: the money on offer, rates, accepted collateral</sub></td>
    <td><img src="docs/screenshots/readme-samet-funds.png" alt="SameT funds"><br><sub><b>SameT funds</b>: flash loans by fee</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/readme-explorer.png" alt="Explorer"><br><sub><b>Explorer</b>: the chain, block by block</sub></td>
    <td><img src="docs/screenshots/readme-lifetime-membership.png" alt="Lifetime membership"><br><sub><b>Lifetime membership</b>: break-even, and what an account has paid</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/readme-spotlight.png" alt="Spotlight"><br><sub><b>Spotlight</b>: the rarer features in one place</sub></td>
    <td><img src="docs/screenshots/readme-advanced.png" alt="Advanced operations"><br><sub><b>Advanced operations</b>: every operation of the chain, checked against its rules before your wallet is asked</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/readme-dashboard-light.png" width="700" alt="The dashboard in the light theme">
  <br><sub>The light theme</sub>
</p>

## Works on iOS and Android

The pages have a phone layout under 860 px: the menu becomes a drawer, tables and cards fit the width, and the page does not scroll sideways. It is used on an iPhone (Safari, iOS 18). Every route is also checked against the live chain at three phone sizes, 360×800, 390×844 and 412×915, with `scripts/smoke-boot.py --viewport … --layout`, which fails on sideways overflow or a menu left open. The Android sizes are checked in Chrome's mobile emulation, not yet on a physical Android phone.

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/screenshots/readme-iphone-dashboard.png" alt="iPhone: dashboard"><br><sub>iPhone, 390×844</sub></td>
    <td align="center" width="25%"><img src="docs/screenshots/readme-iphone-menu.png" alt="iPhone: menu"><br><sub>the menu drawer</sub></td>
    <td align="center" width="25%"><img src="docs/screenshots/readme-iphone-trade.png" alt="iPhone: trade page"><br><sub>trade with its chart</sub></td>
    <td align="center" width="25%"><img src="docs/screenshots/readme-iphone-membership.png" alt="iPhone: lifetime membership"><br><sub>lifetime membership</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/readme-android-dashboard.png" alt="Android: dashboard"><br><sub>Android, 412×915</sub></td>
    <td align="center"><img src="docs/screenshots/readme-android-pools.png" alt="Android: liquidity pools"><br><sub>liquidity pools</sub></td>
    <td align="center"><img src="docs/screenshots/readme-android-menu.png" alt="Android: menu, light theme"><br><sub>the light theme</sub></td>
    <td align="center"><img src="docs/screenshots/readme-android-portfolio.png" alt="Android: portfolio, light theme"><br><sub>portfolio</sub></td>
  </tr>
</table>

Over plain `http` (a development server on your network) the browser withholds some features that need a secure page, such as the clipboard and biometric unlock. For real use serve it over HTTPS ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Run it

You need **Node.js 20** (the container image builds with it; `package.json` allows 16 or later, which is what CI runs on), **yarn 1** (`corepack enable`, or `npm install -g yarn`), and **git**, **python3**, **make** and **g++** for the install. The install downloads the TradingView charting library (about 6 MB, from `blocksights.info`, checked against the md5 in `charting_library/`) and three packages from GitHub, so it needs network access. Use a non-root user.

```
nvm install 20 && nvm use 20            # or any Node 20 you have

git clone --branch claude/bitshares-ui-migration-pu5y14 https://github.com/pi314x/bitshares-ui.git
cd bitshares-ui

yarn install                            # a few minutes
yarn start                              # http://localhost:8080
```

The first start compiles for a few minutes; after that the page reloads as you edit. `yarn start --host 0.0.0.0` makes it reachable from a phone on the same network. It connects to the BitShares mainnet by default (Settings → Nodes switches to the testnet).

### With Docker

```
docker compose up --build               # http://localhost:8080
```

The image is built from this source (Node, `yarn build`) and served by nginx as an unprivileged user, with the security headers of [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). It speaks plain HTTP: for a wallet put it behind HTTPS, with a reverse proxy in front or with `docker compose -f docker-compose.yml -f docker-compose.tls.yml up --build` and a certificate in `./certs`.

### A production build

```
yarn build                              # ./build/dist, to host with nginx or Apache
```

### Installable (Electron)

Installable wallets for Windows, macOS and Linux are built with Electron; the [GitHub Action](.github/workflows/build-release-binaries.yml) lists every step.

## Developing

```
yarn test              # Jest unit tests
yarn typecheck         # TypeScript
yarn lint              # ESLint over app/ (0 errors is what CI gates on)
yarn lint:changed      # ESLint on the files committed on your branch
yarn build-preview     # one new screen on its own, without a live node
yarn test:market:ci    # Mocha market tests (5 known failures in CallOrder math)
```

`.github/workflows/ci.yml` runs lint, typecheck and the tests on every pull request.

A build can be booted in a real browser against a live node, which finds what the unit tests cannot (first-render errors, CSS clashes, sideways overflow on a phone):

```
npx webpack --env prod --optimization-emit-on-errors --output-path build/dist_smoke
python3 scripts/smoke-boot.py build/dist_smoke --live-node https://node.xbts.io/ws \
    --viewport 390x844 --layout --routes /,/pools,/samet-funds
```

(needs the `playwright` Python package and Chromium; see [AGENTS.md](AGENTS.md) for every option).

Where to read next:

- [docs/UI_MIGRATION_PLAN.md](docs/UI_MIGRATION_PLAN.md): the phased plan, what is done, what is not, and why.
- [AGENTS.md](AGENTS.md): how the code is laid out and the rules for contributors, human or AI.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): serving it over HTTPS, and the security headers.
- [docs/MCP.md](docs/MCP.md): the AI assistant server. Off unless `MCP_ENABLED` is set (copy `.env.example` to `.env`); `node mcp/server.js --check` says what is on.

## Credits

This migration stands on the **BitShares UI**, the wallet that the BitShares community has built and kept running since 8 June 2015: more than 10,000 commits from almost 200 contributors, all still in this repository's history. Props to everyone who built it.

**Sigve Kvalsvik** ([@svk31](https://github.com/svk31)) most of all: about 3,000 commits between June 2015 and 2018, by far the largest share of this wallet, and the author of its very first commits (together with valzav, on 8 June 2015).

With thanks to the others who built the previous UI, in the order of their commits: **Stefan Schiessl**, **James Calfee**, **valzav**, **Startail**, **TestZ**, **Leroy Jethro Gibbs**, **Abit** ([@abitmore](https://github.com/abitmore)), **rnglab**, **Daniel Larimer** and **Alex Chien**, and everyone who translated, tested, reported a bug or sent a pull request.

The interface is set in [IBM Plex](https://github.com/IBM/plex), and the trade page uses the [TradingView Charting Library](https://www.tradingview.com/) under its own license.

## Contributing & Coding style guideline

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

This repository has a Code of Conduct that should be followed by everyone. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

**Please keep comments constructive and clean**

## License

[MIT](LICENSE.md). Copyright (c) 2019 The BitShares UI worker and contributors.

## The upstream project

The BitShares UI itself is developed at [bitshares/bitshares-ui](https://github.com/bitshares/bitshares-ui). What follows is how that project releases; this branch does not deploy to those sites.

<details>
<summary>Upstream release branches and BrowserStack</summary>

**Develop**: all upstream PRs go to `develop`; new commits are deployed to https://develop.bitshares.org.

**Staging** (the current release candidate): at the end of each milestone `develop` is pushed to staging and forms the release candidate, named by its date, i.e. `5.0.220214-rc1`. Application breaking issues are reported in the issue tracker and PRs go to `staging`. https://staging.bitshares.org

**Master** (stable): when all major issues of the release candidate are fixed, `staging` is released to `master`. https://wallet.bitshares.org is the official reference wallet of BitShares.

The BitShares UI is integrated with [BrowserStack](https://www.browserstack.com) for manual compatibility testing across devices and browser versions.

</details>
