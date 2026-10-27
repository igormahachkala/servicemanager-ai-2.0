#!/usr/bin/env bash
# Isolated executable regression tests for reconcile-preflight.sh.
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/reconcile-preflight.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/reconcile-preflight-test.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { echo "  PASS $1"; PASS=$((PASS + 1)); }
no() { echo "  FAIL $1"; FAIL=$((FAIL + 1)); }
expect_rc() {
  local name="$1" expected="$2"; shift 2
  set +e
  OUT=$("$@" 2>&1)
  RC=$?
  set -e
  [ "$RC" -eq "$expected" ] && ok "$name (exit $expected)" || { no "$name (exit $RC, expected $expected)"; echo "$OUT"; }
}
has() { printf '%s\n' "$OUT" | grep -Fq "$1" && ok "$2" || no "$2"; }

make_fixture() {
  local dir="$1"
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" config user.email test@example.invalid
  git -C "$dir" config user.name test
  printf 'one\ntwo\nthree\n' > "$dir/file.txt"
  git -C "$dir" add file.txt
  git -C "$dir" commit -qm base
  git -C "$dir" branch -M prod
  git -C "$dir" branch beta
  git -C "$dir" checkout -qb candidate
  printf 'candidate\n' >> "$dir/file.txt"
  git -C "$dir" commit -qam candidate
  git -C "$dir" checkout -q prod
  git -C "$dir" remote add origin "$dir"
  git -C "$dir" update-ref refs/remotes/origin/prod refs/heads/prod
  git -C "$dir" update-ref refs/remotes/origin/beta refs/heads/beta
  git -C "$dir" update-ref refs/remotes/origin/candidate refs/heads/candidate
}

set -e
echo "== A1 reconcile-preflight self-test =="

F1="$TMP/clean"
make_fixture "$F1"
expect_rc "clean candidate" 0 bash -c "cd '$F1' && '$SCRIPT' origin/candidate origin/prod origin/beta"
has "Content equivalence   : EQUAL" "content tree identity checked"
has "READY FOR RELEASE PREPARATION : YES" "clean candidate ready"

F2="$TMP/beta-behind"
make_fixture "$F2"
git -C "$F2" checkout -q prod
printf 'production\n' > "$F2/prod-only.txt"
git -C "$F2" add prod-only.txt
git -C "$F2" commit -qm prod-forward
git -C "$F2" update-ref refs/remotes/origin/prod refs/heads/prod
expect_rc "prod ahead of beta is not a blocker" 0 bash -c "cd '$F2' && '$SCRIPT' origin/candidate origin/prod origin/beta"
printf '%s\n' "$OUT" | grep -Fq "restore before release" && no "ancestry does not order restore" || ok "ancestry does not order restore"
has "READY FOR RELEASE PREPARATION : YES" "prod ahead of beta still ready"

F3="$TMP/same-file"
make_fixture "$F3"
git -C "$F3" checkout -q prod
sed 's/^one$/production-one/' "$F3/file.txt" > "$F3/file.next"
mv "$F3/file.next" "$F3/file.txt"
git -C "$F3" commit -qam prod-non-overlap
git -C "$F3" branch -f beta prod
git -C "$F3" update-ref refs/remotes/origin/prod refs/heads/prod
git -C "$F3" update-ref refs/remotes/origin/beta refs/heads/beta
expect_rc "same-file non-conflicting reconciliation" 0 bash -c "cd '$F3' && '$SCRIPT' origin/candidate origin/prod origin/beta"
has "Content equivalence   : EQUAL" "same-file content preserved"

F4="$TMP/conflict"
make_fixture "$F4"
git -C "$F4" checkout -q prod
printf 'one\ntwo\nthree\nproduction\n' > "$F4/file.txt"
git -C "$F4" commit -qam prod-conflict
git -C "$F4" branch -f beta prod
git -C "$F4" update-ref refs/remotes/origin/prod refs/heads/prod
git -C "$F4" update-ref refs/remotes/origin/beta refs/heads/beta
expect_rc "merge conflict" 1 bash -c "cd '$F4' && '$SCRIPT' origin/candidate origin/prod origin/beta"
has "READY FOR RELEASE PREPARATION : NO" "conflict blocks readiness"

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
