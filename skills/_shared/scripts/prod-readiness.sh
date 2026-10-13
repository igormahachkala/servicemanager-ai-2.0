#!/usr/bin/env bash
#
# prod-readiness.sh — A7 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# READ-ONLY aggregator of the Production-readiness signals for one candidate:
# current prod/beta SHAs, the beta ⊇ prod invariant, a stage-ok tag that matches
# the exact candidate, the stage-busy / prod-busy lock state, migrations and DB
# actions carried by the candidate, and whether anything looks unfinished.
#
# HARD RULE: this tool DIAGNOSES ONLY. A complete set of green signals (and the
# absence of a lock) is NOT authorization — it never permits or performs a
# Production deployment. Promotion to Production requires explicit OWNER GO and is
# executed only through sma-deploy-prod. The report states this every run.
#
# No merge, no deploy, no DB access, no tag/ref creation or mutation, no automatic
# authorization, no release-protocol change. Reads use `git ls-remote` plus a
# transient object-only fetch (--no-write-fetch-head: loose objects only; no
# FETCH_HEAD, no ref, no tag).
#
# Usage:   prod-readiness.sh <candidate-branch-or-sha> [--remote REMOTE]
# Default: --remote origin
#
# Exit codes:
#   0  all readiness signals present (NOT authorization)
#   1  readiness incomplete (a signal is missing / a lock blocks)
#   2  bad arguments / unknown candidate
#   3  git / network failure
#
set -u

REMOTE="origin"
CAND_REF=""
die() { echo "prod-readiness: $1" >&2; exit "${2:-2}"; }

[ $# -ge 1 ] || die "usage: prod-readiness.sh <candidate-branch-or-sha> [--remote REMOTE]" 2
CAND_REF="$1"; shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="${2:-}"; shift 2 || die "--remote needs a value" ;;
    *) die "unknown argument: $1" ;;
  esac
done
command -v git >/dev/null 2>&1 || die "git not found" 3

LS=$(git ls-remote "$REMOTE" 2>/dev/null) || die "cannot read remote '$REMOTE'" 3
[ -n "$LS" ] || die "empty ls-remote from '$REMOTE' (network failure?)" 3
ref_sha(){ printf '%s\n' "$LS" | awk -v r="$1" '$2==r{print $1; exit}'; }
tag_commit(){ local p; p=$(ref_sha "refs/tags/$1^{}"); [ -n "$p" ] && printf '%s' "$p" || ref_sha "refs/tags/$1"; }

PROD_SHA=$(ref_sha "refs/heads/prod")
BETA_SHA=$(ref_sha "refs/heads/beta")

# Resolve the candidate: a branch on the remote, or a raw SHA.
CAND_BRANCH=""
CAND_SHA=$(ref_sha "refs/heads/$CAND_REF")
if [ -n "$CAND_SHA" ]; then CAND_BRANCH="$CAND_REF"; else CAND_SHA="$CAND_REF"; fi

STAGE_OK_TAG="stage-ok/${CAND_BRANCH}"
STAGE_OK_COMMIT=$( [ -n "$CAND_BRANCH" ] && tag_commit "$STAGE_OK_TAG" || true )

# Transient object fetch (only refs present) so cat-file + ancestry work.
FETCH=""
for r in "refs/heads/prod" "refs/heads/beta" "refs/tags/stage-busy" "refs/tags/prod-busy" \
         $( [ -n "$CAND_BRANCH" ] && echo "refs/heads/$CAND_BRANCH refs/tags/$STAGE_OK_TAG" ); do
  [ -n "$(ref_sha "$r")" ] && FETCH="$FETCH $r"
done
[ -n "$FETCH" ] && git fetch -q --no-write-fetch-head --no-tags "$REMOTE" $FETCH >/dev/null 2>&1 || true
# Make sure the candidate object is present (if it is a raw SHA not under a ref).
git cat-file -e "$CAND_SHA" 2>/dev/null || git fetch -q --no-write-fetch-head --no-tags "$REMOTE" "$CAND_SHA" >/dev/null 2>&1 || true

tag_body(){ local o; o=$(ref_sha "refs/tags/$1"); [ -n "$o" ] && git cat-file -p "$o" 2>/dev/null | sed -n '/^$/,$p' | sed '1d' || true; }
tag_field(){ tag_body "$1" | sed -n "s/^$2:[[:space:]]*//p" | head -1; }

INCOMPLETE=0
note_missing(){ INCOMPLETE=1; }

echo "PRODUCTION READINESS   (remote: $REMOTE)"
echo
echo "  Candidate             : $CAND_REF" ; [ -n "$CAND_BRANCH" ] && echo "    branch tip SHA      : $CAND_SHA" || echo "    (raw SHA)           : $CAND_SHA"
echo "  Current Production SHA: ${PROD_SHA:-<none>}"
echo "  Current beta SHA      : ${BETA_SHA:-<none>}"
echo

# beta ⊇ prod
echo -n "  beta ⊇ prod           : "
if [ -n "$PROD_SHA" ] && [ -n "$BETA_SHA" ] && git cat-file -e "$PROD_SHA" 2>/dev/null && git cat-file -e "$BETA_SHA" 2>/dev/null; then
  if git merge-base --is-ancestor "$PROD_SHA" "$BETA_SHA" 2>/dev/null; then echo "OK"; else echo "VIOLATED (restore before release)"; note_missing; fi
else echo "UNKNOWN (objects unavailable)"; note_missing; fi

# already in prod?
if [ -n "$PROD_SHA" ] && git cat-file -e "$CAND_SHA" 2>/dev/null && git merge-base --is-ancestor "$CAND_SHA" "$PROD_SHA" 2>/dev/null; then
  echo "  Candidate vs prod     : ALREADY IN PRODUCTION"
else
  echo "  Candidate vs prod     : not yet in prod"
fi

# stage-ok for the EXACT candidate
echo -n "  stage-ok (exact)      : "
if [ -z "$CAND_BRANCH" ]; then
  echo "N/A (candidate given as raw SHA; stage-ok is keyed by branch)"; note_missing
elif [ -z "$STAGE_OK_COMMIT" ]; then
  echo "ABSENT ($STAGE_OK_TAG not found)"; note_missing
elif [ "$STAGE_OK_COMMIT" = "$CAND_SHA" ]; then
  echo "PRESENT and matches candidate tip"
else
  echo "MISMATCH (tag at $STAGE_OK_COMMIT, candidate tip $CAND_SHA — re-accept on current tip)"; note_missing
fi
# acceptance confirmation from the tag body
if [ -n "$STAGE_OK_COMMIT" ]; then
  acc_branch=$(tag_field "$STAGE_OK_TAG" branch); acc_stage=$(tag_field "$STAGE_OK_TAG" stage_sha); acc_crit=$(tag_field "$STAGE_OK_TAG" criterion)
  echo "    acceptance branch   : ${acc_branch:-<none>}"
  echo "    accepted stage_sha  : ${acc_stage:-<none>}"
  [ -n "$acc_crit" ] && echo "    criterion           : $acc_crit"
fi

# locks
SB_BRANCH=$(tag_field stage-busy branch); SB_EXISTS=$( [ -n "$(tag_commit stage-busy)" ] && echo yes || echo no )
PB_BRANCH=$(tag_field prod-busy branch);  PB_EXISTS=$( [ -n "$(tag_commit prod-busy)" ] && echo yes || echo no )
echo -n "  stage-busy            : "
if [ "$SB_EXISTS" = yes ]; then
  if [ -n "$CAND_BRANCH" ] && [ "$SB_BRANCH" = "$CAND_BRANCH" ]; then echo "HELD by this candidate ($SB_BRANCH) — expected until prod"; else echo "HELD by '${SB_BRANCH:-?}' (another candidate holds the Stage lane)"; note_missing; fi
else
  echo "absent (per protocol it is held until the code reaches prod — verify the candidate is still in flight)"
fi
echo -n "  prod-busy             : "
if [ "$PB_EXISTS" = yes ]; then echo "HELD by '${PB_BRANCH:-?}' (Production lane busy)"; note_missing; else echo "absent (Production lane technically free — NOT authorization)"; fi

# migrations + DB actions carried by the candidate (delta vs merge-base with prod)
echo
MIG="?"; DBACT="?"
if git cat-file -e "$CAND_SHA" 2>/dev/null && [ -n "$PROD_SHA" ] && git cat-file -e "$PROD_SHA" 2>/dev/null; then
  BASE=$(git merge-base "$CAND_SHA" "$PROD_SHA" 2>/dev/null)
  if [ -n "$BASE" ]; then
    FILES=$(git diff --name-only "$BASE" "$CAND_SHA" 2>/dev/null)
    MIGF=$(printf '%s\n' "$FILES" | grep -iE 'prisma/migrations/|schema\.prisma' || true)
    DBF=$(printf '%s\n' "$FILES" | grep -iE 'runbook\.md|bootstrap-|backfill|seed-|RolePermission' || true)
    MIG=$( [ -n "$MIGF" ] && echo "YES" || echo "none" )
    DBACT=$( [ -n "$DBF" ] && echo "YES" || echo "none" )
    echo "  Migrations in candidate: $MIG"
    [ -n "$MIGF" ] && printf '%s\n' "$MIGF" | sed 's|^|      - |'
    echo "  DB / runtime actions   : $DBACT"
    [ -n "$DBF" ] && { printf '%s\n' "$DBF" | sed 's|^|      - |'; echo "      (these require OWNER-controlled runtime steps — not performed here)"; }
  fi
fi
[ "$MIG" = "?" ] && echo "  Migrations in candidate: UNKNOWN (candidate/prod objects unavailable)"
[ "$DBACT" = "?" ] && echo "  DB / runtime actions   : UNKNOWN"

# unfinished-operations heuristic from available data
echo
if [ "$INCOMPLETE" -eq 0 ]; then
  echo "  Unfinished operations  : none detected in the available data"
  echo
  echo "  READINESS              : COMPLETE — all signals present"
  RC=0
else
  echo "  Unfinished operations  : readiness signals missing or a lock blocks (see above)"
  echo
  echo "  READINESS              : INCOMPLETE"
  RC=1
fi
echo
echo "  OWNER GO               : REQUIRED. Readiness is NOT authorization."
echo "    - A complete checklist and an absent prod-busy do NOT permit deployment."
echo "    - Production promotion runs only via sma-deploy-prod, on explicit OWNER command."
echo "    - Migrations and DB/runtime actions above are OWNER-controlled steps, not run here."
echo
echo "  (Read-only diagnosis — no merge, deploy, DB, tag/ref change, or authorization.)"
exit $RC
