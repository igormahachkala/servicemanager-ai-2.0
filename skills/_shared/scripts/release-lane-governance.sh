#!/usr/bin/env bash
# Read-only governance policy checker. It never changes GitHub settings.
set -euo pipefail
usage() { echo "Usage: $0 --fixture DIR | --repo OWNER/REPO" >&2; }
MODE="${1:-}"; VALUE="${2:-}"
[[ "$MODE" == --fixture || "$MODE" == --repo ]] && [[ -n "$VALUE" ]] || { usage; exit 2; }
failed=0
check() { local label="$1"; shift; if "$@"; then echo "PASS $label"; else echo "FAIL $label" >&2; failed=$((failed + 1)); fi; }

if [[ "$MODE" == --fixture ]]; then
  [[ -f "$VALUE/beta.json" && -f "$VALUE/prod.json" && -f "$VALUE/rulesets.json" && -f "$VALUE/environments.json" ]] || { echo "BLOCKED missing governance fixture" >&2; exit 1; }
  check "beta protection" python3 - "$VALUE/beta.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1])); assert d["protected"] is True
assert d["enforce_admins"]["enabled"] is True
assert d["required_pull_request_reviews"]["required_approving_review_count"] >= 1
assert d["required_pull_request_reviews"]["require_code_owner_reviews"] is True
assert d["restrictions"] is None
assert d["allow_force_pushes"] is False and d["allow_deletions"] is False
PY
  check "prod protection" python3 - "$VALUE/prod.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1])); assert d["protected"] is True
assert d["enforce_admins"]["enabled"] is True
assert d["required_pull_request_reviews"]["required_approving_review_count"] >= 1
assert d["required_pull_request_reviews"]["require_code_owner_reviews"] is True
assert d["allow_force_pushes"] is False and d["allow_deletions"] is False
PY
  check "active release ruleset" python3 - "$VALUE/rulesets.json" <<'PY'
import json, sys
rules=json.load(open(sys.argv[1]))
assert any(r.get("enforcement") == "active" and set(r.get("branches", [])) >= {"beta", "prod"} and r.get("required_status_check") == "release-lane-gate" for r in rules)
assert any(r.get("enforcement") == "active" and set(r.get("tags", [])) >= {"stage-busy", "prod-busy", "stage-ok/*"} for r in rules)
PY
  check "deployment environment protection" python3 - "$VALUE/environments.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1])); assert d.get("production", {}).get("required_reviewers", 0) >= 1
assert d.get("production", {}).get("deployment_branch_policy") == "prod-only"
PY
else
  command -v gh >/dev/null || { echo "BLOCKED gh CLI is required for live read-only inspection" >&2; exit 1; }
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/release-governance.XXXXXX"); trap 'rm -rf "$tmp"' EXIT
  gh api "repos/$VALUE/branches/beta/protection" >"$tmp/beta.json"
  gh api "repos/$VALUE/branches/prod/protection" >"$tmp/prod.json"
  gh api "repos/$VALUE/rulesets" >"$tmp/rulesets.json"
  gh api "repos/$VALUE/environments/production" >"$tmp/environment.json" || :
  python3 - "$tmp/beta.json" "$tmp/prod.json" "$tmp/rulesets.json" "$tmp/environment.json" <<'PY'
import json, sys
beta, prod, rules, env = [json.load(open(path)) for path in sys.argv[1:]]
def protected(data):
    assert data.get("protected") is True
    assert data.get("enforce_admins", {}).get("enabled") is True
    reviews = data.get("required_pull_request_reviews") or {}
    assert reviews.get("required_approving_review_count", 0) >= 1
    assert reviews.get("require_code_owner_reviews") is True
    assert data.get("allow_force_pushes") is False and data.get("allow_deletions") is False
protected(beta); protected(prod)
branch_refs = {"refs/heads/beta", "refs/heads/prod"}
tag_refs = {"refs/tags/stage-busy", "refs/tags/prod-busy", "refs/tags/stage-ok/*"}
branch_gate = False; tag_gate = False
for ruleset in rules:
    if ruleset.get("enforcement") != "active": continue
    includes = set((ruleset.get("conditions") or {}).get("ref_name", {}).get("include", []))
    rule_types = {r.get("type") for r in ruleset.get("rules", [])}
    if ruleset.get("target") == "branch" and branch_refs <= includes and "required_status_checks" in rule_types:
        branch_gate = True
    if ruleset.get("target") == "tag" and tag_refs <= includes:
        tag_gate = True
assert branch_gate and tag_gate
assert env.get("protection_rules", {}).get("required_reviewers")
assert env.get("deployment_branch_policy", {}).get("protected_branches") is True
print("GOVERNANCE: PASS")
PY
  exit $?
fi
((failed == 0)) || { echo "GOVERNANCE: BLOCKED ($failed failed checks)" >&2; exit 1; }
echo "GOVERNANCE: PASS"
