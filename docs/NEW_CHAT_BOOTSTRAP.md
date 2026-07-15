# NEW CHAT BOOTSTRAP — ServiceManager.AI (2026-03-04)

Цель документа:
- быстро ввести новый чат/AI в контекст текущей ветки разработки
- зафиксировать ключевые архитектурные решения (PBAC vs Policy)
- перечислить, какие файлы/модули нужно попросить для продолжения

---

## 0) Проект (коротко)
ServiceManager.AI — multi-tenant SaaS для сервисных компаний.
Stack: NestJS + Prisma + PostgreSQL + JWT.
Изоляция данных: везде companyId, берём из JWT (req.user.companyId).

---

## 1) Главная архитектурная идея (официальная)
Мы разделили два слоя:

1) **КТО МОЖЕТ** → Permission Blocks (PBAC)
- Проверяется Guards (PermissionsGuard / RolesGuard)
- Permission codes задаются декларативно через декораторы @RequirePermission()

2) **ЧТО ВИДИТ / НА КАКИЕ ДАННЫЕ РАСПРОСТРАНЯЕТСЯ** → Policy (Scope / Data Policy)
- Policy возвращает Prisma.where / decision
- Service не “придумывает” фильтры сам, а применяет decision.where

Формула:
Guard = “можно ли действие”
Policy = “какие данные доступны/применимы”
Service = “делает бизнес-операцию на разрешённых данных”
DB = “хранит состояние и историю”

---

## 2) Что сделано в ветке feat/tickets-policy-v1 (по git log)
HEAD: 8d87d24 Stabilize PBAC/Policy + SLA indexes/worker + analytics + e2e green

Крупные блоки работ:
- Внедрён переходный PBAC (PermissionsGuard) + миграции/seed.
- Добавлен Policy слой (tickets.policy.ts, users.policy.ts) и helpers.
- TicketsService переведён на policy decisions для board/list/getOne/claim и write-rules.
- Kanban board v2: фильтры (status[], assigneeId, sla bucket, q search, take).
- SLA: поля/индексы + SLA worker (бричи/маркировки), метрики в аналитике.
- Domain events: события ticket.created/assigned/status_changed/claimed и т.п.
- Assignment service (детерминированная стратегия/курсор) вынесен в отдельный модуль.
- Workflow: decideTicketTransition для валидных переходов статусов.
- E2E тесты стабилизированы (sequential, auth ожидания, зелёные тесты).

---

## 3) Текущее поведение (важные правила)
### 3.1 Tickets read scope
Официальное решение в текущей реализации:
- TECHNICIAN может читать тикеты в рамках company (list/getOne scoped by companyId).
- Изменение статуса TECHNICIAN — строго только assigned-to-self (enforced в policy/service).

### 3.2 PBAC переходный режим
- Если в БД ещё нет ни одного PermissionBlock (не засеяно) → PermissionsGuard пропускает, работает RolesGuard + policy/service.
- Когда PermissionBlock существует → включается PBAC контроль по RolePermission и UserPermission.

---

## 4) Какие файлы попросить в новом чате (минимальный набор)
### Документация (docs/)
1) docs/CHAT_BOOTSTRAP.md
2) docs/CONTRIBUTING_AI_RULES.md
3) docs/PLATFORM_CONSTITUTION_V2.md
4) docs/SECURITY_MODEL.md
5) docs/AUTHORIZATION_ARCHITECTURE.md
6) docs/RBAC_MATRIX.md
7) docs/TICKET_VISIBILITY_MATRIX.md
8) docs/ARCHITECTURE_DECISIONS.md
9) docs/ARCHITECTURE.md + docs/SERVICE_BOUNDARIES.md + docs/MODULE_MAP.md

### Код (backend/src/)
1) backend/src/common/permissions.guard.ts
2) backend/src/common/permissions.decorator.ts
3) backend/src/common/permissions.constants.ts
4) backend/src/policy/tickets.policy.ts
5) backend/src/policy/users.policy.ts
6) backend/src/policy/policy.types.ts + policy.utils.ts
7) backend/src/tickets/tickets.controller.ts
8) backend/src/tickets/tickets.service.ts
9) backend/src/assignment/** (assignment.service.ts + module)
10) backend/src/events/** (events.bus и store, если есть)
11) backend/src/workflow/** (ticket.workflow)
12) backend/prisma/schema.prisma + backend/prisma/seed.ts + migrations (последние)

---

## 5) Что сейчас важно сделать дальше (операционно)
По git status есть:
- много modified файлов (schema/seed/tickets/policy/docs и т.д.)
- много untracked (migrations, assignment, events, новые docs, новые e2e)

Следующие шаги:
1) Проверить что всё собирается/тесты зелёные.
2) Добавить/закоммитить новые файлы (untracked) и изменения (modified).
3) Сформировать финальный “architecture book” PDF и “dev guide” PDF (скриптом).

---

## 6) Команды, которые обычно нужны новому чату
- Показать последние коммиты:
  git log -n 30 --oneline --decorate

- Показать статус (что не закоммичено):
  git status

- Список важных папок:
  ls -la backend/src/common
  ls -la backend/src/policy
  ls -la backend/src/tickets
  ls -la backend/src/assignment
  ls -la backend/src/events
  ls -la backend/src/workflow

- Собрать PDF документацию:
  ./scripts/build_docs_pdf.sh
