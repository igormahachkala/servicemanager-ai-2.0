#!/usr/bin/env bash
#
# qa-preflight.sh — A3 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# Read-only preflight that catches broken Stage QA accounts BEFORE a release is
# deployed and acceptance is attempted. It checks API availability and that each
# approved QA account can authenticate, per role. It NEVER creates/modifies users,
# resets passwords, changes RolePermission, runs migrations, deploys, or prints any
# secret (password / token / cookie) — login responses are discarded, only the HTTP
# status code is read.
#
# Credentials inventory (roles → emails) is a file you point at; passwords are read
# from environment variables only (SMA_QA_PW_<ROLE>) and never stored or logged.
#
#   Inventory file ($SMA_QA_INVENTORY or --inventory FILE), one per line:
#       CLIENT_ADMIN    client.admin@stage.local
#       CLIENT          client.user@stage.local
#       PROVIDER_ADMIN  provider.admin@stage.local
#       MASTER          master@stage.local
#       DISPATCHER      dispatcher@stage.local
#   Password for role R comes from env SMA_QA_PW_R (e.g. $SMA_QA_PW_CLIENT_ADMIN).
#
# LIVE-CONTOUR GUARD: Stage is a shared, sometimes-reserved contour. Requests to any
# non-loopback host require explicit authorization via SMA_QA_PREFLIGHT_LIVE=1 (the
# OWNER GO). Loopback hosts (127.0.0.1/localhost) are always allowed — that is how
# this script is developed and tested, against a local mock. Without the flag a
# non-loopback target is refused (exit 4); nothing is sent.
#
# Usage:   qa-preflight.sh [--base-url URL] [--inventory FILE] [--timeout SECONDS]
# Default base URL: https://stage-api.sma-assistants.ru
#
# Exit codes:
#   0  READY FOR ACCEPTANCE (API up and every approved role authenticates)
#   1  one or more roles failed to authenticate, or a required role is missing
#   2  bad arguments / missing or empty inventory
#   3  API unavailable (health check failed)
#   4  live request to a non-loopback host refused (no SMA_QA_PREFLIGHT_LIVE=1)
#
set -u

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
[ -n "$INVENTORY" ] || die "no inventory: set \$SMA_QA_INVENTORY or pass --inventory FILE" 2
[ -f "$INVENTORY" ] || die "inventory file not found: $INVENTORY" 2

# label role key for display ("PROVIDER ADMIN" rather than PROVIDER_ADMIN)
role_label() { case "$1" in PROVIDER_ADMIN) echo "PROVIDER ADMIN";; *) echo "$1";; esac; }

# mask an email local-part so the report exposes no full identifiers
mask_email() {
  case "$1" in
    *@*) local lp="${1%@*}" dom="${1#*@}"; printf '%s***@%s' "${lp%"${lp#?}"}" "$dom" ;;
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

# curl helpers — never emit body/headers; only the numeric HTTP status.
http_get_code() { curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$1" 2>/dev/null; }
# POST login: password supplied via stdin env-expansion in a subshell; body discarded.
login_code() {
  # $1=email  $2=password (passed as positional, never printed)
  curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" \
    -H 'Content-Type: application/json' \
    --data-binary @- "$BASE_URL/auth/login" 2>/dev/null <<JSON
{"email":$(json_str "$1"),"password":$(json_str "$2")}
JSON
}
# minimal JSON string escaper (quotes + backslashes)
json_str() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }

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
echo "  Credentials status by role:"
FAILURES=""
MISSING=""
PASS_N=0
for role in $REQUIRED_ROLES; do
  email=$(awk -v r="$role" '$1==r{print $2; exit}' "$INVENTORY")
  if [ -z "$email" ]; then
    MISSING="$MISSING $role"
    printf "      - %-16s : MISSING from inventory\n" "$(role_label "$role")"
    continue
  fi
  pwvar="SMA_QA_PW_${role}"
  pw=$(eval "printf '%s' \"\${$pwvar:-}\"")
  if [ -z "$pw" ]; then
    FAILURES="$FAILURES $role(no-password-env)"
    printf "      - %-16s : NO PASSWORD (set \$%s)\n" "$(role_label "$role")" "$pwvar"
    continue
  fi
  code=$(login_code "$email" "$pw")
  case "$code" in
    200) PASS_N=$((PASS_N+1)); printf "      - %-16s : OK (200)            %s\n" "$(role_label "$role")" "$(mask_email "$email")" ;;
    401) FAILURES="$FAILURES $role(401)"; printf "      - %-16s : AUTH FAILED (401)   %s\n" "$(role_label "$role")" "$(mask_email "$email")" ;;
    403) FAILURES="$FAILURES $role(403)"; printf "      - %-16s : FORBIDDEN (403)     %s\n" "$(role_label "$role")" "$(mask_email "$email")" ;;
    000|"") FAILURES="$FAILURES $role(timeout)"; printf "      - %-16s : NO RESPONSE/TIMEOUT %s\n" "$(role_label "$role")" "$(mask_email "$email")" ;;
    *)   FAILURES="$FAILURES $role($code)"; printf "      - %-16s : ERROR (%s)          %s\n" "$(role_label "$role")" "$code" "$(mask_email "$email")" ;;
  esac
done

echo
echo "  Authentication failures:${FAILURES:- none}"
echo "  Missing QA accounts    :${MISSING:- none}"
echo

REQ_N=$(printf '%s\n' $REQUIRED_ROLES | grep -c .)
if [ "$PASS_N" -eq "$REQ_N" ]; then
  echo "  READY FOR ACCEPTANCE  : YES"
  RC=0
else
  echo "  READY FOR ACCEPTANCE  : NO ($PASS_N/$REQ_N roles authenticated)"
  RC=1
fi
echo
echo "  (Read-only preflight — no users/passwords/permissions touched; no secrets logged.)"
exit $RC
