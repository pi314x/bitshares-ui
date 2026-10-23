#!/usr/bin/env bash
# Prepares a release of BitShares Desk from the commit that is checked out: runs the gates, builds
# the container image from a clean archive of that commit (not from the working folder), checks the
# image, and saves it as a file you can copy to a server. It publishes nothing: no push, no tag,
# no registry. What to do with the file is in docs/DEPLOYMENT.md ("Releasing").
#
#     scripts/prepare-release.sh              # all steps
#     SKIP_GATES=1 scripts/prepare-release.sh # only the image (the gates ran before)
#
# Needs docker, git, yarn, curl and openssl. The working tree must be clean: the image is built from
# the commit, and a change that is not committed would not be in it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n== %s\n' "$*"; }
fail() {
    echo "FAIL: $*" >&2
    exit 1
}

[ -z "$(git status --porcelain)" ] || fail "the working tree has changes that are not committed (git status)"

REV="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
VERSION="$(node -p "require('./package.json').version")"
TAG="${VERSION}-${REV}"
IMAGE="bitshares-desk:${TAG}"
OUT="build/release"

echo "commit $REV on $BRANCH, version $VERSION, image $IMAGE"

if [ -z "${SKIP_GATES:-}" ]; then
    step "types"
    yarn -s typecheck
    step "lint (errors fail it, warnings do not)"
    yarn -s lint >/dev/null
    step "tests"
    yarn -s test --silent
fi

step "image (from a clean archive of $REV)"
git archive --format=tar HEAD | docker build \
    -t "$IMAGE" -t bitshares-desk:latest \
    --build-arg "BRANCH=$BRANCH" --build-arg "GIT_REV=$REV" -

step "image checks (headers, policy, user, files that must not be served, TLS variant)"
scripts/check-container.sh "$IMAGE"

step "what the image ships"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
CID="$(docker create "$IMAGE")"
docker cp "$CID:/usr/share/nginx/html/." "$TMP/html"
docker rm "$CID" >/dev/null
[ -f "$TMP/html/index.html" ] || fail "no index.html in the image"
# the app's own source maps must not exist (the four .css.map of the charting library are its own
# files, and nginx answers 404 for any .map: scripts/check-container.sh tests that)
if find "$TMP/html" -name '*.js.map' | grep -q .; then fail "script source maps are in the image"; fi
if grep -rIl 'BEGIN [A-Z ]*PRIVATE KEY' "$TMP/html" >/dev/null 2>&1; then fail "a private key block is in the image"; fi
# the MCP pages are compile-time flags, off in a build that sets none: the review route must not exist
if grep -rIl '/mcp/review' "$TMP/html" --include='*.js' >/dev/null 2>&1; then
    fail "the MCP pages are in this build (MCP_ENABLED was set when it was built)"
fi
echo "ok: $(find "$TMP/html" -type f | wc -l) files, no script source maps, no keys, no MCP pages"

step "image file"
mkdir -p "$OUT"
FILE="$OUT/bitshares-desk-${TAG}.tar.gz"
docker save "$IMAGE" | gzip -9 >"$FILE"
(cd "$OUT" && sha256sum "bitshares-desk-${TAG}.tar.gz" | tee "bitshares-desk-${TAG}.tar.gz.sha256")
ls -lh "$FILE" | awk '{print "size", $5}'

cat <<EOF

Ready: $IMAGE
  file     $FILE (+ .sha256)
  on the server:
    sha256sum -c bitshares-desk-${TAG}.tar.gz.sha256
    gunzip -c bitshares-desk-${TAG}.tar.gz | docker load
    docker tag $IMAGE bitshares-desk:local
    docker compose up -d --no-build          # plain http on :8080, behind your TLS proxy
    # or with TLS of its own (certificate chain and key in ./certs):
    docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --no-build
Nothing was pushed or tagged. See docs/DEPLOYMENT.md.
EOF
