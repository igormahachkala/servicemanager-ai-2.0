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
  "$ROOT/docs/00_START_HERE.md" \
  "$ROOT/docs/01_PROJECT_OVERVIEW.md" \
  "$ROOT/docs/02_ARCHITECTURE.md" \
  "$ROOT/docs/03_ACCESS_MODEL.md" \
  "$ROOT/docs/06_DOMAIN_MODEL.md" \
  "$ROOT/docs/07_TICKET_LIFECYCLE.md" \
  "$ROOT/docs/08_PERMISSIONS_MATRIX.md" \
  "$ROOT/docs/SERVICE_BOUNDARIES.md" \
  "$ROOT/docs/DB_SCHEMA_EXPLAINED.md" \
  "$ROOT/docs/OBSERVABILITY_STRATEGY.md" \
  "$ROOT/docs/ARCHITECTURE_DECISIONS.md" \
  "$ROOT/docs/15_ARCHITECTURE_STATUS.md" \
  "$ROOT/docs/16_ARCHITECTURE_CHANGELOG.md" \
  "$ROOT/docs/17_DECISION_LOG.md"

# 2) Гайд “как работать”
build_pdf "SMA_DEV_GUIDE.pdf" \
  "$ROOT/docs/00_START_HERE.md" \
  "$ROOT/docs/04_DEVELOPMENT_WORKFLOW.md" \
  "$ROOT/docs/05_TESTING_AND_FIRST_TASK.md" \
  "$ROOT/docs/09_REPOSITORY_GUIDE.md" \
  "$ROOT/docs/10_CODING_STANDARDS.md" \
  "$ROOT/docs/11_RUNTIME_ACCEPTANCE.md" \
  "$ROOT/docs/12_RELEASE_PROCESS.md" \
  "$ROOT/docs/13_TROUBLESHOOTING.md" \
  "$ROOT/docs/API_SPEC.md" \
  "$ROOT/docs/CODE_STYLE_GUIDE.md" \
  "$ROOT/docs/DATABASE_MIGRATION_POLICY.md" \
  "$ROOT/docs/ERROR_HANDLING_POLICY.md" \
  "$ROOT/docs/ERROR_CODE_STANDARD.md"

# 3) Безопасность / доступы
build_pdf "SMA_SECURITY_AND_ACCESS.pdf" \
  "$ROOT/docs/03_ACCESS_MODEL.md" \
  "$ROOT/docs/08_PERMISSIONS_MATRIX.md" \
  "$ROOT/docs/10_CODING_STANDARDS.md" \
  "$ROOT/docs/15_ARCHITECTURE_STATUS.md"

echo
echo "Done. PDFs:"
ls -la "$OUT"
