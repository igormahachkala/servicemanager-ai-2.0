#!/usr/bin/env bash
#
# merge-check-env.selftest.sh — offline tests for merge-check-env.sh.
# Needs one prepared backend dir (node_modules + prisma); pass it as $1 or set
# $SMA_TEST_BACKEND. No .env, no real DB, no Stage/Production. Run: bash … <backend-dir> [backend-dir2]
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/merge-check-env.sh"
BE="${1:-${SMA_TEST_BACKEND:-}}"
BE2="${2:-}"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo "  PASS $1"; }
no() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }
rc_is() { [ "$2" = "$3" ] && ok "$1 (exit $3)" || no "$1 (expected $2 got $3)"; }

echo "== A4 merge-check-env self-test =="

# value / export are synthetic, loopback, non-connecting
URL=$(bash "$SCRIPT" value)
case "$URL" in postgresql://*@127.0.0.1:1/*) ok "value: synthetic loopback DSN";; *) no "value: DSN shape";; esac
bash "$SCRIPT" export | grep -q "^export DATABASE_URL='postgresql://" && ok "export: eval-able" || no "export"

# classify
[ "$(bash "$SCRIPT" classify 'prisma generate' | awk '/^class/{print $3}')" = "no-connection" ] && ok "classify generate=no-connection" || no "classify generate"
[ "$(bash "$SCRIPT" classify 'prisma migrate deploy' | awk '/^class/{print $3}')" = "real-db" ] && ok "classify migrate=real-db" || no "classify migrate"
[ "$(bash "$SCRIPT" classify 'nest build' | awk '/^class/{print $3}')" = "no-connection" ] && ok "classify build=no-connection" || no "classify build"

# Database-required check: require-db BLOCKED without an authorized URL
( unset SMA_MERGE_CHECK_DB_URL; bash "$SCRIPT" require-db -- true >/dev/null 2>&1 ); rc_is "require-db blocked w/o URL" 5 $?

# require-db refuses a Stage/Prod-looking host, and REDACTS the password in the refusal
OUT=$(SMA_MERGE_CHECK_DB_URL='postgresql://u:TOPSECRETpw@stage-api.sma-assistants.ru:5432/db' bash "$SCRIPT" require-db -- true 2>&1); RC=$?
rc_is "require-db refuses Stage host" 5 $RC
printf '%s' "$OUT" | grep -q 'TOPSECRETpw' && no "redaction (Stage URL leaked password)" || ok "redaction: Stage URL password masked"

# Secret redaction on an ALLOWED local DB: password masked in the echoed line, command runs
OUT=$(SMA_MERGE_CHECK_DB_URL='postgresql://u:TOPSECRETpw@127.0.0.1:5432/testdb' bash "$SCRIPT" require-db -- true 2>&1); RC=$?
rc_is "require-db runs on local DB" 0 $RC
printf '%s' "$OUT" | grep -q 'TOPSECRETpw' && no "redaction (local URL leaked password)" || ok "redaction: local URL password masked"
printf '%s' "$OUT" | grep -q 'u:\*\*\*@127.0.0.1' && ok "redaction: masked form shown" || no "redaction: masked form"

# bad args
bash "$SCRIPT" >/dev/null 2>&1; rc_is "no subcommand" 2 $?
bash "$SCRIPT" bogus >/dev/null 2>&1; rc_is "unknown subcommand" 2 $?

# Prisma paths need a prepared backend dir.
if [ -n "$BE" ] && [ -x "$BE/node_modules/.bin/prisma" ]; then
  # Missing backend/.env + prisma generate → unblocked by synthetic URL
  [ -f "$BE/.env" ] && echo "  note: $BE/.env exists (helper still uses synthetic, never reads it)" || echo "  note: $BE has no .env (the blocked case)"
  bash "$SCRIPT" generate "$BE" >/dev/null 2>&1; rc_is "generate w/o .env (synthetic URL)" 0 $?
  # proves no .env was created
  [ -f "$BE/.env" ] && no "generate created .env (must not)" || ok "generate did not create .env"
  # Prisma validate parses with the synthetic URL (same parser as generate)
  ( cd "$BE" && DATABASE_URL="$(bash "$SCRIPT" value)" node_modules/.bin/prisma validate --schema prisma/schema.prisma >/dev/null 2>&1 ); rc_is "prisma validate (synthetic URL)" 0 $?
  # Concurrent execution: two generates in parallel (same or two dirs) → both succeed
  d2="${BE2:-$BE}"
  bash "$SCRIPT" generate "$BE"  >/dev/null 2>&1 & P1=$!
  bash "$SCRIPT" generate "$d2"  >/dev/null 2>&1 & P2=$!
  wait $P1; R1=$?; wait $P2; R2=$?
  [ "$R1" = 0 ] && [ "$R2" = 0 ] && ok "concurrent generate (both exit 0)" || no "concurrent generate ($R1/$R2)"
else
  echo "  SKIP prisma generate/validate/concurrent — no prepared backend dir given"
fi

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
