#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs_pdf"
mkdir -p "$OUT"

build_pdf () {
  local out="$1"; shift
  echo "==> Building $OUT/$out"
  pandoc "$@" \
    -o "$OUT/$out" \
    --pdf-engine=xelatex \
    --toc --number-sections \
    -V mainfont="DejaVu Serif" \
    -V monofont="DejaVu Sans Mono" \
    -V geometry:margin=20mm
}

# 1) Архитектура / платформа (книга)
build_pdf "SMA_ARCHITECTURE_BOOK.pdf" \
  "$ROOT/docs/PLATFORM_CONSTITUTION_V2.md" \
  "$ROOT/docs/ARCHITECTURE.md" \
  "$ROOT/docs/MODULE_MAP.md" \
  "$ROOT/docs/SERVICE_BOUNDARIES.md" \
  "$ROOT/docs/DB_SCHEMA_EXPLAINED.md" \
  "$ROOT/docs/SECURITY_MODEL.md" \
  "$ROOT/docs/OBSERVABILITY_STRATEGY.md" \
  "$ROOT/docs/SCALING_STRATEGY.md" \
  "$ROOT/docs/ARCHITECTURE_DECISIONS.md"

# 2) Гайд “как работать”
build_pdf "SMA_DEV_GUIDE.pdf" \
  "$ROOT/docs/CONTRIBUTING_AI_RULES.md" \
  "$ROOT/docs/PROJECT_RULES.md" \
  "$ROOT/docs/CHAT_BOOTSTRAP.md" \
  "$ROOT/docs/DEV_COMMANDS.md" \
  "$ROOT/docs/API_SPEC.md" \
  "$ROOT/docs/CODE_STYLE_GUIDE.md" \
  "$ROOT/docs/DATABASE_MIGRATION_POLICY.md" \
  "$ROOT/docs/ERROR_HANDLING_POLICY.md" \
  "$ROOT/docs/ERROR_CODE_STANDARD.md"

# 3) Безопасность / доступы
build_pdf "SMA_SECURITY_AND_ACCESS.pdf" \
  "$ROOT/docs/SECURITY_MODEL.md" \
  "$ROOT/docs/RBAC_MATRIX.md" \
  "$ROOT/docs/TICKET_VISIBILITY_MATRIX.md" \
  "$ROOT/docs/AUTHORIZATION_ARCHITECTURE.md" \
  "$ROOT/docs/SYSTEM_INVARIANTS.md"

echo
echo "Done. PDFs:"
ls -la "$OUT"
