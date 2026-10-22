#!/usr/bin/env bash
# VPS (10.77.0.1): publish the AI Company panel at https://<domain>.
#   https://<domain>  --basic auth-->  http://10.77.0.2:18080 (tunnel -> office panel)
# The panel has no login of its own, so this site REFUSES to go live without a
# password: the final check must see 401 without credentials.
#
# Usage: sudo ./vps_panel_site.sh <domain> [email-for-letsencrypt]
#   env: UPSTREAM=http://10.77.0.2:18080 PANEL_USER=owner SKIP_TLS=1 (test only)
set -euo pipefail

DOMAIN="${1:?usage: vps_panel_site.sh <domain> [email]}"
EMAIL="${2:-}"
UPSTREAM="${UPSTREAM:-http://10.77.0.2:18080}"
PANEL_USER="${PANEL_USER:-owner}"
NGINX_ROOT="${NGINX_ROOT:-/etc/nginx}"
HTPASSWD="$NGINX_ROOT/ai-company.htpasswd"
SITE="$NGINX_ROOT/sites-available/ai-company"

reload_nginx() {
  if command -v systemctl >/dev/null && systemctl is-active --quiet nginx 2>/dev/null; then systemctl reload nginx
  elif pgrep -x nginx >/dev/null; then nginx -s reload
  else systemctl enable --now nginx 2>/dev/null || nginx
  fi
}
say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '    OK  %s\n' "$*"; }
warn() { printf '    !!  %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run with sudo."

say "Packages"
need=()
command -v nginx    >/dev/null || need+=(nginx)
command -v htpasswd >/dev/null || need+=(apache2-utils)
if [ -z "${SKIP_TLS:-}" ]; then command -v certbot >/dev/null || need+=(certbot python3-certbot-nginx); fi
if [ "${#need[@]}" -gt 0 ]; then apt-get update -qq && apt-get install -y -qq "${need[@]}"; fi
ok "nginx $(nginx -v 2>&1 | sed 's#.*/##')"

say "Who owns ports 80/443?"
holder="$(ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -v nginx || true)"
if [ -n "$holder" ]; then
  warn "not nginx:"; echo "$holder"
  die "Ports 80/443 are held by another process (Docker/Caddy?). Send this output — the site must be added there instead."
fi
ok "free or nginx"

say "Tunnel -> office panel: $UPSTREAM"
code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$UPSTREAM/" || true)"
if [ "$code" = "200" ]; then ok "HTTP 200"; else warn "HTTP ${code:-000} — run office_panel_forward.sh on the office Linux first (or check wg show)."; fi

say "Password for user '$PANEL_USER'"
if [ -s "$HTPASSWD" ] && grep -q "^$PANEL_USER:" "$HTPASSWD"; then
  ok "exists ($HTPASSWD) — to change: sudo htpasswd $HTPASSWD $PANEL_USER"
else
  create=""; [ -f "$HTPASSWD" ] || create="c"
  if [ -n "${PANEL_PASSWORD:-}" ]; then
    htpasswd "-${create}bB" "$HTPASSWD" "$PANEL_USER" "$PANEL_PASSWORD"
  else
    htpasswd "-${create}B" "$HTPASSWD" "$PANEL_USER"   # asks for the password twice
  fi
  chmod 640 "$HTPASSWD"; chown root:www-data "$HTPASSWD" 2>/dev/null || true
  ok "created"
fi

say "Site $SITE"
cat > "$SITE" <<CONF
# AI Company panel (managed by vps_panel_site.sh)
server {
    listen 80;
    server_name $DOMAIN;

    auth_basic "AI Company";
    auth_basic_user_file $HTPASSWD;

    client_max_body_size 20m;

    location / {
        proxy_pass $UPSTREAM;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Authorization "";   # the password stays on the VPS
        proxy_buffering off;                 # model answers stream token by token
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
CONF
ln -sf "$SITE" "$NGINX_ROOT/sites-enabled/ai-company"
nginx -t
reload_nginx
ok "http://$DOMAIN live behind basic auth"

scheme=https
if [ -n "${SKIP_TLS:-}" ]; then
  scheme=http; warn "SKIP_TLS set — no certificate (test only)"
else
  say "Let's Encrypt for $DOMAIN (DNS A-record must already point here)"
  if [ -n "$EMAIL" ]; then mail=(-m "$EMAIL"); else mail=(--register-unsafely-without-email); fi
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos "${mail[@]}"
  ok "certificate installed, http -> https redirect on"
fi

say "Security check: $scheme://$DOMAIN without a password"
resolve=()
[ -n "${SKIP_TLS:-}" ] && resolve=(--resolve "$DOMAIN:80:127.0.0.1")
anon=""
for _ in 1 2 3 4 5 6; do   # reload is asynchronous: give new workers a moment
  sleep 1
  anon="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "${resolve[@]}" "$scheme://$DOMAIN/" || true)"
  [ "$anon" = "401" ] && break
done
if [ "$anon" = "401" ]; then
  ok "401 — password required"
else
  rm -f "$NGINX_ROOT/sites-enabled/ai-company"; reload_nginx
  die "Got HTTP $anon instead of 401 — site DISABLED so the panel is not open to the internet."
fi

printf '\nDone: %s://%s  (user: %s)\n' "$scheme" "$DOMAIN" "$PANEL_USER"
printf 'Last step on the Windows server: .\\05-public-hostname.ps1 -Hostname %s\n' "$DOMAIN"
