#!/usr/bin/env bash
# Offline negative controls for release-automation behavior required by the
# current Stage/Production protocols. Never contacts a live contour or database.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-protocol.XXXXXX")
MOCK_PID=""
trap '[[ -n "$MOCK_PID" ]] && kill "$MOCK_PID" 2>/dev/null || true; rm -rf "$TMP"' EXIT

passed=0
skipped=0
failed=0

pass() { echo "PASS $1"; passed=$((passed + 1)); }
skip() { echo "SKIP $1"; skipped=$((skipped + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }

expect_failure() {
  local label="$1"
  shift
  if "$@" >"$TMP/command.out" 2>&1; then
    fail "$label accepted unsafe evidence"
  else
    pass "$label rejected unsafe evidence"
  fi
}

expect_success() {
  local label="$1"
  shift
  if "$@" >"$TMP/command.out" 2>&1; then
    pass "$label accepted valid evidence"
  else
    fail "$label rejected valid evidence"
    sed 's/^/    /' "$TMP/command.out" >&2
  fi
}

check_workflow_safety() {
  local workflow="$HERE/../../../.github/workflows/release-automation-ci.yml"
  if [[ ! -f "$workflow" ]]; then
    fail "CI safety: workflow is missing"
    return
  fi
  if grep -Eq 'pull_request_target|secrets\.|^[[:space:]]*environment:|^[[:space:]]*(ssh|scp)[[:space:]]' "$workflow"; then
    fail "CI safety: privileged trigger, secret, environment, or SSH use detected"
  else
    pass "CI safety: no privileged trigger, secrets, environment, or SSH"
  fi
  if grep -Eq '^[[:space:]]*contents:[[:space:]]*read[[:space:]]*$' "$workflow"; then
    pass "CI safety: repository token is read-only"
  else
    fail "CI safety: explicit contents: read permission is missing"
  fi
  if grep -Eq 'merge-checks\.sh|docker compose|prisma migrate|seed:|lock-acquire|stage-busy|prod-busy' "$workflow"; then
    fail "CI safety: deploy, DB mutation, or release-lock command detected"
  else
    pass "CI safety: no deploy, DB mutation, or release-lock command"
  fi
}

run_a6_regressions() {
  local script="$HERE/stage-smoke.sh"
  if [[ ! -f "$script" ]]; then
    skip "A6 regressions: stage-smoke has not landed yet"
    return
  fi

  cat >"$TMP/mock.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import sys

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path == "/version":
            self.send_response(int(os.environ.get("VERSION_STATUS", "200")))
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"commitSha":"expected-sha","environment":"beta"}')
            return
        self.send_response(200)
        if self.path == "/sw.js":
            self.send_header("Content-Type", "application/javascript")
        self.end_headers()
        self.wfile.write(b"ok")

HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
PY

  local port=$((20000 + RANDOM % 10000))
  VERSION_STATUS=500 python3 "$TMP/mock.py" "$port" &
  MOCK_PID=$!
  local base="http://127.0.0.1:$port"
  for _ in $(seq 1 50); do
    curl -fsS "$base/health" >/dev/null 2>&1 && break
    sleep 0.1
  done
  : >"$TMP/backend.log"
  : >"$TMP/frontend.log"

  local common=(
    --web-url "$base"
    --api-url "$base"
    --expect-sha expected-sha
    --expect-env beta
    --backend-log "$TMP/backend.log"
    --frontend-log "$TMP/frontend.log"
    --backend-restart-count 0
    --frontend-restart-count 0
    --postgres-status running
    --postgres-restart-count 0
  )

  expect_failure "A6 /version HTTP 500" bash "$script" "${common[@]}"

  kill "$MOCK_PID" 2>/dev/null || true
  wait "$MOCK_PID" 2>/dev/null || true
  MOCK_PID=""
  VERSION_STATUS=200 python3 "$TMP/mock.py" "$port" &
  MOCK_PID=$!
  for _ in $(seq 1 50); do
    curl -fsS "$base/health" >/dev/null 2>&1 && break
    sleep 0.1
  done

  expect_failure "A6 PostgreSQL StartedAt change" bash "$script" "${common[@]}" \
    --postgres-started-at-before 2026-10-14T01:00:00Z \
    --postgres-started-at-after 2026-10-14T01:01:00Z

  expect_success "A6 unchanged PostgreSQL StartedAt" bash "$script" "${common[@]}" \
    --postgres-started-at-before 2026-10-14T01:00:00Z \
    --postgres-started-at-after 2026-10-14T01:00:00Z
}

make_a7_fixture() {
  local source="$TMP/a7-source"
  local remote="$TMP/a7-remote.git"
  git init -q "$source"
  (
    cd "$source"
    git config user.email ci@example.invalid
    git config user.name ci
    echo base >fixture.txt
    git add fixture.txt
    git commit -qm base
    git branch -M prod
    local prod_sha
    prod_sha=$(git rev-parse HEAD)
    git checkout -qb feat/candidate
    echo candidate >>fixture.txt
    git commit -qam candidate
    local candidate_sha
    candidate_sha=$(git rev-parse HEAD)
    git branch beta
    git tag -a stage-ok/feat/candidate "$candidate_sha" -m "Stage acceptance passed
branch: feat/candidate
branch_sha: $candidate_sha
stage_sha: $prod_sha
criterion: offline negative control"
    git tag -a stage-busy "$candidate_sha" -m "branch: feat/candidate
date: 2026-10-14T00:00:00Z"
  )
  git clone -q --bare "$source" "$remote"
  printf '%s\n' "$remote"
}

replace_a7_stage_ok() {
  local remote="$1" stage_sha="$2"
  local worktree="$TMP/a7-retag"
  rm -rf "$worktree"
  git clone -q "$remote" "$worktree"
  (
    cd "$worktree"
    git config user.email ci@example.invalid
    git config user.name ci
    local candidate_sha
    candidate_sha=$(git rev-parse origin/feat/candidate)
    git tag -f -a stage-ok/feat/candidate "$candidate_sha" -m "Stage acceptance passed
branch: feat/candidate
branch_sha: $candidate_sha
stage_sha: $stage_sha
criterion: offline negative control"
    git push -q -f origin refs/tags/stage-ok/feat/candidate
  )
}

run_a7_regressions() {
  local script="$HERE/prod-readiness.sh"
  if [[ ! -f "$script" ]]; then
    skip "A7 regressions: prod-readiness has not landed yet"
    return
  fi

  local remote prod_sha candidate_sha candidate_tree
  remote=$(make_a7_fixture)
  prod_sha=$(git --git-dir="$remote" rev-parse refs/heads/prod)
  candidate_sha=$(git --git-dir="$remote" rev-parse refs/heads/feat/candidate)
  candidate_tree=$(git --git-dir="$remote" rev-parse "$candidate_sha^{tree}")

  expect_failure "A7 candidate absent from Stage runtime" bash "$script" feat/candidate \
    --remote "$remote" \
    --stage-runtime-sha "$prod_sha" \
    --merge-check PASS \
    --ci PASS \
    --expected-production-tree "$candidate_tree" \
    --actual-production-tree "$candidate_tree"

  replace_a7_stage_ok "$remote" "$candidate_sha"

  expect_failure "A7 invalid Git tree evidence" bash "$script" feat/candidate \
    --remote "$remote" \
    --stage-runtime-sha "$candidate_sha" \
    --merge-check PASS \
    --ci PASS \
    --expected-production-tree NOT_A_GIT_TREE \
    --actual-production-tree NOT_A_GIT_TREE

  expect_failure "A7 unverified CI string" bash "$script" feat/candidate \
    --remote "$remote" \
    --stage-runtime-sha "$candidate_sha" \
    --merge-check PASS \
    --ci PASS \
    --expected-production-tree "$candidate_tree" \
    --actual-production-tree "$candidate_tree"
}

check_workflow_safety
run_a6_regressions
run_a7_regressions

echo "release protocol regressions: $passed passed, $skipped skipped, $failed failed"
((failed == 0))
