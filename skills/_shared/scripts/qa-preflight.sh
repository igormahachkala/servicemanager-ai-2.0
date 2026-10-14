#!/usr/bin/env bash
#
# qa-preflight.sh — A3 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# Read-only preflight that catches broken Stage QA accounts BEFORE a release is
# deployed and acceptance is attempted. It NEVER creates/modifies users, resets
# passwords, changes RolePermission, runs migrations or deploys.
#
# WHY HTTP 200 ON LOGIN IS NOT ENOUGH
# -----------------------------------
# The first revision accepted "/auth/login → 200" as proof that a QA account was
# correct. It is not: 200 only proves the e-mail and password match SOME account.
# It says nothing about WHICH account. A QA inventory line claiming
# "PROVIDER_ADMIN provider.admin@stage.local" passed even when that address was a
# CLIENT-contour user, a TECHNICIAN, or an account in the wrong company — and
# acceptance then failed on Stage for a reason the preflight had already touched
# and declared green. That is a false PASS, and it is the defect this revision
# closes.
#
# So after authenticating, the script calls GET /auth/me with the issued token and
# verifies the IDENTITY BEHIND the credentials:
#
#   1. the token actually works      — /auth/me must answer 200;
#   2. the role is the expected one  — me.role must equal the role the inventory
#                                      claims (ROLE MISMATCH otherwise);
#   3. the account is enabled        — me.isActive must not be false;
#   4. the contour is the right one  — see CONTOUR SEPARATION below.
#
# CONTOUR SEPARATION (CLIENT vs PROVIDER)
# ---------------------------------------
# /auth/me does NOT return companyType (see backend auth.service.toPublicUser and
# the frontend Me type — companyType is consumed to compute a flag and then
# dropped). The contour therefore cannot simply be read off the payload, and this
# script does not pretend otherwise. Two checks are used instead, and both are
# real verification rather than a restatement of the inventory:
#
#   a) COMPANY GROUPING. Every account declared in one contour must resolve to the
#      same me.companyId, and the CLIENT contour's company must differ from the
#      PROVIDER contour's. This catches the realistic breakage — a "provider" QA
#      account that actually lives in the client company, or two contours
#      collapsed onto one company — because companyId comes from the server.
#
#   b) MANAGEMENT-SURFACE INVERSION. me.canAccessManagementSurface is derived
#      server-side from (role, companyType), so for some roles it is invertible:
#        CLIENT_ADMIN       → true means CLIENT company,   false means PROVIDER
#        DISPATCHER, MASTER → true means PROVIDER company, false means CLIENT
#      For those roles the derived contour is compared with the declared one.
#      For ADMIN (true in both contours) and TECHNICIAN/CLIENT (false in both) the
#      flag carries no contour information; the script says so explicitly instead
#      of guessing. Role, grouping and disjointness still apply to them.
#
# The inventory declares the contour; the server decides whether the declaration
# holds. A declaration that cannot be checked is reported as such and never
# counted as verified.
#
# SECRETS
# -------
# No password, token or cookie is ever printed, and none is placed in a command
# line (argv is world-readable via ps). Passwords come from the environment and
# travel to curl over stdin. The access token is written to a 0600 file under a
# umask-077 temp directory and handed to curl through --config, so it appears
# neither in argv nor in the report. Response bodies are parsed, never echoed.
# E-mails are masked in the report. The temp directory is wiped on exit.
#
# INVENTORY ($SMA_QA_INVENTORY or --inventory FILE)
#   <ROLE_KEY> <email> <CONTOUR>        # whitespace-separated, one per line
#       CLIENT_ADMIN    client.admin@stage.local    CLIENT
#       CLIENT          client.user@stage.local     CLIENT
#       PROVIDER_ADMIN  provider.admin@stage.local  PROVIDER
#       MASTER          master@stage.local          PROVIDER
#       DISPATCHER      dispatcher@stage.local      PROVIDER
#   '#' starts a comment. CONTOUR is required: without it the contour cannot be
#   checked, and silently skipping the check is exactly the false PASS being fixed.
#   Password for ROLE_KEY R comes from env SMA_QA_PW_R, e.g. $SMA_QA_PW_CLIENT_ADMIN.
#
#   ROLE_KEY is an inventory label, not a UserRole: PROVIDER_ADMIN denotes the
#   provider-contour administrator whose actual UserRole is ADMIN. The mapping
#   below is authoritative; comparing me.role against the raw key would fail for
#   every provider admin.
#
# LIVE-CONTOUR GUARD: requests to any non-loopback host require explicit
# authorization via SMA_QA_PREFLIGHT_LIVE=1 (the OWNER GO). Loopback is always
# allowed — that is how this script is developed and tested against a local mock.
#
# Usage:   qa-preflight.sh [--base-url URL] [--inventory FILE] [--timeout SECONDS]
# Default base URL: https://stage-api.sma-assistants.ru
#
# Exit codes:
#   0  READY FOR ACCEPTANCE (API up, every role authenticates AND verifies)
#   1  one or more roles failed to authenticate, or a required role is missing
#   2  bad arguments / missing, empty or malformed inventory / missing dependency
#   3  API unavailable (health check failed)
#   4  live request to a non-loopback host refused (no SMA_QA_PREFLIGHT_LIVE=1)
#   5  credentials authenticate but the identity behind them is wrong
#      (role mismatch, deactivated account, or contour violation)
#
set -u
umask 077

REQUIRED_ROLES="CLIENT_ADMIN CLIENT PROVIDER_ADMIN MASTER DISPATCHER"
BASE_URL="https://stage-api.sma-assistants.ru"
INVENTORY="${SMA_QA_INVENTORY:-}"
TIMEOUT=10

die() { echo "qa-preflight: $1" >&2; exit "${2:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)  BASE_URL="${2:-}"; shift 2 || die "--base-url needs a value" ;;
    --inventory) INVENTORY="${2:-}"; shift 2 || die "--inventory needs a value" ;;
    --timeout)   TIMEOUT="${2:-}"; shift 2 || die "--timeout needs a value" ;;
    *) die "unknown argument: $1" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "curl not found" 2
# python3 parses the JSON payloads. A sed-based reader would misread nested
# objects and could hand back the wrong role — precision matters more here than
# one less dependency.
command -v python3 >/dev/null 2>&1 || die "python3 not found (needed to parse /auth/me)" 2
[ -n "$INVENTORY" ] || die "no inventory: set \$SMA_QA_INVENTORY or pass --inventory FILE" 2
[ -f "$INVENTORY" ] || die "inventory file not found: $INVENTORY" 2

WORK=$(mktemp -d "${TMPDIR:-/tmp}/qapf-run.XXXXXX") || die "cannot create temp dir" 2
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM

# ROLE_KEY → actual UserRole expected from /auth/me.
expected_user_role() {
  case "$1" in
    PROVIDER_ADMIN) echo "ADMIN" ;;
    CLIENT_ADMIN)   echo "CLIENT_ADMIN" ;;
    CLIENT)         echo "CLIENT" ;;
    MASTER)         echo "MASTER" ;;
    DISPATCHER)     echo "DISPATCHER" ;;
    *)              echo "$1" ;;
  esac
}

# Contour implied by canAccessManagementSurface, where the flag is invertible.
# Prints CLIENT, PROVIDER, or nothing when the role carries no contour signal.
derived_contour() {
  case "$1" in
    CLIENT_ADMIN)      [ "$2" = "true" ] && echo CLIENT   || echo PROVIDER ;;
    DISPATCHER|MASTER) [ "$2" = "true" ] && echo PROVIDER || echo CLIENT ;;
    *) : ;;
  esac
}

role_label() { case "$1" in PROVIDER_ADMIN) echo "PROVIDER ADMIN";; *) echo "$1";; esac; }

# Mask an e-mail so the report carries no full identifier.
mask_email() {
  case "$1" in
    *@*) lp="${1%@*}"; dom="${1#*@}"; printf '%s***@%s' "${lp%"${lp#?}"}" "$dom" ;;
    *)   printf '***' ;;
  esac
}

# LIVE guard: non-loopback host requires explicit authorization.
host=$(printf '%s' "$BASE_URL" | sed -E 's#^[a-z]+://##; s#[:/].*$##')
case "$host" in
  127.0.0.1|localhost|::1) LIVE_MODE="mock/local ($host)";;
  *)
    if [ "${SMA_QA_PREFLIGHT_LIVE:-0}" = "1" ]; then
      LIVE_MODE="LIVE ($host) — authorized via SMA_QA_PREFLIGHT_LIVE=1"
    else
      echo "qa-preflight: refusing to send requests to non-loopback host '$host' without authorization." >&2
      echo "              Stage is a shared/reserved contour. Set SMA_QA_PREFLIGHT_LIVE=1 (OWNER GO) to run" >&2
      echo "              against it, or pass --base-url http://127.0.0.1:PORT for a local mock." >&2
      exit 4
    fi
    ;;
esac

json_str() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
http_get_code() { curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$1" 2>/dev/null; }

# POST /auth/login. Body (with the password) goes over stdin, never argv.
# Writes the response body to $1 and prints only the HTTP status.
login_into() {
  _out="$1"; _email="$2"; _pw="$3"
  curl -s -o "$_out" -w '%{http_code}' --max-time "$TIMEOUT" \
    -H 'Content-Type: application/json' \
    --data-binary @- "$BASE_URL/auth/login" 2>/dev/null <<JSON
{"email":$(json_str "$_email"),"password":$(json_str "$_pw")}
JSON
}

# GET /auth/me. The token is passed through a 0600 curl config file so it never
# reaches argv; the file is overwritten per call and removed with $WORK.
me_into() {
  _out="$1"; _tokenfile="$2"
  curl -s -o "$_out" -w '%{http_code}' --max-time "$TIMEOUT" \
    --config "$_tokenfile" "$BASE_URL/auth/me" 2>/dev/null
}

# Extract one field. Prints the value, or nothing when absent/unparsable.
# Only scalar fields are read; the body itself is never echoed.
json_field() {
  python3 - "$1" "$2" <<'PY' 2>/dev/null
import json,sys
try:
    with open(sys.argv[1], 'rb') as fh:
        data = json.load(fh)
except Exception:
    sys.exit(0)
if not isinstance(data, dict):
    sys.exit(0)
node = data
for part in sys.argv[2].split('.'):
    if not isinstance(node, dict) or part not in node:
        sys.exit(0)
    node = node[part]
if isinstance(node, bool):
    print('true' if node else 'false')
elif node is None:
    sys.exit(0)
elif isinstance(node, (str, int, float)):
    print(node)
PY
}

# --- inventory ---------------------------------------------------------------
# Parsed once, with validation: a malformed inventory is a configuration error,
# not a silent skip.
INV_CLEAN="$WORK/inventory"
sed 's/#.*$//' "$INVENTORY" | awk 'NF' > "$INV_CLEAN"
[ -s "$INV_CLEAN" ] || die "inventory is empty: $INVENTORY" 2

BAD_LINES=$(awk 'NF && NF<3 {print $1}' "$INV_CLEAN" | tr '\n' ' ')
if [ -n "${BAD_LINES% }" ]; then
  die "inventory rows without a CONTOUR column: ${BAD_LINES% }
              expected '<ROLE_KEY> <email> <CLIENT|PROVIDER>'. The contour column is
              required — skipping the contour check is the false PASS being fixed." 2
fi
BAD_CONTOUR=$(awk 'NF>=3 && $3!="CLIENT" && $3!="PROVIDER" {print $1"="$3}' "$INV_CLEAN" | tr '\n' ' ')
if [ -n "${BAD_CONTOUR% }" ]; then
  die "inventory rows with an unknown CONTOUR: ${BAD_CONTOUR% } (expected CLIENT or PROVIDER)" 2
fi

# 1. API availability.
HEALTH_CODE=$(http_get_code "$BASE_URL/health")

echo "QA PREFLIGHT REPORT"
echo
echo "  Environment           : $BASE_URL"
echo "  Mode                  : $LIVE_MODE"
echo "  Timeout               : ${TIMEOUT}s"
if [ "$HEALTH_CODE" = "200" ]; then
  echo "  API availability      : OK (/health 200)"
else
  echo "  API availability      : UNAVAILABLE (/health → ${HEALTH_CODE:-no-response})"
  echo
  echo "  READY FOR ACCEPTANCE  : NO (API unavailable)"
  echo
  echo "  (Read-only preflight — no users/passwords/permissions touched.)"
  exit 3
fi

echo
echo "  Credentials and identity by role:"
AUTH_FAILURES=""
IDENTITY_FAILURES=""
MISSING=""
PASS_N=0
CLIENT_COMPANIES=""
PROVIDER_COMPANIES=""
UNVERIFIABLE_CONTOUR=""

for role in $REQUIRED_ROLES; do
  line=$(awk -v r="$role" '$1==r{print; exit}' "$INV_CLEAN")
  if [ -z "$line" ]; then
    MISSING="$MISSING $role"
    printf "      - %-16s : MISSING from inventory\n" "$(role_label "$role")"
    continue
  fi
  email=$(printf '%s' "$line" | awk '{print $2}')
  want_contour=$(printf '%s' "$line" | awk '{print $3}')
  masked=$(mask_email "$email")
  want_role=$(expected_user_role "$role")

  pwvar="SMA_QA_PW_${role}"
  pw=$(eval "printf '%s' \"\${$pwvar:-}\"")
  if [ -z "$pw" ]; then
    AUTH_FAILURES="$AUTH_FAILURES $role(no-password-env)"
    printf "      - %-16s : NO PASSWORD (set \$%s)\n" "$(role_label "$role")" "$pwvar"
    continue
  fi

  BODY="$WORK/login.json"
  : > "$BODY"
  code=$(login_into "$BODY" "$email" "$pw")
  case "$code" in
    200) : ;;
    401) AUTH_FAILURES="$AUTH_FAILURES $role(401)"; printf "      - %-16s : AUTH FAILED (401)   %s\n" "$(role_label "$role")" "$masked"; continue ;;
    403) AUTH_FAILURES="$AUTH_FAILURES $role(403)"; printf "      - %-16s : FORBIDDEN (403)     %s\n" "$(role_label "$role")" "$masked"; continue ;;
    000|"") AUTH_FAILURES="$AUTH_FAILURES $role(timeout)"; printf "      - %-16s : NO RESPONSE/TIMEOUT %s\n" "$(role_label "$role")" "$masked"; continue ;;
    *)   AUTH_FAILURES="$AUTH_FAILURES $role($code)"; printf "      - %-16s : ERROR (%s)          %s\n" "$(role_label "$role")" "$code" "$masked"; continue ;;
  esac

  # Login succeeded. That alone proves nothing about WHICH account answered.
  token=$(json_field "$BODY" access_token)
  : > "$BODY"
  if [ -z "$token" ]; then
    IDENTITY_FAILURES="$IDENTITY_FAILURES $role(no-token)"
    printf "      - %-16s : LOGIN 200 BUT NO TOKEN IN RESPONSE  %s\n" "$(role_label "$role")" "$masked"
    continue
  fi

  TOKENCFG="$WORK/curl.cfg"
  : > "$TOKENCFG"; chmod 600 "$TOKENCFG"
  printf 'header = "Authorization: Bearer %s"\n' "$token" > "$TOKENCFG"
  token=""

  MEBODY="$WORK/me.json"
  : > "$MEBODY"
  me_code=$(me_into "$MEBODY" "$TOKENCFG")
  : > "$TOKENCFG"
  if [ "$me_code" != "200" ]; then
    IDENTITY_FAILURES="$IDENTITY_FAILURES $role(me-$me_code)"
    printf "      - %-16s : TOKEN REJECTED (/auth/me → %s)  %s\n" "$(role_label "$role")" "${me_code:-no-response}" "$masked"
    : > "$MEBODY"
    continue
  fi

  got_role=$(json_field "$MEBODY" role)
  got_company=$(json_field "$MEBODY" companyId)
  got_active=$(json_field "$MEBODY" isActive)
  got_surface=$(json_field "$MEBODY" canAccessManagementSurface)
  : > "$MEBODY"

  if [ -z "$got_role" ]; then
    IDENTITY_FAILURES="$IDENTITY_FAILURES $role(no-role-in-me)"
    printf "      - %-16s : /auth/me RETURNED NO ROLE  %s\n" "$(role_label "$role")" "$masked"
    continue
  fi
  if [ "$got_role" != "$want_role" ]; then
    IDENTITY_FAILURES="$IDENTITY_FAILURES $role(role:$got_role!=$want_role)"
    printf "      - %-16s : ROLE MISMATCH (is %s, expected %s)  %s\n" "$(role_label "$role")" "$got_role" "$want_role" "$masked"
    continue
  fi
  if [ "$got_active" = "false" ]; then
    IDENTITY_FAILURES="$IDENTITY_FAILURES $role(deactivated)"
    printf "      - %-16s : ACCOUNT DEACTIVATED  %s\n" "$(role_label "$role")" "$masked"
    continue
  fi

  # Contour check (b): invert canAccessManagementSurface where it is invertible.
  contour_note="contour $want_contour declared"
  if [ -n "$got_surface" ]; then
    got_contour=$(derived_contour "$role" "$got_surface")
    if [ -n "$got_contour" ]; then
      if [ "$got_contour" != "$want_contour" ]; then
        IDENTITY_FAILURES="$IDENTITY_FAILURES $role(contour:$got_contour!=$want_contour)"
        printf "      - %-16s : CONTOUR MISMATCH (is %s, declared %s)  %s\n" "$(role_label "$role")" "$got_contour" "$want_contour" "$masked"
        continue
      fi
      contour_note="contour $want_contour verified"
    else
      UNVERIFIABLE_CONTOUR="$UNVERIFIABLE_CONTOUR $role"
      contour_note="contour $want_contour declared (role carries no contour signal)"
    fi
  fi

  # Contour check (a) feeds the grouping/disjointness assertions below.
  if [ -n "$got_company" ]; then
    case "$want_contour" in
      CLIENT)   CLIENT_COMPANIES="$CLIENT_COMPANIES $got_company" ;;
      PROVIDER) PROVIDER_COMPANIES="$PROVIDER_COMPANIES $got_company" ;;
    esac
  fi

  PASS_N=$((PASS_N+1))
  printf "      - %-16s : OK  role %s, %s  %s\n" "$(role_label "$role")" "$got_role" "$contour_note" "$masked"
done

# --- contour grouping and disjointness ---------------------------------------
uniq_count() { printf '%s\n' $1 | awk 'NF' | sort -u | grep -c . ; }
CONTOUR_ERRORS=""
C_UNIQ=$(uniq_count "$CLIENT_COMPANIES")
P_UNIQ=$(uniq_count "$PROVIDER_COMPANIES")
[ "$C_UNIQ" -gt 1 ] && CONTOUR_ERRORS="$CONTOUR_ERRORS client-contour-spans-$C_UNIQ-companies"
[ "$P_UNIQ" -gt 1 ] && CONTOUR_ERRORS="$CONTOUR_ERRORS provider-contour-spans-$P_UNIQ-companies"
if [ "$C_UNIQ" -ge 1 ] && [ "$P_UNIQ" -ge 1 ]; then
  SHARED=$(printf '%s\n' $CLIENT_COMPANIES | awk 'NF' | sort -u > "$WORK/c.ids"
           printf '%s\n' $PROVIDER_COMPANIES | awk 'NF' | sort -u > "$WORK/p.ids"
           comm -12 "$WORK/c.ids" "$WORK/p.ids" | grep -c .)
  [ "$SHARED" -gt 0 ] && CONTOUR_ERRORS="$CONTOUR_ERRORS contours-share-company"
fi

echo
echo "  Contour separation:"
printf "      - %-26s : %s\n" "CLIENT contour companies"   "$C_UNIQ"
printf "      - %-26s : %s\n" "PROVIDER contour companies" "$P_UNIQ"
if [ -n "$CONTOUR_ERRORS" ]; then
  printf "      - %-26s : VIOLATION —%s\n" "separation" "$CONTOUR_ERRORS"
  IDENTITY_FAILURES="$IDENTITY_FAILURES contour($CONTOUR_ERRORS)"
elif [ "$C_UNIQ" -eq 1 ] && [ "$P_UNIQ" -eq 1 ]; then
  printf "      - %-26s : OK (one company each, disjoint)\n" "separation"
else
  printf "      - %-26s : NOT ASSERTED (a contour has no verified account)\n" "separation"
fi
[ -n "$UNVERIFIABLE_CONTOUR" ] && \
  printf "      - %-26s :%s (ADMIN/TECHNICIAN/CLIENT: flag identical in both contours)\n" "contour not derivable for" "$UNVERIFIABLE_CONTOUR"

echo
echo "  Authentication failures:${AUTH_FAILURES:- none}"
echo "  Identity failures      :${IDENTITY_FAILURES:- none}"
echo "  Missing QA accounts    :${MISSING:- none}"
echo

REQ_N=$(printf '%s\n' $REQUIRED_ROLES | grep -c .)
if [ -n "$IDENTITY_FAILURES" ]; then
  echo "  READY FOR ACCEPTANCE  : NO (credentials authenticate but the identity is wrong)"
  RC=5
elif [ "$PASS_N" -eq "$REQ_N" ] && [ -z "$AUTH_FAILURES" ] && [ -z "$MISSING" ]; then
  echo "  READY FOR ACCEPTANCE  : YES ($PASS_N/$REQ_N roles authenticated and verified)"
  RC=0
else
  echo "  READY FOR ACCEPTANCE  : NO ($PASS_N/$REQ_N roles authenticated and verified)"
  RC=1
fi
echo
echo "  (Read-only preflight — no users/passwords/permissions touched; no secrets logged.)"
exit $RC
