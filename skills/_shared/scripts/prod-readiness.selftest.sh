#!/usr/bin/env bash
#
# prod-readiness.selftest.sh — offline tests for prod-readiness.sh against a throwaway
# local fixture remote (never the real origin). Verifies diagnosis AND no ref/tag
# mutation. Run: bash prod-readiness.selftest.sh
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/prod-readiness.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/prodrd.XXXXXX")
PASS=0; FAIL=0
trap 'rm -rf "$TMP"' EXIT
ok(){ PASS=$((PASS+1)); echo "  PASS $1"; }
no(){ FAIL=$((FAIL+1)); echo "  FAIL $1"; }
rc_is(){ [ "$2" = "$3" ] && ok "$1 (exit $3)" || no "$1 (expected $2 got $3)"; }
has(){ printf '%s' "$1" | grep -q "$2" && ok "$3" || no "$3"; }

# --- fixture: prod=c0; feat/cand adds a migration + runbook (c1); beta=c1 (⊇ prod) ---
SRC="$TMP/src"; BARE="$TMP/remote.git"
git init -q "$SRC"; ( cd "$SRC"
  git config user.email a@b.c; git config user.name t
  mkdir -p backend/prisma/migrations backend/scripts
  echo base > f; git add f; git commit -qm c0
  git branch -M prod
  git checkout -qb feat/cand
  mkdir -p backend/prisma/migrations/20260101_x
  echo "-- sql" > backend/prisma/migrations/20260101_x/migration.sql
  echo "# runbook" > backend/scripts/thing.runbook.md
  echo more >> f; git add -A; git commit -qm c1
  git branch beta        # beta = feat/cand tip (c1) → prod c0 ⊆ beta, candidate in beta
  git checkout -q prod
)
git clone -q --bare "$SRC" "$BARE"
R="$BARE"
C1=$(git ls-remote "$BARE" refs/heads/feat/cand | awk '{print $1}')
C0=$(git ls-remote "$BARE" refs/heads/prod | awk '{print $1}')

mktag(){ local wt; wt=$(mktemp -d "$TMP/wt.XXXXXX"); git clone -q "$BARE" "$wt" >/dev/null 2>&1
  ( cd "$wt" && git tag -f -a "$1" "$2" -m "$3" >/dev/null 2>&1 && git push -q -f origin "refs/tags/$1" >/dev/null 2>&1 ); rm -rf "$wt"; }
deltag(){ local wt; wt=$(mktemp -d "$TMP/wt.XXXXXX"); git clone -q "$BARE" "$wt" >/dev/null 2>&1
  ( cd "$wt" && git push -q origin ":refs/tags/$1" >/dev/null 2>&1 ); rm -rf "$wt"; }

OKBODY=$(printf 'Stage acceptance passed\nbranch: feat/cand\nbranch_sha: %s\nstage_sha: %s\ncriterion: smoke green' "$C1" "$C1")

echo "== A7 prod-readiness self-test =="

# POSITIVE: stage-ok@tip + stage-busy(feat/cand), no prod-busy
mktag stage-ok/feat/cand "$C1" "$OKBODY"
mktag stage-busy "$C1" "$(printf 'Контур занят\nbranch: feat/cand\npr: 9\ndate: 2026-10-13T00:00:00Z')"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" 2>&1); rc_is "POS all signals present" 0 $?
has "$OUT" "READINESS              : COMPLETE" "POS COMPLETE"
has "$OUT" "stage-ok (exact)      : PRESENT and matches" "POS stage-ok matches"
has "$OUT" "Migrations in candidate: YES" "POS migration detected"
has "$OUT" "DB / runtime actions   : YES" "POS DB action (runbook) detected"
has "$OUT" "OWNER GO               : REQUIRED" "POS OWNER-GO caveat present"
has "$OUT" "stage-busy            : HELD by this candidate" "POS stage-busy held by candidate"

# MISSING stage-ok
deltag stage-ok/feat/cand
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" 2>&1); rc_is "missing stage-ok" 1 $?
has "$OUT" "stage-ok (exact)      : ABSENT" "missing stage-ok noted"

# SHA MISMATCH: stage-ok points at c0, candidate tip is c1
mktag stage-ok/feat/cand "$C0" "$OKBODY"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" 2>&1); rc_is "stage-ok SHA mismatch" 1 $?
has "$OUT" "stage-ok (exact)      : MISMATCH" "mismatch noted"
mktag stage-ok/feat/cand "$C1" "$OKBODY"   # restore good

# BUSY LOCK: prod-busy held by another branch
mktag prod-busy "$C0" "$(printf 'Контур занят\nbranch: other/x\ndate: 2026-10-13T00:00:00Z')"
OUT=$(bash "$SCRIPT" feat/cand --remote "$R" 2>&1); rc_is "prod-busy held" 1 $?
has "$OUT" "prod-busy             : HELD by 'other/x'" "prod-busy blocker noted"
deltag prod-busy

# beta ⊉ prod violation (fresh fixture)
SRC2="$TMP/src2"; BARE2="$TMP/remote2.git"
git init -q "$SRC2"; ( cd "$SRC2"; git config user.email a@b.c; git config user.name t
  echo x>f; git add f; git commit -qm base; git branch beta; echo y>>f; git commit -qam prodonly; git branch -M prod; git checkout -qb feat/cand )
git clone -q --bare "$SRC2" "$BARE2"
OUT=$(bash "$SCRIPT" feat/cand --remote "$BARE2" 2>&1); rc_is "beta ⊉ prod" 1 $?
has "$OUT" "beta ⊇ prod           : VIOLATED" "beta⊉prod noted"

# CANDIDATE NOT IN BETA (the critical fix): beta ⊇ prod OK, stage-ok matches tip,
# stage-busy held by candidate, but beta does NOT contain the candidate → INCOMPLETE.
SRC3="$TMP/src3"; BARE3="$TMP/remote3.git"
git init -q "$SRC3"; ( cd "$SRC3"; git config user.email a@b.c; git config user.name t
  echo base > f; git add f; git commit -qm c0
  git branch -M prod
  git branch beta                     # beta = prod (c0) → beta ⊇ prod OK, but will NOT contain c1
  git checkout -qb feat/cand
  echo more >> f; git add -A; git commit -qm c1   # candidate tip c1, NOT in beta
  git checkout -q prod )
git clone -q --bare "$SRC3" "$BARE3"
C1b=$(git ls-remote "$BARE3" refs/heads/feat/cand | awk '{print $1}')
BODY3=$(printf 'Stage acceptance passed\nbranch: feat/cand\nbranch_sha: %s\nstage_sha: %s' "$C1b" "$C1b")
mk3(){ local wt; wt=$(mktemp -d "$TMP/wt.XXXXXX"); git clone -q "$BARE3" "$wt" >/dev/null 2>&1
  ( cd "$wt" && git tag -f -a "$1" "$2" -m "$3" >/dev/null 2>&1 && git push -q -f origin "refs/tags/$1" >/dev/null 2>&1 ); rm -rf "$wt"; }
mk3 stage-ok/feat/cand "$C1b" "$BODY3"
mk3 stage-busy "$C1b" "$(printf 'branch: feat/cand\ndate: 2026-10-13T00:00:00Z')"
OUT=$(bash "$SCRIPT" feat/cand --remote "$BARE3" 2>&1); RC=$?
rc_is "candidate NOT in beta → INCOMPLETE" 1 $RC
has "$OUT" "beta ⊇ prod           : OK" "  (beta ⊇ prod still OK)"
has "$OUT" "stage-ok (exact)      : PRESENT and matches" "  (stage-ok still matches tip)"
has "$OUT" "Candidate ∈ beta      : NO" "candidate-not-in-beta gate fires"
has "$OUT" "READINESS              : INCOMPLETE" "INCOMPLETE despite stage-ok+stage-busy"
has "$OUT" "OWNER GO               : REQUIRED" "OWNER-GO warning preserved"

# GIT/NETWORK error
bash "$SCRIPT" feat/cand --remote "$TMP/nope.git" >/dev/null 2>&1; rc_is "remote unreadable" 3 $?

# bad args
bash "$SCRIPT" >/dev/null 2>&1; rc_is "no candidate arg" 2 $?

# NO MUTATION of refs/tags (fixture + running repo)
FB=$(git ls-remote "$R" | sort); RB=$(git show-ref | sort)
bash "$SCRIPT" feat/cand --remote "$R" >/dev/null 2>&1
FA=$(git ls-remote "$R" | sort); RA=$(git show-ref | sort)
[ "$FB" = "$FA" ] && ok "no fixture tag mutation" || no "fixture tags changed"
[ "$RB" = "$RA" ] && ok "no running-repo ref mutation" || no "running-repo refs changed"

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
