# AUDIT_LOG_ARCHITECTURE — ServiceManager.AI

Audit Log нужен для:
- истории изменений
- разборов спорных ситуаций
- безопасности
- compliance

---

## 1) MVP модель
Таблица `AuditLog`:

- id (uuid)
- companyId
- actorUserId (nullable: system)
- entityType (enum: TICKET, USER, COMPANY, ...)
- entityId (string)
- action (enum/string: CREATE, UPDATE, ASSIGN, STATUS_CHANGE, ...)
- payload (json) — diff/metadata
- createdAt

---

## 2) Принципы записи
- Пишем события в service слой
- Никогда не пишем секреты (password, tokens)
- payload содержит:
  - before/after (если небольшое)
  - или только changedFields
  - correlationId/requestId (позже)

---

## 3) Какие события must-have
Tickets:
- create
- assign
- status change
- child created
- update fields

Users:
- create user
- role change
- technician specializations changed

Company:
- autoAssignEnabled toggle

ProblemCategory/Specialization:
- create/update/status toggle
- mapping changes

---

## 4) Доступ
- ADMIN/DISPATCHER могут смотреть audit log
- TECHNICIAN видит только события по своим тикетам (позже)
- CLIENT видит публичные изменения по своим заявкам (позже)

---

## 5) Аналитика
AuditLog — это event stream.
Потом можно строить:
- среднее время до назначения
- время закрытия
- активность диспетчеров/техников
- SLA breach причины
