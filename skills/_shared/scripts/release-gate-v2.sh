#!/usr/bin/env bash
# Trusted Release System V2 gate. Verification is lock-independent; Stage and
# Production admission add their canonical lock and acceptance requirements.
set -euo pipefail

usage() {
  echo "Usage: $0 <verify|stage|production> <branch> <head-sha> <pr> [options]" >&2
}

[ "$#" -ge 4 ] || { usage; exit 2; }
MODE="$1"; BRANCH="$2"; HEAD_SHA="$3"; PR_NUMBER="$4"; shift 4
REMOTE=origin
EVENT=pull_request
REPOSITORY=
BASE_REF=
BASE_SHA=
HEAD_REPO=
METADATA_FILE=
REVIEW_FILE=
REVIEW_APP_ID=
REVIEW_NAME="Independent technical review"
LOCK_METADATA_FILE=
PROD_LOCK_METADATA_FILE=
OWNER_GO_FILE=
OWNER_LOGIN=
MERGE_SHA=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="$2"; shift 2 ;;
    --event) EVENT="$2"; shift 2 ;;
    --repo) REPOSITORY="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2"; shift 2 ;;
    --base-sha) BASE_SHA="$2"; shift 2 ;;
    --head-repo) HEAD_REPO="$2"; shift 2 ;;
    --metadata-file) METADATA_FILE="$2"; shift 2 ;;
    --review-file) REVIEW_FILE="$2"; shift 2 ;;
    --review-app-id) REVIEW_APP_ID="$2"; shift 2 ;;
    --review-name) REVIEW_NAME="$2"; shift 2 ;;
    --lock-metadata-file) LOCK_METADATA_FILE="$2"; shift 2 ;;
    --prod-lock-metadata-file) PROD_LOCK_METADATA_FILE="$2"; shift 2 ;;
    --owner-go-file) OWNER_GO_FILE="$2"; shift 2 ;;
    --owner-login) OWNER_LOGIN="$2"; shift 2 ;;
    --merge-sha) MERGE_SHA="$2"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done

fail() { echo "RELEASE V2: BLOCKED - $*" >&2; exit 1; }
pass() { echo "RELEASE V2: PASS - $*"; }
is_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

case "$MODE" in
  verify) [[ "$BASE_REF" == beta || "$BASE_REF" == prod ]] || fail "unsupported PR base" ;;
  stage) [ "$BASE_REF" = beta ] || fail "Stage admission requires a beta PR" ;;
  production) [ "$BASE_REF" = prod ] || fail "Production admission requires a prod PR" ;;
  *) fail "unknown gate mode" ;;
esac
[[ "$EVENT" == pull_request ]] || fail "direct push is not an admitted release event"
[ -n "$BRANCH" ] && [[ "$BRANCH" != -* ]] || fail "empty or unsafe head branch"
is_sha "$HEAD_SHA" || fail "head SHA is not canonical"
is_sha "$BASE_SHA" || fail "base SHA is not canonical"
is_sha "$MERGE_SHA" || fail "merge_commit_sha is missing or not canonical"
[[ "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]] || fail "invalid pull request number"
[ -n "$REPOSITORY" ] && [ "$HEAD_REPO" = "$REPOSITORY" ] || fail "head repository is not trusted"
[ -f "$METADATA_FILE" ] || fail "trusted PR metadata is missing"
[ -f "$REVIEW_FILE" ] || fail "independent review evidence is missing"
[[ "$REVIEW_APP_ID" =~ ^[1-9][0-9]*$ ]] || fail "trusted review app id is not configured"

validate_pr_metadata() {
  python3 - "$1" "$2" "$3" "$4" "$5" "$6" "$7" "$8" <<'PY'
import json, sys
path, number, repo, base_ref, base_sha, head_ref, head_sha, merge_sha = sys.argv[1:]
d = json.load(open(path))
assert str(d.get("number")) == number
assert d.get("base", {}).get("ref") == base_ref
assert d.get("base", {}).get("repo", {}).get("full_name") == repo
if base_sha:
    assert d.get("base", {}).get("sha") == base_sha
assert d.get("head", {}).get("ref") == head_ref
assert d.get("head", {}).get("repo", {}).get("full_name") == repo
if head_sha:
    assert d.get("head", {}).get("sha") == head_sha
merge = d.get("merge_commit_sha")
assert isinstance(merge, str) and len(merge) == 40
assert all(c in "0123456789abcdef" for c in merge)
if merge_sha:
    assert merge == merge_sha
PY
}

validate_review() {
  python3 - "$REVIEW_FILE" "$HEAD_SHA" "$REVIEW_APP_ID" "$REVIEW_NAME" <<'PY'
import json, sys
path, head_sha, app_id, name = sys.argv[1:]
d = json.load(open(path))
runs = d.get("check_runs")
assert isinstance(runs, list)
assert d.get("total_count") == len(runs)
matches = [r for r in runs if r.get("name") == name]
assert len(matches) == 1
r = matches[0]
assert r.get("head_sha") == head_sha
assert r.get("status") == "completed"
assert r.get("conclusion") == "success"
assert str(r.get("app", {}).get("id")) == app_id
PY
}

remote_ref() {
  git ls-remote --exit-code "$REMOTE" "$1" 2>/dev/null | awk 'NR == 1 { print $1; exit }'
}

remote_snapshot() {
  local refs
  refs="refs/heads/prod refs/heads/beta refs/heads/$BRANCH refs/tags/stage-busy refs/tags/prod-busy"
  [ "$MODE" = production ] && refs="$refs refs/tags/stage-ok/$BRANCH refs/tags/stage-ok/$BRANCH^{}"
  git ls-remote "$REMOTE" $refs 2>/dev/null | sort
}

ensure_commit() {
  local object="$1"
  git cat-file -e "$object^{commit}" 2>/dev/null && return 0
  git fetch -q --no-write-fetch-head --no-tags "$REMOTE" "$object" || return 1
  git cat-file -e "$object^{commit}" 2>/dev/null
}

ensure_tag() {
  local tag="$1"
  git fetch -q --no-write-fetch-head --no-tags --force "$REMOTE" "refs/tags/$tag:refs/tags/$tag" || return 1
  [ "$(git cat-file -t "refs/tags/$tag" 2>/dev/null || true)" = tag ]
}

tag_body() { git cat-file -p "refs/tags/$1" | sed -n '/^$/,$p' | sed '1,2d'; }
field_count() { awk -F': ' -v key="$1" '$1 == key { n++ } END { print n + 0 }' <<<"$2"; }
field_value() { awk -F': ' -v key="$1" '$1 == key { print substr($0, length(key) + 3); exit }' <<<"$2"; }

valid_iso_date() {
  python3 - "$1" <<'PY'
import datetime, sys
try:
    value = sys.argv[1]
    parsed = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    assert parsed.strftime("%Y-%m-%dT%H:%M:%SZ") == value
except (AssertionError, ValueError, TypeError):
    raise SystemExit(1)
PY
}

validate_lock() {
  local tag="$1" expected_branch="$2" body value
  body="$(tag_body "$tag")"
  for field in branch pr agent date; do
    [ "$(field_count "$field" "$body")" = 1 ] || fail "$tag has missing or duplicate $field metadata"
  done
  value="$(field_value branch "$body")"; [ "$value" = "$expected_branch" ] || fail "$tag owner branch mismatch"
  LOCK_PR="$(field_value pr "$body")"; [[ "$LOCK_PR" =~ ^[1-9][0-9]*$ ]] || fail "$tag PR metadata is malformed"
  value="$(field_value agent "$body")"; [ -n "$value" ] || fail "$tag agent metadata is empty"
  value="$(field_value date "$body")"; valid_iso_date "$value" || fail "$tag date metadata is malformed"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == branch:* || "$line" == pr:* || "$line" == agent:* || "$line" == date:* ]] \
      || fail "$tag contains unknown metadata"
  done <<<"$body"
}

validate_stage_ok() {
  local tag="stage-ok/$BRANCH" body value actual_tree
  body="$(tag_body "$tag")"
  for field in branch branch_sha stage_sha stage_tree criterion checks date; do
    [ "$(field_count "$field" "$body")" = 1 ] || fail "$tag has missing or duplicate $field metadata"
  done
  [ "$(field_value branch "$body")" = "$BRANCH" ] || fail "$tag owner branch mismatch"
  [ "$(field_value branch_sha "$body")" = "$HEAD_SHA" ] || fail "$tag branch_sha mismatch"
  STAGE_SHA="$(field_value stage_sha "$body")"; is_sha "$STAGE_SHA" || fail "$tag stage_sha is malformed"
  STAGE_TREE="$(field_value stage_tree "$body")"; is_sha "$STAGE_TREE" || fail "$tag stage_tree is malformed"
  [ -n "$(field_value criterion "$body")" ] && [ -n "$(field_value checks "$body")" ] || fail "$tag acceptance evidence is incomplete"
  value="$(field_value date "$body")"; valid_iso_date "$value" || fail "$tag date metadata is malformed"
  actual_tree="$(git rev-parse "$STAGE_SHA^{tree}" 2>/dev/null || true)"
  [ "$STAGE_TREE" = "$actual_tree" ] || fail "$tag Stage tree identity mismatch"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == branch:* || "$line" == branch_sha:* || "$line" == stage_sha:* || "$line" == stage_tree:* || "$line" == criterion:* || "$line" == checks:* || "$line" == date:* ]] \
      || fail "$tag contains unknown metadata"
  done <<<"$body"
}

validate_owner_go() {
  python3 - "$OWNER_GO_FILE" "$HEAD_SHA" "$PR_NUMBER" "$OWNER_LOGIN" <<'PY'
import json, sys
path, sha, pr, owner = sys.argv[1:]
d = json.load(open(path))
assert d.get("environment") == "production"
assert d.get("candidate_sha") == sha
assert str(d.get("pr")) == pr
assert owner and d.get("actor") == owner
assert str(d.get("run_id", "")).isdigit()
PY
}

validate_pr_metadata "$METADATA_FILE" "$PR_NUMBER" "$REPOSITORY" "$BASE_REF" "$BASE_SHA" "$BRANCH" "$HEAD_SHA" "$MERGE_SHA" \
  || fail "current PR metadata identity mismatch"
validate_review || fail "independent technical review is missing, stale, unsuccessful, or untrusted"

INITIAL_SNAPSHOT="$(remote_snapshot)" || fail "repository refs are unavailable"
branch_sha="$(remote_ref "refs/heads/$BRANCH")" || fail "candidate branch is unavailable"
prod_sha="$(remote_ref refs/heads/prod)" || fail "origin/prod is unavailable"
beta_sha="$(remote_ref refs/heads/beta)" || fail "origin/beta is unavailable"
base_remote_sha="$(remote_ref "refs/heads/$BASE_REF")" || fail "PR base branch is unavailable"
[ "$branch_sha" = "$HEAD_SHA" ] || fail "remote head does not match supplied candidate SHA"
[ "$base_remote_sha" = "$BASE_SHA" ] || fail "PR base SHA is stale"
ensure_commit "$prod_sha" || fail "origin/prod object is unavailable"
ensure_commit "$beta_sha" || fail "origin/beta object is unavailable"
ensure_commit "$HEAD_SHA" || fail "candidate object is unavailable"
ensure_commit "$MERGE_SHA" || fail "merge result object is unavailable"
git merge-base --is-ancestor "$prod_sha" "$beta_sha" || fail "beta does not contain prod"
git merge-base --is-ancestor "$BASE_SHA" "$MERGE_SHA" || fail "merge result does not contain the PR base"
git merge-base --is-ancestor "$HEAD_SHA" "$MERGE_SHA" || fail "merge result does not contain candidate"
merge_tree="$(git rev-parse "$MERGE_SHA^{tree}" 2>/dev/null || true)"
is_sha "$merge_tree" || fail "merge result tree is not a real Git tree"

if [ "$MODE" = stage ] || [ "$MODE" = production ]; then
  [ -f "$LOCK_METADATA_FILE" ] || fail "trusted stage-busy PR metadata is missing"
  ensure_tag stage-busy || fail "stage-busy is missing or unreadable"
  validate_lock stage-busy "$BRANCH"
  validate_pr_metadata "$LOCK_METADATA_FILE" "$LOCK_PR" "$REPOSITORY" beta "" "$BRANCH" "" "" \
    || fail "stage-busy owner PR metadata mismatch"
fi

if [ "$MODE" = production ]; then
  [ -f "$PROD_LOCK_METADATA_FILE" ] || fail "trusted prod-busy PR metadata is missing"
  [ -f "$OWNER_GO_FILE" ] || fail "owner GO evidence is missing"
  [ -n "$OWNER_LOGIN" ] || fail "release owner identity is not configured"
  validate_owner_go || fail "owner GO evidence is invalid or belongs to another candidate"
  ensure_tag "stage-ok/$BRANCH" || fail "exact stage-ok is missing or unreadable"
  [ "$(git rev-parse "refs/tags/stage-ok/$BRANCH^{commit}")" = "$HEAD_SHA" ] \
    || fail "stage-ok does not identify the exact candidate"
  validate_stage_ok
  ensure_commit "$STAGE_SHA" || fail "stage_sha object is unavailable"
  git merge-base --is-ancestor "$HEAD_SHA" "$STAGE_SHA" || fail "candidate is not an ancestor of accepted Stage SHA"
  git merge-base --is-ancestor "$STAGE_SHA" "$beta_sha" || fail "accepted Stage SHA is not contained in beta"
  beta_tree="$(git rev-parse "$beta_sha^{tree}" 2>/dev/null || true)"
  [ "$beta_tree" = "$STAGE_TREE" ] || fail "accepted Stage tree does not match current beta tree"
  [ "$merge_tree" = "$beta_tree" ] || fail "prospective Production merge tree does not match accepted Stage tree"
  ensure_tag prod-busy || fail "prod-busy is missing or unreadable"
  validate_lock prod-busy "$BRANCH"
  validate_pr_metadata "$PROD_LOCK_METADATA_FILE" "$LOCK_PR" "$REPOSITORY" prod "" "$BRANCH" "" "" \
    || fail "prod-busy owner PR metadata mismatch"
fi

FINAL_SNAPSHOT="$(remote_snapshot)" || fail "repository refs became unavailable"
[ "$INITIAL_SNAPSHOT" = "$FINAL_SNAPSHOT" ] || fail "refs or release tags changed during validation"
pass "$MODE gate admitted candidate $HEAD_SHA for branch $BRANCH (PR #$PR_NUMBER); merge tree $merge_tree"
