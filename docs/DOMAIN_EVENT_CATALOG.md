# DOMAIN EVENT CATALOG — ServiceManager.AI

Цель:
зафиксировать единый каталог доменных событий (DomainEvent.type)
и контракт их payload.

Domain Events — это Event Store v1 (таблица DomainEvent).
События используются для:
- audit log (история действий)
- аналитики (через события/историю, а не только текущий статус)
- интеграций (webhooks в будущем)
- воспроизводимости (восстановление цепочек действий)

---

## 0) Общий формат DomainEvent

Хранится в БД:

- companyId
- entityType
- entityId
- type
- actorUserId (nullable)
- payload (Json, nullable)
- createdAt

Инварианты:
1) Любое событие строго внутри companyId
2) type — строковый код из этого каталога
3) payload должен быть минимальным, но достаточным
4) Нельзя класть секреты/пароли/токены в payload

---

## 1) Tickets — события тикетов

### 1.1 ticket.created
Когда:
- создан новый тикет (parent или child)

entityType: Ticket  
payload:
- status: TicketStatus
- parentId?: string | null
- problemCategoryId: string
- assignedTechnicianId?: string | null
- autoAssigned?: boolean
- mode?: 'manual' | 'auto' | 'child'

Пример payload:
{
  "status": "NEW",
  "parentId": null,
  "problemCategoryId": "uuid",
  "assignedTechnicianId": null,
  "autoAssigned": false,
  "mode": "manual"
}

---

### 1.2 ticket.assigned
Когда:
- управленческая роль назначила техника (manual assign)

entityType: Ticket  
payload:
- fromStatus: TicketStatus
- toStatus: TicketStatus
- assignedTechnicianId: string
- mode: 'manual'

Пример:
{
  "fromStatus": "NEW",
  "toStatus": "ASSIGNED",
  "assignedTechnicianId": "uuid",
  "mode": "manual"
}

---

### 1.3 ticket.claimed
Когда:
- TECHNICIAN забрал NEW тикет себе (claim)

entityType: Ticket  
payload:
- fromStatus: TicketStatus
- toStatus: TicketStatus
- assignedTechnicianId: string

Пример:
{
  "fromStatus": "NEW",
  "toStatus": "ASSIGNED",
  "assignedTechnicianId": "uuid"
}

---

### 1.4 ticket.status_changed
Когда:
- изменён статус тикета (любой разрешённый transition)

entityType: Ticket  
payload:
- fromStatus: TicketStatus
- toStatus: TicketStatus
- comment?: string | null
- slaBreachedMarked?: boolean

Пример:
{
  "fromStatus": "ASSIGNED",
  "toStatus": "IN_PROGRESS",
  "comment": null,
  "slaBreachedMarked": false
}

---

### 1.5 ticket.sla_breached_marked (planned)
Когда:
- SLA worker отметил breach

entityType: Ticket  
payload:
- slaDueAt: string (ISO)
- breachedAt: string (ISO)

Пример:
{
  "slaDueAt": "2026-03-04T10:00:00.000Z",
  "breachedAt": "2026-03-04T10:05:00.000Z"
}

Статус:
- planned (когда появится SLA worker)

---

### 1.6 ticket.edited (planned)
Когда:
- изменены поля тикета (адрес/описание/категория и т.п.)

entityType: Ticket  
payload:
- changedFields: string[]
- comment?: string | null

Пример:
{
  "changedFields": ["address", "problemText"],
  "comment": "Updated by dispatcher"
}

Статус:
- planned

---

## 2) Users — события пользователей (planned)

### 2.1 user.created
entityType: User  
payload:
- role: UserRole
- email: string

---

### 2.2 user.role_changed
entityType: User  
payload:
- fromRole: UserRole
- toRole: UserRole

---

### 2.3 user.permissions_changed (PBAC)
entityType: User  
payload:
- added: string[]
- removed: string[]

---

## 3) Company — события компании (planned)

### 3.1 company.created
entityType: Company  
payload:
- name: string

---

### 3.2 company.auto_assign_toggled
entityType: Company  
payload:
- enabled: boolean

---

## 4) Specializations & Categories (planned)

### 4.1 specialization.created
entityType: Specialization  
payload:
- name: string

### 4.2 problem_category.created
entityType: ProblemCategory  
payload:
- name: string
- specializationIds: string[]

---

## 5) Правила версионирования

- Нельзя переименовывать event type задним числом.
- Если нужен новый смысл — добавляем новый type.
- Payload может расширяться только backward-compatible:
  - можно добавлять поля
  - нельзя удалять/ломать существующие

---

## 6) Минимальный набор v1 (MVP)

Уже должны существовать в системе:

- ticket.assigned
- ticket.claimed
- ticket.status_changed

Рекомендуется добавить:

- ticket.created

---

## 7) Связь с аналитикой

Analytics v1 строится на:

- TicketStatusHistory
- DomainEvent

События позволяют считать:

- throughput
- время до назначения
- время до решения
- SLA breach count
- активность техников

