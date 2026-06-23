#!/usr/bin/env bash
set -euo pipefail

# Creates a least-privilege read-only role for AI Developer MCP access to Stage DB.
# Safe to re-run: updates password if SMA_AI_READONLY_PASSWORD is set.

ROLE_NAME="${SMA_AI_READONLY_ROLE:-sma_ai_readonly}"
DB_NAME="${SMA_STAGE_DB_NAME:-sma_stage_db}"
ADMIN_URL="${SMA_STAGE_ADMIN_DATABASE_URL:-postgresql://sma_user:sma_password@localhost:55433/sma_stage_db}"

if [[ -z "${SMA_AI_READONLY_PASSWORD:-}" ]]; then
  echo "ERROR: set SMA_AI_READONLY_PASSWORD before running." >&2
  echo "Example: SMA_AI_READONLY_PASSWORD='$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)' $0" >&2
  exit 1
fi

PASSWORD_ESCAPED="${SMA_AI_READONLY_PASSWORD//\'/\'\'}"

psql_exec() {
  if command -v psql >/dev/null 2>&1; then
    if psql "$ADMIN_URL" -v ON_ERROR_STOP=1 "$@"; then
      return 0
    fi
  fi

  docker run --rm postgres:16 psql "$ADMIN_URL" -v ON_ERROR_STOP=1 "$@"
}

echo "Creating/updating role ${ROLE_NAME} on ${DB_NAME}..."

psql_exec <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE_NAME}') THEN
    CREATE ROLE ${ROLE_NAME} LOGIN PASSWORD '${PASSWORD_ESCAPED}';
  ELSE
    ALTER ROLE ${ROLE_NAME} WITH LOGIN PASSWORD '${PASSWORD_ESCAPED}';
  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE ${DB_NAME} TO ${ROLE_NAME};
GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};
GRANT pg_read_all_data TO ${ROLE_NAME};
SQL

echo "OK: role ${ROLE_NAME} ready (CONNECT + pg_read_all_data)."
