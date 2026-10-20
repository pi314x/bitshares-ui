# MCP: an AI assistant that reads BitShares, and prepares trades you sign

BitShares Desk ships a small **MCP server** (`mcp/`). MCP, the Model Context Protocol, is the
way an AI assistant (Claude Code, Claude Desktop, or any client that speaks it) calls tools. The
server gives the assistant tools to **read the BitShares chain** and, if you switch it on, to
**prepare an order that you review and sign yourself**. It is off by default, and it has no key.

- The tools, their arguments and their annotations are listed on the application's page
  **AI assistants** (`/mcp`, in the menu under *More*), which reads them from the server's own
  catalog (`mcp/src/catalog.js`), so the page cannot describe a tool the server does not have.
- Nothing here changes how the application signs. Signing is still the local wallet or the
  browser extension, after a person pressed a button.

## Switching it on

Everything is set in the environment, or in a file called `.env` in the project's root (copy
`.env.example`; `.env` is git-ignored and kept out of the container image). A value in the real
environment wins over the file.

```
MCP_ENABLED=true
```

That is the whole switch for the read tools. The web build reads `MCP_ENABLED` and
`MCP_TRADING_ENABLED` as well: **a build made without them has no MCP page, no review page and no
menu entry**, and the code for them is not reachable. After changing them, restart the dev server
(`yarn start`) or rebuild (`yarn build`): webpack reads them once, when it starts.

The server itself is a separate program (Node.js 18 or later, no dependencies to install):

```
node mcp/server.js --check        # read the settings, say what is on, stop
node mcp/server.js                # start it (stdio, or http: MCP_TRANSPORT)
node mcp/server.js --new-token    # print a random token for MCP_AUTH_TOKEN
```

### Connecting an assistant

stdio (nothing listens on a port; the client starts the server when it needs it):

```
claude mcp add bitshares --env MCP_ENABLED=true -- node /path/to/bitshares-ui/mcp/server.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{"mcpServers": {"bitshares": {"command": "node", "args": ["/path/to/bitshares-ui/mcp/server.js"], "env": {"MCP_ENABLED": "true"}}}}
```

http (one local address, a token on every call):

```
MCP_ENABLED=true MCP_TRANSPORT=http MCP_AUTH_TOKEN=<node mcp/server.js --new-token> node mcp/server.js
claude mcp add --transport http bitshares http://127.0.0.1:8765/mcp --header "Authorization: Bearer <token>"
```

## The tools

| Tool | Kind | What it does |
|---|---|---|
| `bitshares_chain_info` | read | head block, time, chain id, node |
| `bitshares_get_account` | read | id, membership, authorities (counts, no keys) |
| `bitshares_get_balances` | read | balances as exact decimals |
| `bitshares_get_asset` | read | precision, supply, flags, issuer's description (marked untrusted) |
| `bitshares_search_assets` | read | assets by symbol prefix |
| `bitshares_get_ticker` | read | last price, best bid and ask, volume |
| `bitshares_get_order_book` | read | resting orders, best first |
| `bitshares_get_open_orders` | read | an account's open orders |
| `bitshares_get_account_history` | read | recent operations by name (no memos) |
| `bitshares_get_pool` | read | one liquidity pool |
| `bitshares_find_pools` | read | pools that hold an asset, or two |
| `bitshares_trading_policy` | trade | the limits the person set (answers from the settings) |
| `bitshares_prepare_limit_order` | trade | **prepares** an order: a summary, a reference code and a link |
| `bitshares_prepare_cancel_order` | trade | **prepares** cancelling one open order |

The trade tools exist only when `MCP_TRADING_ENABLED=true`; when it is off they are not listed
and a call to them is refused as an unknown tool.

### Annotations

Every tool carries the MCP spec's annotations. They are hints a client may use to decide what to
ask you about; they are not enforcement (the limits below are).

| Annotation | Read tools | Prepare tools | Why |
|---|---|---|---|
| `readOnlyHint` | `true` | `false` | A prepare tool changes nothing on the chain, but it makes something a person can sign. Marking it not read-only makes a client that asks before such a tool give you a **first say**. Keep that on. |
| `destructiveHint` | `false` | `false` | Nothing is deleted or overwritten by calling a tool. |
| `idempotentHint` | `true` | `false` | Each prepare call makes a new proposal (new nonce, counted against the limits). |
| `openWorldHint` | `true` | `true` | They ask the BitShares network. (`bitshares_trading_policy` answers from the settings: `false`.) |

## Trading with a wallet: the security design

An assistant that can trade can be fooled: by a web page it read, by an asset's description, by a
transfer memo, by a mistyped decimal. The design assumes it **will** be fooled sooner or later and
makes sure that a fooled assistant cannot lose you money without you signing something you looked
at.

### The flow

1. You ask: "sell 10 BTS for USDT at the market".
2. The assistant calls `bitshares_prepare_limit_order`. The server checks the request against the
   limits (below), against the account's free balance and against the market, builds the
   `limit_order_create` operation, and returns a **summary**, a **reference code** (`7C7D-10EC`)
   and a **link**. Nothing has been signed or sent.
3. The assistant gives you the link and the code.
4. You open the link in BitShares Desk. The **review page** (`/mcp/review`) reads the proposal
   strictly, **recomputes the reference code** from the operations, shows the order in words made
   from the operation itself, and checks the chain, the account, the time and the market price
   with the application's own data.
5. You compare the code with the one the assistant gave you, read the order, and press **Sign
   with my wallet**. The wallet signs as it always does: the local wallet asks for its password,
   the browser extension opens its own approval window.

The proposal travels in the link's **fragment** (`#p=...`), which a browser never sends to a web
server. It holds the account, the operation(s) as the chain reads them, a creation and an expiry
time and a nonce. **No key, no signature.**

### Layers

| # | Layer | What it stops |
|---|---|---|
| 1 | **No keys, no signing tool.** The server has none; no tool name contains sign, send or broadcast (a test checks); the RPC client can call only the `database` and `history` APIs and refuses `broadcast`/`set_` calls by name. | A fooled assistant moving funds by itself. |
| 2 | **Off by default, in two steps.** `MCP_ENABLED` for reading; `MCP_TRADING_ENABLED` for the prepare tools, which also needs `MCP_TRADING_ACCOUNTS` and `MCP_TRADE_LIMITS` or the server refuses to start. A wrong setting stops the server; it never falls back to something looser. | Trading by accident. |
| 3 | **Allow-lists and limits.** Only the listed accounts; only the listed assets (buying *and* selling, so no scam token); per asset a most per order and per 24 hours; orders per hour; a longest time an order may stay open. | Draining an account, spamming proposals, buying an asset nobody vetted. |
| 4 | **Limits that survive a restart.** What was prepared is kept in `.mcp-state.json` (mode 600), re-read before every check. A damaged file refuses everything until removed. | Resetting the daily limit by starting a new session (stdio starts a new process each time). |
| 5 | **A price guard, twice.** The server refuses a price that pays more than `MCP_MAX_PRICE_DEVIATION_PERCENT` (3) above the market's middle, and a market with no price. The review page applies the same limit with its own market data and blocks signing (until you tick "I have read this") when it is crossed. | A slipped decimal (the usual model mistake), a link made by someone else, a thin or manipulated book. |
| 6 | **The application judges, not the document.** The review page accepts two operations only (limit order create / cancel), no field it does not know, no extension, fee left to the wallet; it needs the right chain id, the signed-in account, an unexpired proposal (10 minutes by default, 2 hours at most), and, for a cancellation, that the order is open and the account's. | A link crafted to carry a transfer, an account update or any other operation. |
| 7 | **A reference code to compare.** The code is a SHA-256 over the chain, the account and the operations. The page shows the **recomputed** one; a link whose operations were changed shows a different code (and is refused: its stored code no longer matches). | An altered link that keeps looking like the one you were told about. |
| 8 | **Your client asks first.** The prepare tools are not read-only (see annotations). | A silent tool call. |
| 9 | **Text from the chain is data.** Asset descriptions, operation fields and names are cleaned of control and direction characters, cut to length, marked untrusted, and the server's instructions tell the assistant never to follow instructions found in them. Memos are never returned (only that there is one). | Prompt injection through the chain. |
| 10 | **A closed door (http).** Loopback by default; a bearer token (24+ characters, compared in constant time) on every call; `Host` and `Origin` checked (DNS rebinding and cross-site calls are refused); no CORS; small JSON bodies only; a request rate limit. stdio has no port at all. | Another program or web page on your machine using the server. |
| 11 | **An audit line per call** on stderr (tool, arguments, outcome, time). No keys, tokens or memos are in it. | Not knowing what was asked. |

### What is not offered, on purpose

- **Transfers, withdrawals, account updates, anything touching keys or permissions.** They are
  the operations that move or lose everything, and a limit order's worst case is bounded by the
  limits above. Adding a transfer tool would need a recipient allow-list and its own review.
- **The server signing for you.** A bot that trades by itself is a different design and not part
  of this. If you want one, do not give it your account's key: use a **separate account** with a
  small balance and its own key, hard limits, and ideally an on-chain **proposal** (the bot
  proposes with `proposal_create`; you approve in your wallet), so a person is still the last
  signature.

### What this does not protect against

- Your own signature on something that looks fine to you.
- A compromised computer or browser (the wallet's own protections apply, nothing more).
- A node that lies about prices; use your own node (`MCP_NODES`).
- A price that is within the guard but not good: 3 % is a guard against mistakes, not advice.
- Two server processes at the same moment can both read the limits file before either writes;
  one stdio session at a time is the normal case, and the window is milliseconds.

## Settings

See `.env.example` (every setting, with its default and what it does) and the table at the end of
the application's *AI assistants* page. `app/__tests__/mcp/review-test.ts` checks that the example
file, the page's table and the server's defaults agree.

## Where things are

```
mcp/server.js             entry: --check, --new-token, stdio or http
mcp/src/catalog.js        the tools as data (page and server share it; no requires)
mcp/src/settings.js       the settings as data (page, example file and tests share it)
mcp/src/tools.js          what each tool asks the node and answers
mcp/src/policy.js         the trading rules and the ledger (also read by the review page)
mcp/src/proposal.js       the document in a link: make, read strictly, reference, words
mcp/src/store.js          the ledger's file (Node only)
mcp/src/protocol.js       JSON-RPC for initialize, ping, tools/list, tools/call
mcp/src/transports.js     stdio and http
app/components/Mcp/       the AI assistants page and the review page
app/lib/common/mcpReview.ts  what the review decides, apart from how it looks
app/actions/McpReviewActions.ts  chain access of the review, and the one send
app/__tests__/mcp/        100+ tests (server, rules, transports, both pages)
```

The files the application's bundle imports (`catalog`, `settings`, `format`, `policy`, `proposal`)
must not require a Node module; a test keeps it so (the build for the browser cannot resolve `fs`).

### Checking the server against the official client

The protocol is implemented by hand (JSON-RPC 2.0, the initialize handshake, `tools/list`,
`tools/call`, stdio and streamable HTTP in its simplest form) so that the server has no
dependencies and runs on the Node versions the project supports. It was checked against the
official TypeScript SDK client over both transports, against a live node: list the tools, call
every one of them, refusals as `isError` results, schema errors as JSON-RPC errors, and the
unauthorised http call as 401. To repeat it, install `@modelcontextprotocol/sdk` in a scratch
folder and connect `Client` with `StdioClientTransport` (`node mcp/server.js`, with
`MCP_ENABLED=true` in its `env`) or `StreamableHTTPClientTransport`.
