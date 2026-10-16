#!/usr/bin/env bash
# Trusted, read-only release-lane admission gate.
# It consumes refs/tags and commit objects only; it never executes PR code.
set -euo pipefail

usage() { echo "Usage: $0 <beta|production> <branch> <head-sha> <pr-number> [--event pull_request] [--merge-sha sha] [--remote remote]" >&2; }
[[ $# -ge 4 ]] || { usage; exit 2; }
CONTOUR="$1"; BRANCH="$2"; HEAD_SHA="$3"; PR_NUMBER="$4"; shift 4
EVENT="pull_request"; MERGE_SHA=""; REMOTE="origin"
while (($#)); do
  case "$1" in
    --event) EVENT="${2:-}"; shift 2 ;;
    --merge-sha) MERGE_SHA="${2:-}"; shift 2 ;;
    --remote) REMOTE="${2:-}"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done

fail() { echo "RELEASE LANE: BLOCKED — $*" >&2; exit 1; }
pass() { echo "RELEASE LANE: PASS — $*"; }
is_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

[[ "$CONTOUR" == beta || "$CONTOUR" == production ]] || fail "unknown contour"
[[ "$EVENT" == pull_request ]] || fail "direct push is not an admitted release event"
[[ -n "$BRANCH" && "$BRANCH" != -* ]] || fail "empty or unsafe head branch"
is_sha "$HEAD_SHA" || fail "head SHA is not canonical"
[[ "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]] || fail "invalid pull request number"

remote_ref() { git ls-remote --exit-code "$REMOTE" "$1" 2>/dev/null | awk 'NR == 1 { print $1; exit }'; }
ensure_commit() {
  local object="$1"
  git cat-file -e "$object^{commit}" 2>/dev/null && return 0
  git fetch -q --no-write-fetch-head --no-tags "$REMOTE" "$object" || return 1
  git cat-file -e "$object^{commit}" 2>/dev/null
}
ensure_tag() {
  local tag="$1"
  git fetch -q --no-write-fetch-head --no-tags "$REMOTE" "refs/tags/$tag:refs/tags/$tag" || return 1
  [[ "$(git cat-file -t "refs/tags/$tag" 2>/dev/null || true)" == tag ]]
}

branch_sha="$(remote_ref "refs/heads/$BRANCH")"
[[ "$branch_sha" == "$HEAD_SHA" ]] || fail "remote head does not match supplied candidate SHA"
prod_sha="$(remote_ref refs/heads/prod)"; beta_sha="$(remote_ref refs/heads/beta)"
is_sha "$prod_sha" || fail "origin/prod is unavailable"
is_sha "$beta_sha" || fail "origin/beta is unavailable"
ensure_commit "$prod_sha" || fail "origin/prod object is unavailable"
ensure_commit "$beta_sha" || fail "origin/beta object is unavailable"
git merge-base --is-ancestor "$prod_sha" "$beta_sha" || fail "beta does not contain prod"
ensure_commit "$HEAD_SHA" || fail "candidate object is unavailable"

if [[ -n "$MERGE_SHA" ]]; then
  is_sha "$MERGE_SHA" || fail "merge SHA is not canonical"
  ensure_commit "$MERGE_SHA" || fail "prospective merge object is unavailable"
  git merge-base --is-ancestor "$HEAD_SHA" "$MERGE_SHA" || fail "prospective merge does not contain candidate"
fi

ensure_tag stage-busy || fail "stage-busy is missing, lightweight, or unreadable"
stage_body="$(git cat-file -p refs/tags/stage-busy | sed -n '/^$/,$p' | sed '1d')"
grep -Fqx "branch: $BRANCH" <<<"$stage_body" || fail "stage-busy is owned by another release branch"
git rev-parse "$HEAD_SHA^{tree}" >/dev/null || fail "candidate tree cannot be resolved"

if [[ "$CONTOUR" == production ]]; then
  ensure_tag "stage-ok/$BRANCH" || fail "exact stage-ok is missing or not annotated"
  stage_ok_target="$(git rev-parse "refs/tags/stage-ok/$BRANCH^{commit}")"
  [[ "$stage_ok_target" == "$HEAD_SHA" ]] || fail "stage-ok does not identify the exact candidate"
  stage_ok_body="$(git cat-file -p "refs/tags/stage-ok/$BRANCH" | sed -n '/^$/,$p' | sed '1d')"
  grep -Fqx "branch: $BRANCH" <<<"$stage_ok_body" || fail "stage-ok branch ownership mismatch"
  stage_sha="$(awk '$1 == "stage_sha:" { print $2; exit }' <<<"$stage_ok_body")"
  is_sha "$stage_sha" || fail "stage-ok has no canonical stage_sha"
  ensure_commit "$stage_sha" || fail "stage_sha object is unavailable"
  git merge-base --is-ancestor "$stage_sha" "$beta_sha" || fail "accepted Stage SHA is not contained in beta"
  ensure_tag prod-busy || fail "prod-busy is missing, lightweight, or unreadable"
  prod_body="$(git cat-file -p refs/tags/prod-busy | sed -n '/^$/,$p' | sed '1d')"
  grep -Fqx "branch: $BRANCH" <<<"$prod_body" || fail "prod-busy is owned by another release branch"
fi

pass "$CONTOUR candidate $HEAD_SHA admitted for branch $BRANCH (PR #$PR_NUMBER)"
