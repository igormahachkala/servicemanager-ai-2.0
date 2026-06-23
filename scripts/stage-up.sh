#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Stage build (backend + web)"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://127.0.0.1:3001}"
echo "VITE_API_BASE_URL=$VITE_API_BASE_URL"
docker compose -f docker-compose.stage.yml build stage_backend stage_web

echo "==> Stage up"
docker compose -f docker-compose.stage.yml up -d stage_postgres stage_backend stage_web

echo "==> Wait for backend health"
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "Backend healthy"
    break
  fi
  sleep 2
done

echo "==> Prisma migrate deploy (stage backend)"
docker compose -f docker-compose.stage.yml exec -T stage_backend npx prisma migrate deploy

echo "==> Stage endpoints"
echo -n "health: "; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/health
echo -n "permissions audit (no auth): "; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/permissions/users/00000000-0000-4000-8000-000000000099/audit
echo -n "permissions overrides PUT (no auth): "; curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://127.0.0.1:3001/permissions/users/00000000-0000-4000-8000-000000000099/overrides -H 'content-type: application/json' -d '{}'
echo "Web: http://127.0.0.1:4174 (public: http://194.67.101.37:4174 if routed)"
