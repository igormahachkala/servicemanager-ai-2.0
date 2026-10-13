#!/usr/bin/env bash
#
# qa-preflight.selftest.sh — isolated, offline tests for qa-preflight.sh.
# Spins up a local mock HTTP server (loopback only) and exercises every path.
# Never touches Stage/Production, no secrets committed. Run: bash qa-preflight.selftest.sh
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/qa-preflight.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/qapf.XXXXXX")
PORT=$(( 20000 + RANDOM % 10000 ))
PASS=0; FAIL=0
trap 'kill "$MOCK_PID" 2>/dev/null; rm -rf "$TMP"' EXIT

# --- mock server: /health 200; /auth/login by email → 200/401/403/500/slow ---
cat > "$TMP/mock.py" <<'PY'
import json, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n) if n else b'{}'
        try: email = json.loads(body).get('email', '')
        except Exception: email = ''
        if 'slow@' in email:
            time.sleep(3)  # force curl --max-time to trip
            self.send_response(200); self.end_headers(); return
        if 'invalid@' in email or 'expired@' in email:
            code = 401
        elif 'forbidden@' in email:
            code = 403
        elif 'boom@' in email:
            code = 500
        else:
            code = 200
        self.send_response(code)
        # Deliberately return a token + cookie to prove the script never logs them.
        self.send_header('Set-Cookie', 'sid=SECRETCOOKIEVALUE; HttpOnly')
        self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(b'{"accessToken":"SECRETTOKENVALUE","user":{"role":"x"}}')
HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY
python3 "$TMP/mock.py" "$PORT" & MOCK_PID=$!
BASE="http://127.0.0.1:$PORT"
# wait for mock
for _ in $(seq 1 30); do curl -s -o /dev/null "$BASE/health" && break; sleep 0.1; done

SENTINEL_PW="SUPERSECRETPW_do_not_log"
export SMA_QA_PW_CLIENT_ADMIN="$SENTINEL_PW" SMA_QA_PW_CLIENT="$SENTINEL_PW" \
       SMA_QA_PW_PROVIDER_ADMIN="$SENTINEL_PW" SMA_QA_PW_MASTER="$SENTINEL_PW" SMA_QA_PW_DISPATCHER="$SENTINEL_PW"

inv() { cat > "$TMP/$1"; echo "$TMP/$1"; }
check() { # name expected_exit actual_exit
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  PASS $1 (exit $3)"; else FAIL=$((FAIL+1)); echo "  FAIL $1 (expected exit $2, got $3)"; fi
}

ALL_VALID=$(inv all <<EOF
CLIENT_ADMIN    client.admin@stage.local
CLIENT          client.user@stage.local
PROVIDER_ADMIN  provider.admin@stage.local
MASTER          master@stage.local
DISPATCHER      dispatcher@stage.local
EOF
)

echo "== A3 qa-preflight self-test =="

# T1 valid → exit 0
OUT=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$ALL_VALID" 2>&1); check "T1 valid credentials" 0 $?
# T7 secret redaction (reuse T1 output): no password / token / cookie in report
if printf '%s' "$OUT" | grep -qiE "$SENTINEL_PW|SECRETTOKENVALUE|SECRETCOOKIEVALUE|Set-Cookie"; then
  FAIL=$((FAIL+1)); echo "  FAIL T7 secret redaction (secret leaked in output)"
else PASS=$((PASS+1)); echo "  PASS T7 secret redaction (no password/token/cookie in report)"; fi

# T2 invalid credentials → 401 → exit 1
INV=$(inv invalid <<EOF
CLIENT_ADMIN    invalid@stage.local
CLIENT          client.user@stage.local
PROVIDER_ADMIN  provider.admin@stage.local
MASTER          master@stage.local
DISPATCHER      dispatcher@stage.local
EOF
)
bash "$SCRIPT" --base-url "$BASE" --inventory "$INV" >/dev/null 2>&1; check "T2 invalid credentials (401)" 1 $?

# T3 expired → 401 → exit 1
EXP=$(inv expired <<EOF
CLIENT_ADMIN    expired@stage.local
CLIENT          client.user@stage.local
PROVIDER_ADMIN  provider.admin@stage.local
MASTER          master@stage.local
DISPATCHER      dispatcher@stage.local
EOF
)
bash "$SCRIPT" --base-url "$BASE" --inventory "$EXP" >/dev/null 2>&1; check "T3 expired credentials" 1 $?

# T4 missing account (DISPATCHER omitted) → exit 1 + MISSING listed
MIS=$(inv missing <<EOF
CLIENT_ADMIN    client.admin@stage.local
CLIENT          client.user@stage.local
PROVIDER_ADMIN  provider.admin@stage.local
MASTER          master@stage.local
EOF
)
OUT4=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$MIS" 2>&1); RC4=$?
check "T4 missing account" 1 $RC4
printf '%s' "$OUT4" | grep -q "Missing QA accounts    : DISPATCHER" && { PASS=$((PASS+1)); echo "  PASS T4b missing listed"; } || { FAIL=$((FAIL+1)); echo "  FAIL T4b missing listed"; }

# T5 API unavailable (dead port) → exit 3
DEADPORT=$(( PORT + 1 ))
bash "$SCRIPT" --base-url "http://127.0.0.1:$DEADPORT" --inventory "$ALL_VALID" --timeout 2 >/dev/null 2>&1; check "T5 API unavailable" 3 $?

# T6 403 and 500 classification → exit 1
F403=$(inv f403 <<EOF
CLIENT_ADMIN    forbidden@stage.local
CLIENT          boom@stage.local
PROVIDER_ADMIN  provider.admin@stage.local
MASTER          master@stage.local
DISPATCHER      dispatcher@stage.local
EOF
)
OUT6=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$F403" 2>&1); check "T6 403/500 classification" 1 $?
printf '%s' "$OUT6" | grep -q "FORBIDDEN (403)" && printf '%s' "$OUT6" | grep -q "ERROR (500)" && { PASS=$((PASS+1)); echo "  PASS T6b 403+500 labelled"; } || { FAIL=$((FAIL+1)); echo "  FAIL T6b 403+500 labelled"; }

# T8 timeout (slow@ + --timeout 1) → exit 1, labelled NO RESPONSE/TIMEOUT
SLOW=$(inv slow <<EOF
CLIENT_ADMIN    slow@stage.local
CLIENT          client.user@stage.local
PROVIDER_ADMIN  provider.admin@stage.local
MASTER          master@stage.local
DISPATCHER      dispatcher@stage.local
EOF
)
OUT8=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$SLOW" --timeout 1 2>&1); check "T8 timeout handling" 1 $?
printf '%s' "$OUT8" | grep -q "NO RESPONSE/TIMEOUT" && { PASS=$((PASS+1)); echo "  PASS T8b timeout labelled"; } || { FAIL=$((FAIL+1)); echo "  FAIL T8b timeout labelled"; }

# T9 live-contour guard: default Stage host, no authorization → exit 4, nothing sent
bash "$SCRIPT" --inventory "$ALL_VALID" >/dev/null 2>&1; check "T9 live guard refuses Stage" 4 $?

# T10 no-password env → exit 1
unset SMA_QA_PW_MASTER
bash "$SCRIPT" --base-url "$BASE" --inventory "$ALL_VALID" >/dev/null 2>&1; check "T10 missing password env" 1 $?
export SMA_QA_PW_MASTER="$SENTINEL_PW"

# T11 bad args / no inventory → exit 2
bash "$SCRIPT" --base-url "$BASE" >/dev/null 2>&1; check "T11 no inventory" 2 $?

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
