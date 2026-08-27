# TECHNICAL_DEBT — ServiceManager.AI

Документ фиксирует технический долг и риски MVP, чтобы мы не забыли закрыть их до production.

---

## 1) Security / Secrets
- [ ] Никогда не хранить секреты в docker-compose.yml для production. Только в .env / секрет-хранилище.
- [ ] Ротация JWT_SECRET и политика истечения токенов.
- [ ] Ограничить CORS, rate limiting, brute-force protection на /auth.
- [ ] Ввести refresh tokens (опционально) и blacklist/rotation.
- [ ] Проверить отсутствие логирования токенов/паролей.

## 2) Multi-tenant isolation
- [ ] Везде гарантировать фильтрацию по companyId (особенно в tickets/users/specializations/problemCategories).
- [ ] Негативные тесты на утечки данных между компаниями.
- [ ] Политика каскадного удаления и “soft-delete” для production.

## 3) Data model evolution
- [ ] Ticket status history (audit trail по статусам).
- [ ] SLA модель (policy + расчёт deadlines).
- [ ] Индексы на часто используемые поля (companyId, createdAt, status, assignedTechnicianId).

## 4) Observability
- [ ] Structured logging (requestId, companyId, userId).
- [ ] Health endpoints /metrics.
- [ ] Sentry/ошибки, алерты.

## 5) API quality
- [ ] OpenAPI/Swagger генерация и актуальность.
- [ ] Версионирование API (v1).
- [ ] Единые ошибки (error codes, validation messages).

## 6) Performance
- [ ] Pagination на list endpoints (/tickets, /users, /technicians).
- [ ] Ограничения размеров payload (фото/вложения позже).
- [ ] N+1 queries (проверить include/select).

## 7) Dev workflow
- [ ] Makefile / scripts для типовых задач.
- [ ] Pre-commit hooks (lint/format/tests).
- [ ] CI (lint + unit + e2e + migration check).

## 8) Frontend/Mobile readiness
- [ ] Auth flow готов к мобильному клиенту (token storage, refresh).
- [ ] Offline-first требования учесть в API (sync позже).

---

## Notes
Этот документ должен регулярно обновляться при появлении новых рисков.
