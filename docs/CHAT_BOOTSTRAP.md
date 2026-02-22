# CHAT BOOTSTRAP — ServiceManager.AI

Это SaaS система для сервисных компаний (мульти-тенант).

Stack:
- Backend: NestJS
- ORM: Prisma
- DB: PostgreSQL
- Auth: JWT
- Multi-tenant via companyId
- Dockerized

---

## CURRENT STATUS (MVP COMPLETE)

Working modules:
- Auth (register/login/me)
- Users
- Specializations
- ProblemCategories
- Technicians (M:N specializations)
- Company (autoAssignEnabled toggle)
- Tickets
  - auto assign ON/OFF
  - candidates list
  - manual assign
  - parent/child tickets

---

## CORE ENTITIES

Company
User (ADMIN / DISPATCHER / TECHNICIAN / CLIENT / NETWORK_DIRECTOR)
Specialization
ProblemCategory
Ticket
TechnicianSpecialization (M:N)
ProblemCategorySpecialization (M:N)

---

## AUTO ASSIGN LOGIC (MVP)

1) ProblemCategory → Specializations
2) Technicians → Specializations
3) Match
4) If company.autoAssignEnabled = true → assign first candidate
5) Else → status NEW

---

## SECURITY RULES

- JWT always dynamic (never hardcoded)
- No production passwords in code
- Secrets only in .env or docker-compose
- Never hardcode tokens
- Multi-tenant isolation via companyId

---

## IMPORTANT PRINCIPLES

- Backend is API-first.
- All changes must respect multi-tenant architecture.
- No direct SQL outside Prisma.
- No business logic in controller — only in services.
- Always consider scaling.

---

## CURRENT NEXT PHASE

Planned next steps:
- Ticket status history
- Analytics
- SLA tracking
- PDF acts
- Billing
- Mobile app

---

## INSTRUCTIONS FOR AI

You are continuing development of ServiceManager.AI.
Do not suggest random Linux commands unless directly required.
Assume project root:
~/projects/sma-service

Never suggest hardcoding secrets.
