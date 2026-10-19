#!/usr/bin/env bash
# Exercises the trusted GitHub adapter with a local remote and a fake read-only API.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ADAPTER="$HERE/release-gate-v2-github.sh"
ROOT="$HERE/../../.."
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-gate-v2-workflow.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0; failed=0
pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }

expect_pass() {
  local label="$1"; shift
  if "$@" >"$TMP/out" 2>&1; then pass "$label"; else fail "$label"; sed 's/^/  /' "$TMP/out" >&2; fi
}
expect_fail() {
  local label="$1" reason="$2" rc; shift 2
  set +e; "$@" >"$TMP/out" 2>&1; rc=$?; set -e
  if ((rc != 0)) && grep -Eiq "$reason" "$TMP/out"; then pass "$label"; else fail "$label"; sed 's/^/  /' "$TMP/out" >&2; fi
}

WORK="$TMP/work"; REMOTE="$TMP/remote.git"; API="$TMP/api"; BIN="$TMP/bin"; CHECKS="$TMP/checks"
mkdir -p "$API" "$BIN" "$CHECKS"
git init -q "$WORK"
git -C "$WORK" config user.name "V2 Workflow Test"
git -C "$WORK" config user.email v2-workflow@example.invalid
printf 'base\n' >"$WORK/fixture"; git -C "$WORK" add fixture; git -C "$WORK" commit -qm base
git -C "$WORK" branch -M prod; PROD=$(git -C "$WORK" rev-parse HEAD)
git -C "$WORK" branch beta; git -C "$WORK" switch -qc feat/v2
printf 'candidate\n' >>"$WORK/fixture"; git -C "$WORK" commit -qam candidate
HEAD=$(git -C "$WORK" rev-parse HEAD)
git -C "$WORK" clone -q --bare . "$REMOTE"; git -C "$WORK" remote add origin "$REMOTE"
git -C "$WORK" push -q origin prod beta feat/v2

python3 - "$API" "$PROD" "$HEAD" <<'PY'
import json, pathlib, sys
p, base, head = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
def meta(number):
    return {"number":number,"base":{"ref":"beta","sha":base,"repo":{"full_name":"owner/repo"}},
            "head":{"ref":"feat/v2","sha":head,"repo":{"full_name":"owner/repo"}},"merge_commit_sha":head}
json.dump(meta(8), open(p/"pr-8.json","w")); json.dump(meta(7), open(p/"pr-7.json","w"))
run={"name":"Independent technical review","head_sha":head,"status":"completed","conclusion":"success","app":{"id":42}}
json.dump({"total_count":1,"check_runs":[run]}, open(p/"review.json","w"))
PY

cat >"$BIN/gh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "${FAKE_NETWORK_FAIL:-0}" != 1 ]] || { echo "simulated API unavailable" >&2; exit 75; }
endpoint= input= method=GET
while (($#)); do
  case "$1" in
    --method) method="$2"; shift 2 ;;
    --input) input="$2"; shift 2 ;;
    repos/*) endpoint="$1"; shift ;;
    *) shift ;;
  esac
done
if [[ "$method" == POST ]]; then
  cp "$input" "$FAKE_CHECK_DIR/check-$RANDOM-$(date +%s%N).json"
  echo '{}'; exit 0
fi
case "$endpoint" in
  */pulls/8) cat "$FAKE_API_DIR/pr-8.json" ;;
  */pulls/7) cat "$FAKE_API_DIR/pr-7.json" ;;
  */check-runs*) cat "$FAKE_API_DIR/review.json" ;;
  *) exit 64 ;;
esac
SH
chmod +x "$BIN/gh"

adapter() {
  (cd "$WORK" && env PATH="$BIN:$PATH" FAKE_API_DIR="$API" FAKE_CHECK_DIR="$CHECKS" \
    GH_TOKEN=test MODE="$1" PR_NUMBER=8 REPOSITORY=owner/repo REVIEW_APP_ID=42 \
    GITHUB_SERVER_URL=https://github.example GITHUB_RUN_ID=123 ADMISSION_CHECK_NAME="${2:-}" "$ADAPTER")
}
network_adapter() { FAKE_NETWORK_FAIL=1 adapter verify; }

expect_pass "ordinary PR verification runs without a release lock" adapter verify
expect_fail "Stage workflow blocks when stage-busy is absent" 'stage-busy is missing' adapter stage 'Stage admission'

git -C "$WORK" tag -a stage-busy "$HEAD" -m $'Release lock\n\nbranch: feat/v2\npr: 7\nagent: workflow test / feat/v2\ndate: 2026-10-19T00:00:00Z'
git -C "$WORK" push -q origin refs/tags/stage-busy
expect_pass "Stage workflow admits the exact owned lock" adapter stage 'Stage admission'
if grep -l '"conclusion": "success"' "$CHECKS"/*.json >/dev/null 2>&1; then pass "Stage workflow publishes a SHA-bound success check"; else fail "Stage workflow publishes a SHA-bound success check"; fi

git -C "$WORK" tag -f -a stage-busy "$HEAD" -m $'Release lock\n\nbranch: foreign/release\npr: 7\nagent: workflow test / foreign\ndate: 2026-10-19T00:00:00Z'
git -C "$WORK" push -q -f origin refs/tags/stage-busy
expect_fail "Stage workflow rejects a foreign lock" 'owner branch mismatch' adapter stage 'Stage admission'
expect_fail "GitHub API failure denies closed" 'BLOCKED|failed|error|unavailable|exit' network_adapter

for workflow in release-lane-gate.yml release-stage-admission.yml release-production-admission.yml; do
  path="$ROOT/.github/workflows/$workflow"
  if [[ -f "$path" ]] && grep -Fq 'github.event.repository.default_branch' "$path" \
      && grep -Fq 'actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349' "$path" \
      && ! grep -Eq 'pull_request\.head|docker compose|prisma migrate|ssh |scp ' "$path" \
      && ! grep -E 'secrets\.' "$path" | grep -Fv 'secrets.RELEASE_GATE_APP_PRIVATE_KEY' >/dev/null; then
    pass "$workflow uses trusted code and only the governance App credential"
  else
    fail "$workflow trust boundary"
  fi
done
if grep -Fq 'pull_request_target:' "$ROOT/.github/workflows/release-lane-gate.yml" \
    && grep -Fq 'MODE: verify' "$ROOT/.github/workflows/release-lane-gate.yml"; then
  pass "PR verification is lock-independent and uses the trusted trigger"
else
  fail "PR verification workflow contract"
fi
if grep -Fq 'environment: production' "$ROOT/.github/workflows/release-production-admission.yml" \
    && grep -Fq 'MODE: production' "$ROOT/.github/workflows/release-production-admission.yml"; then
  pass "Production admission requires the protected environment"
else
  fail "Production environment contract"
fi

echo "== results: $passed passed, $failed failed =="
((failed == 0))
