#!/usr/bin/env bash
# Office Linux («красный», 10.77.0.2): forward the AI Company panel into the
# existing WireGuard tunnel. Same pattern as the Ollama forward (nginx stream):
#   VPS 10.77.0.1 -> 10.77.0.2:18080 -> <panel host>:8080 (Windows office server)
# Only the VPS tunnel address may connect. Safe to rerun.
#
# Usage: sudo ./office_panel_forward.sh [PANEL_HOST] [PANEL_PORT]
#   env: WG_ADDR=10.77.0.2 VPS_WG=10.77.0.1 LISTEN_PORT=18080 WG_IFACE=wg-office
set -euo pipefail

PANEL_HOST="${1:-192.168.1.157}"
PANEL_PORT="${2:-8080}"
WG_ADDR="${WG_ADDR:-10.77.0.2}"
VPS_WG="${VPS_WG:-10.77.0.1}"
LISTEN_PORT="${LISTEN_PORT:-18080}"
WG_IFACE="${WG_IFACE:-wg-office}"
NGINX_ROOT="${NGINX_ROOT:-/etc/nginx}"
SNIPPET_DIR="$NGINX_ROOT/stream.d"
SNIPPET="$SNIPPET_DIR/ai-company-panel.conf"

reload_nginx() {
  if command -v systemctl >/dev/null && systemctl is-active --quiet nginx 2>/dev/null; then systemctl reload nginx
  elif pgrep -x nginx >/dev/null; then nginx -s reload
  else systemctl enable --now nginx 2>/dev/null || nginx
  fi
}
say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '    OK  %s\n' "$*"; }
warn() { printf '    !!  %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
command -v nginx >/dev/null || { echo "nginx not found — this script expects the Ollama forward (nginx stream) to be set up already."; exit 1; }

say "Tunnel address $WG_ADDR present?"
if ip -4 addr show | grep -q "inet $WG_ADDR/"; then ok "yes"; else warn "$WG_ADDR not on any interface — is wg-quick@$WG_IFACE up? nginx will fail to bind."; fi

say "Panel reachable from this machine: http://$PANEL_HOST:$PANEL_PORT/"
code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://$PANEL_HOST:$PANEL_PORT/" || true)"
if [ "$code" = "200" ]; then ok "HTTP 200"; else warn "HTTP ${code:-000} — check that ai-company-web runs and Windows firewall allows TCP $PANEL_PORT from the LAN (03-install-services.ps1 adds the rule)."; fi

say "Stream snippet $SNIPPET"
mkdir -p "$SNIPPET_DIR"
cat > "$SNIPPET" <<CONF
# AI Company panel: VPS -> tunnel -> office Windows server (managed by office_panel_forward.sh)
upstream ai_company_panel {
    server $PANEL_HOST:$PANEL_PORT;
}
server {
    listen $WG_ADDR:$LISTEN_PORT;   # tunnel address only
    proxy_pass ai_company_panel;
    proxy_connect_timeout 3s;
    proxy_timeout 600s;             # long model answers stream through here
    allow $VPS_WG;                  # only the VPS
    deny all;
}
CONF
ok "written"

say "Hook stream.d into the existing stream {} block"
include_line="include $SNIPPET_DIR/*.conf;"
if grep -rqsF "$include_line" "$NGINX_ROOT"; then
  ok "include already present"
else
  stream_file="$(grep -rlsE '^[[:space:]]*stream[[:space:]]*\{' "$NGINX_ROOT/nginx.conf" "$NGINX_ROOT/modules-enabled" "$NGINX_ROOT/conf.d" 2>/dev/null | head -n1 || true)"
  if [ -n "$stream_file" ]; then
    cp -a "$stream_file" "$stream_file.bak.$(date +%Y%m%d%H%M%S)"
    # Only one stream {} block is allowed in nginx — add the include inside it.
    sed -i -E "0,/^([[:space:]]*)stream[[:space:]]*\{/s##&\n    $include_line#" "$stream_file"
    ok "added to $stream_file (backup next to it)"
  else
    printf 'stream {\n    %s\n}\n' "$include_line" > "$NGINX_ROOT/modules-enabled/99-ai-company-stream.conf"
    ok "no stream block found — created modules-enabled/99-ai-company-stream.conf"
  fi
fi

say "Firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow in on "$WG_IFACE" from "$VPS_WG" to any port "$LISTEN_PORT" proto tcp >/dev/null
  ok "ufw: $WG_IFACE $VPS_WG -> $LISTEN_PORT/tcp"
else
  ok "ufw inactive — nothing to do"
fi

say "nginx -t && reload"
nginx -t
reload_nginx
ok "reloaded"

say "Done. On the VPS check:  curl -s -o /dev/null -w '%{http_code}\\n' http://$WG_ADDR:$LISTEN_PORT/   (expect 200)"
