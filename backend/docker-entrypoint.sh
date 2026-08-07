#!/bin/sh
set -e

# Allows Production/Stage to mount an official extra CA certificate into
# /usr/local/share/ca-certificates without baking certificates into Git.
if find /usr/local/share/ca-certificates -type f -name '*.crt' -print -quit 2>/dev/null | grep -q .; then
  update-ca-certificates >/dev/null
fi

exec "$@"
