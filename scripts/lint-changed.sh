#!/usr/bin/env bash
# Lints only the JS/JSX/TS/TSX files changed relative to the base branch.
#
# Why: `yarn lint` (the whole `app/` tree) currently fails with ~800
# pre-existing errors across the legacy codebase (see
# docs/UI_MIGRATION_PLAN.md, Phase 0/9 — cleaning those up is its own,
# separate effort). Gating CI on the full-repo lint today would make every
# PR red regardless of its own changes. This script ratchets enforcement
# instead: new/changed code must be clean, the pre-existing backlog is
# tracked but not blocking, and the backlog shrinks over time as files are
# migrated (Phases 1-9) rather than needing a single big-bang cleanup PR.
set -euo pipefail

BASE_REF="${GITHUB_BASE_REF:-develop}"

git fetch --quiet origin "$BASE_REF" 2>/dev/null || true

if git rev-parse --verify --quiet "origin/$BASE_REF" >/dev/null; then
    DIFF_BASE="origin/$BASE_REF"
elif git rev-parse --verify --quiet "HEAD~1" >/dev/null; then
    DIFF_BASE="HEAD~1"
else
    echo "No base ref to diff against; skipping changed-file lint."
    exit 0
fi

CHANGED=$(git diff --name-only --diff-filter=ACMR "$DIFF_BASE"...HEAD -- \
    'app/**/*.js' 'app/**/*.jsx' 'app/**/*.ts' 'app/**/*.tsx' 2>/dev/null || true)

if [ -z "$CHANGED" ]; then
    echo "No changed JS/TS files under app/ — nothing to lint."
    exit 0
fi

echo "Linting changed files:"
echo "$CHANGED"
# shellcheck disable=SC2086
npx eslint $CHANGED
