# DATA MODEL DIAGRAM — ServiceManager.AI (text ER)

Нотация:
A 1—N B  = один ко многим
A M—N B  = многие ко многим (через связующую таблицу)

---

## Core

Company 1—N User
Company 1—N Specialization
Company 1—N ProblemCategory
Company 1—N Ticket

---

## Users / Roles

User:
- belongs to one Company
- has role: ADMIN | DISPATCHER | TECHNICIAN | CLIENT | NETWORK_DIRECTOR

Technician is a User with role TECHNICIAN.

---

## Specializations

User (TECHNICIAN) M—N Specialization
через TechnicianSpecialization

TechnicianSpecialization:
- userId
- specializationId
(Unique: userId + specializationId)

---

## Problem categories

ProblemCategory M—N Specialization
через ProblemCategorySpecialization

ProblemCategorySpecialization:
- problemCategoryId
- specializationId
(Unique: problemCategoryId + specializationId)

ProblemCategory may include:
- instructions (памятка до приезда)

---

## Tickets (main)

Ticket:
- belongs to one Company
- belongs to one ProblemCategory
- optional assignedTechnician (User TECHNICIAN)
- has urgency and status
- has SLA minutes (optional)

Relations:
Company 1—N Ticket
ProblemCategory 1—N Ticket
User(TECHNICIAN) 1—N Ticket (assignedTechnician)

---

## Parent/Child tickets

Ticket 1—N Ticket
через self relation:
- parentId (nullable)

Rules:
- Parent ticket can have many children.
- Child ticket has its own status/SLA independently.
- Child copies requester/contact/address/point from parent at creation time (snapshot).

---

## Suggested future entities (Phase 2+)

TicketStatusHistory:
- ticketId
- fromStatus
- toStatus
- changedByUserId
- comment?
- createdAt

Attachment:
- ticketId
- url/path
- type (photo, file)
- createdAt

ServiceAct (PDF):
- ticketId
- actType (WORK_DONE / INSPECTION)
- payload JSON
- pdfUrl
- signedByClient (bool)
- signedAt

Point (Location):
- companyId
- name
- address
- geo lat/lng
- externalId (optional)
Ticket can reference Point instead of duplicating text fields.
