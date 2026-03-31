# Closed onboarding model

Public self-service company registration is disabled.

Official onboarding flow:

- public user -> `/login`
- public user -> `/request-access`
- `PLATFORM_ADMIN` -> create company
- `PLATFORM_ADMIN` -> create first company admin

Public intake is separate from tenant auth.
The public support/request-access route does not create companies and does not mint tenant access.

Temporary demo note:

- `ensurePlatformAdmin()` is still used as an env-driven bootstrap for demo deployments
- later it should move to a dedicated seed/init command

---

# ARCHITECTURE — ServiceManager.AI

ServiceManager.AI evolves from an isolated tenant FSM product toward a service network platform.

Current stack:

- Backend: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Auth: JWT
- Architecture: modular service layer + PBAC
- Deployment: Docker + local WSL runtime

---

# 1. Core architectural rules

## 1.1 Multi-tenant isolation

Every tenant-scoped operational object is still anchored to:

- `companyId`

Source of truth:

- `JWT payload -> req.user.companyId`

Rules:

- no operational cross-company reads without explicit platform scope
- no platform behavior should bypass tenant boundaries accidentally

## 1.2 Unified company model

There is one `Company` entity with a type:

- `CLIENT`
- `PROVIDER`

This replaces the idea of separate company entities for clients and contractors.

The goal is:

- keep one company model
- distinguish commercial/operational role by `type`
- prepare the service network layer without breaking the existing FSM core

## 1.3 Service relationship foundation

Provider visibility must not come from role alone.

The foundation entity is `ServiceContract`:

- `clientCompanyId`
- `providerCompanyId`
- `status`
- `role` = `PRIMARY | SECONDARY`
- `startsAt`
- `endsAt`
- `notes`

Business invariants:

- client and provider must be different companies
- client side must be a `CLIENT`
- provider side must be a `PROVIDER`

In this phase the relationship is platform-managed only.
Provider routing is not implemented yet.

Phase B visibility rules:

- `PRIMARY` provider may read linked client operational slices through an `ACTIVE` contract
- `SECONDARY` provider stays restricted and does not receive full linked client visibility
- provider access is always resolved through relationship state, never through role alone

This is intentional: we are building the right network foundation first, without destabilizing the current ticket engine.

## 1.4 Public intake compatibility

Public quick request, QR links and company public tokens still belong to the client company.

That means:

- `/public/request/context/:token` stays company-bound
- public location and equipment selection stays company-bound
- created ticket still lands in the existing operational core for that client company

Future provider assignment may later use the relationship layer, but public intake must not depend on that yet.

## 1.5 API-first and service-layer discipline

Controllers:

- transport only
- DTO parsing only
- guards and role checks only

Business logic:

- service layer only

Database access:

- Prisma from service layer only

---

# 2. Runtime environments

## 2.1 Local WSL runtime

Primary env file:

- `backend/.env`

Database host:

- `localhost:5432`

## 2.2 Docker runtime

Primary env file:

- `backend/.env.docker`

Database host:

- `postgres:5432`

## 2.3 Important boundary

The same backend code must work in both modes.
Only environment configuration changes between WSL-local and Docker runtime.

---

# 3. Module structure

Main business modules include:

- `AuthModule`
- `UsersModule`
- `CompanyModule`
- `ServiceContractsModule`
- `TicketsModule`
- `LocationsModule`
- `EquipmentModule`
- `PublicRequestModule`
- `AnalyticsModule`

Canonical backend flow:

`Controller -> Guard -> Policy -> Service -> Prisma`
---

## Platform observer scope

PLATFORM_ADMIN has an explicit observer mode for cross-company operational reads.

Properties:

- observer mode is read-only in intent
- observer scope is explicit via companyId, never implicit impersonation
- it does not weaken normal tenant isolation for non-platform actors
- it coexists with provider visibility rules and does not replace ServiceContract-based access

This gives the platform actor a control-center view across tenants while keeping ordinary company actors tenant-bound unless a relationship model explicitly opens a safe path.