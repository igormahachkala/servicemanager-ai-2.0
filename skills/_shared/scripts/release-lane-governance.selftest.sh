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
[{"enforcement":"active","branches":["beta","prod"],"required_status_check":"release-lane-gate"},{"enforcement":"active","tags":["stage-busy","prod-busy","stage-ok/*"]}]
JSON
cat >"$TMP/environments.json" <<'JSON'
{"production":{"required_reviewers":1,"deployment_branch_policy":"prod-only"}}
JSON
if "$HERE/release-lane-governance.sh" --fixture "$TMP" >"$TMP/out" 2>&1; then pass "complete governance policy accepted"; else fail "complete governance policy accepted"; fi
python3 - "$TMP/beta.json" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d["protected"]=False; json.dump(d,open(p,"w"))
PY
set +e; "$HERE/release-lane-governance.sh" --fixture "$TMP" >"$TMP/out" 2>&1; rc=$?; set -e
if ((rc != 0)) && grep -q 'FAIL beta protection' "$TMP/out"; then pass "unprotected beta rejected"; else fail "unprotected beta rejected"; fi
workflow="$HERE/../../../.github/workflows/release-lane-gate.yml"
if grep -Fq 'pull_request_target:' "$workflow" \
  && grep -Fq 'ref: ${{ github.event.pull_request.base.ref }}' "$workflow" \
  && grep -Fq 'persist-credentials: false' "$workflow" \
  && ! grep -Eq 'secrets\.|^[[:space:]]*environment:|^[[:space:]]*(ssh|scp)[[:space:]]' "$workflow"; then
  pass "trusted gate uses base-only checkout without secrets or deploy"
else
  fail "trusted gate trust boundary"
fi
echo "== results: $passed passed, $failed failed =="; ((failed == 0))
