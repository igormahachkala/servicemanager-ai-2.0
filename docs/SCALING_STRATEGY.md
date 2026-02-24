# SCALING_STRATEGY — ServiceManager.AI

Цель: масштабирование до 15+ клиентов и 1500+ заявок/мес за год, с ростом дальше.

---

## 1) Архитектурные уровни
### MVP (сейчас)
- монолитный NestJS API
- Postgres
- Docker compose

### Scale v1
- разделение окружений (dev/stage/prod)
- Nginx reverse proxy
- HTTPS
- CI/CD
- backup базы
- мониторинг

### Scale v2
- background jobs (bullmq/redis): уведомления, SLA checks, PDF генерация
- event log / audit log
- caching (redis)
- read models для аналитики

### Scale v3
- разделение доменов на модули/сервисы (по мере надобности)
- отдельный сервис нотификаций (Telegram/Max)
- отдельный сервис биллинга

---

## 2) База данных
- индексы на companyId + createdAt + status
- pagination везде
- архивирование закрытых тикетов (partitioning позже)
- реплика read-only (если потребуется)

---

## 3) API и клиенты
- стабилизировать API contract
- versioning /v1
- rate limiting per company
- API keys (для интеграций)

---

## 4) Multi-tenant
- строгая изоляция companyId
- опционально row-level security (RLS) в Postgres позже

---

## 5) Асинхронщина
Добавим очередь:
- PDF generation
- SLA breach scan
- telegram notifications
- analytics aggregation

---

## 6) Observability
- structured logs
- metrics (Prometheus)
- tracing (OpenTelemetry) позже
- alerting (Grafana)

---

## 7) План на год (вехи)
- 0–1 месяц: стабильный MVP + e2e + docs
- 1–3: status history + SLA + PDF acts + notifications
- 3–6: billing v1 + limits + admin panel
- 6–12: mobile + offline sync v1 + advanced analytics
