#!/usr/bin/env bash
# Run and validate the release-automation self-tests present in this merge result.
# A missing A1-A7 implementation+test pair is expected while the series lands
# incrementally. A partial pair, an empty test, or a zero-assertion test is fatal.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# label|implementation|self-test|required-now
CASES=(
  "CI runner|run-release-automation-selftests.sh|run-release-automation-selftests.selftest.sh|required"
  "Area map|area-map.sh|area-map.selftest.sh|required"
  "A1|reconcile-preflight.sh|reconcile-preflight.selftest.sh|incremental"
  "A2|worktree-prep.sh|worktree-prep.selftest.sh|incremental"
  "A3|qa-preflight.sh|qa-preflight.selftest.sh|incremental"
  "A4|merge-check-env.sh|merge-check-env.selftest.sh|incremental"
  "A5|lock-status.sh|lock-status.selftest.sh|incremental"
  "A6|stage-smoke.sh|stage-smoke.selftest.sh|incremental"
  "A7|prod-readiness.sh|prod-readiness.selftest.sh|incremental"
  "Release lane gate|release-lane-gate.sh|release-lane-gate.selftest.sh|required"
  "Release System V2 gate|release-gate-v2.sh|release-gate-v2.selftest.sh|required"
  "Release System V2 workflows|release-gate-v2-github.sh|release-gate-v2-github.selftest.sh|required"
  "Release lane governance|release-lane-governance.sh|release-lane-governance.selftest.sh|required"
  "Release lane bootstrap|release-lane-bootstrap-check.sh|release-lane-bootstrap-check.selftest.sh|required"
)

list_files() {
  local entry label implementation selftest policy
  printf '%s\n' "$HERE/release-automation-protocol.selftest.sh"
  for entry in "${CASES[@]}"; do
    IFS='|' read -r label implementation selftest policy <<<"$entry"
    [[ -f "$HERE/$implementation" ]] && printf '%s\n' "$HERE/$implementation"
    [[ -f "$HERE/$selftest" ]] && printf '%s\n' "$HERE/$selftest"
  done
  return 0
}

VALIDATED_ASSERTIONS=0
validate_selftest_output() {
  local output_file="$1" summary observed
  VALIDATED_ASSERTIONS=0
  [[ -s "$output_file" ]] || return 1
  summary=$(grep -E '^== results: [0-9]+ passed, [0-9]+ failed ==$' "$output_file" | tail -1) || return 1
  observed=$(grep -Ec '^[[:space:]]*PASS([[:space:]]|$)' "$output_file" || true)
  if [[ "$summary" =~ ^==\ results:\ ([0-9]+)\ passed,\ ([0-9]+)\ failed\ ==$ ]]; then
    ((BASH_REMATCH[1] > 0)) || return 1
    ((BASH_REMATCH[2] == 0)) || return 1
    ((observed == BASH_REMATCH[1])) || return 1
    VALIDATED_ASSERTIONS=${BASH_REMATCH[1]}
    return 0
  fi
  return 1
}

validate_totals() {
  local files_passed="$1" assertions="$2" failures="$3"
  ((files_passed > 0 && assertions > 0 && failures == 0))
}

main() {
  if [[ "${1:-}" == "--list-files" ]]; then
    list_files
    return 0
  fi
  if (($# != 0)); then
    echo "usage: $0 [--list-files]" >&2
    return 2
  fi

  local passed=0 skipped=0 failed=0 assertions=0
  local entry label implementation selftest policy output rc
  output=$(mktemp "${TMPDIR:-/tmp}/release-selftest.XXXXXX")

  for entry in "${CASES[@]}"; do
    IFS='|' read -r label implementation selftest policy <<<"$entry"
    implementation="$HERE/$implementation"
    selftest="$HERE/$selftest"

    if [[ ! -e "$implementation" && ! -e "$selftest" && "$policy" == "incremental" ]]; then
      echo "SKIP $label: not present in this merge result"
      skipped=$((skipped + 1))
      continue
    fi
    if [[ ! -f "$implementation" || ! -f "$selftest" ]]; then
      echo "FAIL $label: implementation/self-test pair is incomplete" >&2
      failed=$((failed + 1))
      continue
    fi

    echo "RUN  $label ($(basename "$implementation"))"
    : >"$output"
    set +e
    bash "$selftest" >"$output" 2>&1
    rc=$?
    set -e
    cat "$output"
    if ((rc != 0)); then
      echo "FAIL $label: self-test exited $rc" >&2
      failed=$((failed + 1))
    elif ! validate_selftest_output "$output"; then
      echo "FAIL $label: missing non-zero assertion summary" >&2
      failed=$((failed + 1))
    else
      echo "PASS $label ($VALIDATED_ASSERTIONS assertions)"
      passed=$((passed + 1))
      assertions=$((assertions + VALIDATED_ASSERTIONS))
    fi
  done

  echo "release automation self-tests: $passed files passed, $skipped skipped, $failed failed; $assertions assertions executed"
  if ! validate_totals "$passed" "$assertions" "$failed"; then
    if ((passed == 0 || assertions == 0)); then
      echo "FAIL no self-tests were executed" >&2
    fi
    rm -f "$output"
    return 1
  fi
  rm -f "$output"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
