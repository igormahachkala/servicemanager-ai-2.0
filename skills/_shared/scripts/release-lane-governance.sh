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
  gh api "repos/$VALUE/environments" >"$tmp/environments.json"
  "$0" --fixture "$tmp"; exit $?
fi
((failed == 0)) || { echo "GOVERNANCE: BLOCKED ($failed failed checks)" >&2; exit 1; }
echo "GOVERNANCE: PASS"
