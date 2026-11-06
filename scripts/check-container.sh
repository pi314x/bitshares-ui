#!/usr/bin/env bash
# Starts the container image the way docker-compose.yml runs it and checks what it serves:
# the health check, the user, the headers and the policy, caching, files that must not be served,
# a read-only file system, and the TLS variant. The nginx files are also run through `nginx -t`.
# Used by .github/workflows/docker.yml; run it locally the same way:
#
#     docker build -t bitshares-desk:ci .
#     scripts/check-container.sh bitshares-desk:ci
#
# Needs docker, curl and openssl. Exits non-zero with a line "FAIL: ..." at the first thing that
# is not as it should be.
set -euo pipefail

IMAGE="${1:-bitshares-desk:ci}"
PORT="${PORT:-18080}"
TLS_HTTP_PORT="${TLS_HTTP_PORT:-18081}"
TLS_PORT="${TLS_PORT:-18443}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="desk-check-$$"
TMP="$(mktemp -d)"
NGINX_IMAGE="nginxinc/nginx-unprivileged:stable-alpine"

cleanup() {
    docker rm -f "$NAME" "$NAME-tls" >/dev/null 2>&1 || true
    rm -rf "$TMP"
}
trap cleanup EXIT

fail() {
    echo "FAIL: $*" >&2
    if docker inspect "$NAME" >/dev/null 2>&1; then docker logs "$NAME" 2>&1 | tail -20 >&2 || true; fi
    exit 1
}
ok() { echo "ok: $*"; }

# header NAME of an answer, lower case, without the line end
header() { # url [curl options]
    local url="$1"
    shift
    curl -s -I "$@" "$url" | tr -d '\r'
}
has_header() { # headers name -> value or empty
    printf '%s\n' "$1" | awk -v n="$(printf '%s' "$2" | tr 'A-Z' 'a-z')" 'BEGIN{FS=": "} tolower($1)==n {sub(/^[^:]*: /,""); print; exit}'
}
expect_header() { # headers name substring
    local value
    value="$(has_header "$1" "$2")"
    case "$value" in
        *"$3"*) ;;
        *) fail "header $2 is '${value}', expected it to contain '$3'" ;;
    esac
}

# ---- the nginx files ----------------------------------------------------------------------
# A certificate for the TLS ones (readable by the unprivileged user of the image).
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TMP/privkey.pem" -out "$TMP/fullchain.pem" \
    -days 2 -subj "/CN=desk.example.org" >/dev/null 2>&1
# (mktemp makes the folder private to this user; the image's user 101 has to read the files)
chmod 755 "$TMP"
chmod 644 "$TMP/privkey.pem" "$TMP/fullchain.pem"

nginx_test() { # label, user, mounts...
    local label="$1" user="$2"
    shift 2
    docker run --rm --user "$user" "$@" "$NGINX_IMAGE" nginx -t >/dev/null 2>"$TMP/nginx.err" \
        || { cat "$TMP/nginx.err" >&2; fail "nginx -t: $label"; }
    ok "nginx -t: $label"
}
SNIPPETS=(-v "$ROOT/conf/headers.common.conf:/etc/nginx/headers.common.conf:ro" \
    -v "$ROOT/conf/headers.csp.conf:/etc/nginx/headers.csp.conf:ro")
nginx_test "conf/nginx.container.conf" 101 -v "$ROOT/conf/nginx.container.conf:/etc/nginx/nginx.conf:ro" "${SNIPPETS[@]}"
nginx_test "conf/nginx.container.tls.conf" 101 -v "$ROOT/conf/nginx.container.tls.conf:/etc/nginx/nginx.conf:ro" \
    "${SNIPPETS[@]}" -v "$TMP:/certs:ro"
nginx_test "conf/nginx.https.conf.example" root -v "$ROOT/conf/nginx.https.conf.example:/etc/nginx/nginx.conf:ro" \
    -v "$TMP:/etc/letsencrypt/live/desk.example.org:ro"
nginx_test "conf/nginx.conf" root -v "$ROOT/conf/nginx.conf:/etc/nginx/nginx.conf:ro"

# ---- the image, plain ---------------------------------------------------------------------
docker run -d --name "$NAME" -p "$PORT:8080" --read-only --tmpfs /tmp --cap-drop ALL \
    --security-opt no-new-privileges:true "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo none)"
    [ "$status" = "healthy" ] && break
    [ "$(docker inspect --format '{{.State.Running}}' "$NAME")" = "true" ] || fail "the container stopped"
    sleep 2
done
[ "$status" = "healthy" ] || fail "the container is not healthy (state: $status)"
ok "healthy"

[ "$(docker exec "$NAME" id -u)" = "101" ] || fail "the server does not run as user 101"
ok "runs as user 101, read-only file system, no capabilities"

BASE="http://127.0.0.1:$PORT"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthz")" = "200" ] || fail "/healthz is not 200"

page="$(header "$BASE/")"
expect_header "$page" Content-Type "text/html"
expect_header "$page" Cache-Control "no-cache"
expect_header "$page" Strict-Transport-Security "max-age=31536000"
expect_header "$page" X-Content-Type-Options "nosniff"
expect_header "$page" Referrer-Policy "no-referrer"
expect_header "$page" X-Frame-Options "DENY"
expect_header "$page" Permissions-Policy "camera=(self)"
expect_header "$page" Cross-Origin-Opener-Policy "same-origin-allow-popups"
csp="$(has_header "$page" Content-Security-Policy)"
case "$csp" in *"frame-ancestors 'none'"*) ;; *) fail "the policy has no frame-ancestors 'none'" ;; esac
case "$csp" in *"unsafe-eval"*) fail "the policy allows unsafe-eval" ;; esac
case "$csp" in *"cdnjs"*|*"alicdn"*) fail "the policy names a CDN" ;; esac
ok "the page's headers and policy"

deep="$(header "$BASE/account/alice/permissions")"
expect_header "$deep" Content-Type "text/html"
expect_header "$deep" Content-Security-Policy "default-src 'self'"
ok "a router address serves the page"

script="$(curl -s "$BASE/" | grep -oE 'app\.[0-9a-f]{16,}\.js' | head -1)"
[ -n "$script" ] || fail "the page names no app script"
asset="$(header "$BASE/$script")"
expect_header "$asset" Cache-Control "immutable"
expect_header "$asset" X-Content-Type-Options "nosniff"
ok "a hashed file is cached as immutable ($script)"

[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$script.map")" = "404" ] || fail "a source map is served"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/.git/config")" = "404" ] || fail "a hidden file is served"
docker exec "$NAME" sh -c 'ls /usr/share/nginx/html | grep -q "^zxcvbn\."' || fail "the password strength library is not in the image"
docker exec "$NAME" sh -c 'touch /usr/share/nginx/html/x 2>/dev/null' && fail "the served files are writable"
ok "no source maps, no hidden files, the strength library is in the image, the files are read-only"

# ---- the image, with TLS ------------------------------------------------------------------
docker run -d --name "$NAME-tls" -p "$TLS_HTTP_PORT:8080" -p "$TLS_PORT:8443" -v "$TMP:/certs:ro" \
    --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true "$IMAGE" \
    nginx -c /etc/nginx/nginx.tls.conf -g "daemon off;" >/dev/null
for _ in $(seq 1 30); do
    curl -sk -o /dev/null "https://127.0.0.1:$TLS_PORT/healthz" 2>/dev/null && break
    sleep 1
done
redirect="$(header "http://127.0.0.1:$TLS_HTTP_PORT/some/page")"
expect_header "$redirect" Location "https://"
tls="$(header "https://127.0.0.1:$TLS_PORT/" -k)"
expect_header "$tls" Strict-Transport-Security "max-age=31536000"
expect_header "$tls" Content-Security-Policy "frame-ancestors 'none'"
ok "TLS variant: http redirects, https sends the headers"

echo "all checks passed"
