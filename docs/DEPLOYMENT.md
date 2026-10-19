# Serving BitShares Desk over HTTPS

The app is static files: a page, its scripts and styles. Your keys never reach the server
(the local wallet is encrypted in the browser, a password login derives its keys in the
browser, transactions are signed there and only the signed transaction goes to a node). What
the server does decide is **which code** the browser runs, and that code is what handles the
keys. So the server and the way it serves matter.

## What HTTPS gives, and what it does not

- Gives: nobody on the network can read or change the files on their way. Over plain `http` a
  change of the script is enough to steal a key when the wallet is unlocked. Some browser
  features only exist on HTTPS ("secure contexts"): the clipboard API, biometric unlock
  (WebAuthn), service workers.
- Does not give: trust in the server. A server or a build that is changed serves changed code.
  Keep the server patched, serve from a build you made, and check what is served.

## Set-up

1. A domain of its own for the app (or a subdomain). The wallet's stored data is per origin:
   another page on the same origin could read it.
2. A certificate (Let's Encrypt is fine) and TLS 1.2 or 1.3.
3. `yarn build`, put the `build/dist` folder on the server, start from
   `conf/nginx.https.conf.example`. It sends the headers below and redirects `http` to `https`.
4. Check the result in the browser's developer tools (Network, the page's response headers, and
   the Console for "Refused to ..." lines) and with an online header checker.

`conf/nginx.conf` (the Docker image's) stays plain HTTP, with the headers that do not need
HTTPS; put it behind a TLS terminator, or use the example.

## The headers

| Header | Why |
|---|---|
| `Strict-Transport-Security` | the browser uses HTTPS for the domain for a year, even when asked for `http` |
| `Content-Security-Policy` | see below; sent on the page, and the same policy is in the page's `<meta>` tag |
| `X-Content-Type-Options: nosniff` | a file is what its type says |
| `Referrer-Policy: no-referrer` | the page address holds account names; it is not sent to other sites |
| `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` | no other site frames the wallet (clickjacking) |
| `Permissions-Policy` | only the camera (for the QR scanner), nothing else of the device |
| `Cross-Origin-Opener-Policy` | the page does not share a window group with sites it opens |
| `Cache-Control` | the page is never cached; files with a hash in their name for a year |

## The content security policy

```
default-src 'self' blob:; worker-src 'self' blob:;
script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
connect-src 'self' wss: https: ws://127.0.0.1:* ws://localhost:*;
font-src 'self' data:; img-src 'self' data:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

- Scripts come from the app's own origin only. There is no third-party script: the password
  strength library (`zxcvbn`) is part of the app and loaded from it; it used to come from a CDN.
  `'unsafe-eval'` is not allowed (the app does not need it; checked on the main screens, the
  trade page's chart included).
- `'unsafe-inline'` for scripts remains: the page has three small inline scripts (the saved
  theme before first paint, the browser check, the splash). Moving them out would let it go.
- `connect-src` allows `wss:` and `https:` (a node can be any secure host: the node list, nodes
  a user adds, gateways, faucets, price services), the local node on `127.0.0.1`/`localhost`,
  and nothing in clear text. To pin it to hosts you trust, list them instead of `wss:`/`https:`
  in both the `<meta>` tag (`app/assets/index.hbs`) and the header; users then cannot add other
  nodes.

## Nodes

An HTTPS page can only reach `wss://` nodes (the browser blocks `ws://`). The built-in list
is `wss://`, except `ws://127.0.0.1:8090` (a node on the same machine). A node cannot take
your keys; it can show wrong data, and it sees your address. Compare what you sign with
another node, or run your own.

## Not covered here

A browser extension or other software on the device that reads the page. A page that is
served by someone else. The weakness of a short wallet password (the wallet's lock is only as
strong as it). Use the wallet's auto-lock, and a backup kept apart.
