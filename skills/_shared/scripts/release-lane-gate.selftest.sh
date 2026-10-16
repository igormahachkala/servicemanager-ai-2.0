#!/usr/bin/env bash
# Offline adversarial tests for the trusted release-lane gate.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
GATE="$HERE/release-lane-gate.sh"
TMP_BASE="$(printenv TMPDIR || printf /tmp)"
TMP=$(mktemp -d "$TMP_BASE/release-lane-gate.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
passed=0; failed=0
pass() { echo "PASS $1"; passed=$((passed + 1)); }
fail() { echo "FAIL $1" >&2; failed=$((failed + 1)); }
run_gate() { (cd "$WORK" && "$GATE" "$@" --repo owner/repo --remote origin --base-ref "$BASE_REF" --base-sha "$BASE_SHA" --head-repo owner/repo --metadata-file "$CURRENT_META" --lock-metadata-file "$STAGE_META" --prod-lock-metadata-file "$PROD_META" --merge-sha "$MERGE_SHA"); }
expect_pass() {
  local label="$1"; shift
  if run_gate "$@" >"$TMP/out" 2>&1; then pass "$label"; else fail "$label"; sed 's/^/  /' "$TMP/out" >&2; fi
}
expect_fail() {
  local label="$1" reason="$2"; shift 2
  set +e; run_gate "$@" >"$TMP/out" 2>&1; local rc=$?; set -e
  if ((rc != 0)) && grep -Eiq "$reason" "$TMP/out" && ! grep -q 'RELEASE LANE: PASS' "$TMP/out"; then pass "$label"; else fail "$label (rc=$rc)"; sed 's/^/  /' "$TMP/out" >&2; fi
}
write_meta() {
  local path="$1" number="$2" base="$3" base_sha="$4" ref="$5" sha="$6" merge="$7" repo
  repo=owner/repo; [ "$#" -ge 8 ] && repo="$8"
  python3 - "$path" "$number" "$base" "$base_sha" "$ref" "$sha" "$merge" "$repo" <<'PY'
import json, sys
path, number, base, base_sha, ref, sha, merge, repo = sys.argv[1:]
json.dump({"number": int(number), "base": {"ref": base, "sha": base_sha, "repo": {"full_name": repo}}, "head": {"ref": ref, "sha": sha, "repo": {"full_name": repo}}, "merge_commit_sha": merge}, open(path, "w"))
PY
}
new_tag() {
  local tag="$1" message="$2" target
  target=HEAD; [ "$#" -ge 3 ] && target="$3"
  git -C "$WORK" tag -a -f "$tag" "$target" -m "$message" >/dev/null
  git -C "$WORK" push -q -f origin "refs/tags/$tag"
}
lock_message() {
  local branch="$1" pr="$2" msg
  printf -v msg 'Release lock\n\nbranch: %s\npr: %s\nagent: selftest / %s\ndate: 2026-10-16T00:00:00Z' "$branch" "$pr" "$branch"
  printf '%s' "$msg"
}
stage_message() {
  local branch="$1" candidate="$2" stage="$3" msg tree
  tree=$(git -C "$WORK" rev-parse "$stage^{tree}")
  printf -v msg 'Stage acceptance passed\nbranch: %s\nbranch_sha: %s\nstage_sha: %s\nstage_tree: %s\ncriterion: fixture acceptance\nchecks: gate self-test\ndate: 2026-10-16T00:00:00Z' "$branch" "$candidate" "$stage" "$tree"
  printf '%s' "$msg"
}
new_lock() { new_tag "$1" "$(lock_message "$2" "$3")"; }
new_stage_ok() { new_tag "stage-ok/$1" "$(stage_message "$1" "$2" "$3")" "$2"; }

WORK="$TMP/work"; REMOTE="$TMP/remote.git"
git init -q "$WORK"
git -C "$WORK" config user.name "Release Lane Self-Test"
git -C "$WORK" config user.email release-lane-selftest@example.invalid
printf 'base\n' >"$WORK/fixture.txt"; git -C "$WORK" add fixture.txt; git -C "$WORK" commit -qm base
git -C "$WORK" branch -M prod
BASE_SHA=$(git -C "$WORK" rev-parse HEAD)
BASE_SHA_ORIG="$BASE_SHA"
git -C "$WORK" switch -qc beta "$BASE_SHA"
git -C "$WORK" switch -qc feat/release-lane-fixture "$BASE_SHA"
printf 'candidate\n' >>"$WORK/fixture.txt"; git -C "$WORK" commit -qam candidate
CANDIDATE_SHA=$(git -C "$WORK" rev-parse HEAD)
git -C "$WORK" clone -q --bare . "$REMOTE"; git -C "$WORK" remote add origin "$REMOTE"
git -C "$WORK" push -q origin prod beta feat/release-lane-fixture
CURRENT_META="$TMP/current.json"; STAGE_META="$TMP/stage.json"; PROD_META="$TMP/prod.json"
MERGE_SHA="$CANDIDATE_SHA"; BASE_REF=beta
set_beta() {
  BASE_REF=beta
  write_meta "$CURRENT_META" 8 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
  write_meta "$STAGE_META" 7 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
  write_meta "$PROD_META" 7 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
}
set_prod() {
  BASE_REF=prod
  BASE_SHA="$BASE_SHA_ORIG"
  git -C "$WORK" push -q origin "$CANDIDATE_SHA":refs/heads/beta
  write_meta "$CURRENT_META" 8 prod "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
  write_meta "$STAGE_META" 7 prod "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
  write_meta "$PROD_META" 7 prod "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
}
set_beta_current() {
  BASE_SHA="$CANDIDATE_SHA"
  set_beta
}
set_beta
new_lock stage-busy feat/release-lane-fixture 7
new_lock prod-busy feat/release-lane-fixture 7
new_stage_ok feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"

expect_pass "valid beta release" beta feat/release-lane-fixture "$CANDIDATE_SHA" 8
set_prod
expect_pass "valid production release" production feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_tag "stage-ok/feat/release-lane-fixture" "$(stage_message feat/release-lane-fixture "$CANDIDATE_SHA" "$BASE_SHA_ORIG")" "$CANDIDATE_SHA"
expect_fail "candidate absent from accepted Stage denied" 'candidate is not an ancestor' production feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_stage_ok feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
set_beta_current
expect_fail "prod/production alias rejected" 'unknown contour|contour/base' prod feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_lock stage-busy other/release 9
expect_fail "#360 foreign stage lock denied" 'owner branch mismatch' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_lock stage-busy feat/release-lane-fixture 7
git -C "$WORK" push -q origin :refs/tags/prod-busy
set_prod
expect_fail "missing prod lock denied" 'prod-busy is missing' production feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_lock prod-busy feat/release-lane-fixture 7
set_beta_current
new_tag stage-busy $'Release lock\n\nbranch: feat/release-lane-fixture\npr: 7\nagent: selftest / feat/release-lane-fixture\ndate: 2026-10-16T00:00:00Z\nbranch: contradictory'
expect_fail "malformed duplicate lock denied" 'missing or duplicate branch|unknown metadata' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_lock stage-busy feat/release-lane-fixture 7
new_tag stage-busy $'Release lock\n\nbranch: feat/release-lane-fixture\npr: 7\nagent: selftest\ndate: 2026-02-30T00:00:00Z'
expect_fail "impossible lock date denied" 'date metadata is malformed' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_lock stage-busy feat/release-lane-fixture 7
write_meta "$CURRENT_META" 8 beta "$BASE_SHA" feat/release-lane-fixture "$BASE_SHA_ORIG" "$BASE_SHA_ORIG"
expect_fail "wrong candidate denied" 'remote head does not match' beta feat/release-lane-fixture "$BASE_SHA_ORIG" 8
write_meta "$CURRENT_META" 8 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
new_tag "stage-ok/feat/release-lane-fixture" "$(stage_message feat/release-lane-fixture "$BASE_SHA_ORIG" "$BASE_SHA_ORIG")" "$BASE_SHA_ORIG"
set_prod
expect_fail "invalid stage-ok denied" 'stage-ok does not identify' production feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_stage_ok feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
new_tag prod-busy "$(lock_message other/release 22)"
set_prod
expect_fail "foreign prod lock denied" 'owner branch mismatch' production feat/release-lane-fixture "$CANDIDATE_SHA" 8
new_lock prod-busy feat/release-lane-fixture 7
set_beta_current
python3 - "$CURRENT_META" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d["head"]["repo"]["full_name"]="evil/fork"; json.dump(d,open(p,"w"))
PY
expect_fail "fork head identity denied" 'current PR metadata identity mismatch|trusted repository' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8
write_meta "$CURRENT_META" 8 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
: >"$CURRENT_META"
expect_fail "PR metadata/API failure denied" 'current PR metadata identity mismatch|JSON' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8
write_meta "$CURRENT_META" 8 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
expect_fail "direct push denied" 'direct push is not an admitted' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8 --event push

cat >"$TMP/race-hook.sh" <<'SH'
#!/usr/bin/env bash
printf 'race\n' >>fixture.txt
git add fixture.txt
git commit -qm race
git push -q origin HEAD:refs/heads/feat/release-lane-fixture
SH
chmod +x "$TMP/race-hook.sh"
write_meta "$CURRENT_META" 8 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$MERGE_SHA"
RELEASE_LANE_SELFTEST=1 expect_fail "TOCTOU head change denied" 'refs or lock tags changed' beta feat/release-lane-fixture "$CANDIDATE_SHA" 8 --test-after-snapshot "$TMP/race-hook.sh"

git -C "$WORK" reset --hard -q "$CANDIDATE_SHA"
printf 'follow-up\n' >>"$WORK/fixture.txt"; git -C "$WORK" commit -qam follow-up
FOLLOWUP_SHA=$(git -C "$WORK" rev-parse HEAD); git -C "$WORK" push -q -f origin HEAD:refs/heads/feat/release-lane-fixture
MERGE_SHA="$FOLLOWUP_SHA"
BASE_REF=beta
write_meta "$CURRENT_META" 9 beta "$BASE_SHA" feat/release-lane-fixture "$FOLLOWUP_SHA" "$FOLLOWUP_SHA"
write_meta "$STAGE_META" 7 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
write_meta "$PROD_META" 7 beta "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
new_stage_ok feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
expect_pass "same-branch beta follow-up" beta feat/release-lane-fixture "$FOLLOWUP_SHA" 9
git -C "$WORK" push -q origin HEAD:refs/heads/beta
BASE_REF=prod
BASE_SHA="$BASE_SHA_ORIG"
write_meta "$CURRENT_META" 9 prod "$BASE_SHA" feat/release-lane-fixture "$FOLLOWUP_SHA" "$FOLLOWUP_SHA"
write_meta "$STAGE_META" 7 prod "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
write_meta "$PROD_META" 7 prod "$BASE_SHA" feat/release-lane-fixture "$CANDIDATE_SHA" "$CANDIDATE_SHA"
expect_fail "follow-up requires fresh stage-ok" 'stage-ok does not identify' production feat/release-lane-fixture "$FOLLOWUP_SHA" 9
new_stage_ok feat/release-lane-fixture "$FOLLOWUP_SHA" "$FOLLOWUP_SHA"
expect_pass "same-branch production follow-up" production feat/release-lane-fixture "$FOLLOWUP_SHA" 9

echo "== results: $passed passed, $failed failed =="
((failed == 0))
