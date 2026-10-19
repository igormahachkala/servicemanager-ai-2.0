#!/usr/bin/env bash
set -euo pipefail
usage() { echo "Usage: $0 [--mode pre|post] --fixture DIR | [--mode pre|post] --repo OWNER/REPO" >&2; }
mode_check=post
if [[ "${1:-}" == --mode ]]; then mode_check="${2:-}"; shift 2; fi
mode="${1:-}"; value="${2:-}"
[[ "$mode_check" == pre || "$mode_check" == post ]] || { usage; exit 2; }
[[ "$mode" == --fixture || "$mode" == --repo ]] && [[ -n "$value" ]] || { usage; exit 2; }
if [[ "$mode" == --fixture ]]; then
  [[ -f "$value/beta.json" && -f "$value/prod.json" && -f "$value/rulesets.json" && -f "$value/environments.json" ]] || { echo "BLOCKED missing governance fixture" >&2; exit 1; }
  python3 - "$value" "$mode_check" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1]); mode = sys.argv[2]
beta = json.loads((root / "beta.json").read_text()); prod = json.loads((root / "prod.json").read_text())
rules = json.loads((root / "rulesets.json").read_text()); env = json.loads((root / "environments.json").read_text())
def protected(d, branch_name):
    assert d.get("protected") is True
    assert d.get("enforce_admins", {}).get("enabled") is True
    reviews = d.get("required_pull_request_reviews") or {}
    assert reviews.get("required_approving_review_count", 0) == 0
    assert reviews.get("require_code_owner_reviews") is False
    assert d.get("allow_force_pushes") is False and d.get("allow_deletions") is False
    checks = {c.get("context"): c.get("app_id", 0) for c in (d.get("required_status_checks") or {}).get("checks", [])}
    expected = {"Shell quality", "A1-A7 self-tests", "Protocol regression", "A4 Prisma integration",
                "Release lane gate", "Independent technical review"}
    expected.add("Stage admission" if branch_name == "beta" else "Production admission")
    assert expected <= set(checks) and all(checks[name] > 0 for name in expected)
tags = next((r for r in rules if r.get("enforcement") == "active" and set(r.get("tags", [])) >= {"stage-busy", "prod-busy", "stage-ok/*"}), None)
assert tags and tags.get("lock_tags_protected") is True and tags.get("bypass_actors", []) == []
p = env.get("production", {})
assert p.get("required_reviewers", 0) >= 1 and p.get("deployment_branch_policy") == "prod-only"
g = env.get("release-governance", {})
assert g.get("required_reviewers", -1) == 0 and g.get("can_admins_bypass") is False
assert set(g.get("protected_refs", [])) >= {"beta", "prod"}
if mode == "post": protected(beta, "beta"); protected(prod, "prod")
print(f"GOVERNANCE: PASS ({mode})")
PY
  exit $?
fi
command -v gh >/dev/null || { echo "BLOCKED gh CLI is required for live read-only inspection" >&2; exit 1; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/release-governance.XXXXXX"); trap 'rm -rf "$tmp"' EXIT
gh api "repos/$value/branches/beta/protection" >"$tmp/beta.json"
gh api "repos/$value/branches/prod/protection" >"$tmp/prod.json"
gh api "repos/$value/rulesets" >"$tmp/rulesets.json"
gh api "repos/$value/environments/production" >"$tmp/production.json"
gh api "repos/$value/environments/release-governance" >"$tmp/release-governance.json"
python3 - "$tmp" "$mode_check" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1]); mode = sys.argv[2]
beta = json.loads((root / "beta.json").read_text()); prod = json.loads((root / "prod.json").read_text())
rules = json.loads((root / "rulesets.json").read_text())
prod_env = json.loads((root / "production.json").read_text())
governance_env = json.loads((root / "release-governance.json").read_text())
def protected(d, branch_name):
    assert d.get("protected") is True and d.get("enforce_admins", {}).get("enabled") is True
    reviews = d.get("required_pull_request_reviews") or {}
    assert reviews.get("required_approving_review_count", 0) == 0 and reviews.get("require_code_owner_reviews") is False
    assert d.get("allow_force_pushes") is False and d.get("allow_deletions") is False
    checks = {c.get("context"): c.get("app_id", 0) for c in (d.get("required_status_checks") or {}).get("checks", [])}
    expected = {"Shell quality", "A1-A7 self-tests", "Protocol regression", "A4 Prisma integration",
                "Release lane gate", "Independent technical review"}
    expected.add("Stage admission" if branch_name == "beta" else "Production admission")
    assert expected <= set(checks) and all(checks[name] > 0 for name in expected)
if mode == "post": protected(beta, "beta"); protected(prod, "prod")
tags = next((r for r in rules if r.get("enforcement") == "active" and r.get("target") == "tag"), None)
if mode == "post":
    assert tags
    tag_includes = set((tags.get("conditions") or {}).get("ref_name", {}).get("include", []))
    assert {"refs/tags/stage-busy", "refs/tags/prod-busy", "refs/tags/stage-ok/*"} <= tag_includes
    assert any(r.get("type") in {"deletion", "update", "creation"} for r in tags.get("rules", [])) and not tags.get("bypass_actors")
assert any(r.get("type") == "required_reviewers" for r in prod_env.get("protection_rules", []))
assert prod_env.get("can_admins_bypass") is False
assert governance_env.get("can_admins_bypass") is False
assert not any(r.get("type") == "required_reviewers" for r in governance_env.get("protection_rules", []))
print(f"GOVERNANCE: PASS ({mode})")
PY
