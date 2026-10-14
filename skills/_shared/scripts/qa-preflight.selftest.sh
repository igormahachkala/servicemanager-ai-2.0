#!/usr/bin/env bash
#
# qa-preflight.selftest.sh — isolated, offline tests for qa-preflight.sh.
# Spins up a local mock HTTP server (loopback only) and exercises every path,
# including the negative cases where login succeeds but the identity is wrong.
# Never touches Stage/Production, no secrets committed. Run: bash qa-preflight.selftest.sh
#
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/qa-preflight.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/qapf.XXXXXX")
PORT=$(( 20000 + RANDOM % 10000 ))
PASS=0; FAIL=0
trap 'kill "$MOCK_PID" 2>/dev/null; rm -rf "$TMP"' EXIT

# --- mock server -------------------------------------------------------------
# /health                 → 200
# POST /auth/login        → status by e-mail; on 200 returns {access_token,user}
# GET  /auth/me (Bearer)  → the identity the token was minted for
#
# The token deliberately carries a secret sentinel so the redaction test can
# prove it never reaches the report, and the e-mail so the mock can resolve
# /auth/me without server state.
cat > "$TMP/mock.py" <<'PY'
import json, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer

SENTINEL = 'SECRETTOKENVALUE'

# e-mail → identity returned by /auth/me
IDENTITY = {
  'client.admin@stage.local':  dict(role='CLIENT_ADMIN', companyId='company-client-1',   isActive=True,  surface=True),
  'client.user@stage.local':   dict(role='CLIENT',       companyId='company-client-1',   isActive=True,  surface=False),
  'provider.admin@stage.local':dict(role='ADMIN',        companyId='company-provider-1', isActive=True,  surface=True),
  'master@stage.local':        dict(role='MASTER',       companyId='company-provider-1', isActive=True,  surface=True),
  'dispatcher@stage.local':    dict(role='DISPATCHER',   companyId='company-provider-1', isActive=True,  surface=True),
  # --- negative fixtures ---
  # authenticates fine, but is a TECHNICIAN, not the claimed role
  'wrongrole@stage.local':     dict(role='TECHNICIAN',   companyId='company-provider-1', isActive=True,  surface=False),
  # claims CLIENT contour; canAccessManagementSurface=false for CLIENT_ADMIN means PROVIDER
  'wrongcontour@stage.local':  dict(role='CLIENT_ADMIN', companyId='company-provider-1', isActive=True,  surface=False),
  # right role, but lives in the CLIENT company while declared PROVIDER
  'crosscontour@stage.local':  dict(role='MASTER',       companyId='company-client-1',   isActive=True,  surface=True),
  # disabled account that still authenticates
  'inactive@stage.local':      dict(role='DISPATCHER',   companyId='company-provider-1', isActive=False, surface=True),
  'slowme@stage.local':        dict(role='MASTER',       companyId='company-provider-1', isActive=True,  surface=True),
}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _json(self, code, payload):
        self.send_response(code)
        self.send_header('Set-Cookie', 'sid=SECRETCOOKIEVALUE; HttpOnly')
        self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}'); return
        if self.path == '/auth/me':
            auth = self.headers.get('Authorization', '')
            if not auth.startswith('Bearer ' + SENTINEL + '.'):
                self._json(401, {'message': 'Unauthorized'}); return
            email = auth.split('.', 1)[1]
            if 'badtoken@' in email:          # token minted but rejected on use
                self._json(401, {'message': 'Unauthorized'}); return
            if 'slowme@' in email:
                # Hold the response so the argv sampler (N13) gets a real window.
                # Against a local mock curl otherwise lives a few milliseconds and
                # the sampler can never observe it — which made N13 vacuous: it
                # passed even with the token moved into argv on purpose.
                time.sleep(0.6)
                email = 'master@stage.local'
            ident = IDENTITY.get(email)
            if ident is None:
                self._json(401, {'message': 'User not found'}); return
            self._json(200, {
                'id': 'user-' + email, 'email': email,
                'role': ident['role'], 'companyId': ident['companyId'],
                'companyName': 'Mock Co', 'isActive': ident['isActive'],
                'canAccessManagementSurface': ident['surface'],
                'canAccessEngineeringAgent': False,
            }); return
        self.send_response(404); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n) if n else b'{}'
        try: email = json.loads(body).get('email', '')
        except Exception: email = ''
        if 'slow@' in email:
            time.sleep(3); self.send_response(200); self.end_headers(); return
        if 'invalid@' in email or 'expired@' in email:
            self._json(401, {'message': 'Invalid credentials'}); return
        if 'forbidden@' in email:
            self._json(403, {'message': 'Forbidden'}); return
        if 'boom@' in email:
            self._json(500, {'message': 'kaboom'}); return
        if 'notoken@' in email:                # 200 with no access_token at all
            self._json(200, {'user': {'role': 'CLIENT_ADMIN'}}); return
        self._json(200, {
            'access_token': SENTINEL + '.' + email,
            'user': {'role': 'LOGIN-ECHO-UNTRUSTED'},
        })

HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY
python3 "$TMP/mock.py" "$PORT" & MOCK_PID=$!
BASE="http://127.0.0.1:$PORT"
for _ in $(seq 1 30); do curl -s -o /dev/null "$BASE/health" && break; sleep 0.1; done

SENTINEL_PW="SUPERSECRETPW_do_not_log"
export SMA_QA_PW_CLIENT_ADMIN="$SENTINEL_PW" SMA_QA_PW_CLIENT="$SENTINEL_PW" \
       SMA_QA_PW_PROVIDER_ADMIN="$SENTINEL_PW" SMA_QA_PW_MASTER="$SENTINEL_PW" SMA_QA_PW_DISPATCHER="$SENTINEL_PW"

inv() { cat > "$TMP/$1"; echo "$TMP/$1"; }
check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  PASS $1 (exit $3)"
  else FAIL=$((FAIL+1)); echo "  FAIL $1 (expected exit $2, got $3)"; fi
}
grep_ok() { # name haystack needle
  if printf '%s' "$2" | grep -q "$3"; then PASS=$((PASS+1)); echo "  PASS $1"
  else FAIL=$((FAIL+1)); echo "  FAIL $1 (missing: $3)"; fi
}

ALL_VALID=$(inv all <<EOF
# ROLE_KEY       email                       CONTOUR
CLIENT_ADMIN     client.admin@stage.local    CLIENT
CLIENT           client.user@stage.local     CLIENT
PROVIDER_ADMIN   provider.admin@stage.local  PROVIDER
MASTER           master@stage.local          PROVIDER
DISPATCHER       dispatcher@stage.local      PROVIDER
EOF
)
# one line swapped out of ALL_VALID
variant() { # $1=file $2=ROLE_KEY $3=email $4=contour
  awk -v r="$2" -v e="$3" -v c="$4" '$1==r{print r"  "e"  "c; next} {print}' "$ALL_VALID" > "$TMP/$1"
  echo "$TMP/$1"
}

echo "== A3 qa-preflight self-test =="
echo
echo "-- regression: paths that existed before the /auth/me check --"

OUT=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$ALL_VALID" 2>&1); check "T1 valid credentials" 0 $?
grep_ok "T1b role reported from /auth/me" "$OUT" "role CLIENT_ADMIN"
grep_ok "T1c contour verified where derivable" "$OUT" "contour CLIENT verified"
grep_ok "T1d separation asserted" "$OUT" "OK (one company each, disjoint)"

if printf '%s' "$OUT" | grep -qiE "$SENTINEL_PW|SECRETTOKENVALUE|SECRETCOOKIEVALUE|Set-Cookie|Bearer"; then
  FAIL=$((FAIL+1)); echo "  FAIL T7 secret redaction (secret leaked in output)"
else PASS=$((PASS+1)); echo "  PASS T7 secret redaction (no password/token/cookie in report)"; fi

INV=$(variant invalid CLIENT_ADMIN invalid@stage.local CLIENT)
bash "$SCRIPT" --base-url "$BASE" --inventory "$INV" >/dev/null 2>&1; check "T2 invalid credentials (401)" 1 $?

EXP=$(variant expired CLIENT_ADMIN expired@stage.local CLIENT)
bash "$SCRIPT" --base-url "$BASE" --inventory "$EXP" >/dev/null 2>&1; check "T3 expired credentials" 1 $?

MIS=$(inv missing <<EOF
CLIENT_ADMIN     client.admin@stage.local    CLIENT
CLIENT           client.user@stage.local     CLIENT
PROVIDER_ADMIN   provider.admin@stage.local  PROVIDER
MASTER           master@stage.local          PROVIDER
EOF
)
OUT4=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$MIS" 2>&1); RC4=$?
check "T4 missing account" 1 $RC4
grep_ok "T4b missing listed" "$OUT4" "Missing QA accounts    : DISPATCHER"

DEADPORT=$(( PORT + 1 ))
bash "$SCRIPT" --base-url "http://127.0.0.1:$DEADPORT" --inventory "$ALL_VALID" --timeout 2 >/dev/null 2>&1; check "T5 API unavailable" 3 $?

F403=$(variant f403 CLIENT_ADMIN forbidden@stage.local CLIENT)
F403=$(awk '$1=="CLIENT"{print "CLIENT  boom@stage.local  CLIENT"; next} {print}' "$F403" > "$TMP/f403b"; echo "$TMP/f403b")
OUT6=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$F403" 2>&1); check "T6 403/500 classification" 1 $?
grep_ok "T6b 403 labelled" "$OUT6" "FORBIDDEN (403)"
grep_ok "T6c 500 labelled" "$OUT6" "ERROR (500)"

SLOW=$(variant slow CLIENT_ADMIN slow@stage.local CLIENT)
OUT8=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$SLOW" --timeout 1 2>&1); check "T8 timeout handling" 1 $?
grep_ok "T8b timeout labelled" "$OUT8" "NO RESPONSE/TIMEOUT"

bash "$SCRIPT" --inventory "$ALL_VALID" >/dev/null 2>&1; check "T9 live guard refuses Stage" 4 $?

unset SMA_QA_PW_MASTER
bash "$SCRIPT" --base-url "$BASE" --inventory "$ALL_VALID" >/dev/null 2>&1; check "T10 missing password env" 1 $?
export SMA_QA_PW_MASTER="$SENTINEL_PW"

bash "$SCRIPT" --base-url "$BASE" >/dev/null 2>&1; check "T11 no inventory" 2 $?

echo
echo "-- negative: login succeeds but the identity is wrong (the false PASS) --"

# N1 wrong role behind valid credentials → must NOT pass
N1=$(variant n1 PROVIDER_ADMIN wrongrole@stage.local PROVIDER)
OUTN1=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N1" 2>&1); check "N1 role mismatch" 5 $?
grep_ok "N1b role mismatch reported" "$OUTN1" "ROLE MISMATCH (is TECHNICIAN, expected ADMIN)"
grep_ok "N1c not ready" "$OUTN1" "READY FOR ACCEPTANCE  : NO"

# N2 right role, wrong contour (CLIENT_ADMIN whose surface flag says PROVIDER)
N2=$(variant n2 CLIENT_ADMIN wrongcontour@stage.local CLIENT)
OUTN2=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N2" 2>&1); check "N2 contour mismatch" 5 $?
grep_ok "N2b contour mismatch reported" "$OUTN2" "CONTOUR MISMATCH (is PROVIDER, declared CLIENT)"

# N3 token minted but rejected by /auth/me
N3=$(variant n3 MASTER badtoken@stage.local PROVIDER)
OUTN3=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N3" 2>&1); check "N3 token rejected on /auth/me" 5 $?
grep_ok "N3b token rejection reported" "$OUTN3" "TOKEN REJECTED (/auth/me"

# N4 deactivated account that still authenticates
N4=$(variant n4 DISPATCHER inactive@stage.local PROVIDER)
OUTN4=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N4" 2>&1); check "N4 deactivated account" 5 $?
grep_ok "N4b deactivation reported" "$OUTN4" "ACCOUNT DEACTIVATED"

# N5 provider-declared account living in the client company → contours share a company
N5=$(variant n5 MASTER crosscontour@stage.local PROVIDER)
OUTN5=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N5" 2>&1); check "N5 contours share a company" 5 $?
grep_ok "N5b separation violation reported" "$OUTN5" "contours-share-company"

# N6 login 200 without a token in the body
N6=$(variant n6 CLIENT notoken@stage.local CLIENT)
OUTN6=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N6" 2>&1); check "N6 login 200 without token" 5 $?
grep_ok "N6b missing token reported" "$OUTN6" "NO TOKEN IN RESPONSE"

# N7 inventory without the CONTOUR column → configuration error, not a skip
N7=$(inv n7 <<EOF
CLIENT_ADMIN     client.admin@stage.local
CLIENT           client.user@stage.local     CLIENT
PROVIDER_ADMIN   provider.admin@stage.local  PROVIDER
MASTER           master@stage.local          PROVIDER
DISPATCHER       dispatcher@stage.local      PROVIDER
EOF
)
ERRN7=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N7" 2>&1); check "N7 inventory without contour" 2 $?
grep_ok "N7b contour column demanded" "$ERRN7" "without a CONTOUR column"

# N8 inventory with an unknown contour value
N8=$(variant n8 MASTER master@stage.local SOMEWHERE)
ERRN8=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N8" 2>&1); check "N8 unknown contour value" 2 $?
grep_ok "N8b unknown contour reported" "$ERRN8" "unknown CONTOUR"

# N9 empty inventory
N9=$(inv n9 <<EOF
# only comments here
EOF
)
bash "$SCRIPT" --base-url "$BASE" --inventory "$N9" >/dev/null 2>&1; check "N9 empty inventory" 2 $?

# N10 the original defect, stated directly: a 200 login must not be enough.
# Every account below authenticates (200) yet none is the claimed identity.
N10=$(inv n10 <<EOF
CLIENT_ADMIN     wrongrole@stage.local       CLIENT
CLIENT           wrongrole@stage.local       CLIENT
PROVIDER_ADMIN   wrongrole@stage.local       PROVIDER
MASTER           wrongrole@stage.local       PROVIDER
DISPATCHER       wrongrole@stage.local       PROVIDER
EOF
)
OUTN10=$(bash "$SCRIPT" --base-url "$BASE" --inventory "$N10" 2>&1); check "N10 all-200 but all wrong identity" 5 $?
if printf '%s' "$OUTN10" | grep -q "READY FOR ACCEPTANCE  : YES"; then
  FAIL=$((FAIL+1)); echo "  FAIL N10b false PASS still possible"
else PASS=$((PASS+1)); echo "  PASS N10b no false PASS (login 200 alone never passes)"; fi

# N11 secrets stay out of the report on the failure paths too
if printf '%s' "$OUTN1$OUTN2$OUTN3$OUTN4$OUTN5$OUTN6$OUTN10" \
   | grep -qiE "$SENTINEL_PW|SECRETTOKENVALUE|SECRETCOOKIEVALUE|Bearer"; then
  FAIL=$((FAIL+1)); echo "  FAIL N11 secret redaction on failure paths"
else PASS=$((PASS+1)); echo "  PASS N11 secret redaction on failure paths"; fi

# N13 the token must never reach a command line: argv is world-readable via ps,
# so a leak there is a disclosure even when the report itself stays clean.
#
# The sampler lives in a file and assembles the needle at runtime. Both matter:
# a pattern typed inline puts the sentinel into the sampler's OWN argv, and then
# ps finds it every time — the first version of this test "failed" for exactly
# that reason, catching itself rather than the script. Processes named grep are
# excluded for the same reason.
cat > "$TMP/argvprobe.sh" <<'PROBE'
#!/usr/bin/env bash
PAT="$(printf 'SECRETTOKEN'; printf 'VALUE')"
: > "$2"
for _ in $(seq 1 600); do
  if ps -eo args= 2>/dev/null | grep -F "$PAT" | grep -vF 'grep' | grep -q .; then
    echo LEAK >> "$2"; break
  fi
  sleep 0.01
done
PROBE
SLOWME=$(variant slowme MASTER slowme@stage.local PROVIDER)
bash "$TMP/argvprobe.sh" sample "$TMP/argv.leak" & SAMPLER=$!
bash "$SCRIPT" --base-url "$BASE" --inventory "$SLOWME" --timeout 5 >/dev/null 2>&1
kill "$SAMPLER" 2>/dev/null; wait "$SAMPLER" 2>/dev/null
if [ -s "$TMP/argv.leak" ]; then
  FAIL=$((FAIL+1)); echo "  FAIL N13 token absent from argv (found in the process table)"
else PASS=$((PASS+1)); echo "  PASS N13 token absent from argv (ps sampled while /auth/me was held open)"; fi

# N12 e-mails are masked, never printed whole
if printf '%s' "$OUT" | grep -q "client.admin@stage.local"; then
  FAIL=$((FAIL+1)); echo "  FAIL N12 e-mail masking (full address in report)"
else PASS=$((PASS+1)); echo "  PASS N12 e-mail masking"; fi

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
