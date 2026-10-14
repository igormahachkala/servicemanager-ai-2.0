#!/usr/bin/env bash
#
# stage-smoke.selftest.sh — offline tests for stage-smoke.sh against a local mock
# (loopback only). Stage/Production never contacted. Run: bash stage-smoke.selftest.sh
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/stage-smoke.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/smoke.XXXXXX")
PASS=0; FAIL=0
MOCK_PID=""
trap 'kill "$MOCK_PID" 2>/dev/null; rm -rf "$TMP"' EXIT
ok(){ PASS=$((PASS+1)); echo "  PASS $1"; }
no(){ FAIL=$((FAIL+1)); echo "  FAIL $1"; }
rc_is(){ [ "$2" = "$3" ] && ok "$1 (exit $3)" || no "$1 (expected $2 got $3)"; }

cat > "$TMP/mock.py" <<'PY'
import os, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer
HEALTH=int(os.environ.get('SM_HEALTH','200'))
SHA=os.environ.get('SM_SHA','goodsha'); ENV=os.environ.get('SM_ENV','beta')
FAIL=set(p for p in os.environ.get('SM_FAIL','').split(',') if p)
SLOW=os.environ.get('SM_SLOW','')
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        p=self.path
        if SLOW and p==SLOW: time.sleep(3)
        if p in FAIL: self.send_response(404); self.end_headers(); return
        if p=='/health': self.send_response(HEALTH); self.end_headers(); self.wfile.write(b'{"status":"ok"}'); return
        if p=='/version':
            self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers()
            self.wfile.write(('{"service":"ServiceManager.AI","commitSha":"%s","environment":"%s"}'%(SHA,ENV)).encode()); return
        if p=='/sw.js':
            self.send_response(200); self.send_header('Content-Type','application/javascript'); self.end_headers(); self.wfile.write(b'// sw'); return
        self.send_response(200); self.end_headers(); self.wfile.write(b'<html></html>')
HTTPServer(('127.0.0.1',int(sys.argv[1])),H).serve_forever()
PY

start_mock(){ # env assignments... ; sets MOCK_PID, BASE
  kill "$MOCK_PID" 2>/dev/null
  PORT=$(( 20000 + RANDOM % 10000 ))
  env "$@" python3 "$TMP/mock.py" "$PORT" & MOCK_PID=$!
  BASE="http://127.0.0.1:$PORT"
  for _ in $(seq 1 30); do curl -s -o /dev/null "$BASE/health" 2>/dev/null && break; sleep 0.1; done
}
run(){ bash "$SCRIPT" --web-url "$BASE" --api-url "$BASE" "$@" 2>&1; }
run_required(){
  run --expect-sha goodsha --expect-env beta \
      --backend-log "$TMP/clean.log" --frontend-log "$TMP/frontend-clean.log" \
      --backend-restart-count 0 --frontend-restart-count 0 \
      --postgres-status running --postgres-restart-count 0 "$@"
}

echo "== A6 stage-smoke self-test =="

# fixture logs
printf 'LOG line ok\nNest application successfully started\nmore ok\n' > "$TMP/clean.log"
printf 'web ok\n' > "$TMP/frontend-clean.log"
printf 'INFO boot\nERROR something broke\nUnhandledPromiseRejection: x\n' > "$TMP/errors.log"
printf 'Starting Nest\nNest application successfully started\nSIGTERM received\nStarting Nest\nNest application successfully started\n' > "$TMP/restart.log"
printf 'ERROR authorization: Bearer TOKENAAA\nException: Unhandled token=TOKENBBB\nFatal password=PWCCC and Bearer TOKENDDD\n' > "$TMP/secret.log"

# T1 all healthy
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run_required); RC=$?
rc_is "T1 all endpoints healthy" 0 $RC
printf '%s' "$OUT" | grep -q "RESULT                : PASS" && ok "T1 PASS result" || no "T1 PASS result"
printf '%s' "$OUT" | grep -q "PostgreSQL RestartCount: OK (0)" && ok "T1 PostgreSQL restart evidence required" || no "T1 PostgreSQL restart evidence"
printf '%s' "$OUT" | grep -q "Status                : OK (running)" && ok "T1 PostgreSQL status required" || no "T1 PostgreSQL status"

# T2 health failure
start_mock SM_HEALTH=500 SM_SHA=goodsha SM_ENV=beta
run_required >/dev/null 2>&1; rc_is "T2 health failure" 1 $?

# T3 version SHA mismatch
start_mock SM_SHA=goodsha SM_ENV=beta
run_required --expect-sha WRONGSHA >/dev/null 2>&1; rc_is "T3 SHA mismatch" 1 $?

# T4 wrong environment
start_mock SM_SHA=goodsha SM_ENV=prod
OUT=$(run_required); rc_is "T4 wrong environment" 1 $?
printf '%s' "$OUT" | grep -q "Environment match     : MISMATCH" && ok "T4 env mismatch noted" || no "T4 env mismatch noted"

# T5-T8 endpoint unavailable
start_mock SM_FAIL=/ ; run_required >/dev/null 2>&1; rc_is "T5 frontend unavailable" 1 $?
start_mock SM_FAIL=/m ; run_required >/dev/null 2>&1; rc_is "T6 mobile unavailable" 1 $?
start_mock SM_FAIL=/max ; run_required >/dev/null 2>&1; rc_is "T7 MAX unavailable" 1 $?
start_mock SM_FAIL=/sw.js ; run_required >/dev/null 2>&1; rc_is "T8 service worker unavailable" 1 $?

# T9 timeout
start_mock SM_SLOW=/health
OUT=$(run_required --timeout 1); rc_is "T9 timeout" 1 $?
printf '%s' "$OUT" | grep -q "NO RESPONSE/TIMEOUT" && ok "T9 timeout labelled" || no "T9 timeout labelled"

# T10 runtime errors in logs
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run_required --backend-log "$TMP/errors.log"); rc_is "T10 runtime errors in logs" 1 $?
printf '%s' "$OUT" | grep -q "Runtime errors        : [1-9]" && ok "T10 errors counted" || no "T10 errors counted"

# T11 restart indicators (no errors) → still PASS, restarts reported
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run_required --backend-log "$TMP/restart.log"); rc_is "T11 restart indicators (non-fatal)" 0 $?
printf '%s' "$OUT" | grep -q "Restart indicators    : [1-9]" && ok "T11 restarts reported" || no "T11 restarts reported"

# T12 live Stage guard (default Stage hosts, no flag)
( unset SMA_STAGE_SMOKE_LIVE; bash "$SCRIPT" --expect-env beta >/dev/null 2>&1 ); rc_is "T12 live guard refuses Stage" 4 $?

# T13 secret redaction — secrets on ERROR/Exception/Fatal/Unhandled lines must be fully masked
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run_required --backend-log "$TMP/secret.log" 2>&1)   # capture BOTH stdout and stderr
LEAK=$(printf '%s' "$OUT" | grep -oE "TOKENAAA|TOKENBBB|PWCCC|TOKENDDD" | sort -u | tr '\n' ' ')
if [ -n "$LEAK" ]; then no "T13 secret redaction (LEAKED: $LEAK)"; else ok "T13 secret redaction (all token/password values masked on error lines)"; fi
# the masked lines must still be shown (redacted), proving the lines were processed
printf '%s' "$OUT" | grep -q "Bearer \*\*\*" && ok "T13b Bearer value masked to ***" || no "T13b Bearer masked"

# T14 no git/db/lock mutations (repo refs+tags unchanged across a run)
start_mock SM_SHA=goodsha SM_ENV=beta
B=$(cd "$HERE" && git show-ref 2>/dev/null | sort)
run_required >/dev/null 2>&1
A=$(cd "$HERE" && git show-ref 2>/dev/null | sort)
[ "$B" = "$A" ] && ok "T14 no ref/tag mutation" || no "T14 ref/tag mutation"

# T15 no expected SHA cannot PASS
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run --expect-env beta \
  --backend-log "$TMP/clean.log" --frontend-log "$TMP/frontend-clean.log" \
  --backend-restart-count 0 --frontend-restart-count 0 \
  --postgres-status running --postgres-restart-count 0); rc_is "T15 missing expected SHA blocked" 1 $?
printf '%s' "$OUT" | grep -q "RESULT                : INCOMPLETE/BLOCKED" && ok "T15 incomplete result" || no "T15 incomplete result"

# T16 missing mandatory evidence blocks readiness instead of PASS
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run --expect-sha goodsha --expect-env beta \
  --backend-log "$TMP/clean.log" --frontend-log "$TMP/frontend-clean.log" \
  --backend-restart-count 0 --frontend-restart-count 0 \
  --postgres-status running); rc_is "T16 missing PostgreSQL restart count blocked" 1 $?
printf '%s' "$OUT" | grep -q "PostgreSQL RestartCount: BLOCKED" && ok "T16 missing restart count labelled" || no "T16 missing restart count labelled"

# T17 missing log evidence blocks readiness
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run --expect-sha goodsha --expect-env beta \
  --backend-log "$TMP/clean.log" \
  --backend-restart-count 0 --frontend-restart-count 0 \
  --postgres-status running --postgres-restart-count 0); rc_is "T17 missing frontend log blocked" 1 $?
printf '%s' "$OUT" | grep -q "frontend log.*BLOCKED" && ok "T17 missing frontend log labelled" || no "T17 missing frontend log labelled"

# T18 nonzero RestartCount fails
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run_required --backend-restart-count 1); rc_is "T18 backend restart count failure" 1 $?
printf '%s' "$OUT" | grep -q "backend RestartCount.*FAIL (1)" && ok "T18 restart count labelled" || no "T18 restart count labelled"

# T19 PostgreSQL not running fails
start_mock SM_SHA=goodsha SM_ENV=beta
OUT=$(run_required --postgres-status exited); rc_is "T19 PostgreSQL status failure" 1 $?
printf '%s' "$OUT" | grep -q "Status                : FAIL (exited)" && ok "T19 PostgreSQL status labelled" || no "T19 PostgreSQL status labelled"

# bad args
bash "$SCRIPT" --bogus >/dev/null 2>&1; rc_is "bad args" 2 $?

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
