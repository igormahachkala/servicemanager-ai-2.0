#!/usr/bin/env bash
# Offline adversarial tests for Release System V2.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GATE="$HERE/release-gate-v2.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/release-gate-v2.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0; failed=0
pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }

write_meta() {
  local path="$1" number="$2" base="$3" base_sha="$4" ref="$5" sha="$6" merge="$7"
  python3 - "$path" "$number" "$base" "$base_sha" "$ref" "$sha" "$merge" <<'PY'
import json, sys
p,n,b,bs,r,s,m=sys.argv[1:]
json.dump({"number":int(n),"base":{"ref":b,"sha":bs,"repo":{"full_name":"owner/repo"}},"head":{"ref":r,"sha":s,"repo":{"full_name":"owner/repo"}},"merge_commit_sha":m},open(p,"w"))
PY
}

write_review() {
  local sha="$1" app="$2" conclusion="${3:-success}"
  python3 - "$REVIEW" "$sha" "$app" "$conclusion" <<'PY'
import json, sys
p,sha,app,conclusion=sys.argv[1:]
run={"name":"Independent technical review","head_sha":sha,"status":"completed","conclusion":conclusion,"app":{"id":int(app)}}
json.dump({"total_count":1,"check_runs":[run]},open(p,"w"))
PY
}

lock_message() {
  printf 'Release lock\n\nbranch: feat/v2\npr: %s\nagent: selftest / feat/v2\ndate: 2026-10-19T00:00:00Z' "$1"
}

new_tag() {
  local tag="$1" message="$2" target="${3:-$CANDIDATE_SHA}"
  git -C "$WORK" tag -a -f "$tag" "$target" -m "$message" >/dev/null
  git -C "$WORK" push -q -f origin "refs/tags/$tag"
}

run_gate() {
  local mode="$1"; shift
  (cd "$WORK" && "$GATE" "$mode" feat/v2 "$CANDIDATE_SHA" "$PR" \
    --repo owner/repo --remote origin --event pull_request --base-ref "$BASE_REF" \
    --base-sha "$BASE_SHA" --head-repo owner/repo --metadata-file "$META" \
    --review-file "$REVIEW" --review-app-id 42 --merge-sha "$MERGE_SHA" \
    --lock-metadata-file "$STAGE_META" --prod-lock-metadata-file "$PROD_META" \
    --owner-go-file "$OWNER_GO" --owner-login owner "$@")
}

expect_pass() {
  local label="$1" mode="$2"; shift 2
  if run_gate "$mode" "$@" >"$TMP/out" 2>&1; then pass "$label"; else fail "$label"; sed 's/^/  /' "$TMP/out" >&2; fi
}

expect_fail() {
  local label="$1" reason="$2" mode="$3" rc; shift 3
  set +e; run_gate "$mode" "$@" >"$TMP/out" 2>&1; rc=$?; set -e
  if ((rc != 0)) && grep -Eiq "$reason" "$TMP/out" && ! grep -q 'RELEASE V2: PASS' "$TMP/out"; then
    pass "$label"
  else
    fail "$label (rc=$rc)"; sed 's/^/  /' "$TMP/out" >&2
  fi
}

WORK="$TMP/work"; REMOTE="$TMP/remote.git"
git init -q "$WORK"
git -C "$WORK" config user.name "Release V2 Self-Test"
git -C "$WORK" config user.email release-v2-selftest@example.invalid
printf 'base\n' >"$WORK/fixture.txt"; git -C "$WORK" add fixture.txt; git -C "$WORK" commit -qm base
git -C "$WORK" branch -M prod
PROD_SHA=$(git -C "$WORK" rev-parse HEAD)
git -C "$WORK" switch -qc beta "$PROD_SHA"
git -C "$WORK" switch -qc feat/v2 "$PROD_SHA"
printf 'candidate\n' >>"$WORK/fixture.txt"; git -C "$WORK" commit -qam candidate
CANDIDATE_SHA=$(git -C "$WORK" rev-parse HEAD)
git -C "$WORK" clone -q --bare . "$REMOTE"; git -C "$WORK" remote add origin "$REMOTE"
git -C "$WORK" push -q origin prod beta feat/v2

META="$TMP/current.json"; STAGE_META="$TMP/stage.json"; PROD_META="$TMP/prod.json"
REVIEW="$TMP/review.json"; OWNER_GO="$TMP/owner-go.json"
BASE_REF=beta; BASE_SHA="$PROD_SHA"; MERGE_SHA="$CANDIDATE_SHA"; PR=8
write_meta "$META" 8 beta "$BASE_SHA" feat/v2 "$CANDIDATE_SHA" "$MERGE_SHA"
write_meta "$STAGE_META" 7 beta "$BASE_SHA" feat/v2 "$CANDIDATE_SHA" "$MERGE_SHA"
write_review "$CANDIDATE_SHA" 42
python3 - "$OWNER_GO" "$CANDIDATE_SHA" <<'PY'
import json,sys
json.dump({"environment":"production","candidate_sha":sys.argv[2],"pr":9,"actor":"owner","run_id":"123"},open(sys.argv[1],"w"))
PY

expect_pass "ordinary feature PR verifies without locks" verify
write_review "$PROD_SHA" 42
expect_fail "review for wrong SHA denied" 'independent technical review' verify
write_review "$CANDIDATE_SHA" 99
expect_fail "spoofed review app denied" 'independent technical review' verify
write_review "$CANDIDATE_SHA" 42 failure
expect_fail "failed review denied" 'independent technical review' verify
write_review "$CANDIDATE_SHA" 42
expect_fail "unauthorized direct push denied" 'direct push' verify --event push

expect_fail "Stage admission without lock denied" 'stage-busy is missing' stage
new_tag stage-busy "$(lock_message 7)"
expect_pass "Stage admission with owned lock passes" stage
new_tag stage-busy "$(lock_message 7)"; git -C "$WORK" tag -f -a stage-busy "$CANDIDATE_SHA" -m $'Release lock\n\nbranch: other/release\npr: 7\nagent: selftest / other\ndate: 2026-10-19T00:00:00Z' >/dev/null; git -C "$WORK" push -q -f origin refs/tags/stage-busy
expect_fail "foreign Stage lock denied" 'owner branch mismatch' stage
new_tag stage-busy $'Release lock\n\nbranch: feat/v2\npr: 7\nagent: selftest / feat/v2\ndate: 2026-10-19T00:00:00Z\nbranch: duplicate'
expect_fail "malformed Stage lock denied" 'duplicate branch|unknown metadata' stage
new_tag stage-busy "$(lock_message 7)"

git -C "$WORK" push -q origin "$CANDIDATE_SHA":refs/heads/beta
BASE_REF=prod; BASE_SHA="$PROD_SHA"; PR=9; MERGE_SHA="$CANDIDATE_SHA"
write_meta "$META" 9 prod "$BASE_SHA" feat/v2 "$CANDIDATE_SHA" "$MERGE_SHA"
write_meta "$PROD_META" 9 prod "$BASE_SHA" feat/v2 "$CANDIDATE_SHA" "$MERGE_SHA"
expect_fail "Production without stage-ok denied" 'stage-ok is missing' production

STAGE_TREE=$(git -C "$WORK" rev-parse "$CANDIDATE_SHA^{tree}")
new_tag stage-ok/feat/v2 "$(printf 'Stage acceptance passed\nbranch: feat/v2\nbranch_sha: %s\nstage_sha: %s\nstage_tree: %s\ncriterion: fixture\nchecks: v2 selftest\ndate: 2026-10-19T00:00:00Z' "$CANDIDATE_SHA" "$CANDIDATE_SHA" "$STAGE_TREE")"
new_tag prod-busy "$(lock_message 9)"
mv "$OWNER_GO" "$OWNER_GO.saved"
expect_fail "Production without owner GO denied" 'owner GO evidence is missing' production
mv "$OWNER_GO.saved" "$OWNER_GO"
expect_pass "Production with Stage acceptance, locks and owner GO passes" production

git -C "$WORK" push -q -f origin "$PROD_SHA":refs/heads/beta
expect_fail "rollback invalidates Production admission" 'accepted Stage SHA is not contained|Stage tree does not match' production

BASE_REF=beta; BASE_SHA="$PROD_SHA"; PR=8; MERGE_SHA="$CANDIDATE_SHA"
write_meta "$META" 8 beta "$BASE_SHA" feat/v2 "$CANDIDATE_SHA" "$MERGE_SHA"
set +e
(cd "$WORK" && "$GATE" verify feat/v2 "$CANDIDATE_SHA" 8 --repo owner/repo --remote "$TMP/missing.git" --event pull_request --base-ref beta --base-sha "$PROD_SHA" --head-repo owner/repo --metadata-file "$META" --review-file "$REVIEW" --review-app-id 42 --merge-sha "$MERGE_SHA") >"$TMP/out" 2>&1
rc=$?
set -e
if ((rc != 0)) && grep -Eiq 'unavailable' "$TMP/out"; then pass "network failure denies closed"; else fail "network failure denies closed"; fi

echo "== results: $passed passed, $failed failed =="
((failed == 0))
