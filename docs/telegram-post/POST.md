# Telegram post: BitShares UI refresh

Ready-to-paste material for a manual Telegram post. Nothing here has been
published anywhere. Images are in [`screenshots/`](screenshots/); attach them
as one album in the order below (Telegram allows 10 items per album).

## Post text (long version, about 1,900 characters)

```
🚀 BitShares UI: a fresh look for the wallet

The reference BitShares wallet (web + desktop) is getting a modern front end,
one screen at a time, without touching how keys and transactions are handled.

What's new in this round:

🎨 One colour palette. The new shell was navy while the old screens inside it
were neutral gray. Now everything draws from a single palette: cool slate
neutrals stepped by elevation, one cyan accent, an emerald/rose pair for
up/down. Dark, light and midnight all follow it. Before: 48% of the painted
area on the dark screens was plain gray; now it is 0%. The palette's text and
status colours are checked for WCAG contrast in the test suite.

✨ One typeface: IBM Plex Sans, self-hosted, so the desktop app doesn't need
the network just to draw its own UI. A computed-style check over 9 screens
found about 1,350 visible text elements, every one in IBM Plex.

🎛 Modernized buttons and input fields: 38 px controls, rounded corners, soft
translucent fills, a clear focus ring, a nicer switch, consistent shadows.

⚙️ Under the hood: React 18, TypeScript for most of the code base, Redux
Toolkit state, and the old antd dependency is gone for good.

🛠 Tested against the real app, not just unit tests: the production build was
driven in a browser against live chain data. That found and fixed two
crashes (opening the unlock dialog, the dashboard market table) plus a few
layout bugs, and confirmed
the local wallet lifecycle end to end: create, back up, delete, restore from
the backup file, unlock. A wrong password is rejected, the right one unlocks.

Still in progress: the insides of several legacy screens (Exchange, Account)
are migrated step by step. Work lives on a branch and is not a release yet.

Code: https://github.com/pi314x/bitshares-ui/tree/claude/bitshares-ui-migration-pu5y14

#BitShares #BTS #DEX #OpenSource #Wallet
```

## Short caption (fits Telegram's 1,024-character media caption, about 700)

```
🚀 BitShares UI refresh: one palette, one typeface, modern controls

• One colour palette for the shell and the old screens: gray panels 48% ->
  0% of the painted area, dark / light / midnight, palette contrast tested
• IBM Plex Sans (self-hosted): every visible text element (about 1,350)
  across 9 screens checked is set in IBM Plex
• New buttons, fields, switch: rounded, translucent, clear focus ring
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
| 3 | `03-three-themes.png` | Dark, light and midnight share one palette |
| 4 | `04-palette.png` | The palette: one source of truth for every colour |
| 5 | `05-before-after-wallet-form.png` | Create local wallet: before / after (gray panel and flat fields vs. the new surface, bordered fields, spaced buttons) |
| 6 | `06-before-after-permissions.png` | Account permissions: before / after |
| 7 | `07-before-after-settings.png` | Settings: before / after |
| 8 | `08-before-after-send-dialog.png` | Send dialog: before / after (fields, selects, buttons) |
| 9 | `09-before-after-login-light.png` | Login dialog, light theme: before / after |
| 10 | `10-wallet-delete-and-restore.png` | Delete and restore a local wallet from a backup file |

"Before" is the previous build of this branch (shell already migrated, still
with Roboto, neutral-gray legacy panels and the classic controls). It is not
the original upstream release.

## Notes for whoever posts this

- The screenshots come from a production build served locally and connected to
  a public BitShares node (read-only). The account shown (`bitshares-foundation`)
  is a public on-chain account; no private keys, passwords or backup contents
  appear in any image. The wallet screens were produced with a throwaway test
  wallet.
- The Exchange screen is intentionally not included: its price chart is the
  licensed TradingView charting library, which is not part of the repository,
  so a local build shows an empty chart area.
- The numbers in the post are reproducible with
  `python3 scripts/smoke-boot.py <dist> --fonts --colors --routes ...`: it
  walks the visible text elements (fonts) and measures the share of painted
  area that is a pure gray (colours) on `/`, the market page, settings, wallet
  creation, account creation, permissions, explorer assets and blocks, and node
  settings. The exact element count moves a little with live data. "48% -> 0%"
  compares the previous build with the current one on the dark theme; the
  method and the midnight/light figures are in `docs/UI_MIGRATION_PLAN.md`
  sections 7.6 and 7.7.
- Do not describe this as a release or a security audit. It is a UI migration
  in progress, and wallet code paths were changed only where a crash required it.
