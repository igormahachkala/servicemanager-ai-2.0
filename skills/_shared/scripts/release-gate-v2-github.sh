#!/usr/bin/env bash
# Trusted GitHub adapter for Release System V2. It only reads repository and PR
# metadata, then delegates policy decisions to release-gate-v2.sh.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GATE="$HERE/release-gate-v2.sh"
: "${MODE:?MODE is required}"
: "${PR_NUMBER:?PR_NUMBER is required}"
: "${REPOSITORY:?REPOSITORY is required}"
: "${REVIEW_APP_ID:?REVIEW_APP_ID is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

case "$MODE" in
  verify) EXPECTED_BASE= ;;
  stage) EXPECTED_BASE=beta ;;
  production)
    EXPECTED_BASE=prod
    : "${RELEASE_OWNER_LOGIN:?RELEASE_OWNER_LOGIN is required}"
    : "${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
    [ "$GITHUB_ACTOR" = "$RELEASE_OWNER_LOGIN" ] \
      || { echo "RELEASE V2: BLOCKED - workflow was not started by the release owner" >&2; exit 1; }
    ;;
  *) echo "RELEASE V2: BLOCKED - invalid adapter mode" >&2; exit 2 ;;
esac

TMP=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/release-gate-v2-github.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

api() {
  gh api -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
}

fetch_pr() { api "repos/$REPOSITORY/pulls/$1" >"$2"; }

fields() {
  python3 - "$1" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
values = (
    d.get("base", {}).get("ref", ""), d.get("base", {}).get("sha", ""),
    d.get("head", {}).get("ref", ""), d.get("head", {}).get("sha", ""),
    d.get("head", {}).get("repo", {}).get("full_name", ""),
    d.get("merge_commit_sha", ""),
)
print("\t".join(values))
PY
}

lock_pr() {
  local tag="$1" body count value
  git tag -d "$tag" >/dev/null 2>&1 || true
  git fetch -q --no-write-fetch-head --no-tags origin "refs/tags/$tag:refs/tags/$tag" \
    || { echo "RELEASE V2: BLOCKED - $tag is missing or unreadable" >&2; return 1; }
  [ "$(git cat-file -t "refs/tags/$tag" 2>/dev/null || true)" = tag ] \
    || { echo "RELEASE V2: BLOCKED - $tag is not annotated" >&2; return 1; }
  body=$(git for-each-ref --format='%(contents)' "refs/tags/$tag")
  count=$(awk -F': ' '$1 == "pr" { n++ } END { print n + 0 }' <<<"$body")
  [ "$count" = 1 ] || { echo "RELEASE V2: BLOCKED - $tag PR metadata is malformed" >&2; return 1; }
  value=$(awk -F': ' '$1 == "pr" { print $2; exit }' <<<"$body")
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || return 1
  printf '%s\n' "$value"
}

fetch_review() {
  api "repos/$REPOSITORY/commits/$1/check-runs?check_name=Independent%20technical%20review&per_page=100" >"$2"
}

same_evidence() {
  python3 - "$@" <<'PY'
import json, sys

def pr(path):
    d = json.load(open(path))
    return (d.get("number"), d.get("base", {}).get("ref"), d.get("base", {}).get("sha"),
            d.get("head", {}).get("ref"), d.get("head", {}).get("sha"),
            d.get("head", {}).get("repo", {}).get("full_name"), d.get("merge_commit_sha"))

def review(path):
    d = json.load(open(path))
    return sorted((r.get("name"), r.get("head_sha"), r.get("status"), r.get("conclusion"),
                   r.get("app", {}).get("id")) for r in d.get("check_runs", []))

paths = sys.argv[1:]
assert pr(paths[0]) == pr(paths[1])
assert review(paths[2]) == review(paths[3])
for i in range(4, len(paths), 2):
    assert pr(paths[i]) == pr(paths[i + 1])
PY
}

publish_check() {
  local name="$1" sha="$2" conclusion="$3" title="$4"
  python3 - "$TMP/check.json" "$name" "$sha" "$conclusion" "$title" "$GITHUB_SERVER_URL/$REPOSITORY/actions/runs/$GITHUB_RUN_ID" <<'PY'
import json, sys
path, name, sha, conclusion, title, url = sys.argv[1:]
json.dump({"name": name, "head_sha": sha, "status": "completed", "conclusion": conclusion,
           "details_url": url, "output": {"title": title, "summary": "Trusted Release System V2 admission result."}}, open(path, "w"))
PY
  api --method POST "repos/$REPOSITORY/check-runs" --input "$TMP/check.json" >/dev/null
}

admit() {
  fetch_pr "$PR_NUMBER" "$TMP/pr-initial.json"
  IFS=$'\t' read -r base_ref base_sha branch head_sha head_repo merge_sha < <(fields "$TMP/pr-initial.json")
  [[ "$base_ref" == beta || "$base_ref" == prod ]] || { echo "unsupported PR base" >&2; return 1; }
  [[ -z "$EXPECTED_BASE" || "$base_ref" == "$EXPECTED_BASE" ]] || { echo "admission/base mismatch" >&2; return 1; }
  fetch_review "$head_sha" "$TMP/review-initial.json"

  compare=("$TMP/pr-initial.json" "$TMP/pr-final.json" "$TMP/review-initial.json" "$TMP/review-final.json")
  gate_args=(--repo "$REPOSITORY" --event pull_request --base-ref "$base_ref" --base-sha "$base_sha"
    --head-repo "$head_repo" --metadata-file "$TMP/pr-final.json"
    --review-file "$TMP/review-final.json" --review-app-id "$REVIEW_APP_ID" --merge-sha "$merge_sha")
  if [[ "$MODE" == stage || "$MODE" == production ]]; then
    stage_pr=$(lock_pr stage-busy)
    fetch_pr "$stage_pr" "$TMP/stage-initial.json"
    gate_args+=(--lock-metadata-file "$TMP/stage-final.json")
    compare+=("$TMP/stage-initial.json" "$TMP/stage-final.json")
  fi
  if [[ "$MODE" == production ]]; then
    prod_pr=$(lock_pr prod-busy)
    fetch_pr "$prod_pr" "$TMP/prod-initial.json"
    gate_args+=(--prod-lock-metadata-file "$TMP/prod-final.json")
    compare+=("$TMP/prod-initial.json" "$TMP/prod-final.json")
    python3 - "$TMP/owner-go.json" "$head_sha" "$PR_NUMBER" "$GITHUB_ACTOR" "$GITHUB_RUN_ID" <<'PY'
import json, sys
path, sha, pr, actor, run_id = sys.argv[1:]
json.dump({"environment":"production", "candidate_sha":sha, "pr":int(pr), "actor":actor, "run_id":run_id}, open(path,"w"))
PY
    gate_args+=(--owner-go-file "$TMP/owner-go.json" --owner-login "$RELEASE_OWNER_LOGIN")
  fi

  fetch_pr "$PR_NUMBER" "$TMP/pr-final.json"
  fetch_review "$head_sha" "$TMP/review-final.json"
  [[ "$MODE" == verify ]] || fetch_pr "$stage_pr" "$TMP/stage-final.json"
  [[ "$MODE" != production ]] || fetch_pr "$prod_pr" "$TMP/prod-final.json"
  same_evidence "${compare[@]}" || { echo "RELEASE V2: BLOCKED - GitHub evidence changed during validation" >&2; return 1; }

  "$GATE" "$MODE" "$branch" "$head_sha" "$PR_NUMBER" "${gate_args[@]}"
  printf '%s\n' "$head_sha" >"$TMP/head-sha"
}

set +e
(set -e; admit) >"$TMP/result" 2>&1
rc=$?
set -e
if ((rc == 0)); then
  cat "$TMP/result"
  if [[ -n "${ADMISSION_CHECK_NAME:-}" ]]; then
    publish_check "$ADMISSION_CHECK_NAME" "$(cat "$TMP/head-sha")" success "Admission passed"
  fi
else
  cat "$TMP/result" >&2
  if [[ -n "${ADMISSION_CHECK_NAME:-}" && -s "$TMP/pr-initial.json" ]]; then
    IFS=$'\t' read -r _ _ _ failed_sha _ _ < <(fields "$TMP/pr-initial.json")
    [[ "$failed_sha" =~ ^[0-9a-f]{40}$ ]] && publish_check "$ADMISSION_CHECK_NAME" "$failed_sha" failure "Admission blocked"
  fi
  exit "$rc"
fi
