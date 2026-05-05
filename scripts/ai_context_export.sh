#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

FILES=(
  "docs/CHAT_BOOTSTRAP.md"
  "docs/ARCHITECTURE.md"
  "docs/API_SPEC.md"
)

for f in "${FILES[@]}"; do
  echo "===================="
  echo "$f"
  echo "===================="
  echo
  cat "$f"
  echo
  echo
done
