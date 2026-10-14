#!/usr/bin/env bash
# Contract tests for the release-automation self-test runner.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
RUNNER="$HERE/run-release-automation-selftests.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-runner.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=run-release-automation-selftests.sh
source "$RUNNER"

passed=0
failed=0
pass() { echo "  PASS $1"; passed=$((passed + 1)); }
fail() { echo "  FAIL $1"; failed=$((failed + 1)); }

expect_valid() {
  local label="$1" file="$2"
  if validate_selftest_output "$file"; then pass "$label"; else fail "$label"; fi
}

expect_invalid() {
  local label="$1" file="$2"
  if validate_selftest_output "$file"; then fail "$label"; else pass "$label"; fi
}

printf 'PASS one\n  PASS two\nPASS three\n== results: 3 passed, 0 failed ==\n' >"$TMP/valid"
: >"$TMP/empty"
printf '== results: 0 passed, 0 failed ==\n' >"$TMP/zero"
printf '== results: 2 passed, 1 failed ==\n' >"$TMP/failed"
printf 'looks good but has no machine summary\n' >"$TMP/no-summary"
printf '== results: 1 passed, 0 failed ==\n' >"$TMP/summary-only"
printf 'PASS one\n== results: 2 passed, 0 failed ==\n' >"$TMP/mismatch"

expect_valid "non-zero successful assertion summary accepted" "$TMP/valid"
[[ "$VALIDATED_ASSERTIONS" == 3 ]] && pass "assertion count extracted" || fail "assertion count extracted"
expect_invalid "empty self-test rejected" "$TMP/empty"
expect_invalid "zero-assertion self-test rejected" "$TMP/zero"
expect_invalid "reported failure rejected" "$TMP/failed"
expect_invalid "missing summary rejected" "$TMP/no-summary"
expect_invalid "summary without executed PASS rejected" "$TMP/summary-only"
expect_invalid "summary count mismatch rejected" "$TMP/mismatch"

validate_totals 1 3 0 && pass "non-zero aggregate accepted" || fail "non-zero aggregate accepted"
if validate_totals 0 0 0; then fail "zero-test aggregate rejected"; else pass "zero-test aggregate rejected"; fi
if validate_totals 1 0 0; then fail "zero-assertion aggregate rejected"; else pass "zero-assertion aggregate rejected"; fi
if validate_totals 1 1 1; then fail "aggregate with failure rejected"; else pass "aggregate with failure rejected"; fi

if list_files >"$TMP/files"; then
  pass "list_files returns success"
else
  fail "list_files returns success"
fi
grep -Fxq "$RUNNER" "$TMP/files" && pass "list_files includes runner" || fail "list_files includes runner"
grep -Fxq "$HERE/run-release-automation-selftests.selftest.sh" "$TMP/files" \
  && pass "list_files includes runner self-test" || fail "list_files includes runner self-test"

echo
echo "== results: $passed passed, $failed failed =="
((failed == 0))
