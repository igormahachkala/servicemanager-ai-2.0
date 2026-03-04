# API SPEC — ServiceManager.AI

Base URL (dev):

http://localhost:3000

Auth:

Bearer JWT

Все запросы выполняются внутри companyId,
который извлекается из JWT.

---

# 1. AUTH

## POST /auth/register

Регистрация новой компании и ADMIN пользователя.

Request

{
  "companyName": "My Company",
  "email": "admin@example.com",
  "password": "password"
}

Response

{
  "access_token": "jwt"
}

---

## POST /auth/login

Авторизация пользователя.

Request

{
  "email": "admin@example.com",
  "password": "password"
}

Response

{
  "access_token": "jwt"
}

---

## GET /auth/me

Возвращает текущего пользователя.

Auth required.

Response

{
  "id": "uuid",
  "email": "user@email.com",
  "role": "ADMIN",
  "companyId": "uuid"
}

---

# 2. COMPANY

## GET /company

Получить данные компании.

Auth required.

Response

{
  "id": "uuid",
  "name": "Company",
  "autoAssignEnabled": true
}

---

## PATCH /company/auto-assign

Включить или выключить автоназначение.

Auth required.

Role:

ADMIN

Request

{
  "enabled": true
}

Response

{
  "id": "uuid",
  "autoAssignEnabled": true
}

---

# 3. USERS

## POST /users

Создать пользователя.

Auth required.

Roles allowed:

ADMIN

Request

{
  "email": "tech@test.local",
  "password": "password",
  "role": "TECHNICIAN"
}

Response

{
  "id": "uuid",
  "email": "tech@test.local",
  "role": "TECHNICIAN"
}

---

# 4. TECHNICIANS

## GET /technicians

Список техников.

Auth required.

Response

[
  {
    "id": "uuid",
    "email": "tech@test.local"
  }
]

---

# 5. TICKETS

## POST /tickets

Создание заявки.

Auth required.

Roles allowed:

ADMIN  
MASTER  
DISPATCHER

Request

{
  "problemCategoryId": "uuid",
  "problemText": "Printer broken",
  "urgency": "NOT_URGENT",
  "requesterName": "John",
  "requesterPhone": "+7 999 000 00 00",
  "address": "Some address",
  "pointName": "Office"
}

Response

{
  "ticket": { ... },
  "instructions": "...",
  "candidates": [ ... ],
  "autoAssigned": true
}

---

## GET /tickets

Получить список тикетов.

Auth required.

Response

[
  {
    "id": "uuid",
    "status": "NEW",
    "problemText": "...",
    "assignedTechnicianId": null
  }
]

---

## GET /tickets/:id

Получить один тикет.

Auth required.

Response

{
  "id": "uuid",
  "status": "NEW",
  "problemText": "...",
  "assignedTechnicianId": null
}

---

# 6. ASSIGN

## PUT /tickets/:ticketId/assign/:technicianId

Назначить техника.

Auth required.

Roles allowed:

ADMIN  
MASTER  
DISPATCHER

Response

{
  "id": "ticketId",
  "assignedTechnicianId": "technicianId",
  "status": "ASSIGNED"
}

---

# 7. CLAIM

## POST /tickets/:ticketId/claim

Техник забирает заявку.

Auth required.

Role:

TECHNICIAN

Правила:

- статус должен быть NEW
- специализация должна совпадать

Response

{
  "id": "ticketId",
  "assignedTechnicianId": "techId",
  "status": "ASSIGNED"
}

---

# 8. STATUS CHANGE

## PATCH /tickets/:ticketId/status

Смена статуса заявки.

Auth required.

Roles allowed:

ADMIN  
MASTER  
DISPATCHER  
TECHNICIAN (если assigned)

Request

{
  "status": "IN_PROGRESS"
}

Response

{
  "id": "ticketId",
  "status": "IN_PROGRESS"
}

---

# 9. CHILD TICKETS

## POST /tickets/:parentId/child

Создание дочернего тикета.

Auth required.

Roles allowed:

ADMIN  
MASTER  
DISPATCHER

Request

{
  "problemCategoryId": "uuid",
  "problemText": "Child issue",
  "urgency": "NOT_URGENT"
}

Response

{
  "id": "childTicketId",
  "parentId": "parentId"
}

---

# 10. BOARD API

Kanban board для диспетчера.

## GET /tickets/board

Auth required.

Query parameters

status=NEW  
status=ASSIGNED  
assigneeId=unassigned  
sla=atRisk  
take=50  
q=search

Response

{
  "columns": [
    {
      "status": "NEW",
      "total": 10,
      "cards": [ ... ]
    }
  ],
  "meta": {
    "totalTickets": 100
  }
}

---

# 11. EVENTS

Система записывает domain events.

Примеры событий:

ticket.created  
ticket.assigned  
ticket.claimed  
ticket.status_changed

События используются для:

- аналитики
- SLA
- аудита
