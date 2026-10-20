# Phase 1.5 — Implementation report ((Role + CompanyType) → Permission)

> Реализовано на ветке `feat/sma-permission-phase1.5`. **Прод не трогали. Frontend editor не добавляли.**
> Stage DB недоступна из среды разработки (порт закрыт), поэтому живой Stage-прогон **не выполнялся** — ниже команды и скрипт проверки для запуска на Stage. Stage PASS не заявляю.

## Одобренные решения (зашиты в матрицу)
- ADMIN+CLIENT: `TICKETS_STATUS_CHANGE=false`, `TICKETS_ASSIGN=false`, `TICKETS_CLAIM=false`, `TICKETS_VIEW_AVAILABLE=false`; `LOCATIONS_MANAGE=true`, `USERS_MANAGE=true` (изоляцию по арендатору обеспечивает scope-слой).
- ADMIN+PROVIDER: полный операционный набор.
- NETWORK_DIRECTOR (client-side): `TICKETS_ASSIGN=false`, `TICKETS_CLAIM=false`, `TICKETS_STATUS_CHANGE=false`; остаётся view/create/edit/locations_view/users_manage/analytics.

## Changed files
| Файл | Что |
|---|---|
| `backend/prisma/schema.prisma` | `RolePermission.companyType CompanyType?`; `@@unique([role, companyType, permissionBlockId])`; `@@index([role, companyType])` |
| `backend/prisma/migrations/20260610000001_role_permission_company_type/migration.sql` | NEW. add column; drop старый unique; composite unique; **partial unique для wildcard (companyType IS NULL)**; индекс |
| `backend/src/common/permissions-matrix.ts` | NEW. Единый источник: блоки + гранты `(role, companyType)` по решениям |
| `backend/src/common/permissions.guard.ts` | резолв `companyType` по `companyId` (кэш TTL); матч `OR [{companyType}, {companyType: null}]`; compat-mode сохранён |
| `backend/prisma/seed.ts` | demo-seed переведён на общий матрикс (full-replace грантов), чтобы не оставлять wildcard ADMIN |
| `backend/scripts/seed-permissions-matrix.ts` | NEW. идемпотентный seed (upsert блоков + full-replace грантов в транзакции) |
| `backend/scripts/rollback-permissions.ts` | NEW. удаляет гранты+блоки → возврат в fallback |
| `backend/package.json` | scripts `seed:permissions`, `seed:permissions:rollback` |

## Локальная верификация (выполнено здесь)
- `nest build` — **зелёный**.
- Unit-тесты: **250/251 passed**. Единственный фейл — `users/users-role-change.spec.ts` (executor cleanup) — **pre-existing**, воспроизводится на базовой ветке со снятыми изменениями; к правам отношения не имеет.
- Логическая проверка матрицы (14 ассертов, без БД) — **MATRIX OK**: ADMIN+CLIENT без assign/claim/status, с locations/users; ADMIN+PROVIDER с assign; MASTER+PROVIDER assign; TECHNICIAN claim/status; TM+CLIENT view-без-assign; NETWORK_DIRECTOR без assign/status; PLATFORM_ADMIN wildcard.

## Seed command (Stage)
> DATABASE_URL должен указывать на stage-БД. Порядок: миграция → (выкат guard) → seed.
```bash
# 1) миграция схемы
docker compose -f docker-compose.stage.yml exec stage_backend npx prisma migrate deploy
# 2) seed матрицы (включает PBAC — fallback выключается)
docker compose -f docker-compose.stage.yml exec stage_backend npm run seed:permissions
```

## Rollback command (Stage)
```bash
docker compose -f docker-compose.stage.yml exec stage_backend npm run seed:permissions:rollback
# PermissionBlock.count() → 0 → guard снова в fallback (поведение как до seed).
# Схему откатывать не требуется (nullable-колонка безвредна).
```

## Stage verification — что прогнать после seed (live, на Stage)
> ⚠️ Предусловие по данным: нужны учётки **ADMIN в CLIENT-компании** и **ADMIN в PROVIDER-компании**.
> В текущем QA-seed `provider@test.local` = ADMIN в провайдер-компании; **ADMIN в клиентской компании может отсутствовать** — тогда добавить такого пользователя в QA-seed перед проверкой.

Скрипт (подставить реальные токены/ID Stage):
```bash
API=http://194.67.101.37:3001; ORIGIN=http://194.67.101.37:4174
TID=<ticketId>; TECH=<technicianId>; CO=<linkedClientCompanyId>
login(){ curl -s -X POST $API/auth/login -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])'; }

PA=$(login provider@test.local StageQa123!)     # ADMIN + PROVIDER
CA=$(login <client-admin@...> <pwd>)             # ADMIN + CLIENT (нужна такая учётка!)

# 1) PROVIDER admin МОЖЕТ assign → ожидаем 200
curl -s -o /dev/null -w "provider-admin assign: %{http_code}\n" -X PUT \
  "$API/tickets/$TID/assign/$TECH?linkedClientCompanyId=$CO" -H "Origin: $ORIGIN" -H "Authorization: Bearer $PA"
# 2) CLIENT admin НЕ может assign → ожидаем 403
curl -s -o /dev/null -w "client-admin assign: %{http_code}\n" -X PUT \
  "$API/tickets/$TID/assign/$TECH" -H "Origin: $ORIGIN" -H "Authorization: Bearer $CA"
# 3) TERRITORIAL_MANAGER может комментировать → 201 ; assign → 403
# 4) TECHNICIAN: claim/status/upload — по текущим правилам
# 5) employees(USERS_MANAGE)/locations-manage — закрыты для технических/клиентских ролей где не положено
```
Ожидаемые результаты: (1) 200, (2) **403** — ключевая цель корректировки; TM комментирует, не назначает; technician-операции работают; права employees/locations соблюдены.

## Риски/заметки
- **Право ≠ изоляция**: `USERS_MANAGE`/`LOCATIONS_MANAGE` у ADMIN+CLIENT безопасны только потому, что scope режет по арендатору — проверить на Stage отдельно.
- **NETWORK_DIRECTOR status_change=false** — вывод из принципа «client-side не управляет операционным статусом» (явно не диктовалось в decision; легко вернуть одной строкой матрицы).
- **Drift на `migrate dev`**: partial unique index не выражается в schema.prisma; для `migrate deploy` это ок, но при будущем `migrate dev` Prisma его «не увидит». Зафиксировано намеренно.
- **Demo `prisma db seed`** теперь тоже пишет companyType-aware гранты (full-replace) — больше не вернёт wildcard ADMIN с assign.
