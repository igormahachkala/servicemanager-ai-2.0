#!/usr/bin/env bash
#
# stage-smoke.sh — A6 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# Technical post-deploy smoke of a contour: endpoint reachability, expected
# environment + commit SHA (from /version), and analysis of OPERATOR-PROVIDED
# backend/frontend logs for runtime errors / exceptions / restart indicators.
# It produces a PASS/FAIL report and a READY FOR MANUAL ACCEPTANCE line — it does
# NOT create stage-ok and does NOT replace manual acceptance; it is a precondition.
#
# It makes read-only HTTP GETs only. No deploy, no DB, no migration, no lock/tag
# mutation, no Stage change, no secrets access. Response bodies are not dumped;
# only HTTP codes and the two /version fields are read. Any log line echoed into
# the report is redacted for token/password/cookie material.
#
# LIVE-CONTOUR GUARD: Stage is shared/reserved. Requests to any non-loopback host
# require explicit authorization via SMA_STAGE_SMOKE_LIVE=1 (OWNER GO). Loopback
# (127.0.0.1/localhost) is always allowed — that is how this is developed/tested,
# against a local mock. Without the flag a non-loopback target is refused (exit 4).
#
# Usage:
#   stage-smoke.sh [--web-url URL] [--api-url URL] [--expect-sha SHA]
#                  [--expect-env ENV] [--timeout S]
#                  [--backend-log FILE] [--frontend-log FILE]
# Defaults: web https://stage.sma-assistants.ru, api https://stage-api.sma-assistants.ru,
#           env beta, timeout 10.
#
# Exit codes:
#   0  PASS (ready for manual acceptance)
#   1  FAIL (a check failed)
#   2  bad arguments
#   4  live request to a non-loopback host refused (no SMA_STAGE_SMOKE_LIVE=1)
#
set -u

WEB_URL="https://stage.sma-assistants.ru"
API_URL="https://stage-api.sma-assistants.ru"
EXPECT_SHA=""
EXPECT_ENV="beta"
TIMEOUT=10
BACKEND_LOG=""
FRONTEND_LOG=""

die() { echo "stage-smoke: $1" >&2; exit "${2:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --web-url)      WEB_URL="${2:-}"; shift 2 || die "--web-url needs a value" ;;
    --api-url)      API_URL="${2:-}"; shift 2 || die "--api-url needs a value" ;;
    --expect-sha)   EXPECT_SHA="${2:-}"; shift 2 || die "--expect-sha needs a value" ;;
    --expect-env)   EXPECT_ENV="${2:-}"; shift 2 || die "--expect-env needs a value" ;;
    --timeout)      TIMEOUT="${2:-}"; shift 2 || die "--timeout needs a value" ;;
    --backend-log)  BACKEND_LOG="${2:-}"; shift 2 || die "--backend-log needs a value" ;;
    --frontend-log) FRONTEND_LOG="${2:-}"; shift 2 || die "--frontend-log needs a value" ;;
    *) die "unknown argument: $1" ;;
  esac
done
command -v curl >/dev/null 2>&1 || die "curl not found" 2

host_of() { printf '%s' "$1" | sed -E 's#^[a-z]+://##; s#[:/].*$##'; }
is_loopback() { case "$1" in 127.0.0.1|localhost|::1) return 0;; *) return 1;; esac; }

# LIVE guard for both hosts.
for u in "$WEB_URL" "$API_URL"; do
  h=$(host_of "$u")
  if ! is_loopback "$h"; then
    if [ "${SMA_STAGE_SMOKE_LIVE:-0}" != "1" ]; then
      echo "stage-smoke: refusing to contact non-loopback host '$h' without authorization." >&2
      echo "             Stage is shared/reserved. Set SMA_STAGE_SMOKE_LIVE=1 (OWNER GO) for a live run," >&2
      echo "             or pass --web-url/--api-url http://127.0.0.1:PORT for a local mock." >&2
      exit 4
    fi
  fi
done
if is_loopback "$(host_of "$WEB_URL")"; then MODE="mock/local"; else MODE="LIVE (authorized via SMA_STAGE_SMOKE_LIVE=1)"; fi

code_of() { curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$1" 2>/dev/null; }
ctype_of() { curl -s -o /dev/null -w '%{content_type}' --max-time "$TIMEOUT" "$1" 2>/dev/null; }
# /version body is small, non-secret metadata; fetch just the two fields.
version_body() { curl -s --max-time "$TIMEOUT" "$1" 2>/dev/null; }

redact() { sed -E 's/((token|password|secret|cookie|authorization|bearer)["'"'"':= ]+)[A-Za-z0-9._\/+-]+/\1***/gI'; }

FAILS=0
mark() { # name code expected-note
  if [ "$2" = "200" ]; then printf "    %-16s: OK (200)\n" "$1";
  elif [ "$2" = "000" ] || [ -z "$2" ]; then printf "    %-16s: NO RESPONSE/TIMEOUT\n" "$1"; FAILS=$((FAILS+1));
  else printf "    %-16s: FAIL (%s)\n" "$1" "$2"; FAILS=$((FAILS+1)); fi
}

echo "STAGE SMOKE REPORT"
echo
echo "  Environment (expected): $EXPECT_ENV"
echo "  Mode                  : $MODE"
echo "  Web URL               : $WEB_URL"
echo "  API URL               : $API_URL"
echo "  Timeout               : ${TIMEOUT}s"
echo

# --- API: health + version ---
HEALTH_CODE=$(code_of "$API_URL/health")
VER=$(version_body "$API_URL/version")
ACTUAL_SHA=$(printf '%s' "$VER" | sed -n 's/.*"commitSha":"\([^"]*\)".*/\1/p' | head -1)
ACTUAL_ENV=$(printf '%s' "$VER" | sed -n 's/.*"environment":"\([^"]*\)".*/\1/p' | head -1)

echo "  Expected SHA          : ${EXPECT_SHA:-<not provided>}"
echo "  Actual SHA            : ${ACTUAL_SHA:-<none>}"
if [ -n "$EXPECT_SHA" ]; then
  if [ "$EXPECT_SHA" = "$ACTUAL_SHA" ]; then echo "  SHA match             : OK";
  else echo "  SHA match             : MISMATCH"; FAILS=$((FAILS+1)); fi
fi
if [ -n "$EXPECT_ENV" ]; then
  if [ "$EXPECT_ENV" = "$ACTUAL_ENV" ]; then echo "  Environment match     : OK ($ACTUAL_ENV)";
  else echo "  Environment match     : MISMATCH (got '${ACTUAL_ENV:-none}', expected '$EXPECT_ENV')"; FAILS=$((FAILS+1)); fi
fi
echo
echo "  Endpoints:"
mark "Health /health"  "$HEALTH_CODE"
mark "Frontend /"      "$(code_of "$WEB_URL/")"
mark "Mobile /m"       "$(code_of "$WEB_URL/m")"
mark "MAX /max"        "$(code_of "$WEB_URL/max")"
SW_CODE=$(code_of "$WEB_URL/sw.js"); SW_CT=$(ctype_of "$WEB_URL/sw.js")
if [ "$SW_CODE" = "200" ]; then
  case "$SW_CT" in *javascript*) printf "    %-16s: OK (200, %s)\n" "Service Worker" "$SW_CT";;
    *) printf "    %-16s: WARN (200 but content-type '%s')\n" "Service Worker" "${SW_CT:-?}";; esac
else mark "Service Worker" "$SW_CODE"; fi

# --- log analysis (operator-provided files) ---
echo
echo "  Log analysis:"
RUNTIME_ERRORS=0; RESTARTS=0
analyze_log() { # label file
  local label="$1" f="$2"
  [ -z "$f" ] && { printf "    %-16s: (no log provided)\n" "$label"; return; }
  [ -f "$f" ] || { printf "    %-16s: (file not found: %s)\n" "$label" "$f"; return; }
  local errs restarts
  # grep -c already prints a single integer (0 on no match); no `|| echo 0` — that
  # would emit a SECOND 0 and corrupt the arithmetic/formatting.
  errs=$(grep -icE 'error|exception|unhandled|fatal' "$f" 2>/dev/null); errs=$(printf '%s' "${errs:-0}" | head -1)
  restarts=$(grep -icE 'Nest application successfully started|Starting Nest|restart|container .* (restart|died)|SIGTERM' "$f" 2>/dev/null); restarts=$(printf '%s' "${restarts:-0}" | head -1)
  RUNTIME_ERRORS=$((RUNTIME_ERRORS + errs)); RESTARTS=$((RESTARTS + restarts))
  printf "    %-16s: %s error/exception line(s), %s restart indicator(s)\n" "$label" "$errs" "$restarts"
  if [ "$errs" -gt 0 ]; then
    echo "        first matches (redacted):"
    grep -iE 'error|exception|unhandled|fatal' "$f" | head -3 | redact | sed 's|^|          |'
  fi
}
analyze_log "backend log" "$BACKEND_LOG"
analyze_log "frontend log" "$FRONTEND_LOG"
[ "$RUNTIME_ERRORS" -gt 0 ] && FAILS=$((FAILS+1))
# Restart indicators are reported but do not by themselves fail the smoke (a deploy
# recreates containers → one clean start is normal); they are surfaced for judgment.

echo
echo "  Runtime errors        : $RUNTIME_ERRORS"
echo "  Restart indicators    : $RESTARTS (informational)"
echo
if [ "$FAILS" -eq 0 ]; then
  echo "  RESULT                : PASS"
  echo "  READY FOR MANUAL ACCEPTANCE : YES"
  RC=0
else
  echo "  RESULT                : FAIL ($FAILS check(s) failed)"
  echo "  READY FOR MANUAL ACCEPTANCE : NO"
  RC=1
fi
echo
echo "  (Technical smoke only — does NOT create stage-ok and does NOT replace manual"
echo "   acceptance; no deploy, no DB, no lock/tag mutation, no secrets.)"
exit $RC
