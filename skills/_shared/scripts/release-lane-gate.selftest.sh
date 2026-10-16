#!/usr/bin/env bash
# Offline adversarial tests for the trusted release-lane gate.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GATE="$HERE/release-lane-gate.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-lane-gate.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0; failed=0
pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }
run_gate() { (cd "$WORK" && "$GATE" "$@"); }
expect_pass() {
  local label="$1"; shift
  if run_gate "$@" >"$TMP/out" 2>&1; then pass "$label"; else fail "$label"; sed 's/^/  /' "$TMP/out" >&2; fi
}
expect_fail() {
  local label="$1" reason="$2"; shift 2
  set +e; run_gate "$@" >"$TMP/out" 2>&1; local rc=$?; set -e
  if ((rc != 0)) && grep -Eiq "$reason" "$TMP/out" && ! grep -q 'RELEASE LANE: PASS' "$TMP/out"; then pass "$label"; else fail "$label (rc=$rc)"; sed 's/^/  /' "$TMP/out" >&2; fi
}
new_tag() {
  local tag="$1" message="$2" target="${3:-HEAD}"
  git -C "$WORK" tag -a -f "$tag" "$target" -m "$message" >/dev/null
  git -C "$WORK" push -q -f origin "refs/tags/$tag"
}
new_stage_tag() {
  local candidate="$1" stage="$2" msg
  printf -v msg 'Stage accepted\n\nbranch: feat/release-lane-fixture\nbranch_sha: %s\nstage_sha: %s' "$candidate" "$stage"
  new_tag "stage-ok/feat/release-lane-fixture" "$msg"
}

WORK="$TMP/work"; REMOTE="$TMP/remote.git"
git init -q "$WORK"
git -C "$WORK" config user.name "Release Lane Self-Test"
git -C "$WORK" config user.email release-lane-selftest@example.invalid
printf 'base\n' >"$WORK/fixture.txt"; git -C "$WORK" add fixture.txt; git -C "$WORK" commit -qm base
git -C "$WORK" branch -M prod; PROD_SHA=$(git -C "$WORK" rev-parse HEAD)
git -C "$WORK" switch -qc beta; git -C "$WORK" switch -qc feat/release-lane-fixture "$PROD_SHA"
printf 'candidate\n' >>"$WORK/fixture.txt"; git -C "$WORK" commit -qam candidate
CANDIDATE_SHA=$(git -C "$WORK" rev-parse HEAD); git -C "$WORK" branch -f beta "$CANDIDATE_SHA"
git -C "$WORK" clone -q --bare . "$REMOTE"; git -C "$WORK" remote add origin "$REMOTE"; git -C "$WORK" push -q origin prod beta feat/release-lane-fixture
new_tag stage-busy $'Release lock\n\nbranch: feat/release-lane-fixture\npr: 7'
new_tag prod-busy $'Release lock\n\nbranch: feat/release-lane-fixture\npr: 7'
new_stage_tag "$CANDIDATE_SHA" "$PROD_SHA"

expect_pass "valid beta release" beta feat/release-lane-fixture "$CANDIDATE_SHA" 7 --remote origin
expect_pass "valid production release" production feat/release-lane-fixture "$CANDIDATE_SHA" 7 --remote origin
new_tag stage-busy $'Release lock\n\nbranch: other/release\npr: 8'
expect_fail "#360 foreign lock rejected" 'stage-busy is owned by another' beta feat/release-lane-fixture "$CANDIDATE_SHA" 7 --remote origin
new_tag stage-busy $'Release lock\n\nbranch: feat/release-lane-fixture\npr: 7'
git -C "$WORK" push -q -d origin prod-busy
expect_fail "missing lock" 'prod-busy is missing' production feat/release-lane-fixture "$CANDIDATE_SHA" 7 --remote origin
new_tag prod-busy $'Release lock\n\nbranch: feat/release-lane-fixture\npr: 7'
expect_fail "wrong candidate" 'remote head does not match' beta feat/release-lane-fixture "$PROD_SHA" 7 --remote origin
new_tag "stage-ok/feat/release-lane-fixture" "Stale Stage" "$PROD_SHA"
expect_fail "stale stage-ok" 'stage-ok does not identify' production feat/release-lane-fixture "$CANDIDATE_SHA" 7 --remote origin
expect_fail "direct push rejected" 'direct push is not an admitted' beta feat/release-lane-fixture "$CANDIDATE_SHA" 7 --event push --remote origin

# Same-branch follow-up keeps the lock owner while moving the candidate tip.
printf 'follow-up\n' >>"$WORK/fixture.txt"; git -C "$WORK" commit -qam follow-up
FOLLOWUP_SHA=$(git -C "$WORK" rev-parse HEAD); git -C "$WORK" push -q origin HEAD:refs/heads/feat/release-lane-fixture; git -C "$WORK" push -q origin HEAD:refs/heads/beta
expect_pass "same-branch beta follow-up" beta feat/release-lane-fixture "$FOLLOWUP_SHA" 7 --remote origin
expect_fail "follow-up needs fresh stage-ok" 'stage-ok does not identify' production feat/release-lane-fixture "$FOLLOWUP_SHA" 7 --remote origin
new_stage_tag "$FOLLOWUP_SHA" "$FOLLOWUP_SHA"
expect_pass "same-branch production follow-up" production feat/release-lane-fixture "$FOLLOWUP_SHA" 7 --remote origin

echo "== results: $passed passed, $failed failed =="; ((failed == 0))
