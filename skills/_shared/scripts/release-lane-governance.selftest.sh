#!/usr/bin/env bash
# Fixture-only governance tests; no GitHub settings or live repository access.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-governance-selftest.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0; failed=0
pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }
cat >"$TMP/beta.json" <<'JSON'
{"protected":true,"enforce_admins":{"enabled":true},"required_pull_request_reviews":{"required_approving_review_count":1,"require_code_owner_reviews":true},"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
JSON
cp "$TMP/beta.json" "$TMP/prod.json"
cat >"$TMP/rulesets.json" <<'JSON'
[{"enforcement":"active","branches":["beta","prod"],"required_status_check":"release-lane-gate","trusted_check_source":{"context":"Release lane gate","integration_id":12345},"bypass_actors":[]},{"enforcement":"active","tags":["stage-busy","prod-busy","stage-ok/*"],"lock_tags_protected":true}]
JSON
cat >"$TMP/environments.json" <<'JSON'
{"production":{"required_reviewers":1,"deployment_branch_policy":"prod-only"}}
JSON
if "$HERE/release-lane-governance.sh" --fixture "$TMP" >"$TMP/out" 2>&1; then pass "complete governance policy accepted"; else fail "complete governance policy accepted"; fi
if "$HERE/release-lane-governance.sh" --mode pre --fixture "$TMP" >"$TMP/out" 2>&1; then pass "pre-enforcement readiness accepted"; else fail "pre-enforcement readiness accepted"; fi
python3 - "$TMP/beta.json" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d["protected"]=False; json.dump(d,open(p,"w"))
PY
set +e; "$HERE/release-lane-governance.sh" --fixture "$TMP" >"$TMP/out" 2>&1; rc=$?; set -e
if ((rc != 0)); then pass "unprotected beta rejected"; else fail "unprotected beta rejected"; fi
python3 - "$TMP/rulesets.json" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d[0]["trusted_check_source"]["integration_id"] = 0; json.dump(d,open(p,"w"))
PY
set +e; "$HERE/release-lane-governance.sh" --mode post --fixture "$TMP" >"$TMP/out" 2>&1; rc=$?; set -e
if ((rc != 0)); then pass "spoofed required check source rejected"; else fail "spoofed required check source rejected"; fi
workflow="$HERE/../../../.github/workflows/release-lane-gate.yml"
if grep -Fq ': >"$tmp/prod-lock.json"' "$workflow" \
  && grep -Fq ': >"$tmp/prod-lock-final.json"' "$workflow" \
  && bash -c 'd=$(mktemp -d); trap "rm -rf "$d"" EXIT; : >"$d/prod-lock.json"; : >"$d/prod-lock-final.json"; test -e "$d/prod-lock-final.json"'; then
  pass "beta workflow path materializes both lock metadata files"
else
  fail "beta workflow path materializes both lock metadata files"
fi
sed -n '/# BEGIN RELEASE_LANE_LOCK_FETCH/,/# END RELEASE_LANE_LOCK_FETCH/p' "$workflow" \
  | sed 's/^          //' >"$TMP/lock-fetch.sh"
if grep -Fq 'fetch_required_lock_tag()' "$TMP/lock-fetch.sh" \
  && grep -Fq 'fetch_required_lock_tag stage-busy' "$workflow" \
  && grep -Fq 'fetch_required_lock_tag prod-busy' "$workflow"; then
  pass "trusted workflow embeds controlled lock acquisition"
else
  fail "trusted workflow embeds controlled lock acquisition"
fi

LOCK_WORK="$TMP/lock-work"
LOCK_REMOTE="$TMP/lock-remote.git"
git init -q "$LOCK_WORK"
git -C "$LOCK_WORK" config user.name "Release Lane Workflow Self-Test"
git -C "$LOCK_WORK" config user.email release-lane-workflow-selftest@example.invalid
printf 'fixture\n' >"$LOCK_WORK/fixture.txt"
git -C "$LOCK_WORK" add fixture.txt
git -C "$LOCK_WORK" commit -qm fixture
git -C "$LOCK_WORK" clone -q --bare . "$LOCK_REMOTE"
git -C "$LOCK_WORK" remote add origin "$LOCK_REMOTE"
run_lock_fetch() { (cd "$LOCK_WORK" && source "$TMP/lock-fetch.sh" && fetch_required_lock_tag "$1"); }
expect_lock_failure() {
  local label="$1" tag="$2" reason="$3" rc
  set +e; run_lock_fetch "$tag" >"$TMP/lock.out" 2>&1; rc=$?; set -e
  if ((rc != 0)) && grep -Fq "$reason" "$TMP/lock.out"; then pass "$label"; else fail "$label"; fi
}
expect_lock_failure "missing stage-busy is denied clearly" stage-busy "stage-busy is missing"
git -C "$LOCK_WORK" tag -a stage-busy -m "fixture stage lock"
git -C "$LOCK_WORK" push -q origin refs/tags/stage-busy
if run_lock_fetch stage-busy >"$TMP/lock.out" 2>&1; then pass "annotated stage-busy is fetched"; else fail "annotated stage-busy is fetched"; fi
git -C "$LOCK_WORK" tag prod-busy
git -C "$LOCK_WORK" push -q origin refs/tags/prod-busy
expect_lock_failure "lightweight prod-busy is denied" prod-busy "prod-busy is not an annotated tag"
if grep -Fq 'pull_request_target:' "$workflow" \
  && grep -Fq 'ref: ${{ github.event.pull_request.base.ref }}' "$workflow" \
  && grep -Fq 'persist-credentials: false' "$workflow" \
  && ! grep -Eq 'secrets\.|^[[:space:]]*environment:|^[[:space:]]*(ssh|scp)[[:space:]]' "$workflow"; then
  pass "trusted gate uses base-only checkout without secrets or deploy"
else
  fail "trusted gate trust boundary"
fi
echo "== results: $passed passed, $failed failed =="; ((failed == 0))
