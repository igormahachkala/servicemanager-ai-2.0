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
{"branch":"beta","protected":true,"enforce_admins":{"enabled":true},"required_pull_request_reviews":{"required_approving_review_count":0,"require_code_owner_reviews":false},"required_status_checks":{"checks":[{"context":"Shell quality","app_id":15368},{"context":"A1-A7 self-tests","app_id":15368},{"context":"Protocol regression","app_id":15368},{"context":"A4 Prisma integration","app_id":15368},{"context":"Release lane gate","app_id":15368},{"context":"Independent technical review","app_id":42},{"context":"Stage admission","app_id":15368}]},"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
JSON
cat >"$TMP/prod.json" <<'JSON'
{"branch":"prod","protected":true,"enforce_admins":{"enabled":true},"required_pull_request_reviews":{"required_approving_review_count":0,"require_code_owner_reviews":false},"required_status_checks":{"checks":[{"context":"Shell quality","app_id":15368},{"context":"A1-A7 self-tests","app_id":15368},{"context":"Protocol regression","app_id":15368},{"context":"A4 Prisma integration","app_id":15368},{"context":"Release lane gate","app_id":15368},{"context":"Independent technical review","app_id":42},{"context":"Production admission","app_id":15368}]},"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
JSON
cat >"$TMP/rulesets.json" <<'JSON'
[{"enforcement":"active","tags":["stage-busy","prod-busy","stage-ok/*"],"lock_tags_protected":true,"bypass_actors":[]}]
JSON
cat >"$TMP/environments.json" <<'JSON'
{"production":{"required_reviewers":1,"deployment_branch_policy":"prod-only"},"release-governance":{"required_reviewers":0,"can_admins_bypass":false,"protected_refs":["beta","prod"]}}
JSON
if "$HERE/release-lane-governance.sh" --fixture "$TMP" >"$TMP/out" 2>&1; then pass "complete governance policy accepted"; else fail "complete governance policy accepted"; fi
if "$HERE/release-lane-governance.sh" --mode pre --fixture "$TMP" >"$TMP/out" 2>&1; then pass "pre-enforcement readiness accepted"; else fail "pre-enforcement readiness accepted"; fi
python3 - "$TMP/beta.json" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d["protected"]=False; json.dump(d,open(p,"w"))
PY
set +e; "$HERE/release-lane-governance.sh" --fixture "$TMP" >"$TMP/out" 2>&1; rc=$?; set -e
if ((rc != 0)); then pass "unprotected beta rejected"; else fail "unprotected beta rejected"; fi
python3 - "$TMP/beta.json" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d["protected"]=True; d["required_status_checks"]["checks"][5]["app_id"] = 0; json.dump(d,open(p,"w"))
PY
set +e; "$HERE/release-lane-governance.sh" --mode post --fixture "$TMP" >"$TMP/out" 2>&1; rc=$?; set -e
if ((rc != 0)); then pass "spoofed required check source rejected"; else fail "spoofed required check source rejected"; fi
workflow="$HERE/../../../.github/workflows/release-lane-gate.yml"
if grep -Fq 'MODE: verify' "$workflow" && ! grep -Fq 'stage-busy' "$workflow"; then
  pass "ordinary PR verification has no release-lock dependency"
else
  fail "ordinary PR verification has no release-lock dependency"
fi
if grep -Fq 'pull_request_target:' "$workflow" \
  && grep -Fq 'ref: ${{ github.event.repository.default_branch }}' "$workflow" \
  && grep -Fq 'persist-credentials: false' "$workflow" \
  && grep -Fq 'environment: release-governance' "$workflow" \
  && grep -Fq 'secrets.RELEASE_GATE_APP_PRIVATE_KEY' "$workflow" \
  && ! grep -Eq '^[[:space:]]*(ssh|scp)[[:space:]]' "$workflow"; then
  pass "trusted gate uses default-branch code and protected App identity"
else
  fail "trusted gate trust boundary"
fi
echo "== results: $passed passed, $failed failed =="; ((failed == 0))
