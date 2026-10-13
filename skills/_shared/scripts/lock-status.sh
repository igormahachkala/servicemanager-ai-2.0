#!/usr/bin/env bash
#
# lock-status.sh — A5 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# READ-ONLY diagnostic for the release-lane lock tags (stage-busy, prod-busy) and
# Stage acceptance tags (stage-ok/<branch>), plus the beta ⊇ prod invariant. It
# classifies lane availability and flags likely-stale locks — it never creates,
# deletes, moves, acquires, or releases any tag/ref, never deploys, never touches a
# database, and never cleans up a stale lock. It only reports.
#
# HARD RULE: "technically FREE" is an observation about tag presence, NOT
# authorization. A missing stage-busy does NOT mean Stage may be deployed to —
# Stage is a shared, reserved contour and deployment requires explicit OWNER GO
# regardless of what this tool prints. The report states this every run.
#
# Reads are done with `git ls-remote` (no local ref change) and a transient
# object-only fetch (`--no-write-fetch-head`, writes loose objects for cat-file /
# ancestry, creates no ref/tag). Nothing is written to any ref or tag.
#
# Usage:   lock-status.sh [--remote REMOTE] [--stale-hours N]
# Default: --remote origin  --stale-hours 4
#
# Exit codes:
#   0  report produced
#   2  bad arguments
#   3  git / network failure (could not read the remote)
#
set -u

REMOTE="origin"
STALE_HOURS="${SMA_LOCK_STALE_HOURS:-4}"

die() { echo "lock-status: $1" >&2; exit "${2:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --remote)      REMOTE="${2:-}"; shift 2 || die "--remote needs a value" ;;
    --stale-hours) STALE_HOURS="${2:-}"; shift 2 || die "--stale-hours needs a value" ;;
    *) die "unknown argument: $1" ;;
  esac
done
command -v git >/dev/null 2>&1 || die "git not found" 3

# 1. One pure read of the remote (no local ref mutation).
LS=$(git ls-remote "$REMOTE" 2>/dev/null) || die "cannot read remote '$REMOTE'" 3
[ -n "$LS" ] || die "empty ls-remote from '$REMOTE' (network failure?)" 3

ref_sha()   { printf '%s\n' "$LS" | awk -v r="$1" '$2==r{print $1; exit}'; }
# commit a tag resolves to: the ^{} peel for annotated tags, else the tag line itself
tag_commit(){ local p; p=$(ref_sha "refs/tags/$1^{}"); [ -n "$p" ] && printf '%s' "$p" || ref_sha "refs/tags/$1"; }
tag_obj()   { ref_sha "refs/tags/$1"; }

PROD_SHA=$(ref_sha "refs/heads/prod")
BETA_SHA=$(ref_sha "refs/heads/beta")

# 2. Transient object-only fetch so cat-file (tag bodies) and ancestry work.
#    --no-write-fetch-head: writes objects only; no FETCH_HEAD, no ref, no tag.
#    Only fetch refs that actually exist — a single missing source ref would abort
#    the whole fetch and leave prod/beta objects unavailable.
STAGE_OK_REFS=$(printf '%s\n' "$LS" | awk '$2 ~ /^refs\/tags\/stage-ok\// && $2 !~ /\^\{\}$/ {print $2}')
FETCH_SRCS=""
for r in refs/tags/stage-busy refs/tags/prod-busy refs/heads/prod refs/heads/beta $STAGE_OK_REFS; do
  [ -n "$(ref_sha "$r")" ] && FETCH_SRCS="$FETCH_SRCS $r"
done
[ -n "$FETCH_SRCS" ] && git fetch -q --no-write-fetch-head --no-tags "$REMOTE" $FETCH_SRCS >/dev/null 2>&1 || true   # best-effort; degrade gracefully

# epoch parser (GNU date, then BSD date), empty on failure
to_epoch() {
  local d="$1"
  date -d "$d" +%s 2>/dev/null && return 0
  date -j -f "%Y-%m-%dT%H:%M:%SZ" "$d" +%s 2>/dev/null && return 0
  printf ''
}
NOW=$(date +%s)
human_age() { # $1 epoch → "Nh"/"Nd"/unknown
  [ -z "$1" ] && { printf 'unknown'; return; }
  local s=$(( NOW - $1 )) ; [ "$s" -lt 0 ] && s=0
  if [ "$s" -lt 3600 ]; then printf '%dm' $(( s/60 ));
  elif [ "$s" -lt 86400 ]; then printf '%dh' $(( s/3600 ));
  else printf '%dd' $(( s/86400 )); fi
}

# read an annotated tag body (empty for lightweight tags / missing object)
tag_body() { local o; o=$(tag_obj "$1"); [ -n "$o" ] && git cat-file -p "$o" 2>/dev/null | sed -n '/^$/,$p' | sed '1d' || true; }
tag_date() { # prefer the body `date:` field, else the annotated tagger timestamp
  local body tagger
  body=$(tag_body "$1")
  local d; d=$(printf '%s\n' "$body" | sed -n 's/^date:[[:space:]]*//p' | head -1)
  if [ -n "$d" ]; then to_epoch "$d"; return; fi
  local o; o=$(tag_obj "$1")
  [ -n "$o" ] && git cat-file -p "$o" 2>/dev/null | awk '/^tagger /{print $(NF-1)}' | head -1
}
tag_branch() { tag_body "$1" | sed -n 's/^branch:[[:space:]]*//p' | head -1; }

STALE_SECS=$(( STALE_HOURS * 3600 ))
STALE_SUSPECTS=""

report_lock() { # $1 = tag name (stage-busy|prod-busy)
  local name="$1" commit obj age_epoch age br
  if [ -z "$(tag_obj "$name")" ] && [ -z "$(tag_commit "$name")" ]; then
    echo "    EXISTS            : NO"
    return 1
  fi
  commit=$(tag_commit "$name"); age_epoch=$(tag_date "$name"); age=$(human_age "$age_epoch"); br=$(tag_branch "$name")
  echo "    EXISTS            : YES"
  echo "    Commit SHA        : ${commit:-unknown}"
  echo "    Related release   : ${br:-<not recorded in tag body>}"
  echo "    Age               : ${age}"
  local b; b=$(tag_body "$name")
  if [ -n "$b" ]; then echo "    Tag metadata      :"; printf '%s\n' "$b" | sed 's|^|        | '; else echo "    Tag metadata      : <lightweight tag / body unavailable>"; fi
  if [ -n "$age_epoch" ] && [ "$(( NOW - age_epoch ))" -ge "$STALE_SECS" ]; then
    STALE_SUSPECTS="$STALE_SUSPECTS $name(${age})"
    echo "    Stale suspect     : YES (age ≥ ${STALE_HOURS}h — FLAG ONLY, no cleanup)"
  fi
  return 0
}

echo "RELEASE LOCK STATUS   (remote: $REMOTE)"
echo
echo "  Stage lock (stage-busy):"
report_lock stage-busy; STAGE_BUSY=$?
echo
echo "  Production lock (prod-busy):"
report_lock prod-busy; PROD_BUSY=$?
echo
echo "  Stage acceptance (stage-ok/*):"
if [ -n "$STAGE_OK_REFS" ]; then
  printf '%s\n' "$STAGE_OK_REFS" | while read -r r; do
    nm=${r#refs/tags/}
    echo "    - $nm  @ $(tag_commit "${nm}")  (age $(human_age "$(tag_date "$nm")"))"
  done
  ACCEPT="present"
else
  echo "    (none)"
  ACCEPT="absent"
fi
echo
echo "  beta ⊇ prod invariant:"
if [ -n "$PROD_SHA" ] && [ -n "$BETA_SHA" ]; then
  if git merge-base --is-ancestor "$PROD_SHA" "$BETA_SHA" 2>/dev/null; then
    echo "    OK (prod $PROD_SHA ⊆ beta $BETA_SHA)"
  elif git cat-file -e "$PROD_SHA" 2>/dev/null && git cat-file -e "$BETA_SHA" 2>/dev/null; then
    echo "    VIOLATED (beta does not contain prod — restore before release)"
  else
    echo "    UNKNOWN (commit objects not available offline)"
  fi
else
  echo "    UNKNOWN (prod/beta head not found on remote)"
fi
echo
echo "  Stale lock suspects   :${STALE_SUSPECTS:- none}"
echo
echo "  Technical lane availability:"
[ "$STAGE_BUSY" -eq 0 ] && echo "    Stage       : BUSY (stage-busy held)" || echo "    Stage       : FREE (no stage-busy tag)"
[ "$PROD_BUSY"  -eq 0 ] && echo "    Production  : BUSY (prod-busy held)"  || echo "    Production  : FREE (no prod-busy tag)"
echo "    Stage acceptance tag: $ACCEPT"
echo
echo "  Operational restrictions:"
echo "    - 'FREE' here means only that no lock tag is present. It is NOT authorization to deploy."
echo "    - Stage is a shared, currently RESERVED contour; any Stage/Production action requires explicit OWNER GO."
echo "    - Stale suspects are FLAGGED only; this tool never cleans up, releases, or moves a lock."
echo
echo "  (Read-only — no tag/ref created, moved, or deleted; no deploy; no DB.)"
exit 0
