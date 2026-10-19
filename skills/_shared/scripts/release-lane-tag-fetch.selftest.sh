#!/usr/bin/env bash
# Offline tests for trusted workflow lock-tag acquisition.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
FETCH_TAG="$HERE/release-lane-tag-fetch.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-lane-tag-fetch.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0
failed=0

pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }

expect_pass() {
  local label="$1" tag="$2"
  if (cd "$WORK" && "$FETCH_TAG" "$tag" origin) >"$TMP/out" 2>&1; then
    pass "$label"
  else
    fail "$label"
    sed 's/^/  /' "$TMP/out" >&2
  fi
}

expect_fail() {
  local label="$1" tag="$2" reason="$3" remote="${4:-origin}" rc
  set +e
  (cd "$WORK" && "$FETCH_TAG" "$tag" "$remote") >"$TMP/out" 2>&1
  rc=$?
  set -e
  if ((rc != 0)) && grep -Fq "$reason" "$TMP/out" && ! grep -q 'RELEASE LANE: PASS' "$TMP/out"; then
    pass "$label"
  else
    fail "$label (rc=$rc)"
    sed 's/^/  /' "$TMP/out" >&2
  fi
}

WORK="$TMP/work"
REMOTE="$TMP/remote.git"
git init -q "$WORK"
git -C "$WORK" config user.name "Release Lane Tag Self-Test"
git -C "$WORK" config user.email release-lane-tag-selftest@example.invalid
printf 'fixture\n' >"$WORK/fixture.txt"
git -C "$WORK" add fixture.txt
git -C "$WORK" commit -qm fixture
git -C "$WORK" clone -q --bare . "$REMOTE"
git -C "$WORK" remote add origin "$REMOTE"

expect_fail "missing stage-busy is denied clearly" stage-busy "stage-busy is missing"

git -C "$WORK" tag -a stage-busy -m "fixture stage lock"
git -C "$WORK" push -q origin refs/tags/stage-busy
expect_pass "annotated stage-busy is fetched" stage-busy

git -C "$WORK" tag prod-busy
git -C "$WORK" push -q origin refs/tags/prod-busy
expect_fail "lightweight prod-busy is denied" prod-busy "prod-busy is not an annotated tag"

expect_fail "unavailable remote is denied clearly" stage-busy "stage-busy could not be read from origin" "$TMP/missing.git"

echo "== results: $passed passed, $failed failed =="
((failed == 0))
