#!/usr/bin/env bash
# Fetch a required release-lane lock tag with a controlled fail-closed verdict.
set -euo pipefail

usage() {
  echo "Usage: $0 <stage-busy|prod-busy> [remote]" >&2
}

fail() {
  echo "RELEASE LANE: BLOCKED - $*" >&2
  exit 1
}

[ "$#" -ge 1 ] && [ "$#" -le 2 ] || { usage; exit 2; }
TAG="$1"
REMOTE="${2:-origin}"

case "$TAG" in
  stage-busy|prod-busy) ;;
  *) usage; exit 2 ;;
esac

set +e
REMOTE_TAG=$(git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$TAG" 2>/dev/null)
LS_REMOTE_RC=$?
set -e

case "$LS_REMOTE_RC" in
  0) [ -n "$REMOTE_TAG" ] || fail "$TAG is missing" ;;
  2) fail "$TAG is missing" ;;
  *) fail "$TAG could not be read from origin" ;;
esac

git fetch -q --no-write-fetch-head --no-tags --force \
  "$REMOTE" "refs/tags/$TAG:refs/tags/$TAG" \
  || fail "$TAG could not be fetched from origin"

[ "$(git cat-file -t "refs/tags/$TAG" 2>/dev/null || true)" = tag ] \
  || fail "$TAG is not an annotated tag"
