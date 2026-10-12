# Telegram post: BitShares UI refresh

Ready-to-paste material for a manual Telegram post. Nothing here has been
published anywhere. Images are in [`screenshots/`](screenshots/); attach them
as an album in the order below (Telegram allows 10 items per album).

## Post text (long version, about 1,500 characters)

```
🚀 BitShares UI: a fresh look for the wallet

The reference BitShares wallet (web + desktop) is getting a modern front end,
one screen at a time, without touching how keys and transactions are handled.

What's new in this round:

✨ One typeface everywhere: IBM Plex Sans, self-hosted, so the desktop app
doesn't need the network just to draw its own UI. A computed-style check over
9 screens found about 1,350 visible text elements, every one in IBM Plex.

🎛 Modernized buttons and input fields: 38 px controls, rounded corners, soft
translucent fills, a clear focus ring, consistent in dark and light theme and
across old and new screens.

⚙️ Under the hood: React 18, TypeScript for most of the code base, Redux
Toolkit state, and the old antd dependency is gone for good.

🛠 Tested against the real app, not just unit tests: the production build was
driven in a browser against live chain data. That found and fixed two crashes
(opening the unlock dialog, and the dashboard market table) and confirmed the
local wallet lifecycle end to end: create, back up, delete, restore from the
backup file, unlock. A wrong password is rejected, the right one unlocks.

Still in progress: the insides of several legacy screens (Exchange, Account)
are migrated step by step. Work lives on a branch and is not a release yet.

Code: https://github.com/pi314x/bitshares-ui/tree/claude/bitshares-ui-migration-pu5y14

#BitShares #BTS #DEX #OpenSource #Wallet
```

## Short caption (fits Telegram's 1,024-character media caption, about 600)

```
🚀 BitShares UI refresh: IBM Plex everywhere + modernized buttons and inputs

• One typeface (IBM Plex Sans, self-hosted): every visible text element
  (about 1,350) across 9 screens checked is set in IBM Plex
• New buttons and fields: rounded, translucent, clear focus ring, dark + light
• React 18, TypeScript, Redux Toolkit, antd removed
• Verified in the real app with live chain data, including wallet
  create / backup / delete / restore / unlock

Work in progress on a branch, not a release yet.
https://github.com/pi314x/bitshares-ui/tree/claude/bitshares-ui-migration-pu5y14

#BitShares #BTS #DEX
```

## Image order and suggested captions

| # | File | Suggested caption |
|---|------|-------------------|
| 1 | `01-dashboard-dark.png` | Dashboard, dark theme, live market data |
| 2 | `02-dashboard-light.png` | Same screen, light theme |
| 3 | `03-before-after-send-dialog.png` | Send dialog: before / after (fields, selects, buttons) |
| 4 | `04-before-after-settings.png` | Settings: before / after |
| 5 | `05-before-after-wallet-form.png` | Create local wallet: before / after (note the gap between the buttons) |
| 6 | `06-before-after-login-light.png` | Login dialog, light theme: before / after |
| 7 | `07-wallet-delete-and-restore.png` | Delete and restore a local wallet from a backup file |

"Before" is the previous build of this branch (shell already migrated, still
with Roboto and the classic controls). It is not the original upstream release.

## Notes for whoever posts this

- The screenshots come from a production build served locally and connected to
  a public BitShares node (read-only). The account shown (`bitshares-foundation`)
  is a public on-chain account; no private keys, passwords or backup contents
  appear in any image. The wallet screens were produced with a throwaway test
  wallet.
- The Exchange screen is intentionally not included: its price chart is the
  licensed TradingView charting library, which is not part of the repository,
  so a local build shows an empty chart area.
- The numbers in the post are reproducible: the font check is
  `python3 scripts/smoke-boot.py <dist> --fonts --routes ...` (a computed-style
  census over `/`, the market page, settings, wallet creation, account
  creation, permissions, explorer assets and blocks, and node settings; the
  exact element count moves a little with live data); the wallet flow is
  described in `docs/UI_MIGRATION_PLAN.md` section 7.6.
- Do not describe this as a release or a security audit. It is a UI migration
  in progress, and wallet code paths were changed only where a crash required it.
