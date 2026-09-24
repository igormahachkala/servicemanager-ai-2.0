#!/bin/sh
set -eu

SYSTEM_CA_BUNDLE="${SSL_CERT_FILE:-/etc/ssl/certs/ca-certificates.crt}"
EXTRA_CA_DIR="${SMA_EXTRA_CA_CERTS_DIR:-/usr/local/share/ca-certificates}"
RUNTIME_CA_BUNDLE="${SMA_RUNTIME_CA_BUNDLE:-/tmp/sma-ca-certificates.crt}"

if [ -r "$SYSTEM_CA_BUNDLE" ]; then
  cp "$SYSTEM_CA_BUNDLE" "$RUNTIME_CA_BUNDLE"
else
  : > "$RUNTIME_CA_BUNDLE"
fi

if [ -d "$EXTRA_CA_DIR" ]; then
  for cert in "$EXTRA_CA_DIR"/*.crt; do
    [ -e "$cert" ] || continue
    [ -r "$cert" ] || continue
    printf '\n' >> "$RUNTIME_CA_BUNDLE"
    cat "$cert" >> "$RUNTIME_CA_BUNDLE"
  done
fi

if [ -s "$RUNTIME_CA_BUNDLE" ]; then
  export NODE_EXTRA_CA_CERTS="$RUNTIME_CA_BUNDLE"
  export SSL_CERT_FILE="$RUNTIME_CA_BUNDLE"
fi

exec "$@"
