#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASS="${ADMIN_PASS:-123456}"

TECH_EMAIL="${TECH_EMAIL:-tech1@test.com}"
TECH_PASS="${TECH_PASS:-12345678}"

SPEC_NAME="${SPEC_NAME:-Internet}"

py_get() {
  # usage: echo "$json" | py_get 'lambda o: o["access_token"]'
  python3 - "$@" <<'PY'
import sys, json
expr = sys.argv[1]
data = json.load(sys.stdin)
fn = eval(expr)
v = fn(data)
if v is None:
  print("")
elif isinstance(v, (dict,list)):
  print(json.dumps(v, ensure_ascii=False))
else:
  print(v)
PY
}

api() {
  # api METHOD PATH [JSON_BODY]
  local method="$1"; shift
  local path="$1"; shift
  local body="${1:-}"

  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" \
      "${AUTH_HEADER[@]:-}" \
      -d "$body"
  else
    curl -sS -X "$method" "$BASE$path" \
      "${AUTH_HEADER[@]:-}"
  fi
}

die() { echo "❌ $*" >&2; exit 1; }
ok()  { echo "✅ $*"; }

echo "== Smoke: TECH claim available ticket =="
echo "BASE=$BASE"

# 1) login admin
AUTH_HEADER=()
ADMIN_TOKEN="$(api POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | py_get 'lambda o: o.get("access_token","")')"
[[ -n "$ADMIN_TOKEN" ]] || die "Admin login failed (no access_token). Check ADMIN_EMAIL/ADMIN_PASS."
ok "Admin login"

# 2) login tech
TECH_TOKEN="$(api POST /auth/login "{\"email\":\"$TECH_EMAIL\",\"password\":\"$TECH_PASS\"}" | py_get 'lambda o: o.get("access_token","")')"
[[ -n "$TECH_TOKEN" ]] || die "Tech login failed (no access_token). Check TECH_EMAIL/TECH_PASS."
ok "Tech login"

# 3) get me (company sanity)
AUTH_HEADER=(-H "Authorization: Bearer $ADMIN_TOKEN")
ADMIN_ME="$(api GET /auth/me)"
ADMIN_COMPANY="$(echo "$ADMIN_ME" | py_get 'lambda o: o.get("companyId","")')"
[[ -n "$ADMIN_COMPANY" ]] || die "Admin /auth/me has no companyId?"
ok "Admin companyId=$ADMIN_COMPANY"

AUTH_HEADER=(-H "Authorization: Bearer $TECH_TOKEN")
TECH_ME="$(api GET /auth/me)"
TECH_ID="$(echo "$TECH_ME" | py_get 'lambda o: o.get("id","")')"
TECH_COMPANY="$(echo "$TECH_ME" | py_get 'lambda o: o.get("companyId","")')"
[[ -n "$TECH_ID" ]] || die "Tech /auth/me has no id?"
[[ "$TECH_COMPANY" == "$ADMIN_COMPANY" ]] || die "Company mismatch: admin=$ADMIN_COMPANY tech=$TECH_COMPANY"
ok "Tech id=$TECH_ID companyId=$TECH_COMPANY"

# 4) find SPEC_ID by name
AUTH_HEADER=(-H "Authorization: Bearer $ADMIN_TOKEN")
SPECS="$(api GET /specializations)"
SPEC_ID="$(echo "$SPECS" | py_get 'lambda a: next((s.get("id","") for s in a if s.get("name","").lower()=="'"$(echo "$SPEC_NAME" | tr '[:upper:]' '[:lower:]')"'" ), "")')"
[[ -n "$SPEC_ID" ]] || die "Specialization '$SPEC_NAME' not found via GET /specializations"
ok "Spec '$SPEC_NAME' id=$SPEC_ID"

# 5) set technician specializations (ADMIN)
SET_RES="$(api PUT "/technicians/$TECH_ID/specializations" "{\"specializationIds\":[\"$SPEC_ID\"]}")"
# quick verify: response contains specializationId
HAS_LINK="$(echo "$SET_RES" | py_get 'lambda o: any(x.get("specializationId","")=="'"$SPEC_ID"'" for x in (o.get("technicianSpecializations") or []))')"
[[ "$HAS_LINK" == "True" ]] || die "Failed to set specialization on technician. Response: $SET_RES"
ok "Specialization assigned to tech"

# 6) get available tickets under TECH
AUTH_HEADER=(-H "Authorization: Bearer $TECH_TOKEN")
AVAIL="$(api GET /tickets/available)"
TICKET_ID="$(echo "$AVAIL" | py_get 'lambda a: (a[0].get("id","") if a else "")')"
[[ -n "$TICKET_ID" ]] || die "No available tickets for tech (empty /tickets/available). Create a NEW ticket linked to spec/category first."
ok "Available ticket id=$TICKET_ID"

# 7) claim
CLAIM_RES="$(api POST "/tickets/$TICKET_ID/claim")"
STATUS="$(echo "$CLAIM_RES" | py_get 'lambda o: o.get("status","")')"
ASSIGNED_TO="$(echo "$CLAIM_RES" | py_get 'lambda o: o.get("assignedTechnicianId","")')"

[[ "$STATUS" == "ASSIGNED" ]] || die "Claim did not assign. status=$STATUS resp=$CLAIM_RES"
[[ "$ASSIGNED_TO" == "$TECH_ID" ]] || die "Assigned technician mismatch. expected=$TECH_ID got=$ASSIGNED_TO resp=$CLAIM_RES"
ok "Claim success: status=ASSIGNED assignedTechnicianId=$ASSIGNED_TO"

# 8) available should not include this ticket anymore (often becomes empty)
AVAIL2="$(api GET /tickets/available)"
STILL_THERE="$(echo "$AVAIL2" | py_get 'lambda a: any(t.get("id","")=="'"$TICKET_ID"'" for t in a)')"
[[ "$STILL_THERE" == "False" ]] || die "Ticket still appears in /tickets/available after claim. avail=$AVAIL2"
ok "Ticket removed from available"

echo "🎉 SMOKE PASSED"
