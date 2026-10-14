#!/usr/bin/env bash
# Run the release-automation self-tests that exist in the current merge result.
# A missing implementation+test pair is expected while A1-A7 land incrementally.
# A partial pair is always an error.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)

CASES=(
  "A1 reconcile-preflight"
  "A2 worktree-prep"
  "A3 qa-preflight"
  "A4 merge-check-env"
  "A5 lock-status"
  "A6 stage-smoke"
  "A7 prod-readiness"
)

list_files() {
  local entry label name implementation selftest
  printf '%s\n' "$HERE/run-release-automation-selftests.sh"
  printf '%s\n' "$HERE/release-automation-protocol.selftest.sh"
  for entry in "${CASES[@]}"; do
    label=${entry%% *}
    name=${entry#* }
    implementation="$HERE/$name.sh"
    selftest="$HERE/$name.selftest.sh"
    [[ -f "$implementation" ]] && printf '%s\n' "$implementation"
    [[ -f "$selftest" ]] && printf '%s\n' "$selftest"
  done
}

if [[ "${1:-}" == "--list-files" ]]; then
  list_files
  exit 0
fi
if (($# != 0)); then
  echo "usage: $0 [--list-files]" >&2
  exit 2
fi

passed=0
skipped=0
failed=0

for entry in "${CASES[@]}"; do
  label=${entry%% *}
  name=${entry#* }
  implementation="$HERE/$name.sh"
  selftest="$HERE/$name.selftest.sh"

  if [[ ! -e "$implementation" && ! -e "$selftest" ]]; then
    echo "SKIP $label ($name): not present in this merge result"
    skipped=$((skipped + 1))
    continue
  fi
  if [[ ! -f "$implementation" || ! -f "$selftest" ]]; then
    echo "FAIL $label ($name): implementation/self-test pair is incomplete" >&2
    failed=$((failed + 1))
    continue
  fi

  echo "RUN  $label ($name)"
  if bash "$selftest"; then
    echo "PASS $label ($name)"
    passed=$((passed + 1))
  else
    echo "FAIL $label ($name)" >&2
    failed=$((failed + 1))
  fi
done

echo "release automation self-tests: $passed passed, $skipped skipped, $failed failed"
((failed == 0))
