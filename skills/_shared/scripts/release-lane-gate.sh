#!/usr/bin/env bash
# Trusted read-only release-lane admission. It never executes PR code.
set -euo pipefail
usage() { echo "Usage: $0 <beta|production> <branch> <head-sha> <pr> --repo OWNER/REPO --base-ref beta|prod --base-sha sha --head-repo OWNER/REPO --metadata-file file --lock-metadata-file file --merge-sha sha [--remote remote] [--event pull_request] [--test-after-snapshot file]" >&2; }
[ "$#" -ge 4 ] || { usage; exit 2; }
CONTOUR="$1"; BRANCH="$2"; HEAD_SHA="$3"; PR_NUMBER="$4"; shift 4
EVENT=pull_request; REMOTE=origin; REPOSITORY=; BASE_REF=; BASE_SHA=; HEAD_REPO=; METADATA_FILE=; LOCK_METADATA_FILE=; PROD_LOCK_METADATA_FILE=; MERGE_SHA=; TEST_HOOK=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --event) EVENT="$2"; shift 2 ;;
    --remote) REMOTE="$2"; shift 2 ;;
    --repo) REPOSITORY="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2"; shift 2 ;;
    --base-sha) BASE_SHA="$2"; shift 2 ;;
    --head-repo) HEAD_REPO="$2"; shift 2 ;;
    --metadata-file) METADATA_FILE="$2"; shift 2 ;;
    --lock-metadata-file) LOCK_METADATA_FILE="$2"; shift 2 ;;
    --prod-lock-metadata-file) PROD_LOCK_METADATA_FILE="$2"; shift 2 ;;
    --merge-sha) MERGE_SHA="$2"; shift 2 ;;
    --test-after-snapshot) TEST_HOOK="$2"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done
fail() { echo "RELEASE LANE: BLOCKED - $*" >&2; exit 1; }
pass() { echo "RELEASE LANE: PASS - $*"; }
is_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
[[ "$CONTOUR" == beta || "$CONTOUR" == production ]] || fail "unknown contour"
[[ "$EVENT" == pull_request ]] || fail "direct push is not an admitted release event"
[[ "$CONTOUR" == beta && "$BASE_REF" == beta || "$CONTOUR" == production && "$BASE_REF" == prod ]] || fail "contour/base branch mismatch"
[ -n "$BRANCH" ] && [[ "$BRANCH" != -* ]] || fail "empty or unsafe head branch"
is_sha "$HEAD_SHA" || fail "head SHA is not canonical"
is_sha "$BASE_SHA" || fail "base SHA is not canonical"
is_sha "$MERGE_SHA" || fail "merge_commit_sha is missing or not canonical"
[[ "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]] || fail "invalid pull request number"
[ -n "$REPOSITORY" ] && [ "$HEAD_REPO" = "$REPOSITORY" ] || fail "head repository is not the trusted repository"
[ -f "$METADATA_FILE" ] && [ -f "$LOCK_METADATA_FILE" ] || fail "trusted PR metadata files are missing"
if [ "$CONTOUR" = production ]; then
  [ -f "$PROD_LOCK_METADATA_FILE" ] || fail "trusted prod-busy metadata file is missing"
fi

validate_json_metadata() {
  python3 - "$1" "$2" "$3" "$4" "$5" "$6" <<'PY'
import json, sys
path, number, repo, base_ref, head_ref, head_sha = sys.argv[1:]
d = json.load(open(path))
assert str(d.get("number")) == number
assert d.get("base", {}).get("ref") == base_ref
assert d.get("base", {}).get("repo", {}).get("full_name") == repo
assert d.get("head", {}).get("ref") == head_ref
assert d.get("head", {}).get("repo", {}).get("full_name") == repo
if head_sha:
    assert d.get("head", {}).get("sha") == head_sha
assert isinstance(d.get("merge_commit_sha"), str) and len(d["merge_commit_sha"]) == 40
assert all(c in "0123456789abcdef" for c in d["merge_commit_sha"])
PY
}
remote_ref() { git ls-remote --exit-code "$REMOTE" "$1" 2>/dev/null | awk 'NR == 1 { print $1; exit }'; }
remote_snapshot() {
  local refs
  refs="refs/heads/prod refs/heads/beta refs/heads/$BRANCH refs/tags/stage-busy refs/tags/prod-busy"
  [ "$CONTOUR" = production ] && refs="$refs refs/tags/stage-ok/$BRANCH refs/tags/stage-ok/$BRANCH^{}"
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
  local tag="$1" expected_branch="$2" expected_pr="$3" body value
  [ "$(git cat-file -t "refs/tags/$tag")" = tag ] || fail "$tag is not an annotated tag"
  body="$(tag_body "$tag")"
  for field in branch pr agent date; do
    [ "$(field_count "$field" "$body")" = 1 ] || fail "$tag has missing or duplicate $field metadata"
  done
  value="$(field_value branch "$body")"; [ "$value" = "$expected_branch" ] || fail "$tag owner branch mismatch"
  value="$(field_value pr "$body")"; [ "$value" = "$expected_pr" ] || fail "$tag PR metadata mismatch"
  value="$(field_value agent "$body")"; [ -n "$value" ] || fail "$tag agent metadata is empty"
  value="$(field_value date "$body")"; valid_iso_date "$value" || fail "$tag date metadata is malformed"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == branch:* || "$line" == pr:* || "$line" == agent:* || "$line" == date:* ]] || fail "$tag contains unknown metadata"
  done <<<"$body"
}
validate_stage_ok() {
  local tag="$1" body value
  [ "$(git cat-file -t "refs/tags/$tag")" = tag ] || fail "$tag is not an annotated tag"
  body="$(tag_body "$tag")"
  for field in branch branch_sha stage_sha stage_tree criterion checks date; do
    [ "$(field_count "$field" "$body")" = 1 ] || fail "$tag has missing or duplicate $field metadata"
  done
  value="$(field_value branch "$body")"; [ "$value" = "$BRANCH" ] || fail "$tag owner branch mismatch"
  value="$(field_value branch_sha "$body")"; [ "$value" = "$HEAD_SHA" ] || fail "$tag branch_sha mismatch"
  value="$(field_value stage_sha "$body")"; is_sha "$value" || fail "$tag stage_sha is malformed"; STAGE_SHA="$value"
  value="$(field_value stage_tree "$body")"; is_sha "$value" || fail "$tag stage_tree is malformed"; STAGE_TREE="$value"
  [ -n "$(field_value criterion "$body")" ] && [ -n "$(field_value checks "$body")" ] || fail "$tag acceptance evidence is incomplete"
  value="$(field_value date "$body")"; valid_iso_date "$value" || fail "$tag date metadata is malformed"
  actual_stage_tree="$(git rev-parse "$STAGE_SHA^{tree}" 2>/dev/null || true)"
  [ "$STAGE_TREE" = "$actual_stage_tree" ] || fail "$tag Stage tree identity mismatch"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == branch:* || "$line" == branch_sha:* || "$line" == stage_sha:* || "$line" == stage_tree:* || "$line" == criterion:* || "$line" == checks:* || "$line" == date:* ]] || fail "$tag contains unknown metadata"
  done <<<"$body"
}
validate_json_metadata "$METADATA_FILE" "$PR_NUMBER" "$REPOSITORY" "$BASE_REF" "$BRANCH" "$HEAD_SHA" || fail "current PR metadata identity mismatch"
INITIAL_SNAPSHOT="$(remote_snapshot)"
branch_sha="$(remote_ref "refs/heads/$BRANCH")"; prod_sha="$(remote_ref refs/heads/prod)"; beta_sha="$(remote_ref refs/heads/beta)"; base_remote_sha="$(remote_ref "refs/heads/$BASE_REF")"
[ "$branch_sha" = "$HEAD_SHA" ] || fail "remote head does not match supplied candidate SHA"
[ "$base_remote_sha" = "$BASE_SHA" ] || fail "PR base SHA is stale"
is_sha "$prod_sha" || fail "origin/prod is unavailable"; is_sha "$beta_sha" || fail "origin/beta is unavailable"
ensure_commit "$prod_sha" || fail "origin/prod object is unavailable"; ensure_commit "$beta_sha" || fail "origin/beta object is unavailable"; ensure_commit "$HEAD_SHA" || fail "candidate object is unavailable"; ensure_commit "$MERGE_SHA" || fail "merge result object is unavailable"
git merge-base --is-ancestor "$prod_sha" "$beta_sha" || fail "beta does not contain prod"
git merge-base --is-ancestor "$BASE_SHA" "$MERGE_SHA" || fail "merge result does not contain the PR base"
git merge-base --is-ancestor "$HEAD_SHA" "$MERGE_SHA" || fail "merge result does not contain candidate"
merge_tree="$(git rev-parse "$MERGE_SHA^{tree}" 2>/dev/null || true)"; [[ "$merge_tree" =~ ^[0-9a-f]{40}$ ]] || fail "merge result tree is not a real Git tree"

ensure_tag stage-busy || fail "stage-busy is missing or unreadable"
lock_body="$(tag_body stage-busy)"; lock_pr="$(field_value pr "$lock_body")"; [[ "$lock_pr" =~ ^[1-9][0-9]*$ ]] || fail "stage-busy PR metadata is malformed"
validate_lock stage-busy "$BRANCH" "$lock_pr"
validate_json_metadata "$LOCK_METADATA_FILE" "$lock_pr" "$REPOSITORY" "$BASE_REF" "$BRANCH" "" || fail "stage-busy owner PR metadata mismatch"

if [ "$CONTOUR" = production ]; then
  ensure_tag "stage-ok/$BRANCH" || fail "exact stage-ok is missing or unreadable"
  stage_ok_target="$(git rev-parse "refs/tags/stage-ok/$BRANCH^{commit}")"; [ "$stage_ok_target" = "$HEAD_SHA" ] || fail "stage-ok does not identify the exact candidate"
  validate_stage_ok "stage-ok/$BRANCH"; ensure_commit "$STAGE_SHA" || fail "stage_sha object is unavailable"; git merge-base --is-ancestor "$STAGE_SHA" "$beta_sha" || fail "accepted Stage SHA is not contained in beta"; git merge-base --is-ancestor "$HEAD_SHA" "$STAGE_SHA" || fail "candidate is not an ancestor of accepted Stage SHA"
  beta_tree="$(git rev-parse "$beta_sha^{tree}" 2>/dev/null || true)"; [ "$beta_tree" = "$STAGE_TREE" ] || fail "accepted Stage tree does not match current beta tree"
  [ "$merge_tree" = "$beta_tree" ] || fail "prospective Production merge tree does not match accepted Stage tree"
  ensure_tag prod-busy || fail "prod-busy is missing or unreadable"
  prod_lock_body="$(tag_body prod-busy)"; prod_lock_pr="$(field_value pr "$prod_lock_body")"; validate_lock prod-busy "$BRANCH" "$prod_lock_pr"
  [ -f "$PROD_LOCK_METADATA_FILE" ] || fail "prod-busy owner PR metadata is missing"
  validate_json_metadata "$PROD_LOCK_METADATA_FILE" "$prod_lock_pr" "$REPOSITORY" "$BASE_REF" "$BRANCH" "" || fail "prod-busy owner PR metadata mismatch"
fi
if [ -n "$TEST_HOOK" ]; then
  [ "$(printenv RELEASE_LANE_SELFTEST || true)" = 1 ] && [ -f "$TEST_HOOK" ] || fail "test hook is not permitted"
  bash "$TEST_HOOK"
fi
FINAL_SNAPSHOT="$(remote_snapshot)"
[ "$INITIAL_SNAPSHOT" = "$FINAL_SNAPSHOT" ] || fail "refs or lock tags changed during validation; re-run admission"
pass "$CONTOUR candidate $HEAD_SHA admitted for branch $BRANCH (PR #$PR_NUMBER); merge tree $merge_tree"
