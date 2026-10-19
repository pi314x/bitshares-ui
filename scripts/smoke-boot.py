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

With `--fonts` every visited route is also checked for typography: each
visible element that carries text (plus inputs, buttons and selects) must
resolve to IBM Plex Sans/Mono as its first font family. Unrendered nodes
(`display: none`, zero-size, script/style) are skipped. Any other family fails
the run and is listed, so a stray `font-family` in a legacy stylesheet or an
inline style shows up here rather than on a user's screen.

With `--colors` every visited route is also checked for leftovers of the old
neutral-gray palette: the area-weighted share of painted backgrounds that are
a pure gray (no blue cast, not near-black or white) must stay under 2%. The palette
(`app/design-system/_palette.scss`) is cool slate throughout, so a neutral gray
means a hard-coded legacy colour that bypasses it; the worst offenders are
listed with the element that carries them.

Limits of the default stub: it returns `null` for every other object, so screens
that need real accounts, assets or blocks can legitimately throw on `null`
(`/explorer/fees`, `/barter`, `/block/1` do) - read those as "needs a real
chain", not as regressions. A blank tree after a route is reported and the
app is reloaded so later routes still run.

Requires: python3 (run it without `-I`: `requests` lives in the user site),
`pip install playwright requests`, and a Chromium (the sandbox
image ships one at /opt/pw-browsers/chromium; override with
--chromium-path).
"""
import argparse
import http.server
import json
import os
import re
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA_FILES = {"/dictionary.json": os.path.join(REPO_ROOT, "app", "lib", "common", "dictionary_en.json")}

# Names shown by the language menu (app/design-system/LocaleSwitcher.tsx).
LOCALE_NAMES = {"en": "English", "zh": "中文", "fr": "Français", "ko": "한국어", "de": "Deutsch", "es": "Español", "it": "Italiano", "tr": "Türkçe", "ru": "Русский", "ja": "日本語"}

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
      while (LiveWS._active < 16 && LiveWS._queue.length) {
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


FONT_CENSUS_JS = r"""() => {
  const tally = {}; const off = [];
  const walk = (el) => {
    if (el.nodeType !== 1) return;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD'].includes(el.tagName)) return;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0);
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
    if (visible && (hasText || ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(el.tagName))) {
      const family = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      tally[family] = (tally[family] || 0) + 1;
      if (!/^IBM Plex (Sans|Mono)$/.test(family)) {
        off.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40) + ' [' + family + '] ' + (el.textContent || el.value || '').trim().slice(0, 30));
      }
    }
    if (visible || el.tagName === 'BODY') [...el.children].forEach(walk);
  };
  walk(document.body);
  return {tally, off};
}"""


COLOR_CENSUS_JS = r"""() => {
  const area = {}, sample = {};
  const walk = (el) => {
    if (el.nodeType !== 1) return;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD'].includes(el.tagName)) return;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) return;
    const b = cs.backgroundColor;
    if (b && b !== 'rgba(0, 0, 0, 0)') {
      area[b] = (area[b] || 0) + r.width * r.height;
      sample[b] = sample[b] || (el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 30));
    }
    [...el.children].forEach(walk);
  };
  walk(document.body);
  return {area, sample};
}"""


def neutral_gray(css_color):
    """True for an opaque-ish gray with no hue (and not near-black or white)."""
    m = re.match(r"rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)", css_color)
    if not m:
        return False
    r, g, b = (float(m.group(i)) for i in (1, 2, 3))
    alpha = float(m.group(4)) if m.group(4) else 1.0
    return alpha > 0.5 and max(r, g, b) - min(r, g, b) < 9 and 24 <= max(r, g, b) <= 245


def serve(dist, live_node=None):
    cache = {}
    cache_path = os.environ.get("SMOKE_RPC_CACHE")  # persist relayed replies between runs (warm runs are much faster)
    if cache_path and os.path.exists(cache_path):
        with open(cache_path) as handle:
            cache = {k: v.encode() for k, v in json.load(handle).items()}
    local = threading.local()

    def session():
        # One keep-alive session per request thread: opening a new TLS tunnel
        # through the sandbox proxy for every call made the bridge ~10x slower.
        if not hasattr(local, "session"):
            import requests  # imported lazily: only the live mode needs it

            local.session = requests.Session()
            local.session.headers.update({"content-type": "application/json", "user-agent": "curl/8 smoke-boot"})
        return local.session

    def relay(payload):
        key = json.dumps(payload, sort_keys=True)
        volatile = "2.1.0" in key or payload["method"] == "get_dynamic_global_properties"
        if key in cache and not volatile:
            return cache[key]
        body = json.dumps({"jsonrpc": "2.0", "method": "call", "params": [payload["api"], payload["method"], payload["params"]], "id": 1}).encode()
        try:
            result = session().post(live_node, data=body, timeout=30).content
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
            # `webpack --output-path <dir>` leaves out the files the CopyPlugin
            # writes next to the real output (dictionary.json for wallet
            # creation, the locale files); serve them from the sources so a
            # custom output path behaves like a real deployment.
            source = EXTRA_FILES.get(path)
            if source is None and re.match(r"^/locale-[\w-]+\.json$", path):
                source = os.path.join(REPO_ROOT, "app", "assets", "locales", path.lstrip("/"))
            if source and not os.path.exists(os.path.join(dist, path.lstrip("/"))) and os.path.exists(source):
                with open(source, "rb") as handle:
                    body = handle.read()
                self.send_response(200)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
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
    httpd.save_cache = lambda: cache_path and json.dump({k: v.decode() for k, v in cache.items()}, open(cache_path, "w"))
    return httpd


LAYOUT_JS = """() => {
  const vw = document.documentElement.clientWidth;
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(o.overflowX) && p.getBoundingClientRect().right <= vw + 1 && p.getBoundingClientRect().left >= -1) return true; } return false; };
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') continue;
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) wide.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
  }
  const nav = document.querySelector('nav[aria-label=Main]');
  const navRect = nav ? nav.getBoundingClientRect() : null;
  const navVisible = !!navRect && getComputedStyle(nav).visibility !== 'hidden' && navRect.right > 1 && navRect.left < vw - 1;
  const bar = document.querySelector('header');
  return {vw, scrollW: document.documentElement.scrollWidth, wide: wide.slice(0, 5), navVisible, navWidth: navRect ? Math.round(navRect.width) : 0,
          barWidth: bar ? Math.round(bar.getBoundingClientRect().width) : 0};
}"""


CONTAIN_JS = """() => {
  // Elements that stick out of the bordered or filled box they sit in (a card,
  // a panel, the menu): what a person sees as "goes beyond the borders". Boxes
  // that scroll or clip on purpose are skipped, and so is what scrolls inside.
  const boxy = el => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const filled = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const bordered = ['Top','Right','Bottom','Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none');
    return filled || bordered;
  };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed' || cs.position === 'absolute') continue;
    // nearest ancestor that draws a box
    let box = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/(auto|scroll)/.test(ps.overflowX)) { box = null; break; }
      if (boxy(p)) { box = p; break; }
    }
    if (!box) continue;
    const b = box.getBoundingClientRect();
    if (r.right > b.right + 2 || r.left < b.left - 2) {
      const key = box.tagName + '.' + String(box.className).split(' ')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + '] in ' + key + ' [' + Math.round(b.left) + ',' + Math.round(b.right) + ']');
    }
  }
  return out.slice(0, 8);
}"""


OVERLAP_JS = """() => {
  // Controls that something else sits on: at the centre of each visible button,
  // link, field and select the topmost element must be that control or part of
  // it. What scrolls under the sticky top bar or the status bar is skipped.
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const bar = document.querySelector('header');
  const top = bar ? bar.getBoundingClientRect().bottom : 0;
  const status = document.querySelector('[class*=statusDock], [class*=dock]');
  const bottom = status ? status.getBoundingClientRect().top : vh;
  const name = el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
  const out = [];
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=menuitem], [role=option]';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || x > vw || y <= top + 2 || y >= bottom - 2) continue;
    // clipped away by an ancestor that hides its overflow (a collapsed menu)
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/(hidden|clip|auto|scroll)/.test(ps.overflowY + ps.overflowX)) {
        const pr = p.getBoundingClientRect();
        if (x < pr.left || x > pr.right || y < pr.top || y > pr.bottom) { clipped = true; break; }
      }
    }
    if (clipped) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
    // a label wrapping the control, or the control inside a labelled row
    if (hit.closest('label') && hit.closest('label').contains(el)) continue;
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 24);
    out.push(name(el) + " '" + text + "' covered by " + name(hit));
  }
  return out.slice(0, 8);
}"""

INSETS_JS = """() => {
  // How far the page's own content sits from the edges of the content region:
  // the leftmost, topmost and rightmost visible *boxes* (bordered or filled
  // elements: cards, panels, tables, fields) and leaves (text, images), so a
  // card counts by its edge and not by the text inside it.
  const bar = document.querySelector('header');
  const c = bar ? bar.nextElementSibling : null;
  if (!c) return null;
  const cr = c.getBoundingClientRect();
  let left = Infinity, top = Infinity, right = -Infinity, first = '';
  const boxy = cs => {
    const bg = cs.backgroundColor;
    const filled = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const bordered = ['Top','Right','Bottom','Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none');
    return filled || bordered;
  };
  for (const el of c.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || cs.position === 'absolute') continue;
    const tag = el.tagName.toUpperCase();
    const leaf = (el.children.length === 0 && el.textContent.trim()) || /^(TABLE|INPUT|SELECT|TEXTAREA|CANVAS|IMG|SVG)$/.test(tag);
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (!leaf && !(boxy(cs) && r.width > 40 && r.height > 20)) continue;
    if (r.left < left) { left = r.left; first = tag.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + (el.textContent || '').trim().slice(0, 18); }
    top = Math.min(top, r.top); right = Math.max(right, r.right);
  }
  return {left: Math.round(left - cr.left), top: Math.round(top - cr.top), right: Math.round(cr.right - right), width: Math.round(cr.width), first};
}"""


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
    ap.add_argument("--full-page", action="store_true", help="screenshots cover the whole scrollable page, not only the viewport")
    ap.add_argument("--click", default="", help="comma-separated button labels to click one by one after boot (modal/dropdown smoke; Escape is pressed after each)")
    ap.add_argument("--fonts", action="store_true", help="also fail on any visible text that is not set in IBM Plex Sans/Mono (see the module docstring)")
    ap.add_argument("--colors", action="store_true", help="also fail when more than 2%% of the painted background area is a neutral gray, i.e. a colour that bypasses the palette (see the module docstring)")
    ap.add_argument("--locale", choices=sorted(LOCALE_NAMES), help="switch the app to this UI locale after boot, through the language menu (for example de), to check translated screens and help pages")
    ap.add_argument("--viewport", default="1400x900", help="browser size WIDTHxHEIGHT; at 860px or less the page is loaded as a touch phone (for example 390x844)")
    ap.add_argument("--layout", action="store_true", help="also fail on horizontal page overflow and, at phone width (<= 860px), on a navigation rail that is not collapsed or a top bar narrower than the screen (see docs/UI_MIGRATION_PLAN.md 7.15)")
    ap.add_argument("--probe", default="", help="JavaScript (an arrow function) evaluated on each route after any #button press; its result is printed (for finding what covers an element)")
    ap.add_argument("--pinch", default="", help="CSS selector: on each route, do a two-finger pinch-out on that element (touch events through the devtools protocol) and print its viewBox before and after")
    ap.add_argument("--insets", action="store_true", help="also print how far the page's content sits from the left, top and right edge of the content region (the convention is 24/24/24, and 12/16/12 on a phone)")
    ap.add_argument("--overlap", action="store_true", help="also fail on a button, link or field that another element sits on (a control that cannot be clicked)")
    ap.add_argument("--ls", action="append", default=[], help="KEY=JSON: put this into localStorage before the app starts (repeatable); for example --ls '__graphene__settings_v4={\"unit\":6}' (settings keep the index of a chosen unit)")
    ap.add_argument("--contain", action="store_true", help="also fail on an element that sticks out of the card, panel or menu it is in (what reads as 'goes beyond the borders')")
    ap.add_argument("--chromium-path", default=os.environ.get("CHROMIUM_PATH", "/opt/pw-browsers/chromium"))
    args = ap.parse_args()

    httpd = serve(os.path.abspath(args.dist), args.live_node)
    base = f"http://127.0.0.1:{httpd.server_address[1]}/"
    errors, page_errors = [], []
    failed = False

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.chromium_path)
        vw, vh = (int(v) for v in args.viewport.lower().split("x"))
        phone = vw <= 860
        page = browser.new_context(viewport={"width": vw, "height": vh}, is_mobile=phone, has_touch=phone, device_scale_factor=2 if phone else 1).new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))
        page.on("console", lambda m: errors.append(m.text[:300]) if m.type == "error" else None)
        watch = os.environ.get("SMOKE_CONSOLE_FILTER")  # print console output containing this substring
        if watch:
            page.on("console", lambda m: print("   console.%s: %s" % (m.type, m.text[:300])) if watch in m.text else None)
        if args.account:
            # AccountStore persists these under `__graphene__<key>_<first 8 chars of chain id>`.
            page.add_init_script(
                "try { const n = %s; const c = '4018d784';"
                " localStorage.setItem('__graphene__currentAccount_' + c, JSON.stringify(n));"
                " localStorage.setItem('__graphene__passwordAccount_' + c, JSON.stringify(n));"
                " localStorage.setItem('__graphene__starredAccounts_' + c, JSON.stringify({[n]: {name: n}})); } catch (e) {}"
                % json.dumps(args.account)
            )
        for entry in args.ls:
            key, _, value = entry.partition("=")
            page.add_init_script("try { localStorage.setItem(%s, %s); } catch (e) {}" % (json.dumps(key), json.dumps(value)))
        if args.live_node:
            page.add_init_script(LIVE_WEBSOCKET)
        elif not args.no_stub_chain:
            page.add_init_script(STUB_WEBSOCKET)

        def boot():
            page.goto(base, wait_until="load")
            page.wait_for_timeout(args.boot_wait * 1000)
            if args.locale:
                # Same path as a user: language chip in the top bar, then the menu item.
                page.locator("button[aria-haspopup=menu]").filter(has_text="English").first.click()
                page.get_by_role("menuitem", name=LOCALE_NAMES[args.locale], exact=True).click()
                page.wait_for_timeout(2000)

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
            if args.fonts:
                census = page.evaluate(FONT_CENSUS_JS)
                total = sum(census["tally"].values())
                plex = sum(n for f, n in census["tally"].items() if f.startswith("IBM Plex"))
                print(f"{'':<34} fonts: {plex}/{total} elements in IBM Plex")
                for line in census["off"][:6]:
                    print("      not Plex:", line)
                if census["off"]:
                    failed = True
            if args.colors:
                census = page.evaluate(COLOR_CENSUS_JS)
                total = sum(census["area"].values()) or 1
                gray = {c: a for c, a in census["area"].items() if neutral_gray(c)}
                share = 100.0 * sum(gray.values()) / total
                print(f"{'':<34} colors: {share:.1f}% of painted area is a neutral gray")
                for c, a in sorted(gray.items(), key=lambda kv: -kv[1])[:4]:
                    print(f"      neutral {c} ({100.0 * a / total:.1f}%) e.g. {census['sample'].get(c, '')}")
                if share > 2.0:
                    failed = True
            if args.insets:
                ins = page.evaluate(INSETS_JS)
                if ins:
                    want = (12, 16, 12) if vw <= 860 else (24, 24, 24)
                    off = (ins["left"], ins["top"], ins["right"]) != want
                    flag = ("   <-- " + ins["first"]) if (ins["left"], ins["top"]) != want[:2] else ""
                    print(f"{'':<34} insets: left {ins['left']} top {ins['top']} right {ins['right']}{flag}")
            if args.overlap:
                covered = page.evaluate(OVERLAP_JS)
                print(f"{'':<34} overlap: " + ("ok" if not covered else str(len(covered)) + " controls covered"))
                for line in covered:
                    print("      covered:", line)
                if covered:
                    failed = True
            if args.contain:
                pokes = page.evaluate(CONTAIN_JS)
                print(f"{'':<34} contain: " + ("ok" if not pokes else str(len(pokes)) + " out of their box"))
                for line in pokes:
                    print("      beyond:", line)
                if pokes:
                    failed = True
            if args.layout:
                lay = page.evaluate(LAYOUT_JS)
                problems = []
                if lay["scrollW"] > lay["vw"] + 1:
                    problems.append("page scrolls sideways by %dpx" % (lay["scrollW"] - lay["vw"]))
                if lay["wide"]:
                    problems.append("outside the screen: " + "; ".join(lay["wide"]))
                if lay["vw"] <= 860:
                    if lay["navVisible"]:
                        problems.append("navigation rail is open on a phone (%dpx of %dpx)" % (lay["navWidth"], lay["vw"]))
                    if lay["barWidth"] and lay["barWidth"] < lay["vw"] * 0.9:
                        problems.append("top bar is %dpx on a %dpx screen" % (lay["barWidth"], lay["vw"]))
                print(f"{'':<34} layout: " + ("ok" if not problems else "; ".join(problems)))
                if problems:
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

        for entry in [r for r in args.routes.split(",") if r]:
            # "/path@Tab label": after the route has loaded, open that tab of the
            # page (a tab strip, or its select on a phone) before the report
            # "...#Label": then click the first button with that accessible name
            # (a row's menu, say) so the shot shows what it opens
            entry_main, _, press = entry.partition("#")
            route, _, tab = entry_main.partition("@")
            page.evaluate(
                "(r) => { history.pushState({}, '', r); window.dispatchEvent(new PopStateEvent('popstate')); }",
                route,
            )
            page.wait_for_timeout(int(args.route_wait * 1000))
            dismiss()
            if tab:
                # a tab of the page (design-system tabs, or the legacy strip and
                # its select on a phone)
                tabs = page.locator("#content [role=tab]").filter(has_text=tab)
                if tabs.count():
                    tabs.first.click()
                else:
                    strip = page.locator("#content .service-selector")
                    select = strip.locator("select")
                    if select.count():
                        value = select.first.evaluate(
                            "(el, t) => { const o = Array.from(el.options).find(o => o.textContent.toLowerCase().includes(t.toLowerCase())); return o ? o.value : null; }",
                            tab,
                        )
                        if value is not None:
                            select.first.select_option(value)
                    else:
                        strip.locator("li", has_text=tab).first.click()
                page.wait_for_timeout(int(args.route_wait * 1000))
            # "#Trigger=Option&Trigger2=Option2": open a dropdown and pick an
            # option, then the next; a step without "=" just presses a button
            for step in [x for x in press.split("&") if x]:
                trigger, _, choose = step.partition("=")
                button = page.get_by_role("button", name=trigger).first
                if not button.count():
                    print(f"{'':<34} (no button named {trigger!r})")
                    break
                button.scroll_into_view_if_needed()
                # on a phone a touch, like a finger (touch events first, then
                # the click the browser synthesises from the tap)
                (button.tap if phone else button.click)()
                page.wait_for_timeout(600)
                if choose:
                    option = page.get_by_role("option", name=choose, exact=True).first
                    if not option.count():
                        # an asset name is split into styled spans: fall back
                        # to a case-insensitive match on the whole name
                        option = page.get_by_role(
                            "option",
                            name=re.compile(r"^\s*" + re.escape(choose) + r"\s*$", re.I),
                        ).first
                    if option.count():
                        (option.tap if phone else option.click)()
                        page.wait_for_timeout(1500)
                    else:
                        print(f"{'':<34} (no option {choose!r})")
            if args.pinch:
                target = page.locator(args.pinch).first
                if target.count():
                    target.scroll_into_view_if_needed()
                    rect = target.bounding_box()
                    cx, cy = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
                    before = target.get_attribute("viewBox")
                    cdp = page.context.new_cdp_session(page)

                    def touch(kind, points):
                        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(points)]})

                    touch("touchStart", [(cx - 20, cy), (cx + 20, cy)])
                    for step in range(1, 11):
                        touch("touchMove", [(cx - 20 - step * 6, cy), (cx + 20 + step * 6, cy)])
                    touch("touchEnd", [])
                    page.wait_for_timeout(300)
                    print(f"{'':<34} pinch: {before} -> {target.get_attribute('viewBox')}")
                else:
                    print(f"{'':<34} (nothing matches {args.pinch!r})")
            if args.probe:
                print(f"{'':<34} probe:", page.evaluate(args.probe))
            if args.shots:
                name = (route.strip("/").replace("/", "_") or "root") + (
                    "__" + tab.replace(" ", "_") if tab else ""
                )
                page.screenshot(path=os.path.join(args.shots, name + ".png"), full_page=bool(tab) or args.full_page)
            if report(entry):
                print("     (tree is blank - reloading the app)")
                boot()
                errors.clear()
                page_errors.clear()
        browser.close()

    httpd.save_cache()
    httpd.shutdown()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
