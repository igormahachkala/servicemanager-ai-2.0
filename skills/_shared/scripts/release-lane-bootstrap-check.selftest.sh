#!/usr/bin/env bash
# Bootstrap preflight regression tests.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
TMP_BASE="$(printenv TMPDIR || printf /tmp)"
TMP=$(mktemp -d "$TMP_BASE/release-bootstrap.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0; failed=0
pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }
if "$HERE/release-lane-bootstrap-check.sh" "$HERE/../../.." >/dev/null 2>&1; then pass "trusted workflow present in current base"; else fail "trusted workflow present in current base"; fi
mkdir -p "$TMP/missing-base"
set +e
"$HERE/release-lane-bootstrap-check.sh" "$TMP/missing-base" >"$TMP/out" 2>&1
rc=$?
set -e
if [ "$rc" -ne 0 ] && grep -q 'workflow missing in base' "$TMP/out"; then pass "missing trusted workflow blocks bootstrap"; else fail "missing trusted workflow blocks bootstrap"; fi
echo "== results: $passed passed, $failed failed =="
((failed == 0))
