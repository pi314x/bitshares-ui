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

Limits: the stub chain returns `null` for every other object, so screens
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
import sys
import threading

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


def serve(dist):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=dist, **k)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/" or not os.path.exists(os.path.join(dist, path.lstrip("/"))):
                self.path = "/index.html"
            return super().do_GET()

        def log_message(self, *a):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
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
    ap.add_argument("--chromium-path", default=os.environ.get("CHROMIUM_PATH", "/opt/pw-browsers/chromium"))
    args = ap.parse_args()

    httpd = serve(os.path.abspath(args.dist))
    base = f"http://127.0.0.1:{httpd.server_address[1]}/"
    errors, page_errors = [], []
    failed = False

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.chromium_path)
        page = browser.new_context(viewport={"width": 1400, "height": 900}).new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))
        page.on("console", lambda m: errors.append(m.text[:300]) if m.type == "error" else None)
        if not args.no_stub_chain:
            page.add_init_script(STUB_WEBSOCKET)

        def boot():
            page.goto(base, wait_until="load")
            page.wait_for_timeout(args.boot_wait * 1000)

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
        if args.shots:
            os.makedirs(args.shots, exist_ok=True)
            page.screenshot(path=os.path.join(args.shots, "boot.png"))
        report("(boot)")

        for route in [r for r in args.routes.split(",") if r]:
            page.evaluate(
                "(r) => { history.pushState({}, '', r); window.dispatchEvent(new PopStateEvent('popstate')); }",
                route,
            )
            page.wait_for_timeout(int(args.route_wait * 1000))
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
