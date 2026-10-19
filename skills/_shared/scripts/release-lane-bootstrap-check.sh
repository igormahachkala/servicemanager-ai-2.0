#!/usr/bin/env bash
# Read-only bootstrap preflight for installing the trusted gate in a base ref.
set -euo pipefail
[ "$#" -eq 1 ] || { echo "Usage: $0 BASE_WORKTREE" >&2; exit 2; }
BASE="$1"
WORKFLOW="$BASE/.github/workflows/release-lane-gate.yml"
GATE="$BASE/skills/_shared/scripts/release-lane-gate.sh"
[ -f "$WORKFLOW" ] || { echo "BOOTSTRAP: BLOCKED - trusted workflow missing in base" >&2; exit 1; }
[ -x "$GATE" ] || { echo "BOOTSTRAP: BLOCKED - trusted gate missing or not executable in base" >&2; exit 1; }
grep -Fq 'pull_request_target:' "$WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - trusted trigger missing" >&2; exit 1; }
grep -Fq 'ref: ${{ github.event.pull_request.base.ref }}' "$WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - workflow does not checkout trusted base" >&2; exit 1; }
grep -Fq 'persist-credentials: false' "$WORKFLOW" || { echo "BOOTSTRAP: BLOCKED - checkout credentials are not disabled" >&2; exit 1; }
if grep -Eq 'secrets\.|^[[:space:]]*environment:|^[[:space:]]*(ssh|scp)[[:space:]]|docker compose|prisma migrate|seed:' "$WORKFLOW"; then
  echo "BOOTSTRAP: BLOCKED - privileged action found in trusted workflow" >&2
  exit 1
fi
echo "BOOTSTRAP: READY - trusted workflow is present in base and safe to enable"
