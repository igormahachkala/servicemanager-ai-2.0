#!/usr/bin/env bash
#
# reconcile-preflight.sh — A1 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# READ-ONLY release-preparation preflight for one candidate against a target
# contour branch (default origin/prod). It answers, in one command, the manual
# checks every candidate prep repeats: current SHAs, the beta ⊇ prod invariant,
# file overlap with Production, a conflict-free merge simulation, candidate-delta
# preservation, and schema/migration presence.
#
# It does NOT mutate branches, push, deploy, touch the database, take locks, or
# change the protocol. The merge is simulated with `git merge-tree --write-tree`,
# which writes only loose objects to the object store and never moves a ref or the
# working tree. This preflight is advisory: it never replaces a gate in
# sma-deploy-stage / sma-deploy-prod.
#
# Usage:
#   reconcile-preflight.sh <candidate-ref> [target-ref] [beta-ref]
#     candidate-ref  branch or SHA of the release candidate (required)
#     target-ref     contour base to reconcile onto   (default: origin/prod)
#     beta-ref       beta branch for the invariant     (default: origin/beta)
#
# Exit codes:
#   0  ready for release preparation (merge simulation is conflict-free)
#   1  merge conflicts — reconciliation needs manual resolution
#   2  bad arguments / unknown ref
#   3  git or fetch failure
#   4  git too old (needs merge-tree --write-tree, git >= 2.38)
#
set -u

TARGET_DEFAULT="origin/prod"
BETA_DEFAULT="origin/beta"

die() { echo "reconcile-preflight: $1" >&2; exit "${2:-2}"; }

[ $# -ge 1 ] || die "usage: reconcile-preflight.sh <candidate-ref> [target-ref] [beta-ref]" 2
CAND_REF="$1"
TARGET_REF="${2:-$TARGET_DEFAULT}"
BETA_REF="${3:-$BETA_DEFAULT}"

git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository" 3

# git >= 2.38 for `merge-tree --write-tree`
if ! git merge-tree --write-tree HEAD HEAD >/dev/null 2>&1; then
  die "git is too old: need 'merge-tree --write-tree' (git >= 2.38)" 4
fi

# 1. Fresh fetch (read-only: updates remote-tracking refs only, no local branch moved).
git fetch --quiet --prune origin 2>/dev/null || die "git fetch origin failed" 3

# Resolve refs.
CAND=$(git rev-parse --verify --quiet "${CAND_REF}^{commit}") || die "unknown candidate ref: $CAND_REF" 2
PROD=$(git rev-parse --verify --quiet "${TARGET_REF}^{commit}") || die "unknown target ref: $TARGET_REF" 2
BETA=$(git rev-parse --verify --quiet "${BETA_REF}^{commit}" || true)   # beta is optional/advisory

BASE=$(git merge-base "$CAND" "$PROD" 2>/dev/null) || die "no merge-base between candidate and target" 3

# 3. beta ⊇ prod invariant (advisory; prod must be an ancestor of beta).
if [ -n "$BETA" ]; then
  if git merge-base --is-ancestor "$PROD" "$BETA" 2>/dev/null; then BETA_INV="OK (prod ⊆ beta)"; else BETA_INV="VIOLATED (beta behind prod — restore before release)"; fi
else
  BETA_INV="unknown (beta ref '$BETA_REF' not found)"
fi

# Already in target?
if git merge-base --is-ancestor "$CAND" "$PROD" 2>/dev/null; then ALREADY_IN="YES (candidate already in target)"; else ALREADY_IN="no"; fi

# 4. File overlap: candidate delta (base..cand) ∩ prod delta (base..prod).
CAND_FILES=$(git diff --name-only "$BASE" "$CAND" | sort)
PROD_FILES=$(git diff --name-only "$BASE" "$PROD" | sort)
OVERLAP=$(comm -12 <(printf '%s\n' "$CAND_FILES") <(printf '%s\n' "$PROD_FILES"))
OVERLAP_N=$(printf '%s' "$OVERLAP" | grep -c . || true)

# 5. Dry-run merge (read-only; writes objects only, no ref/worktree change).
MT_OUT=$(git merge-tree --write-tree --name-only "$PROD" "$CAND" 2>/dev/null)
MT_RC=$?
MERGED_TREE=$(printf '%s\n' "$MT_OUT" | sed -n '1p')
if [ "$MT_RC" -eq 0 ]; then
  CONFLICTS=""
  CONFLICTS_N=0
else
  # `merge-tree --write-tree --name-only` output: line 1 = merged tree OID; lines 2..N
  # = conflicted file names; then a blank line; then an informational block
  # (Auto-merging / CONFLICT …). Take only the file-name list, up to the first blank line.
  CONFLICTS=$(printf '%s\n' "$MT_OUT" | tail -n +2 | awk 'NF==0{exit} {print}')
  CONFLICTS_N=$(printf '%s' "$CONFLICTS" | grep -c . || true)
fi

# 6. Candidate-delta preservation: reconciled delta (prod..merged) file set == candidate delta.
TREE_EQUIV="n/a (merge had conflicts)"
if [ "$MT_RC" -eq 0 ] && [ -n "$MERGED_TREE" ]; then
  RECON_FILES=$(git diff --name-only "$PROD" "$MERGED_TREE" | sort)
  if [ "$RECON_FILES" = "$CAND_FILES" ]; then
    TREE_EQUIV="EQUAL (reconciled delta == candidate delta; nothing added/lost)"
  else
    TREE_EQUIV="DIFFERS (reconciled file set != candidate file set — inspect)"
    EXTRA=$(comm -13 <(printf '%s\n' "$CAND_FILES") <(printf '%s\n' "$RECON_FILES"))
    MISSING=$(comm -23 <(printf '%s\n' "$CAND_FILES") <(printf '%s\n' "$RECON_FILES"))
  fi
fi

# 7. Schema / migration changes in the candidate delta.
MIG=$(printf '%s\n' "$CAND_FILES" | grep -iE 'prisma/migrations/|schema\.prisma' || true)
MIG_N=$(printf '%s' "$MIG" | grep -c . || true)

# 8. Report.
echo "RELEASE PREFLIGHT"
echo
echo "  Production SHA        : $PROD  ($TARGET_REF)"
echo "  Beta SHA              : ${BETA:-<none>}  ($BETA_REF)"
echo "  Candidate SHA         : $CAND  ($CAND_REF)"
echo "  Merge-base            : $BASE"
echo "  Candidate in target   : $ALREADY_IN"
echo "  beta ⊇ prod invariant : $BETA_INV"
echo
echo "  Overlap               : $OVERLAP_N file(s) changed by BOTH candidate and Production since base"
if [ "$OVERLAP_N" -gt 0 ]; then printf '%s\n' "$OVERLAP" | sed 's|^|      - |'; fi
echo
if [ "$CONFLICTS_N" -eq 0 ]; then
  echo "  Merge conflicts       : NONE (clean merge simulation)"
else
  echo "  Merge conflicts       : $CONFLICTS_N file(s)"
  printf '%s\n' "$CONFLICTS" | sed 's|^|      - |'
fi
echo
echo "  Tree equivalence      : $TREE_EQUIV"
if [ -n "${EXTRA:-}" ]; then printf '%s\n' "$EXTRA" | sed 's|^|      + extra: |'; fi
if [ -n "${MISSING:-}" ]; then printf '%s\n' "$MISSING" | sed 's|^|      - missing: |'; fi
echo
if [ "$MIG_N" -eq 0 ]; then
  echo "  Migration changes     : NONE"
else
  echo "  Migration changes     : $MIG_N file(s)"
  printf '%s\n' "$MIG" | sed 's|^|      - |'
fi
echo
if [ "$CONFLICTS_N" -eq 0 ]; then
  echo "  READY FOR RELEASE PREPARATION : YES"
  [ "$MIG_N" -gt 0 ] && echo "    note: candidate carries migration(s) — route through the has_migration path."
  echo
  echo "  (Preflight only — the sma-deploy-stage / sma-deploy-prod gates are unchanged.)"
  exit 0
else
  echo "  READY FOR RELEASE PREPARATION : NO (resolve the conflicts above in the task branch)"
  echo
  echo "  (Preflight only — the sma-deploy-stage / sma-deploy-prod gates are unchanged.)"
  exit 1
fi
