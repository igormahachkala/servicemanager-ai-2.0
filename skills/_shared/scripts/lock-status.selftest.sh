#!/usr/bin/env bash
#
# lock-status.selftest.sh — offline tests for lock-status.sh using a throwaway local
# fixture remote (never the real origin). Verifies classification AND that the script
# mutates no refs/tags. Run: bash lock-status.selftest.sh
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/lock-status.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/lockst.XXXXXX")
PASS=0; FAIL=0
trap 'rm -rf "$TMP"' EXIT
ok(){ PASS=$((PASS+1)); echo "  PASS $1"; }
no(){ FAIL=$((FAIL+1)); echo "  FAIL $1"; }
rc_is(){ [ "$2" = "$3" ] && ok "$1 (exit $3)" || no "$1 (expected $2 got $3)"; }
has(){ printf '%s' "$1" | grep -q "$2" && ok "$3" || no "$3"; }

iso_now(){ date -u +%Y-%m-%dT%H:%M:%SZ; }
iso_old(){ date -u -d '10 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-10H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null; }
iso_hours_ago(){ date -u -d "$1 hours ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"$1"H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null; }

# --- build fixture: src repo + bare remote; prod ⊆ beta -----------------------
SRC="$TMP/src"; BARE="$TMP/remote.git"
git init -q "$SRC"; ( cd "$SRC"
  git config user.email a@b.c; git config user.name t
  echo one > f; git add f; git commit -qm c0
  git branch -M prod
  echo two >> f; git commit -qamc1
  git branch beta
  git update-ref refs/heads/prod HEAD~1   # prod at c0, beta at c1 → beta ⊇ prod
)
git clone -q --bare "$SRC" "$BARE"
REMOTE="$BARE"
# helper to (re)create an annotated tag in the fixture bare repo
mktag(){ # name target-ref body
  local wt; wt=$(mktemp -d "$TMP/wt.XXXXXX")
  git clone -q "$BARE" "$wt" >/dev/null 2>&1
  ( cd "$wt" && git tag -f -a "$1" "$(git rev-parse "$2")" -m "$3" >/dev/null 2>&1 && git push -q -f origin "refs/tags/$1" >/dev/null 2>&1 )
  rm -rf "$wt"
}
deltag(){ local wt; wt=$(mktemp -d "$TMP/wt.XXXXXX"); git clone -q "$BARE" "$wt" >/dev/null 2>&1; ( cd "$wt" && git push -q origin ":refs/tags/$1" >/dev/null 2>&1 ); rm -rf "$wt"; }

echo "== A5 lock-status self-test =="

# S1 both locks absent
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1); rc_is "S1 both absent" 0 $?
has "$OUT" "Stage       : FREE" "S1 Stage FREE"
has "$OUT" "Production  : FREE" "S1 Production FREE"
has "$OUT" "FREE.*means only that no lock" "S1 FREE≠authorization caveat present"
has "$OUT" "OK (prod" "S1 beta ⊇ prod OK"
has "$OUT" "Stale thresholds     : stage=4h, production=2h" "S1 protocol stale thresholds"

# S2 stage lock present
mktag stage-busy origin/beta "$(printf 'Контур занят\nbranch: feat/x\npr: 7\ndate: %s' "$(iso_now)")"
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1)
has "$OUT" "Stage       : BUSY" "S2 Stage BUSY"
has "$OUT" "Related release   : feat/x" "S2 related release parsed"

# S3 production lock present (stage absent)
deltag stage-busy
mktag prod-busy origin/prod "$(printf 'Контур занят\nbranch: feat/y\ndate: %s' "$(iso_now)")"
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1)
has "$OUT" "Production  : BUSY" "S3 Production BUSY"
has "$OUT" "Stage       : FREE" "S3 Stage FREE"

# S4 both locks present
mktag stage-busy origin/beta "$(printf 'branch: feat/x\ndate: %s' "$(iso_now)")"
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1)
has "$OUT" "Stage       : BUSY" "S4 Stage BUSY"
has "$OUT" "Production  : BUSY" "S4 Production BUSY"

# S5 stage-ok present
mktag stage-ok/feat/x origin/prod "$(printf 'Stage acceptance passed\nbranch: feat/x\ndate: %s' "$(iso_now)")"
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1)
has "$OUT" "Stage acceptance tag: present" "S5 acceptance present"
has "$OUT" "stage-ok/feat/x" "S5 stage-ok listed"

# S6 stage stale threshold: 10h old stage lock is stale under 4h protocol threshold.
deltag stage-busy
mktag stage-busy origin/beta "$(printf 'branch: feat/stale\ndate: %s' "$(iso_old)")"
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1)
has "$OUT" "Stage lock (stage-busy):" "S6 stage section present"
has "$OUT" "Stale threshold   : 4h" "S6 stage threshold 4h"
has "$OUT" "Stale suspect     : YES (age ≥ 4h" "S6 stage stale suspect flagged"
has "$OUT" "FLAG ONLY, no cleanup" "S6 flag-only (no cleanup)"

# S6b production stale threshold: 3h old prod lock is stale under 2h protocol
# threshold, while a 3h stage lock is NOT stale under the 4h stage threshold.
mktag stage-busy origin/beta "$(printf 'branch: feat/not-stale-stage\ndate: %s' "$(iso_hours_ago 3)")"
mktag prod-busy origin/prod "$(printf 'branch: feat/stale-prod\ndate: %s' "$(iso_hours_ago 3)")"
OUT=$(bash "$SCRIPT" --remote "$REMOTE" 2>&1)
has "$OUT" "Stale threshold   : 2h" "S6b production threshold 2h"
printf '%s' "$OUT" | grep -q "Stale lock suspects.*prod-busy" && ok "S6b production stale suspect flagged at 3h" || no "S6b production stale suspect flagged at 3h"
printf '%s' "$OUT" | grep -q "stage-busy(3h)" && no "S6b stage incorrectly stale at 3h" || ok "S6b stage not stale at 3h"

# S6c custom thresholds remain per-lane, not a single shared threshold.
OUT=$(bash "$SCRIPT" --remote "$REMOTE" --stage-stale-hours 3 --prod-stale-hours 1 2>&1)
has "$OUT" "Stale thresholds     : stage=3h, production=1h" "S6c custom per-lane thresholds"

# S7 beta NOT containing prod (fresh fixture where prod has a commit beta lacks)
SRC2="$TMP/src2"; BARE2="$TMP/remote2.git"
git init -q "$SRC2"; ( cd "$SRC2"
  git config user.email a@b.c; git config user.name t
  echo x > f; git add f; git commit -qm base
  git branch beta
  echo y >> f; git commit -qam prod-only   # prod ahead of beta
  git branch -M prod
)
git clone -q --bare "$SRC2" "$BARE2"
OUT=$(bash "$SCRIPT" --remote "$BARE2" 2>&1)
has "$OUT" "VIOLATED" "S7 beta ⊉ prod → VIOLATED"

# S8 git/network failure
bash "$SCRIPT" --remote "$TMP/does-not-exist.git" >/dev/null 2>&1; rc_is "S8 remote unreadable" 3 $?

# S9 no mutation of refs/tags (fixture tags + running-repo refs unchanged)
FIX_BEFORE=$(git ls-remote "$REMOTE" | sort)
REPO_REFS_BEFORE=$(git show-ref | sort)
bash "$SCRIPT" --remote "$REMOTE" >/dev/null 2>&1
FIX_AFTER=$(git ls-remote "$REMOTE" | sort)
REPO_REFS_AFTER=$(git show-ref | sort)
[ "$FIX_BEFORE" = "$FIX_AFTER" ] && ok "S9 fixture tags unchanged" || no "S9 fixture tags changed"
[ "$REPO_REFS_BEFORE" = "$REPO_REFS_AFTER" ] && ok "S9 running-repo refs unchanged" || no "S9 running-repo refs changed"

# bad args
bash "$SCRIPT" --bogus >/dev/null 2>&1; rc_is "bad args" 2 $?
bash "$SCRIPT" --stage-stale-hours nope >/dev/null 2>&1; rc_is "bad stage threshold" 2 $?
bash "$SCRIPT" --prod-stale-hours nope >/dev/null 2>&1; rc_is "bad prod threshold" 2 $?

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
