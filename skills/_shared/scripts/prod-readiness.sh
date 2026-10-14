#!/usr/bin/env bash
#
# prod-readiness.sh — A7 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# READ-ONLY aggregator of the Production-readiness signals for one candidate:
# current prod/beta SHAs, the beta ⊇ prod invariant, candidate containment in
# current beta, a stage-ok tag that matches the exact candidate, actual Stage
# runtime SHA evidence, canonical merge-check / CI evidence, Production tree
# identity evidence, the stage-busy / prod-busy lock state, migrations and DB
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
# WHAT AN INDEPENDENT AUDIT FOUND, AND WHAT CHANGED
# -------------------------------------------------
# The first revision accepted three of its gates on the operator's word, so a
# complete-looking report could be produced for a candidate that was not running
# on Stage at all. The audit demonstrated READINESS: COMPLETE with exit 0 while
# the candidate was absent from the Stage runtime. Each gate now verifies.
#
#   1. merge-check / CI were free-text. "--merge-check PASS" was proof of nothing:
#      any string spelled PASS satisfied it, and a genuine PASS belonging to a
#      DIFFERENT commit satisfied it too. Both now require evidence BOUND TO THE
#      CANDIDATE SHA — either an evidence file that names the sha it attests to,
#      or a live query against the forge for that exact sha.
#
#   2. the Production tree was a string comparison. "--expected-production-tree
#      TOTALLY_FAKE_TREE --actual-production-tree TOTALLY_FAKE_TREE" reported OK.
#      The expected tree is no longer taken from the caller at all: it is derived
#      from the candidate commit with git. The actual tree must resolve to a real
#      tree OBJECT, and an --expected-production-tree, if given, must agree with
#      the derived one.
#
#   3. the Stage runtime was only compared with the stage_sha recorded in the
#      stage-ok tag — two numbers agreeing with each other while neither had any
#      relation to the candidate. The runtime sha must now be a real commit AND
#      the candidate must be an ANCESTOR of it: the accepted code has to be inside
#      the build that is actually running.
#
# The set of mandatory gates is unchanged — nothing was added or removed. Only the
# verification behind three existing gates changed, from assertion to evidence.
# What did change is the invocation contract: free-text --merge-check/--ci are
# refused, and evidence must be supplied in a verifiable form.
#
# Usage:   prod-readiness.sh <candidate-branch-or-sha> [--remote REMOTE]
#          --stage-runtime-sha SHA
#          --merge-check-evidence FILE
#          ( --ci-evidence FILE | --ci-source gh:<owner/repo> )
#          --actual-production-tree TREE
#          [--expected-production-tree TREE]   # optional cross-check
# Default: --remote origin
#
# EVIDENCE FILE FORMAT (merge-check and CI alike), '#' starts a comment:
#       sha:    <40-hex commit the evidence attests to>
#       result: PASS            # or OK / SUCCESS
#       source: <url or run id> # optional, recorded in the report
# The sha MUST equal the candidate tip; evidence for another commit is refused.
#
# --ci-source gh:<owner/repo> queries check-runs for the candidate sha via the gh
# CLI and requires at least one run, all concluded successfully. That is a read of
# the authoritative source rather than a claim about it.
#
# Exit codes:
#   0  all readiness signals present (NOT authorization)
#   1  readiness incomplete (a signal is missing / a lock blocks)
#   2  bad arguments / unknown candidate / unverifiable evidence form
#   3  git / network failure
#
set -u

REMOTE="origin"
CAND_REF=""
STAGE_RUNTIME_SHA=""
MERGE_CHECK_EVIDENCE=""
CI_EVIDENCE=""
CI_SOURCE=""
EXPECTED_PROD_TREE=""
ACTUAL_PROD_TREE=""
die() { echo "prod-readiness: $1" >&2; exit "${2:-2}"; }

[ $# -ge 1 ] || die "usage: prod-readiness.sh <candidate-branch-or-sha> [--remote REMOTE]" 2
CAND_REF="$1"; shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="${2:-}"; shift 2 || die "--remote needs a value" ;;
    --stage-runtime-sha) STAGE_RUNTIME_SHA="${2:-}"; shift 2 || die "--stage-runtime-sha needs a value" ;;
    --merge-check-evidence) MERGE_CHECK_EVIDENCE="${2:-}"; shift 2 || die "--merge-check-evidence needs a value" ;;
    --ci-evidence) CI_EVIDENCE="${2:-}"; shift 2 || die "--ci-evidence needs a value" ;;
    --ci-source) CI_SOURCE="${2:-}"; shift 2 || die "--ci-source needs a value" ;;
    --expected-production-tree) EXPECTED_PROD_TREE="${2:-}"; shift 2 || die "--expected-production-tree needs a value" ;;
    --actual-production-tree) ACTUAL_PROD_TREE="${2:-}"; shift 2 || die "--actual-production-tree needs a value" ;;
    # Refused on purpose: these took the operator's word and were the false READY.
    --merge-check|--ci)
      die "'$1' is no longer accepted: a bare verdict is not evidence — it passed for
              any string spelled PASS, and for a real PASS belonging to another commit.
              Use --merge-check-evidence FILE / --ci-evidence FILE (a file naming the
              sha it attests to) or --ci-source gh:<owner/repo>." 2 ;;
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
ok_value() {
  case "$1" in PASS|pass|OK|ok|SUCCESS|success|passed|Passed) return 0;; *) return 1;; esac
}
# --- object validators -------------------------------------------------------
# Resolve a value to an object of an expected type. Prints the resolved oid on
# success, nothing otherwise. A string that is not a git object cannot pass:
# that is what let TOTALLY_FAKE_TREE through before.
resolve_object() { # value expected-type
  local val="$1" want="$2" oid got
  [ -n "$val" ] || return 1
  oid=$(git rev-parse --verify --quiet "$val" 2>/dev/null) || return 1
  [ -n "$oid" ] || return 1
  got=$(git cat-file -t "$oid" 2>/dev/null) || return 1
  [ "$got" = "$want" ] || return 1
  printf '%s' "$oid"
}

# --- evidence files ----------------------------------------------------------
# A verdict is accepted only when it is bound to the candidate sha. The file
# names the commit it attests to; evidence for a different commit is refused,
# which is the case a bare "PASS" could never distinguish.
ev_field() { # file key
  sed 's/#.*$//' "$1" 2>/dev/null | sed -n "s/^[[:space:]]*$2:[[:space:]]*//p" | head -1 | tr -d '[:space:]'
}
check_evidence_file() { # label file candidate_sha
  local label="$1" file="$2" want="$3" sha result src
  echo -n "  $label"
  if [ -z "$file" ]; then
    echo "BLOCKED (verifiable evidence required)"; note_missing; return
  fi
  if [ ! -f "$file" ]; then
    echo "BLOCKED (evidence file not found: $file)"; note_missing; return
  fi
  sha=$(ev_field "$file" sha)
  result=$(ev_field "$file" result)
  src=$(sed 's/#.*$//' "$file" 2>/dev/null | sed -n 's/^[[:space:]]*source:[[:space:]]*//p' | head -1)
  if [ -z "$sha" ] || [ -z "$result" ]; then
    echo "BLOCKED (evidence file must carry 'sha:' and 'result:')"; note_missing; return
  fi
  if [ "$sha" != "$want" ]; then
    echo "REJECTED (evidence attests to $sha, candidate is $want)"
    echo "        Evidence for another commit is not evidence for this one."
    note_missing; return
  fi
  if ok_value "$result"; then
    echo "OK ($result, bound to candidate sha)"
    [ -n "$src" ] && echo "        source: $src"
  else
    echo "FAIL ($result)"; note_missing
  fi
}

# Live CI read: the authoritative source for the candidate sha, not a claim.
check_ci_source() { # label source candidate_sha
  local label="$1" source="$2" want="$3" repo json total bad
  echo -n "  $label"
  case "$source" in
    gh:*/*) repo="${source#gh:}" ;;
    *) echo "BLOCKED (unsupported --ci-source '$source'; expected gh:<owner/repo>)"; note_missing; return ;;
  esac
  if ! command -v gh >/dev/null 2>&1; then
    echo "BLOCKED (--ci-source given but gh CLI not found)"; note_missing; return
  fi
  json=$(gh api "repos/$repo/commits/$want/check-runs" 2>/dev/null) || {
    echo "BLOCKED (cannot read check-runs for $want from $repo)"; note_missing; return; }
  total=$(printf '%s' "$json" | tr ',' '\n' | sed -n 's/.*"total_count":[[:space:]]*\([0-9]*\).*/\1/p' | head -1)
  [ -n "$total" ] || total=0
  if [ "$total" -eq 0 ]; then
    echo "BLOCKED (no check-runs recorded for the candidate sha)"; note_missing; return
  fi
  bad=$(printf '%s' "$json" | tr '{' '\n' | grep -c '"conclusion":[[:space:]]*"\(failure\|cancelled\|timed_out\|action_required\|stale\)"')
  if [ "$bad" -gt 0 ]; then
    echo "FAIL ($bad of $total check-runs not successful, from $repo)"; note_missing
  else
    echo "OK ($total check-runs successful for the candidate sha, from $repo)"
  fi
}

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

# MANDATORY gate: the candidate must be contained in the CURRENT beta, i.e. the
# accepted code is actually present on the Stage contour. Checked INDEPENDENTLY of
# stage-ok — a stale/reset beta can drop a candidate even while its stage-ok tag
# still exists. Without this, READINESS could read COMPLETE for code not on Stage.
echo -n "  Candidate ∈ beta      : "
if [ -z "$BETA_SHA" ] || ! git cat-file -e "$BETA_SHA" 2>/dev/null || ! git cat-file -e "$CAND_SHA" 2>/dev/null; then
  echo "UNKNOWN (beta/candidate objects unavailable)"; note_missing
elif git merge-base --is-ancestor "$CAND_SHA" "$BETA_SHA" 2>/dev/null; then
  echo "YES (candidate is contained in current beta)"
else
  echo "NO — candidate is NOT contained in current beta"
  echo "        The accepted code is not present on the Stage contour (beta may have been"
  echo "        reset or moved). Re-land the candidate on beta and re-accept before Production,"
  echo "        regardless of any existing stage-ok tag."
  note_missing
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
  note_missing
fi
echo -n "  prod-busy             : "
if [ "$PB_EXISTS" = yes ]; then echo "HELD by '${PB_BRANCH:-?}' (Production lane busy)"; note_missing; else echo "absent (Production lane technically free — NOT authorization)"; fi

echo
# --- GATE: the candidate must be INSIDE the build that is actually running ----
# Two numbers agreeing with each other proves nothing about the candidate. The
# runtime sha must be a real commit, and the candidate must be its ancestor.
echo -n "  Stage runtime commit  : "
STAGE_RUNTIME_OID=""
if [ -z "$STAGE_RUNTIME_SHA" ]; then
  echo "BLOCKED (required evidence missing)"; note_missing
else
  git cat-file -e "$STAGE_RUNTIME_SHA" 2>/dev/null || \
    git fetch -q --no-write-fetch-head --no-tags "$REMOTE" "$STAGE_RUNTIME_SHA" >/dev/null 2>&1 || true
  STAGE_RUNTIME_OID=$(resolve_object "$STAGE_RUNTIME_SHA" commit || true)
  if [ -z "$STAGE_RUNTIME_OID" ]; then
    echo "BLOCKED (not a reachable commit object: $STAGE_RUNTIME_SHA)"
    echo "        A runtime sha that git cannot resolve cannot be reasoned about."
    note_missing
  else
    echo "OK ($STAGE_RUNTIME_OID)"
  fi
fi

echo -n "  Candidate ∈ Stage run : "
if [ -z "$STAGE_RUNTIME_OID" ]; then
  echo "BLOCKED (no verified runtime commit to test against)"; note_missing
elif ! git cat-file -e "$CAND_SHA" 2>/dev/null; then
  echo "BLOCKED (candidate object unavailable)"; note_missing
elif git merge-base --is-ancestor "$CAND_SHA" "$STAGE_RUNTIME_OID" 2>/dev/null; then
  echo "YES (candidate is contained in the running Stage build)"
else
  echo "NO — the candidate is NOT in the build running on Stage"
  echo "        Acceptance evidence describes a build that does not contain this"
  echo "        candidate. Deploy the candidate to Stage and re-accept."
  note_missing
fi

# Cross-check with what acceptance recorded, kept as a separate signal.
echo -n "  Runtime vs stage-ok   : "
if [ -z "$STAGE_RUNTIME_OID" ]; then
  echo "n/a (runtime not verified)"
elif [ -z "${acc_stage:-}" ]; then
  echo "BLOCKED (stage-ok has no stage_sha to compare)"; note_missing
elif [ "$STAGE_RUNTIME_OID" = "$(git rev-parse --verify --quiet "${acc_stage}" 2>/dev/null || printf '%s' "$acc_stage")" ]; then
  echo "OK (runtime equals the accepted stage_sha)"
else
  echo "MISMATCH (runtime $STAGE_RUNTIME_OID, stage-ok stage_sha $acc_stage)"; note_missing
fi

echo
check_evidence_file "Canonical merge-check : " "$MERGE_CHECK_EVIDENCE" "$CAND_SHA"
if [ -n "$CI_SOURCE" ]; then
  check_ci_source "CI status             : " "$CI_SOURCE" "$CAND_SHA"
else
  check_evidence_file "CI status             : " "$CI_EVIDENCE" "$CAND_SHA"
fi

# --- GATE: tree identity against a tree git can actually resolve -------------
# The expected tree is DERIVED from the candidate commit, never taken from the
# caller: a caller-supplied pair could agree with itself and mean nothing.
echo
echo -n "  Candidate tree (derived): "
DERIVED_TREE=""
if git cat-file -e "$CAND_SHA" 2>/dev/null; then
  DERIVED_TREE=$(resolve_object "${CAND_SHA}^{tree}" tree || true)
fi
if [ -n "$DERIVED_TREE" ]; then echo "$DERIVED_TREE"; else echo "UNKNOWN (candidate object unavailable)"; note_missing; fi

echo -n "  Deployed tree identity : "
if [ -z "$ACTUAL_PROD_TREE" ]; then
  echo "BLOCKED (--actual-production-tree required: the tree of the deployed checkout)"
  note_missing
elif [ -z "$DERIVED_TREE" ]; then
  echo "BLOCKED (no derived candidate tree to compare)"; note_missing
else
  ACTUAL_TREE_OID=$(resolve_object "$ACTUAL_PROD_TREE" tree || true)
  if [ -z "$ACTUAL_TREE_OID" ]; then
    echo "BLOCKED (not a real tree object: $ACTUAL_PROD_TREE)"
    echo "        A free-text value is not a tree. Supply the output of"
    echo "        'git rev-parse HEAD^{tree}' taken in the deployed checkout."
    note_missing
  elif [ "$ACTUAL_TREE_OID" = "$DERIVED_TREE" ]; then
    echo "OK ($ACTUAL_TREE_OID matches the candidate tree)"
  else
    echo "MISMATCH (deployed $ACTUAL_TREE_OID, candidate $DERIVED_TREE)"; note_missing
  fi
fi

# Optional operator cross-check: must agree with the derived tree.
if [ -n "$EXPECTED_PROD_TREE" ]; then
  echo -n "  Expected tree (operator): "
  EXP_TREE_OID=$(resolve_object "$EXPECTED_PROD_TREE" tree || true)
  if [ -z "$EXP_TREE_OID" ]; then
    echo "BLOCKED (not a real tree object: $EXPECTED_PROD_TREE)"; note_missing
  elif [ -n "$DERIVED_TREE" ] && [ "$EXP_TREE_OID" != "$DERIVED_TREE" ]; then
    echo "DISAGREES with the derived candidate tree ($DERIVED_TREE)"; note_missing
  else
    echo "OK (agrees with the derived candidate tree)"
  fi
fi

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
