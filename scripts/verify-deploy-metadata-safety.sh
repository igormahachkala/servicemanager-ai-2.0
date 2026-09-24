#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

require_contains() {
  local file="$1"
  local pattern="$2"
  grep -Eq "$pattern" "$file" || fail "$file does not contain required pattern: $pattern"
}

reject_contains() {
  local file="$1"
  local pattern="$2"
  if grep -Eq "$pattern" "$file"; then
    fail "$file contains forbidden pattern: $pattern"
  fi
}

require_contains backend/Dockerfile 'ARG SMA_RELEASE_ENFORCE=false'
require_contains backend/Dockerfile 'SMA_RELEASE_COMMIT_SHA must be a full 40 character git SHA'
require_contains backend/Dockerfile 'SMA_RELEASE_ENVIRONMENT must be beta or prod'

require_contains backend/.dockerignore '^[.]env[.][*]$'
require_contains backend/.dockerignore '^[*][.]env$'
require_contains backend/.dockerignore '^[*][*]/[.]env[.][*]$'
require_contains backend/.dockerignore '^[*][*]/[*][.]env$'
reject_contains backend/.dockerignore '^[[:space:]]*![.]env[.]docker[[:space:]]*$'

require_contains docker-compose.yml 'SMA_RELEASE_COMMIT_SHA'
require_contains docker-compose.yml 'SMA_RELEASE_ENVIRONMENT'
require_contains docker-compose.stage.yml 'SMA_RELEASE_COMMIT_SHA'
require_contains docker-compose.stage.yml 'SMA_RELEASE_ENVIRONMENT'

require_contains skills/sma-deploy-stage/SKILL.md 'SMA_RELEASE_ENFORCE=true'
require_contains skills/sma-deploy-stage/SKILL.md 'SMA_RELEASE_ENVIRONMENT=beta'
require_contains skills/sma-deploy-prod/SKILL.md 'SMA_RELEASE_ENFORCE=true'
require_contains skills/sma-deploy-prod/SKILL.md 'SMA_RELEASE_ENVIRONMENT=prod'
require_contains skills/sma-deploy-prod/references/rollback.md 'SMA_RELEASE_ENFORCE=true'

reject_contains skills/_shared/secrets.md '/opt/sma-prod/backend/[.]env[.]docker не существует'
require_contains skills/_shared/secrets.md 'не является каноническим источником'

echo "deploy metadata safety: PASS"
