#!/usr/bin/env bash
# Read-only bootstrap preflight for installing the trusted gate in a base ref.
set -euo pipefail
[ "$#" -eq 1 ] || { echo "Usage: $0 BASE_WORKTREE" >&2; exit 2; }
BASE="$1"
WORKFLOW="$BASE/.github/workflows/release-lane-gate.yml"
STAGE_WORKFLOW="$BASE/.github/workflows/release-stage-admission.yml"
PROD_WORKFLOW="$BASE/.github/workflows/release-production-admission.yml"
GATE="$BASE/skills/_shared/scripts/release-gate-v2.sh"
ADAPTER="$BASE/skills/_shared/scripts/release-gate-v2-github.sh"
[ -f "$WORKFLOW" ] || { echo "BOOTSTRAP: BLOCKED - trusted workflow missing in base" >&2; exit 1; }
[ -f "$STAGE_WORKFLOW" ] && [ -f "$PROD_WORKFLOW" ] || { echo "BOOTSTRAP: BLOCKED - admission workflows missing in base" >&2; exit 1; }
[ -x "$GATE" ] && [ -x "$ADAPTER" ] || { echo "BOOTSTRAP: BLOCKED - trusted V2 gate or adapter missing in base" >&2; exit 1; }
grep -Fq 'pull_request_target:' "$WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - trusted trigger missing" >&2; exit 1; }
grep -Fq 'ref: ${{ github.event.repository.default_branch }}' "$WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - workflow does not checkout trusted default branch" >&2; exit 1; }
grep -Fq 'persist-credentials: false' "$WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - checkout credentials are not disabled" >&2; exit 1; }
grep -Fq 'environment: release-governance' "$WORKFLOW" && grep -Fq 'environment: release-governance' "$STAGE_WORKFLOW" \
  || { echo "BOOTSTRAP: BLOCKED - release-governance environment is not required" >&2; exit 1; }
grep -Fq 'actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349' "$WORKFLOW" \
  || { echo "BOOTSTRAP: BLOCKED - source-bound Release Gate App token is missing" >&2; exit 1; }
if grep -Eq '^[[:space:]]*(ssh|scp)[[:space:]]|docker compose|prisma migrate|seed:' "$WORKFLOW" "$STAGE_WORKFLOW"; then
  echo "BOOTSTRAP: BLOCKED - privileged action found in trusted workflow" >&2
  exit 1
fi
grep -Fq 'environment: production' "$PROD_WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - Production environment is not required" >&2; exit 1; }
if grep -E 'secrets\.' "$WORKFLOW" "$STAGE_WORKFLOW" "$PROD_WORKFLOW" | grep -Fv 'secrets.RELEASE_GATE_APP_PRIVATE_KEY' >/dev/null; then
  echo "BOOTSTRAP: BLOCKED - unexpected secret reference found" >&2
  exit 1
fi
if grep -Eq '^[[:space:]]*(ssh|scp)[[:space:]]|docker compose|prisma migrate|seed:' "$PROD_WORKFLOW"; then
  echo "BOOTSTRAP: BLOCKED - privileged action found in Production admission workflow" >&2
  exit 1
fi
echo "BOOTSTRAP: READY - trusted workflow is present in base and safe to enable"
