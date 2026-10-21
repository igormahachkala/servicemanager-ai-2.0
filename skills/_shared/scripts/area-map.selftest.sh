#!/usr/bin/env bash
# Regression tests for exact Release Automation CI path classification.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
AREA_MAP="$HERE/area-map.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/area-map.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

passed=0
failed=0
pass() { echo "  PASS $1"; passed=$((passed + 1)); }
fail() { echo "  FAIL $1"; failed=$((failed + 1)); }

expect_contains() {
  local label="$1" needle="$2" file="$3"
  if grep -Fq "$needle" "$file"; then pass "$label"; else fail "$label"; fi
}

repo="$TMP/repo"
mkdir -p "$repo"
git -C "$repo" init -q
git -C "$repo" config user.name "Area Map Self-Test"
git -C "$repo" config user.email "area-map-selftest@example.invalid"
printf 'base\n' >"$repo/README"
git -C "$repo" add README
git -C "$repo" commit -qm base
base=$(git -C "$repo" rev-parse HEAD)
git -C "$repo" update-ref refs/remotes/origin/prod "$base"

git -C "$repo" switch -qc approved
mkdir -p "$repo/.github/workflows"
printf '* @owner\n' >"$repo/.github/CODEOWNERS"
printf 'name: release automation\n' >"$repo/.github/workflows/release-automation-ci.yml"
printf 'name: trusted release lane gate\n' >"$repo/.github/workflows/release-lane-gate.yml"
git -C "$repo" add .github
git -C "$repo" commit -qm approved

set +e
(cd "$repo" && "$AREA_MAP" approved) >"$TMP/approved.out" 2>&1
approved_rc=$?
set -e
if ((approved_rc == 0)); then pass "exact CI paths accepted"; else fail "exact CI paths accepted"; fi
expect_contains "exact CI paths classified as skills" "areas: skills" "$TMP/approved.out"
expect_contains "exact CI paths do not request rebuild" "flags:" "$TMP/approved.out"

git -C "$repo" switch -q --detach "$base"
git -C "$repo" switch -qc unapproved
mkdir -p "$repo/.github/workflows"
printf 'name: unapproved\n' >"$repo/.github/workflows/unapproved.yml"
printf 'version: 2\n' >"$repo/.github/dependabot.yml"
git -C "$repo" add .github
git -C "$repo" commit -qm unapproved

set +e
(cd "$repo" && "$AREA_MAP" unapproved) >"$TMP/unapproved.out" 2>&1
unapproved_rc=$?
set -e
if ((unapproved_rc == 0)); then pass "unknown paths do not stop"; else fail "unknown paths do not stop (rc=$unapproved_rc)"; fi
if grep -Fq "Остановиться и спросить пользователя" "$TMP/unapproved.out"; then
  fail "unknown path does not ask"
else
  pass "unknown path does not ask"
fi
if grep -Fq ".github/workflows/unapproved.yml" "$TMP/unapproved.out" || grep -Fq ".github/dependabot.yml" "$TMP/unapproved.out"; then
  fail "unknown path is not printed"
else
  pass "unknown path is not printed"
fi
expect_contains "unknown path still prints areas" "areas:" "$TMP/unapproved.out"

git -C "$repo" switch -q --detach "$base"
git -C "$repo" switch -qc runner
mkdir -p "$repo/agent-runner"
printf 'x\n' >"$repo/agent-runner/x.js"
git -C "$repo" add agent-runner
git -C "$repo" commit -qm runner

set +e
(cd "$repo" && "$AREA_MAP" runner) >"$TMP/runner.out" 2>&1
runner_rc=$?
set -e
if ((runner_rc == 0)); then pass "agent-runner path accepted"; else fail "agent-runner path accepted (rc=$runner_rc)"; fi
expect_contains "agent-runner area kept" "areas: agent-runner" "$TMP/runner.out"

echo
echo "== results: $passed passed, $failed failed =="
((failed == 0))
