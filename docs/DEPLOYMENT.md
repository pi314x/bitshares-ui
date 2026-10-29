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

`conf/nginx.conf` stays plain HTTP, with the headers that do not need HTTPS; put it behind a TLS
terminator, or use the example.

## As a container

`Dockerfile` builds the app from the source (Node 20, `yarn install --frozen-lockfile`,
`yarn build`) and serves it with nginx as an unprivileged user, in a second stage that holds
only the built files and the configuration (no Node, no sources).

```
docker compose up --build            # http://localhost:8080
docker compose -f docker-compose.yml -f docker-compose.tls.yml up --build   # https, with ./certs
```

- The image listens on 8080 (and 8443 with TLS), and sends the headers of
  `conf/headers.common.conf` and the policy of `conf/headers.csp.conf` (the same as the example).
- It runs with a read-only file system, no added capabilities and `no-new-privileges` (see
  `docker-compose.yml`); `/healthz` answers for health checks.
- Plain HTTP by default: put a TLS terminator in front, or mount a certificate chain and key in
  `./certs` (`fullchain.pem`, `privkey.pem`) and use the TLS variant. The server runs as user 101,
  so the key file must be readable by it (`chown 101 certs/privkey.pem` and `chmod 600`, or a
  group). Never put the key in an image or in the repository.
- Three packages are fetched from GitHub at build time, each pinned by its commit in `yarn.lock`
  (`bitshares-report`, `jdenticon`, `perfect-scrollbar`), so the build needs `git` (the build stage
  has it) and the network.
- `yarn install` downloads the charting library from the address in
  `charting_library/install-charting-library.cjs` and checks its md5 against
  `charting_library/*.md5`; the build needs the network for that.
- Nothing is pushed anywhere by building it: tag and push the image yourself, and pin the base
  images by digest if you need exact builds.
- `.github/workflows/docker.yml` builds the image on every pull request that touches the app, the
  Dockerfile or `conf/`, and runs `scripts/check-container.sh` against it (the nginx files through
  `nginx -t`, health, the unprivileged user, the headers and policy, caching, no source maps, the
  TLS variant). The same check runs on a machine with Docker:
  `docker build -t bitshares-desk:ci . && scripts/check-container.sh bitshares-desk:ci`.

## Releasing

`scripts/prepare-release.sh` does the work on the machine where the code is, and publishes
nothing (no push, no tag, no registry):

1. it refuses to run with uncommitted changes (the image is built from the commit);
2. types, lint (errors only) and the tests;
3. the image from a clean `git archive` of the commit, tagged `bitshares-desk:<version>-<commit>`
   and `bitshares-desk:latest`, with the branch and the revision in the build;
4. `scripts/check-container.sh` against it (headers, policy, user, read-only file system, caching,
   no source maps, the TLS variant, `nginx -t`);
5. a look into what the image ships: no script source maps, no private key block. The MCP pages
   are compile-time flags (`MCP_ENABLED`, `MCP_TRADING_ENABLED`) that the Dockerfile does not set:
   in the image `/mcp` and `/mcp/review` are a 404 page and the rail has no "AI assistants" entry
   (run against the shipped files). Their code is still in the bundle, as a chunk nothing loads;
   a public site must not set the flags;
6. `build/release/bitshares-desk-<tag>.tar.gz` and its `.sha256`, for the server.

On the server (Docker, the repository's `docker-compose.yml` and, for TLS of its own,
`docker-compose.tls.yml` next to it):

```
sha256sum -c bitshares-desk-<tag>.tar.gz.sha256
gunzip -c bitshares-desk-<tag>.tar.gz | docker load
docker tag bitshares-desk:<tag> bitshares-desk:local
docker compose up -d --no-build
# TLS of its own: certificate chain and key in ./certs (fullchain.pem, privkey.pem; the key readable
# by user 101), then
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --no-build
```

Before it is public:

- A domain of its own, DNS pointing at the server, ports 80 and 443 open, the certificate issued.
  A renewed certificate is read when nginx reloads: `docker compose kill -s HUP desk` in the
  renewal hook.
- Open it on a phone and on a desktop with a test account: login (a `.bin` file and a password),
  a transfer of a small amount, the extension if it is used, the trade page. Then the developer
  tools: the response headers, no "Refused to ..." in the Console.
- `curl -I https://<domain>/` shows the headers of the table below; `/healthz` answers.
- Put the `/healthz` address into whatever watches the server. A static site has no data to back
  up; the thing to keep is the last two image tags.

Known advisories (`yarn audit --groups dependencies`, checked before this release): no critical
one. `handlebars` (a critical one, build time only: it renders `index.hbs` while webpack runs) and
`dompurify` (through `jspdf`, the paper wallet's PDF) were raised to their fixed versions. Eight
high ones remain; `cross-spawn`, `node-fetch` and `ws` are Node-side code that the browser build
does not run (the browser uses the native WebSocket). `highcharts` 6/7 (through `react-highcharts`)
is in the bundle: its advisories need chart options an attacker controls, and the app passes only
market data to it; the policy does not stop that kind of injection (it allows inline script), so
moving to a current Highcharts is the next dependency step. Run the audit again before each release.
The charting library (TradingView) tries to load Google Analytics from inside its own bundle; the
policy blocks the request (a message in the Console on the trade page), so nothing is sent.

Updating and going back:

- A new release is the same steps with a new tag; `docker compose up -d --no-build` replaces the
  container in seconds. To go back, `docker tag bitshares-desk:<old tag> bitshares-desk:local` and
  `docker compose up -d --no-build` again.
- The base image (`nginxinc/nginx-unprivileged:stable-alpine`) carries nginx and OpenSSL: build a new
  release about once a month to pick up their fixes, and when a security advisory names nginx,
  OpenSSL or one of the app's dependencies.
- Do not merge the branch into `develop`, `staging` or `master` of the upstream repository to
  publish this: a push to those branches runs `.github/workflows/npm-build-and-deploy.yml`, which
  publishes to the deployment repository with that repository's secrets. The branch does not have to
  be merged to run it on your own server.

## Post-quantum key exchange (TLS)

What an attacker can do today is record encrypted traffic and decrypt it later, when a quantum
computer exists ("harvest now, decrypt later"). TLS 1.3 with a hybrid key exchange
(`X25519MLKEM768`: X25519 and ML-KEM-768 together) protects against that, and it needs OpenSSL 3.5
or newer (it is in OpenSSL 3.5's default group list, first).

- The container image uses `nginxinc/nginx-unprivileged:stable-alpine`; at the time of writing that
  is nginx 1.30 on Alpine 3.24 with OpenSSL 3.5.9. Checked against it with an OpenSSL 3.5 client:
  a client that offers `X25519MLKEM768` negotiates it, a client that offers only `X25519` gets
  X25519 (TLS 1.3 both ways), and a default client negotiates the hybrid. The configuration does not
  set `ssl_ecdh_curve`, so the library's default is used. A Debian based nginx image (OpenSSL 3.0)
  does not have it: keep the Alpine one, or check `openssl version` in the image you use.
- Browsers that offer it: Chrome and Edge (131 and later), Firefox (132 and later), Safari (26 and
  later); the others fall back to X25519 without an error. A CDN or proxy in front (Cloudflare and
  others) terminates TLS itself: whether the browser's connection is hybrid then depends on it.
- The certificate stays an ordinary one (ECDSA P-256 or RSA, from Let's Encrypt): browsers do not
  accept post-quantum certificates yet, and a signature only has to hold while the connection is
  open (it cannot be broken afterwards), so this is not where the risk is.
- What it does not cover: the app's own cryptography. The wallet's keys and the chain's signatures
  (secp256k1) are a separate question (the chain itself would have to change); TLS only protects
  the files and the connection to a node on their way.
- To pin it (not needed): `ssl_ecdh_curve X25519MLKEM768:X25519:prime256v1;` in the `server` block.
  Check with `openssl s_client -connect host:443 -groups X25519MLKEM768 -brief` (OpenSSL 3.5 client;
  it prints `Negotiated TLS1.3 group: X25519MLKEM768`).

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
