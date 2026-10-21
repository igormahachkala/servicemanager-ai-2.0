# TESTING_STRATEGY — ServiceManager.AI

Цель: обеспечить стабильность SaaS при росте фич и клиентов.

---

## 1) Уровни тестов

### Unit tests (быстрые)
- Service-level (TicketsService, AuthService, CompanyService)
- Валидация DTO
- Pure functions (SLA calc, auto-assign ranking)

### Integration tests
- Prisma + Postgres (test DB)
- Проверка multi-tenant фильтрации
- Проверка транзакций/связей

### E2E tests (самые важные)
Через HTTP:
- login/me
- create specialization/problem-category
- map category → specializations
- create technician + set specializations
- create ticket (autoAssign ON) → ASSIGNED
- create ticket (autoAssign OFF) → NEW + candidates
- manual assign → ASSIGNED
- create child ticket → независимый ticket + parentId
- negative tests: доступ к данным другой компании запрещён

---

## 2) Минимальный набор e2e для MVP (must have)
1) Auth: login/me
2) Admin creates: specialization, problem category
3) Links: problem category → specialization
4) Technician created + specialization assigned
5) Ticket created autoAssign ON: technician assigned
6) autoAssign OFF: ticket NEW, candidates returned
7) manual assign works
8) child ticket created

---

## 3) Test environment
- docker compose для тестов (postgres_test)
- отдельная DATABASE_URL для тестов
- миграции применяются перед тестами
- очищение базы между тестами (truncate by companyId или reset schema)

---

## 4) CI pipeline (минимум)
On push:
- npm ci
- lint
- unit tests
- e2e tests (docker compose up test stack)
- prisma migrate status / validate

---

## 5) Правила
- Любая бизнес-логика должна иметь тест (unit или e2e).
- Любой multi-tenant эндпоинт должен иметь негативный тест на утечку.
- Любая миграция должна сопровождаться e2e sanity check.

---

## 6) Расширение
Позже добавим:
- нагрузочные тесты (k6)
- contract tests (OpenAPI)
- chaos tests для prod (по мере роста)
