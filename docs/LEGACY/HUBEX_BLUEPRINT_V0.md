# HUBEX_BLUEPRINT_V0 — workflow platform foundation (ServiceManager.AI)

Цель: зафиксировать минимальный “контракт Hubex” до расширения функционала.
Контракт = статусы/переходы/назначения/канбан/события/уведомления/права.

---

## 0) Принципы
- Guard → Policy → Service → DB
- Multi-tenant: companyId везде
- Permission codes: только из PERMISSIONS (one source of truth)
- Workflow = state machine, а не “enum и if-else по проекту”
- Любое действие = Domain Event (для аналитики/уведомлений/audit)
- История и аудит — first-class citizen

---

## 1) Ticket Workflow (v0)

### 1.1 Статусы (текущий enum в проекте)
Сейчас в коде используется:
- NEW
- ASSIGNED
- IN_PROGRESS
- DONE
- CANCELED

**Важно:** v0 не меняет enum, а фиксирует правила переходов как контракт.

### 1.2 Переходы (таблица v0)
Обозначения ролей:
- MGMT = ADMIN/MASTER/DISPATCHER/NETWORK_DIRECTOR
- TECH = TECHNICIAN

| From → To | Кто может | Условия | Side effects |
|---|---|---|---|
| NEW → ASSIGNED | MGMT | выбран technicianId | emit ticket.assigned |
| NEW → ASSIGNED (claim) | TECH | ticket доступен + NEW | emit ticket.claimed |
| NEW → IN_PROGRESS | MGMT | (если нужно в админских сценариях) | emit ticket.status_changed |
| ASSIGNED → IN_PROGRESS | TECH | только назначенный | emit ticket.status_changed |
| ASSIGNED → DONE | MGMT | (админ может закрыть) | emit ticket.status_changed |
| IN_PROGRESS → DONE | TECH | только назначенный | emit ticket.status_changed |
| NEW/ASSIGNED/IN_PROGRESS → CANCELED | MGMT | причина/коммент обязателен (roadmap) | emit ticket.status_changed |

---

## 2) Assignment orchestration (v0)
- manual assign: MGMT назначает техника
- claim (pull): TECH забирает NEW доступный
- auto-assign (push): система назначает (company.autoAssignEnabled)

---

## 3) Kanban contract (v0)
Колонки (default):
- NEW
- ASSIGNED
- IN_PROGRESS
- DONE
- CANCELED (обычно отдельная вкладка)

Один view-контракт должен уметь:
- counts по статусам
- списки по статусам
- фильтры: urgency/category/technician/slaBreached/date range

---

## 4) Domain Events (v0)

### 4.1 Список событий
- ticket.created
- ticket.assigned
- ticket.claimed
- ticket.status_changed
- sla.breached
- user.created

### 4.2 Поля события (контракт)
- id (uuid)
- companyId
- entityType (Ticket/User/…)
- entityId
- type
- actorUserId (nullable для system)
- payload (json)
- createdAt

**Примечание:** в v0 события пишем через абстракцию (пока можно noop/log),
а event-store таблицу добавим отдельной миграцией.

---
