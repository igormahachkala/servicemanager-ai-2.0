#!/usr/bin/env bash
#
# prod-readiness.selftest.sh — offline tests for prod-readiness.sh against throwaway
# local fixture remotes (never the real origin). Verifies diagnosis, verifies that
# no ref/tag is mutated, and — since an independent audit obtained READINESS:
# COMPLETE for a candidate that was not running on Stage — carries an adversarial
# section that reproduces each of those attacks and requires it to be refused.
# Run: bash prod-readiness.selftest.sh
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/prod-readiness.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/prodrd.XXXXXX")
PASS=0; FAIL=0
trap 'rm -rf "$TMP"' EXIT
ok(){ PASS=$((PASS+1)); echo "  PASS $1"; }
no(){ FAIL=$((FAIL+1)); echo "  FAIL $1"; }
fixture_die(){ echo "  ERROR fixture setup: $1" >&2; exit 1; }
rc_is(){ [ "$2" = "$3" ] && ok "$1 (exit $3)" || no "$1 (expected $2 got $3)"; }
has(){ printf '%s' "$1" | grep -q "$2" && ok "$3" || no "$3 [missing: $2]"; }
hasnt(){ printf '%s' "$1" | grep -q "$2" && no "$3 [present: $2]" || ok "$3"; }

# --- fixture ------------------------------------------------------------------
# prod=c0; feat/cand adds a migration + runbook (c1); beta=c1 (⊇ prod).
# other/old is a Stage build branched from prod that does NOT contain the
# candidate — the exact shape the audit used to obtain a false READY.
SRC="$TMP/src"; BARE="$TMP/remote.git"
git init -q "$SRC"; ( cd "$SRC" || exit 1
  git config user.email a@b.c; git config user.name t
  mkdir -p backend/prisma/migrations backend/scripts
  echo base > f; git add f; git commit -qm c0
  git branch -M prod
  git checkout -qb feat/cand
  mkdir -p backend/prisma/migrations/20260101_x
  echo "-- sql" > backend/prisma/migrations/20260101_x/migration.sql
  echo "# runbook" > backend/scripts/thing.runbook.md
  echo more >> f; git add -A; git commit -qm c1
  git branch beta
  git checkout -q prod
  git checkout -qb other/old
  echo unrelated >> f; git add -A; git commit -qm "old stage build"
  git checkout -q prod
)
git clone -q --bare "$SRC" "$BARE"
R="$BARE"
C1=$(git ls-remote "$BARE" refs/heads/feat/cand | awk '{print $1}')
C0=$(git ls-remote "$BARE" refs/heads/prod | awk '{print $1}')
OLD=$(git ls-remote "$BARE" refs/heads/other/old | awk '{print $1}')
C1_TREE=$(git --git-dir="$BARE" rev-parse "$C1^{tree}")
OLD_TREE=$(git --git-dir="$BARE" rev-parse "$OLD^{tree}")
[ -n "$C1" ] && [ -n "$OLD" ] && [ -n "$C1_TREE" ] && [ -n "$OLD_TREE" ] || { echo "fixture broken"; exit 9; }

# Evidence is a file bound to the sha it attests to.
evfile(){ printf 'sha: %s\nresult: %s\nsource: https://ci.example/run/%s\n' "$2" "$3" "$1" > "$TMP/$1"; echo "$TMP/$1"; }
EV_C1=$(evfile ev_c1 "$C1" PASS)
EV_C1_FAIL=$(evfile ev_c1_fail "$C1" FAIL)
EV_OLD=$(evfile ev_old "$OLD" PASS)
printf 'result: PASS\n' > "$TMP/ev_nosha"; EV_NOSHA="$TMP/ev_nosha"

READY_ARGS=(--remote "$R" --stage-runtime-sha "$C1" \
            --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
            --deployed-workdir-tree "$C1_TREE")

mktag(){
  local wt
  wt=$(mktemp -d "$TMP/wt.XXXXXX") || fixture_die "cannot create tag worktree"
  git clone -q "$BARE" "$wt" || fixture_die "cannot clone tag fixture"
  git -C "$wt" config user.email "prod-readiness-selftest@example.invalid" || fixture_die "cannot configure fixture user.email"
  git -C "$wt" config user.name "prod-readiness self-test" || fixture_die "cannot configure fixture user.name"
  git -C "$wt" tag -f -a "$1" "$2" -m "$3" || fixture_die "cannot create fixture tag $1"
  git -C "$wt" push -q -f origin "refs/tags/$1" || fixture_die "cannot push fixture tag $1"
  rm -rf "$wt"
}
deltag(){
  local wt
  wt=$(mktemp -d "$TMP/wt.XXXXXX") || fixture_die "cannot create delete-tag worktree"
  git clone -q "$BARE" "$wt" || fixture_die "cannot clone delete-tag fixture"
  git -C "$wt" push -q origin ":refs/tags/$1" || fixture_die "cannot delete fixture tag $1"
  rm -rf "$wt"
}

OKBODY=$(printf 'Stage acceptance passed\nbranch: feat/cand\nbranch_sha: %s\nstage_sha: %s\nstage_tree: %s\ncriterion: smoke green' "$C1" "$C1" "$C1_TREE")
BUSYBODY=$(printf 'Контур занят\nbranch: feat/cand\npr: 9\ndate: 2026-10-13T00:00:00Z')

echo "== A7 prod-readiness self-test =="
echo
echo "-- positive: every signal genuinely verifiable --"
mktag stage-ok/feat/cand "$C1" "$OKBODY"
mktag stage-busy "$C1" "$BUSYBODY"
OUT=$(bash "$SCRIPT" feat/cand "${READY_ARGS[@]}" 2>&1); rc_is "POS all signals present" 0 $?
has "$OUT" "READINESS              : COMPLETE" "POS COMPLETE"
has "$OUT" "stage-ok (exact)      : PRESENT and matches" "POS stage-ok matches tip"
has "$OUT" "Candidate ∈ beta      : YES" "POS candidate in beta"
has "$OUT" "Stage runtime commit  : OK" "POS runtime resolves to a real commit"
has "$OUT" "Candidate ∈ Stage run : YES" "POS candidate inside the running build"
has "$OUT" "Runtime vs stage-ok   : OK" "POS runtime equals accepted stage_sha"
has "$OUT" "Canonical merge-check : OK" "POS merge-check evidence bound to sha"
has "$OUT" "CI status             : OK" "POS CI evidence bound to sha"
has "$OUT" "Candidate tree (derived): $C1_TREE" "POS candidate tree derived by git"
has "$OUT" "Deployed workdir tree  : OK" "POS deployed workdir tree equals candidate tree"
has "$OUT" "Migrations in candidate: YES" "POS migration detected"
has "$OUT" "DB / runtime actions   : YES" "POS DB action (runbook) detected"
has "$OUT" "OWNER GO               : REQUIRED" "POS OWNER-GO caveat present"
has "$OUT" "stage-busy            : HELD by this candidate" "POS stage-busy held by candidate"

echo
echo "-- adversarial: each attack the audit used must be refused --"

# X1 THE AUDIT'S ATTACK: candidate absent from the running Stage build, while
# every other signal is genuinely valid. Must never read COMPLETE.
mktag stage-ok/feat/cand "$C1" "$(printf 'branch: feat/cand\nstage_sha: %s' "$OLD")"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$OLD" \
      --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X1 candidate NOT in Stage runtime" 1 $?
has   "$OUT" "Candidate ∈ Stage run : NO" "X1 ancestry gate fires"
hasnt "$OUT" "READINESS              : COMPLETE" "X1 no false READY"
mktag stage-ok/feat/cand "$C1" "$OKBODY"

# X2 free-text verdicts are refused outright (they were the unverified strings)
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check PASS --ci PASS --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X2 free-text --merge-check refused" 2 $?
has "$OUT" "no longer accepted" "X2 refusal explains why"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_C1" --ci PASS --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X2b free-text --ci refused" 2 $?

# X3 a string that is not a git tree must not satisfy tree identity
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree TOTALLY_FAKE_TREE 2>&1); rc_is "X3 invented tree string" 1 $?
has   "$OUT" "Deployed workdir tree  : BLOCKED (not a real tree object" "X3 tree object validated"
hasnt "$OUT" "READINESS              : COMPLETE" "X3 no false READY"

# X3b equal-but-fake pair: the original defect was a bare string comparison
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
      --expected-candidate-tree FAKE --deployed-workdir-tree FAKE 2>&1); rc_is "X3b equal fake tree pair" 1 $?
hasnt "$OUT" "READINESS              : COMPLETE" "X3b equal fakes do not pass"

# X4 a real tree, but belonging to another commit
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$OLD_TREE" 2>&1); rc_is "X4 real tree of the wrong commit" 1 $?
has "$OUT" "Deployed workdir tree  : MISMATCH" "X4 wrong-commit tree blocks"

# X5 genuine PASS evidence that attests to a DIFFERENT commit
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_OLD" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X5 evidence for another commit" 1 $?
has   "$OUT" "Canonical merge-check : REJECTED (evidence attests to" "X5 sha binding enforced"
hasnt "$OUT" "READINESS              : COMPLETE" "X5 no false READY"

# X6 evidence file without a sha binding
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_NOSHA" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X6 evidence without sha" 1 $?
has "$OUT" "must carry 'sha:' and 'result:'" "X6 unbound evidence refused"

# X7 evidence file that does not exist
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$TMP/nope" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X7 missing evidence file" 1 $?
has "$OUT" "evidence file not found" "X7 missing file refused"

# X8 unresolvable runtime sha (well-formed but not an object)
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" \
      --stage-runtime-sha deadbeefdeadbeefdeadbeefdeadbeefdeadbeef \
      --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X8 unresolvable runtime sha" 1 $?
has "$OUT" "Stage runtime commit  : BLOCKED (not a reachable commit object" "X8 runtime object validated"

# X9 a tree oid passed where a commit is expected must not satisfy the runtime gate
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1_TREE" \
      --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X9 tree oid as runtime sha" 1 $?
has "$OUT" "Stage runtime commit  : BLOCKED" "X9 object type enforced"

# X10 --ci-source with an unsupported form must block rather than pass
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" \
      --merge-check-evidence "$EV_C1" --ci-source "trustme" \
      --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "X10 unsupported ci-source" 1 $?
has "$OUT" "unsupported --ci-source" "X10 unsupported source refused"

# X11 --ci-source gh:* queried through a stubbed gh: zero check-runs must block,
# all-success must pass. This exercises the live-source code path offline.
STUB="$TMP/stub"; mkdir -p "$STUB"
# Stub shaped after the LIVE GitHub contract, verified against
# repos/:owner/:repo/commits/:sha/check-runs — each run carries name, status,
# conclusion and head_sha; status is terminal only when "completed".
cat > "$STUB/gh" <<'GH'
#!/usr/bin/env bash
run() { printf '{"name":"%s","status":"%s","conclusion":%s,"head_sha":"%s"}' "$1" "$2" "$3" "${4:-$GH_STUB_SHA}"; }
case "${GH_STUB_MODE:-ok}" in
  empty)       echo '{"total_count":0,"check_runs":[]}' ;;
  ok)          echo "{\"total_count\":2,\"check_runs\":[$(run A completed '"success"'),$(run B completed '"success"')]}" ;;
  fail)        echo "{\"total_count\":2,\"check_runs\":[$(run A completed '"success"'),$(run B completed '"failure"')]}" ;;
  # --- the audit's finding: not finished, conclusion null ---
  inprogress)  echo "{\"total_count\":1,\"check_runs\":[$(run A in_progress null)]}" ;;
  queued)      echo "{\"total_count\":1,\"check_runs\":[$(run A queued null)]}" ;;
  waiting)     echo "{\"total_count\":1,\"check_runs\":[$(run A waiting null)]}" ;;
  pending)     echo "{\"total_count\":1,\"check_runs\":[$(run A pending null)]}" ;;
  requested)   echo "{\"total_count\":1,\"check_runs\":[$(run A requested null)]}" ;;
  mixed)       echo "{\"total_count\":2,\"check_runs\":[$(run A completed '"success"'),$(run B in_progress null)]}" ;;
  nullconc)    echo "{\"total_count\":1,\"check_runs\":[$(run A completed null)]}" ;;
  neutral)     echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"neutral"')]}" ;;
  skipped)     echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"skipped"')]}" ;;
  cancelled)   echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"cancelled"')]}" ;;
  timedout)    echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"timed_out"')]}" ;;
  stale)       echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"stale"')]}" ;;
  actionreq)   echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"action_required"')]}" ;;
  foreign)     echo "{\"total_count\":1,\"check_runs\":[$(run A completed '"success"' deadbeefdeadbeefdeadbeefdeadbeefdeadbeef)]}" ;;
  truncated)   echo "{\"total_count\":5,\"check_runs\":[$(run A completed '"success"')]}" ;;
  notjson)     echo 'this is not json' ;;
  notobject)   echo '[]' ;;
  noarray)     echo '{"total_count":1}' ;;
  # conclusion nested inside another object — the old tr/grep reader was fooled by this
  nested)      echo "{\"total_count\":1,\"check_runs\":[{\"name\":\"A\",\"status\":\"in_progress\",\"conclusion\":null,\"head_sha\":\"$GH_STUB_SHA\",\"check_suite\":{\"conclusion\":\"success\"},\"output\":{\"title\":\"conclusion: success\"}}]}" ;;
  *)           echo '{}' ;;
esac
GH
chmod +x "$STUB/gh"
ci_case() { # mode expected_rc label needle
  local out rc
  out=$(PATH="$STUB:$PATH" GH_STUB_MODE="$1" GH_STUB_SHA="$C1" bash "$SCRIPT" feat/cand --remote "$R" \
        --stage-runtime-sha "$C1" --merge-check-evidence "$EV_C1" --ci-source "gh:acme/repo" \
        --deployed-workdir-tree "$C1_TREE" 2>&1); rc=$?
  rc_is "$3" "$2" $rc
  [ -n "${4:-}" ] && has "$out" "$4" "$3 — reported correctly"
  if [ "$2" != "0" ]; then hasnt "$out" "READINESS              : COMPLETE" "$3 — no false READY"; fi
}

# THE AUDIT'S FINDING: unfinished runs must never pass.
ci_case inprogress 1 "X12 status=in_progress, conclusion=null" "CI status             : INCOMPLETE"
ci_case queued     1 "X13 status=queued"                       "still running"
ci_case waiting    1 "X14 status=waiting"                      "still running"
ci_case pending    1 "X15 status=pending"                      "still running"
ci_case requested  1 "X16 status=requested"                    "still running"
ci_case mixed      1 "X17 one success + one in_progress"       "1 of 2 still running"
ci_case nullconc   1 "X18 completed but conclusion=null"       "CI status             : FAIL"
# terminal but not success
ci_case neutral    1 "X19 conclusion=neutral"                  "A(neutral)"
ci_case skipped    1 "X20 conclusion=skipped"                  "A(skipped)"
ci_case cancelled  1 "X21 conclusion=cancelled"                "A(cancelled)"
ci_case timedout   1 "X22 conclusion=timed_out"                "A(timed_out)"
ci_case stale      1 "X23 conclusion=stale"                    "A(stale)"
ci_case actionreq  1 "X24 conclusion=action_required"          "A(action_required)"
# structural integrity of the response
ci_case foreign    1 "X25 run attached to another commit"      "another commit"
ci_case truncated  1 "X26 total_count exceeds returned runs"   "does not match"
ci_case notjson    1 "X27 response is not JSON"                "not JSON"
ci_case notobject  1 "X28 response is not an object"           "not a JSON object"
ci_case noarray    1 "X29 response has no check_runs array"    "no check_runs array"
ci_case nested     1 "X30 success nested in check_suite/output" "CI status             : INCOMPLETE"
ci_case empty      1 "X31 no check-runs at all"                "no check-runs recorded"
ci_case fail       1 "X32 one failed run"                      "CI status             : FAIL"
# only the genuinely green case passes
ci_case ok         0 "X33 all runs completed successfully"     "all 2 check-runs completed successfully"

echo
echo "-- required evidence gaps --"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "missing runtime sha" 1 $?
has "$OUT" "Stage runtime commit  : BLOCKED" "missing runtime sha blocks"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" --ci-evidence "$EV_C1" --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "missing merge-check evidence" 1 $?
has "$OUT" "Canonical merge-check : BLOCKED" "missing merge-check blocks"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" --merge-check-evidence "$EV_C1" --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "missing CI evidence" 1 $?
has "$OUT" "CI status             : BLOCKED" "missing CI blocks"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" 2>&1); rc_is "missing deployed tree" 1 $?
has "$OUT" "Deployed workdir tree  : BLOCKED" "missing deployed tree blocks"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" --stage-runtime-sha "$C1" --merge-check-evidence "$EV_C1_FAIL" --ci-evidence "$EV_C1" --deployed-workdir-tree "$C1_TREE" 2>&1); rc_is "merge-check FAIL verdict" 1 $?
has "$OUT" "Canonical merge-check : FAIL" "FAIL verdict blocks"

echo
echo "-- acceptance, lock and invariant signals --"
deltag stage-ok/feat/cand
OUT=$(bash "$SCRIPT" feat/cand "${READY_ARGS[@]}" 2>&1); rc_is "missing stage-ok" 1 $?
has "$OUT" "stage-ok (exact)      : ABSENT" "missing stage-ok noted"
mktag stage-ok/feat/cand "$C0" "$OKBODY"
OUT=$(bash "$SCRIPT" feat/cand "${READY_ARGS[@]}" 2>&1); rc_is "stage-ok SHA mismatch" 1 $?
has "$OUT" "stage-ok (exact)      : MISMATCH" "mismatch noted"
mktag stage-ok/feat/cand "$C1" "$OKBODY"

mktag prod-busy "$C0" "$(printf 'Контур занят\nbranch: other/x\ndate: 2026-10-13T00:00:00Z')"
OUT=$(bash "$SCRIPT" feat/cand "${READY_ARGS[@]}" 2>&1); rc_is "prod-busy held" 1 $?
has "$OUT" "prod-busy             : HELD by 'other/x'" "prod-busy blocker noted"
deltag prod-busy

deltag stage-busy
OUT=$(bash "$SCRIPT" feat/cand "${READY_ARGS[@]}" 2>&1); rc_is "stage-busy absent" 1 $?
has "$OUT" "stage-busy            : absent" "stage-busy absence noted"
mktag stage-busy "$C1" "$BUSYBODY"

# beta ⊉ prod (fresh fixture)
SRC2="$TMP/src2"; BARE2="$TMP/remote2.git"
git init -q "$SRC2"; ( cd "$SRC2" || exit 1; git config user.email a@b.c; git config user.name t
  echo x>f; git add f; git commit -qm base; git branch beta; echo y>>f; git commit -qam prodonly; git branch -M prod; git checkout -qb feat/cand )
git clone -q --bare "$SRC2" "$BARE2"
OUT=$(bash "$SCRIPT" feat/cand --remote "$BARE2" --stage-runtime-sha "$C1" --merge-check-evidence "$EV_C1" --ci-evidence "$EV_C1" --deployed-workdir-tree "$C1_TREE" 2>&1)
printf '%s' "$OUT" | grep -q "restore before release" && no "ancestry orders restore" || ok "ancestry does not order restore"
printf '%s' "$OUT" | grep -q "beta ⊇ prod" && no "ancestry invariant still printed" || ok "ancestry invariant not printed"

# candidate not contained in beta
SRC3="$TMP/src3"; BARE3="$TMP/remote3.git"
git init -q "$SRC3"; ( cd "$SRC3" || exit 1; git config user.email a@b.c; git config user.name t
  echo base > f; git add f; git commit -qm c0; git branch -M prod; git branch beta
  git checkout -qb feat/cand; echo more >> f; git add -A; git commit -qm c1; git checkout -q prod )
git clone -q --bare "$SRC3" "$BARE3"
C1b=$(git ls-remote "$BARE3" refs/heads/feat/cand | awk '{print $1}')
C1b_TREE=$(git --git-dir="$BARE3" rev-parse "$C1b^{tree}")
printf 'sha: %s\nresult: PASS\n' "$C1b" > "$TMP/ev_c1b"; EV_C1b="$TMP/ev_c1b"
mk3(){
  local wt
  wt=$(mktemp -d "$TMP/wt.XXXXXX") || fixture_die "cannot create candidate-gap tag worktree"
  git clone -q "$BARE3" "$wt" || fixture_die "cannot clone candidate-gap tag fixture"
  git -C "$wt" config user.email "prod-readiness-selftest@example.invalid" || fixture_die "cannot configure candidate-gap user.email"
  git -C "$wt" config user.name "prod-readiness self-test" || fixture_die "cannot configure candidate-gap user.name"
  git -C "$wt" tag -f -a "$1" "$2" -m "$3" || fixture_die "cannot create candidate-gap tag $1"
  git -C "$wt" push -q -f origin "refs/tags/$1" || fixture_die "cannot push candidate-gap tag $1"
  rm -rf "$wt"
}
mk3 stage-ok/feat/cand "$C1b" "$(printf 'branch: feat/cand\nstage_sha: %s' "$C1b")"
mk3 stage-busy "$C1b" "$(printf 'branch: feat/cand')"
OUT=$(bash "$SCRIPT" feat/cand --remote "$BARE3" --stage-runtime-sha "$C1b" --merge-check-evidence "$EV_C1b" --ci-evidence "$EV_C1b" --deployed-workdir-tree "$C1b_TREE" 2>&1); rc_is "candidate NOT in beta → INCOMPLETE" 1 $?
has "$OUT" "stage-ok (exact)      : PRESENT and matches" "  (stage-ok still matches tip)"
has "$OUT" "Candidate ∈ beta      : NO" "candidate-not-in-beta gate fires"
has "$OUT" "OWNER GO               : REQUIRED" "OWNER-GO warning preserved"

echo
echo "-- errors and read-only guarantee --"
bash "$SCRIPT" feat/cand --remote "$TMP/nope.git" >/dev/null 2>&1; rc_is "remote unreadable" 3 $?
bash "$SCRIPT" >/dev/null 2>&1; rc_is "no candidate arg" 2 $?
bash "$SCRIPT" feat/cand --remote "$R" --bogus x >/dev/null 2>&1; rc_is "unknown argument" 2 $?

FB=$(git ls-remote "$R" | sort); RB=$(git show-ref | sort)
bash "$SCRIPT" feat/cand "${READY_ARGS[@]}" >/dev/null 2>&1
FA=$(git ls-remote "$R" | sort); RA=$(git show-ref | sort)
[ "$FB" = "$FA" ] && ok "no fixture tag mutation" || no "fixture tags changed"
[ "$RB" = "$RA" ] && ok "no running-repo ref mutation" || no "running-repo refs changed"

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
