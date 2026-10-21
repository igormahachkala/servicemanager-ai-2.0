#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS=(
  "qwen2.5-coder:14b"
  "qwen3-coder:30b"
  "codestral:22b"
  "devstral:24b"
)

echo "Pull targets: ${TARGETS[*]}"

for model in "${TARGETS[@]}"; do
  if ollama list | awk 'NR>1 {print $1}' | grep -Fxq "$model"; then
    echo "Already installed: $model"
    continue
  fi
  echo "Pulling $model ..."
  ollama pull "$model"
done

echo
echo "Installed models:"
ollama list
