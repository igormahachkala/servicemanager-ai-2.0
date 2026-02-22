# ServiceManager.AI — PROJECT CONTEXT

## 1) Product
SaaS для обслуживающих компаний (лифты/вентиляция/кондиционеры/IT-аутсорс и т.д.).
MVP: заявки (tickets), техники, специализации, автоназначение, дочерние заявки.

## 2) Target audience
Сервисные компании и диспетчерские службы. Есть мобильные сотрудники. Нужен офлайн режим в будущем.

## 3) Environment / Stack
- Local dev: Windows + WSL (Ubuntu)
- Docker Desktop + docker compose
- Backend: NestJS
- DB: PostgreSQL
- ORM: Prisma
- Auth: JWT (Bearer token)

Ports:
- backend: http://localhost:3000
- postgres: localhost:5432

## 4) Current status (implemented)
✅ Auth
- POST /auth/register
- POST /auth/login
- GET /auth/me
Roles: ADMIN, DISPATCHER, TECHNICIAN, CLIENT, NETWORK_DIRECTOR

✅ Users
- GET /users
- POST /users

✅ Specializations
- GET/POST/PATCH /specializations

✅ Problem Categories + binding to specializations
- GET/POST/PATCH /problem-categories
- PUT /problem-categories/:id/specializations

✅ Technicians + binding to specializations
- GET /technicians
- PUT /technicians/:id/specializations

✅ Company settings
- GET /company
- PATCH /company/auto-assign

✅ Tickets (core)
- POST /tickets (creates ticket; returns candidates + instructions; auto-assign optional)
- GET /tickets (list)
- PUT /tickets/:id/assign/:technicianId (manual assign)
- POST /tickets/:id/child (create child ticket, copies location/contact fields)

Ticket fields include:
requesterName, requesterPhone, address, pointName, problemCategoryId, problemText, urgency, status, slaMinutes, assignedTechnicianId, parentId

Auto-assign controlled by company.autoAssignEnabled.

## 5) How to run (dev)
From repo root:
docker compose up -d --build

Logs:
docker logs -n 80 sma_backend

## 6) Working rules
- JWT token is never stored manually; always obtained via /auth/login in terminal.
- Passwords / secrets are in .env or docker-compose env (do not paste real secrets into chat).
- All instructions must respect current architecture (Nest modules + Prisma schema).
- When editing files: specify file path and exact replacement blocks.

## 7) Next tasks (roadmap)
- GET /tickets/:id (include parent + children)
- PATCH /tickets/:id/status (+ status history)
- Analytics: tickets count by day/week/month, filter by point(s)
- Later: acts/PDF, scheduling/calendar, maps, routes, mobile offline

---

## 🔐 Security & Development Principles

1. JWT tokens are always dynamic.
   - Never stored manually.
   - Always obtained via /auth/login.
   - Never hardcoded.

2. Production passwords must NEVER be pasted into chat.

3. All secrets are stored only in:
   - .env
   - docker-compose environment
   - future secret manager (production)

4. Tokens and passwords must never be:
   - committed to repository
   - hardcoded in source code
   - written into documentation

5. All endpoints must respect multi-tenant isolation (companyId).

6. Any new feature must not break:
   - auto-assign logic
   - parent/child tickets
   - role-based access
