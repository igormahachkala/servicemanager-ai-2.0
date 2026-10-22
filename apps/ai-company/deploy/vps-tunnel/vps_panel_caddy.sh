#!/usr/bin/env bash
# VPS whose ports 80/443 belong to Caddy (daily runs there): publish the AI
# Company panel at https://<domain> as one more Caddy site.
#   https://<domain> --basic auth--> 10.77.0.2:18080 (tunnel -> office panel)
# Caddy gets the certificate itself. The site is REMOVED again unless an
# anonymous request gets 401 — the panel has no login of its own.
#
# Usage: sudo bash vps_panel_caddy.sh <domain>
#   env: UPSTREAM=10.77.0.2:18080 PANEL_USER=owner PANEL_PASSWORD=... (else asked)
#        CADDYFILE=/etc/caddy/Caddyfile  SKIP_TLS=1 (local test: http:// site)
set -euo pipefail

DOMAIN="${1:?usage: vps_panel_caddy.sh <domain>}"
UPSTREAM="${UPSTREAM:-10.77.0.2:18080}"
PANEL_USER="${PANEL_USER:-owner}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
CADDY="${CADDY_BIN:-caddy}"
BEGIN="# >>> ai-company panel ($DOMAIN) — managed by vps_panel_caddy.sh"
END="# <<< ai-company panel ($DOMAIN)"

say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '    OK  %s\n' "$*"; }
warn() { printf '    !!  %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*"; exit 1; }

reload_caddy() {
  if [ -n "${CADDY_RELOAD_CMD:-}" ]; then eval "$CADDY_RELOAD_CMD"
  elif command -v systemctl >/dev/null && systemctl is-active --quiet caddy 2>/dev/null; then systemctl reload caddy
  else "$CADDY" reload --config "$CADDYFILE" --adapter caddyfile
  fi
}

[ "$(id -u)" -eq 0 ] || [ -n "${ALLOW_NON_ROOT:-}" ] || die "Run with sudo."

say "Caddy"
command -v "$CADDY" >/dev/null || die "caddy binary not found. If Caddy runs in Docker, send: docker ps; docker inspect <caddy container> | grep -A3 Mounts"
[ -f "$CADDYFILE" ] || die "$CADDYFILE not found. Find the config: systemctl cat caddy | grep ExecStart"
ver="$("$CADDY" version | awk '{print $1}')"
ok "caddy $ver, config $CADDYFILE"
# basic_auth is the 2.8+ name; older versions only know basicauth.
auth_directive="basic_auth"
case "$ver" in v2.[0-7].*) auth_directive="basicauth" ;; esac

say "Tunnel -> office panel: http://$UPSTREAM"
code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://$UPSTREAM/" || true)"
if [ "$code" = "200" ]; then ok "HTTP 200"; else warn "HTTP ${code:-000} — fine if the Windows panel is not started yet; the site works once it is."; fi

say "Password for user '$PANEL_USER'"
if [ -z "${PANEL_PASSWORD:-}" ]; then
  read -r -s -p "    password: " PANEL_PASSWORD; echo
  read -r -s -p "    again:    " again; echo
  [ "$PANEL_PASSWORD" = "$again" ] || die "passwords differ"
fi
[ "${#PANEL_PASSWORD}" -ge 8 ] || die "use at least 8 characters"
hash="$("$CADDY" hash-password --plaintext "$PANEL_PASSWORD")"
ok "hashed (bcrypt)"

site="$DOMAIN"
[ -n "${SKIP_TLS:-}" ] && site="http://$DOMAIN"

say "Site block in $CADDYFILE"
backup="$CADDYFILE.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$CADDYFILE" "$backup"
ok "backup $backup"
# Drop a previous block for this domain, then append the fresh one.
tmp="$(mktemp)"
awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$CADDYFILE" > "$tmp"
cat >> "$tmp" <<CONF

$BEGIN
$site {
	$auth_directive {
		$PANEL_USER $hash
	}
	reverse_proxy $UPSTREAM {
		header_up -Authorization
		flush_interval -1
		transport http {
			dial_timeout 5s
			read_timeout 600s
			write_timeout 600s
		}
	}
}
$END
CONF

restore() { cp -a "$backup" "$CADDYFILE"; reload_caddy || true; }

if ! "$CADDY" validate --config "$tmp" --adapter caddyfile >/tmp/ai-company-caddy-validate.log 2>&1; then
  tail -5 /tmp/ai-company-caddy-validate.log
  rm -f "$tmp"
  die "new config does not validate — nothing changed."
fi
cat "$tmp" > "$CADDYFILE"; rm -f "$tmp"
ok "validated and written"

say "Reload Caddy"
reload_caddy || { restore; die "reload failed — previous config restored."; }
ok "reloaded (daily and other sites keep running)"

say "Security check: ${site/#http:\/\//http://} without a password"
if [ -n "${SKIP_TLS:-}" ]; then url="http://$DOMAIN/"; resolve=(--resolve "$DOMAIN:${TEST_PORT:-80}:127.0.0.1"); url="http://$DOMAIN:${TEST_PORT:-80}/"
else url="https://$DOMAIN/"; resolve=(--resolve "$DOMAIN:443:127.0.0.1"); fi
anon=""
for _ in $(seq 1 30); do   # first start: Caddy is still getting the certificate
  anon="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "${resolve[@]}" "$url" || true)"
  [ "$anon" = "401" ] && break
  sleep 2
done
if [ "$anon" = "401" ]; then
  ok "401 — password required"
else
  restore
  die "got HTTP ${anon:-000} instead of 401 — block removed, previous config restored. If it was a certificate delay, rerun in a minute; journalctl -u caddy -n 50 shows why."
fi

printf '\nDone: %s  (user: %s)\n' "$url" "$PANEL_USER"
printf 'Last step on the Windows server: .\\05-public-hostname.ps1 -Hostname %s\n' "$DOMAIN"
