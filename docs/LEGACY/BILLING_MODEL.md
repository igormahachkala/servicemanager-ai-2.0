# BILLING MODEL — ServiceManager.AI

Цель: подготовить SaaS к монетизации без блокировки MVP.

---

## Billing Principles

- Billing не должен мешать работе ядра (tickets).
- Если billing отключен → всё работает как сейчас.
- Billing включается флагом на Company (Phase 5).

---

## Packaging strategy (варианты тарифов)

### Option A — By active technicians
Платим за количество пользователей с ролью TECHNICIAN.
+ просто считать
+ понятно клиенту

### Option B — By requests volume
Платим за количество тикетов в месяц (все статусы).
+ подходит для “маленьких и больших”
- нужен учёт лимитов и блокировка/уведомления

### Option C — By points (locations)
Платим за количество точек (магазинов/объектов).
+ идеально для сетей
- нужен нормальный модуль Points

---

## Recommended initial pricing structure

### Free (internal MVP)
- unlimited for SMA-service (your company)

### Start
- up to X technicians
- up to Y tickets/month
- basic analytics

### Pro
- unlimited technicians
- SLA + history
- acts PDF
- scheduling

### Enterprise
- self-hosted option
- integrations
- custom roles
- audit logs
- dedicated support

---

## Required Billing Entities (Phase 5)

CompanyBilling:
- companyId
- planId
- status (trial/active/past_due/canceled)
- billingPeriodStart/billingPeriodEnd
- limits JSON (technicians, tickets, points)
- createdAt/updatedAt

Payment:
- companyId
- provider (CloudPayments/YooKassa/etc)
- amount
- currency
- status
- externalPaymentId
- createdAt

Plan:
- id
- name
- price
- billingPeriod (monthly/yearly)
- limits JSON

---

## Enforcement Rules

Soft enforcement (Phase 5 initial):
- show warning banner when near limits
- allow overage for N days

Hard enforcement (later):
- block creating new tickets when limit exceeded
- allow only reading/closing existing

---

## Notes for Russia payments

Possible providers:
- YooKassa
- CloudPayments
- Robokassa
(choose later)

Subscriptions:
- recurring payments
- invoices for legal entities
