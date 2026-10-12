#!/usr/bin/env python3
"""Boot a built bundle in headless Chromium and report runtime errors.

Why this exists (docs/UI_MIGRATION_PLAN.md, section 7.4): the Jest suite and
`tsc` cannot see a class of failures that only show up when the real bundle
runs - frozen-state mutations during connect, route components missing their
router props, broken font/PNG assets, CSS specificity clashes. A boot against
a stub chain found four of those in one session.

    yarn build                       # or: npx webpack --env prod \\
                                     #   --optimization-emit-on-errors \\
                                     #   --output-path build/dist_smoke
    python3 scripts/smoke-boot.py build/dist_smoke \\
        --routes /,/settings/access,/help --shots build/smoke-shots

What it does: serves the dist folder with an SPA fallback, replaces
`window.WebSocket` with a stub that answers the Graphene RPC handshake and a
valid dynamic-global-properties object (so the app gets past "connecting"
and renders the shell), loads the app, optionally client-navigates through
the given routes, and prints console errors / uncaught page errors per
route. Exit status is 1 if any uncaught page error or console error (other
than failed external network requests) was seen.

With `--live-node https://<node>/ws` the stub is replaced by a bridge: the
page's fake WebSocket forwards each call to the local server, which relays
it to that node over HTTPS JSON-RPC (named APIs, so no session is needed)
and returns the real result. This gives real accounts, assets, markets and
blocks - without a working WebSocket route out of a sandbox - at the price of
no live subscriptions (`set_subscribe_callback` is acknowledged but never
pushes), so screens show a snapshot.

Limits of the default stub: it returns `null` for every other object, so screens
that need real accounts, assets or blocks can legitimately throw on `null`
(`/explorer/fees`, `/barter`, `/block/1` do) - read those as "needs a real
chain", not as regressions. A blank tree after a route is reported and the
app is reloaded so later routes still run.

Requires: python3, `pip install playwright`, and a Chromium (the sandbox
image ships one at /opt/pw-browsers/chromium; override with
--chromium-path).
"""
import argparse
import http.server
import json
import os
import socketserver
import ssl
import sys
import threading
import urllib.request

from playwright.sync_api import sync_playwright

STUB_WEBSOCKET = r"""
(() => {
  class StubWS {
    constructor(url) {
      this.url = url; this.readyState = 0;
      setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 10);
    }
    addEventListener(type, fn) { this['on' + type] = fn; }
    removeEventListener() {}
    send(data) {
      let msg; try { msg = JSON.parse(data); } catch (e) { return; }
      const [, method, params] = msg.params || [];
      let result = [];
      if (method === 'login') result = true;
      else if (['database', 'history', 'network_broadcast', 'crypto', 'orders'].includes(method)) result = 1;
      else if (method === 'get_chain_id') result = '4018d7844c78f6a6c41c6a552b898022310fc5dec06da467ee7905a8dad512c8';
      else if (method === 'get_objects') result = ((params && params[0]) || []).map(id => id === '2.1.0' ? {
          id: '2.1.0', time: new Date().toISOString().slice(0, 19), head_block_number: 1,
          head_block_id: '00000001' + '0'.repeat(32), last_irreversible_block_num: 1,
          recently_missed_count: 0, current_aslot: 1, dynamic_flags: 0,
          next_maintenance_time: '2030-01-01T00:00:00'} : null);
      else if (method === 'set_subscribe_callback' || method === 'cancel_all_subscriptions') result = null;
      else if (['get_full_accounts', 'lookup_asset_symbols', 'get_assets'].includes(method)) result = ((params && params[0]) || []).map(() => null);
      setTimeout(() => this.onmessage && this.onmessage({data: JSON.stringify({id: msg.id, jsonrpc: '2.0', result})}), 5);
    }
    close() { this.readyState = 3; this.onclose && this.onclose({}); }
  }
  StubWS.CONNECTING = 0; StubWS.OPEN = 1; StubWS.CLOSING = 2; StubWS.CLOSED = 3;
  window.WebSocket = StubWS;
})();
"""

LIVE_WEBSOCKET = r"""
(() => {
  const API_IDS = {database: 2, history: 3, network_broadcast: 4, crypto: 5, orders: 6};
  const API_NAMES = Object.fromEntries(Object.entries(API_IDS).map(([k, v]) => [v, k]));
  class LiveWS {
    constructor(url) {
      this.url = url; this.readyState = 0;
      setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 10);
    }
    addEventListener(type, fn) { this['on' + type] = fn; }
    removeEventListener() {}
    _reply(id, result, error) {
      const payload = error ? {id, jsonrpc: '2.0', error} : {id, jsonrpc: '2.0', result};
      setTimeout(() => this.onmessage && this.onmessage({data: JSON.stringify(payload)}), 0);
    }
    send(data) {
      let msg; try { msg = JSON.parse(data); } catch (e) { return; }
      const [api, method, params] = msg.params || [];
      if (method === 'login') return this._reply(msg.id, true);
      if (api === 1 && API_IDS[method]) return this._reply(msg.id, API_IDS[method]);
      if (method === 'set_subscribe_callback' || method === 'cancel_all_subscriptions') return this._reply(msg.id, null);
      LiveWS._queue.push(() => fetch('/__rpc', {method: 'POST', body: JSON.stringify({api: API_NAMES[api] || 'database', method, params})})
        .then(r => r.json())
        .then(j => j.error ? this._reply(msg.id, null, j.error) : this._reply(msg.id, j.result))
        .catch(e => this._reply(msg.id, null, {code: -1, message: String(e)})));
      LiveWS._pump();
    }
    static _pump() {
      while (LiveWS._active < 12 && LiveWS._queue.length) {
        LiveWS._active++;
        Promise.resolve(LiveWS._queue.shift()()).finally(() => { LiveWS._active--; LiveWS._pump(); });
      }
    }
    close() { this.readyState = 3; this.onclose && this.onclose({}); }
  }
  LiveWS._queue = []; LiveWS._active = 0;
  LiveWS.CONNECTING = 0; LiveWS.OPEN = 1; LiveWS.CLOSING = 2; LiveWS.CLOSED = 3;
  window.WebSocket = LiveWS;
})();
"""


def serve(dist, live_node=None):
    cache = {}
    ca_file = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
    context = ssl.create_default_context(cafile=ca_file) if os.path.exists(ca_file) else ssl.create_default_context()

    def relay(payload):
        key = json.dumps(payload, sort_keys=True)
        volatile = "2.1.0" in key or payload["method"] == "get_dynamic_global_properties"
        if key in cache and not volatile:
            return cache[key]
        body = json.dumps({"jsonrpc": "2.0", "method": "call", "params": [payload["api"], payload["method"], payload["params"]], "id": 1}).encode()
        request = urllib.request.Request(live_node, data=body, headers={"content-type": "application/json", "user-agent": "curl/8 smoke-boot"})
        try:
            with urllib.request.urlopen(request, timeout=30, context=context) as response:
                result = response.read()
        except Exception as exc:  # network failure: surface as an RPC error
            result = json.dumps({"error": {"code": -1, "message": str(exc)}}).encode()
        if not volatile:
            cache[key] = result
        if os.environ.get("SMOKE_LOG_RPC"):
            note = ""
            try:
                parsed = json.loads(result)
                note = "ERROR " + json.dumps(parsed["error"])[:140] if parsed.get("error") else "ok %d bytes" % len(result)
            except ValueError:
                note = "non-JSON reply"
            print("   RPC", payload["api"], payload["method"], json.dumps(payload["params"])[:70], "->", note, flush=True)
        return result

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=dist, **k)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/" or not os.path.exists(os.path.join(dist, path.lstrip("/"))):
                self.path = "/index.html"
            return super().do_GET()

        def do_POST(self):
            if self.path != "/__rpc" or not live_node:
                self.send_error(404)
                return
            payload = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            result = relay(payload)
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(result)))
            self.end_headers()
            try:
                self.wfile.write(result)
            except (BrokenPipeError, ConnectionResetError):
                pass  # the page navigated away and dropped the request

        def log_message(self, *a):
            pass

    class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
        daemon_threads = True
        allow_reuse_address = True

    httpd = Server(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dist", help="built bundle directory (contains index.html)")
    ap.add_argument("--routes", default="", help="comma-separated client routes to visit after boot")
    ap.add_argument("--boot-wait", type=int, default=15, help="seconds to wait for the first boot")
    ap.add_argument("--route-wait", type=float, default=2.5, help="seconds to wait per route")
    ap.add_argument("--shots", help="directory for one screenshot per route (and boot.png)")
    ap.add_argument("--no-stub-chain", action="store_true", help="do not stub the WebSocket (boots to the init-error screen)")
    ap.add_argument("--live-node", help="relay chain calls to this node's HTTPS JSON-RPC endpoint (e.g. https://node.xbts.io/ws) instead of the canned stub")
    ap.add_argument("--account", help="pre-select this account as the current (read-only, wallet stays locked) account, so dashboard/market/account screens render with that account's data (BitShares mainnet only)")
    ap.add_argument("--dismiss", default="", help="comma-separated button labels to click when visible after boot and after each route (e.g. 'Not now' for the first-run gateway modal)")
    ap.add_argument("--click", default="", help="comma-separated button labels to click one by one after boot (modal/dropdown smoke; Escape is pressed after each)")
    ap.add_argument("--chromium-path", default=os.environ.get("CHROMIUM_PATH", "/opt/pw-browsers/chromium"))
    args = ap.parse_args()

    httpd = serve(os.path.abspath(args.dist), args.live_node)
    base = f"http://127.0.0.1:{httpd.server_address[1]}/"
    errors, page_errors = [], []
    failed = False

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.chromium_path)
        page = browser.new_context(viewport={"width": 1400, "height": 900}).new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))
        page.on("console", lambda m: errors.append(m.text[:300]) if m.type == "error" else None)
        if args.account:
            # AccountStore persists these under `__graphene__<key>_<first 8 chars of chain id>`.
            page.add_init_script(
                "try { const n = %s; const c = '4018d784';"
                " localStorage.setItem('__graphene__currentAccount_' + c, JSON.stringify(n));"
                " localStorage.setItem('__graphene__passwordAccount_' + c, JSON.stringify(n));"
                " localStorage.setItem('__graphene__starredAccounts_' + c, JSON.stringify({[n]: {name: n}})); } catch (e) {}"
                % json.dumps(args.account)
            )
        if args.live_node:
            page.add_init_script(LIVE_WEBSOCKET)
        elif not args.no_stub_chain:
            page.add_init_script(STUB_WEBSOCKET)

        def boot():
            page.goto(base, wait_until="load")
            page.wait_for_timeout(args.boot_wait * 1000)

        def dismiss():
            for label in [l for l in args.dismiss.split(",") if l]:
                button = page.get_by_role("button", name=label, exact=True)
                if button.count():
                    button.first.click()
                    page.wait_for_timeout(500)

        def report(label):
            nonlocal failed
            # External requests cannot succeed in a sandbox; they are not app bugs.
            real = [e for e in errors if "ERR_TUNNEL_CONNECTION_FAILED" not in e and "ERR_NAME_NOT_RESOLVED" not in e]
            body = page.evaluate("(document.getElementById('content') || document.body).innerText").replace("\n", " | ")
            status = "ok" if not real and not page_errors else "ERRORS"
            print(f"{label:<34} {status:<6} {body[:110]!r}")
            for e in (page_errors + real)[:4]:
                print("    ", e)
            if real or page_errors:
                failed = True
            blank = not body.strip()
            errors.clear()
            page_errors.clear()
            return blank

        boot()
        dismiss()
        if args.shots:
            os.makedirs(args.shots, exist_ok=True)
            page.screenshot(path=os.path.join(args.shots, "boot.png"))
        report("(boot)")

        for label in [l for l in args.click.split(",") if l]:
            button = page.get_by_role("button", name=label, exact=True)
            if not button.count():
                print(f"{'click ' + label:<34} (no such button)")
                continue
            button.first.click()
            page.wait_for_timeout(int(args.route_wait * 1000))
            if args.shots:
                page.screenshot(path=os.path.join(args.shots, "click_" + label.replace(" ", "_") + ".png"))
            if report("click " + label):
                print("     (tree is blank - reloading the app)")
                boot()
                dismiss()
                errors.clear()
                page_errors.clear()
            else:
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)

        for route in [r for r in args.routes.split(",") if r]:
            page.evaluate(
                "(r) => { history.pushState({}, '', r); window.dispatchEvent(new PopStateEvent('popstate')); }",
                route,
            )
            page.wait_for_timeout(int(args.route_wait * 1000))
            dismiss()
            if args.shots:
                name = route.strip("/").replace("/", "_") or "root"
                page.screenshot(path=os.path.join(args.shots, name + ".png"))
            if report(route):
                print("     (tree is blank - reloading the app)")
                boot()
                errors.clear()
                page_errors.clear()
        browser.close()

    httpd.shutdown()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
