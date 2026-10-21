# SLA_CALCULATION_MODEL — ServiceManager.AI

SLA = правила времени реакции/выполнения по заявкам.

---

## 1) Термины
- **SLA Policy**: набор правил (по категории, срочности, точке/клиенту).
- **Response time**: время до принятия/назначения (optional).
- **Resolve time**: время до статуса DONE/RESOLVED.
- **Deadline**: вычисляемое время, когда SLA будет нарушено.
- **Breach**: факт нарушения SLA (deadline < now и тикет не закрыт).

---

## 2) MVP модель (простая)
В тикете хранится `slaMinutes` (nullable).
- Если `slaMinutes` null → SLA не применяется.
- Если задано → deadline = createdAt + slaMinutes.

Urgency:
- URGENT: default slaMinutes = 60 (пример)
- NOT_URGENT: default slaMinutes = 24*60 (пример)

Но финально `slaMinutes` может быть:
- из DTO при создании
- или вычислено по policy

---

## 3) Policy модель (следующий шаг)
Таблица `SlaPolicy`:
- companyId
- problemCategoryId (nullable for fallback)
- urgency (nullable)
- pointName (nullable)
- slaMinutes
- isActive

Правило выбора:
1) максимально специфичное (category+urgency+point)
2) category+urgency
3) category only
4) urgency only
5) default company policy

---

## 4) Метрики SLA
- SLA compliance % = closed within deadline / total closed with SLA
- breached open tickets count
- avg time to assign / resolve (позже)

---

## 5) Нужные поля в Ticket (будущее)
- assignedAt (DateTime?)
- resolvedAt (DateTime?)
- closedAt (DateTime?)
- slaDeadlineAt (DateTime?) — чтобы не пересчитывать
- slaBreachedAt (DateTime?) — зафиксировать момент нарушения

MVP можно считать deadline на лету, но для аналитики лучше хранить `slaDeadlineAt`.

---

## 6) Важно
- Parent/Child тикеты SLA независимы: каждый имеет свой deadline.
- Изменение срочности/категории может пересчитать SLA по правилам (policy-based).
