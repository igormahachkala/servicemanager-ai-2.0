# 01 Project Overview

## What ServiceManager.AI Is

ServiceManager.AI is a multi-company service management system. Client companies create and accept service work. Provider companies receive work through active service contracts, assign eligible staff, complete operational work, and communicate through comments, history, attachments, push notifications, realtime updates, and MAX integration.

The product has two primary contours:

- Management platform - desktop web UI for clients, providers, platform administration, dispatching, assignment, registry work, analytics, and configuration.
- Mobile application - mobile web UI for technicians and field-oriented provider workflows.

## Business Goals

- Keep client and provider work separated by company, contract, role, location, specialization, and permission.
- Give providers a reliable operational workflow from ticket visibility through assignment, claim, in-progress work, and completion.
- Keep acceptance separate from completion: providers complete work, clients accept completed work.
- Preserve an auditable ticket lifecycle through timeline entries, comments, attachments, and status history.
- Deliver notifications through supported product channels without weakening authorization.
- Support stage and production operations with reproducible builds, migrations, health checks, backups, and rollback-ready releases.

## Major Domains

- Companies and users - tenant identity, roles, account lifecycle, company settings.
- Service contracts - active client-provider relationships, PRIMARY and SECONDARY contract roles, location scope, specialization scope.
- Tickets - intake, board, registry, detail, assignment, claim, request assignment, status workflow, completion, and client acceptance.
- Access and permissions - PBAC, policy checks, contract context, user location bindings, technician specialization.
- Operational records - timeline, status history, comments, attachments, inspections, work shifts, work logs, SLA, analytics.
- Notifications - database notifications, realtime delivery, web push, and MAX transport.
- Public request intake - customer-facing request creation through configured public entry points.
- Mobile technician flow - field-oriented ticket lists, ticket details, comments, attachments, status changes, and completed-ticket access.

For the field-level entity map, read [06 Domain Model](06_DOMAIN_MODEL.md).

## Repository Structure

```text
.
|-- backend/                 # NestJS API, Prisma schema, migrations, backend tests
|-- web/                     # React/Vite management platform and mobile frontend
|-- agent-runner/            # supporting automation runner package
|-- docs/                    # onboarding, architecture, operations, and references
|-- scripts/                 # repository utility scripts
|-- test/                    # shared test infrastructure
|-- docker-compose.yml       # production-oriented container composition
`-- docker-compose.stage.yml # stage container composition
```

Important package and configuration files:

- `backend/package.json` - backend scripts, NestJS, Prisma, Jest, and API dependencies.
- `backend/prisma/schema.prisma` - database schema and core domain enums.
- `web/package.json` - frontend scripts, React, Vite, TypeScript, and browser verification scripts.
- `.gitignore` - ignored local runtime files, archives, logs, and build outputs.

For the module-by-module map, read [09 Repository Guide](09_REPOSITORY_GUIDE.md).
For project-specific engineering rules, read [10 Coding Standards](10_CODING_STANDARDS.md).

## Main Backend Modules

Backend modules live under `backend/src/`:

- `auth`, `users`, `company` - authentication, identity, roles, and company settings.
- `service-contracts`, `permissions`, `policy` - contract context, access scope, and authorization decisions.
- `tickets`, `assignment`, `workflow`, `workforce` - ticket lifecycle, provider assignment, claim, completion, and candidate selection.
- `locations`, `equipment`, `specializations`, `problem-categories` - service domain catalog and scope data.
- `timeline`, `events`, `notifications`, `push`, `realtime`, `max-bot` - audit stream and delivery channels.
- `uploads` - ticket and report attachments.
- `analytics`, `sla`, `inspection`, `map`, `public-request`, `agent-tasks` - operational reporting and supporting product surfaces.
- `prisma` - database client and data access wiring.

## Main Frontend Modules

Frontend modules live under `web/src/`:

- `pages`, `views`, `components`, `ui`, `hooks`, `lib` - management platform screens, shared UI, state, and API helpers.
- `mobile` - mobile technician experience.
- `it-company` - provider-oriented management surfaces.
- `max` - MAX-related UI integration points.
- `assets` - static product assets.

## Technology Stack

- Runtime - Node.js 20 or newer.
- Backend - NestJS, TypeScript, Prisma Client, PostgreSQL, JWT authentication, Jest.
- Frontend - React, TypeScript, Vite, React Router, TanStack Query.
- Realtime and notifications - WebSocket/realtime service, web push, notification service, MAX bot integration.
- Infrastructure - Docker, Docker Compose, Prisma migrations.

## Runtime And Environment Model

Local development is for code iteration and automated checks. It is not runtime acceptance.

Stage is the acceptance environment. It uses `docker-compose.stage.yml`, rebuilt images, Stage data, and explicit migration handling when a candidate includes schema changes.

Production is the live environment. Production tasks require explicit authorization, current backups, rollback readiness, and exact task boundaries.

The same backend authorization model serves desktop, mobile, push, realtime, and MAX surfaces. UI checks can improve ergonomics, but backend authorization is the source of truth.

## High-Level Architecture

The frontend calls the NestJS backend over authenticated HTTP APIs. The backend validates JWT identity, resolves company and role context, applies authorization, executes domain services, persists through Prisma, and emits audit or notification side effects when business events require them.

The provider access model is contract-context based:

```text
Service Contract
-> Role In Contract
-> Contract Locations
-> Contract Specializations
-> Allowed Work Area
-> User Permissions
```

This model is used for provider visibility, assignment eligibility, request assignment behavior, claim behavior, and notification recipient eligibility.

Ticket lifecycle separates provider completion from client acceptance:

```text
NEW
-> ASSIGNED
-> IN_PROGRESS
-> AWAITING_ACCEPTANCE
-> DONE
```

Providers can perform valid operational completion. Valid client-side actors perform acceptance. Timeline, status history, comments, attachments, and notifications must reflect the actor and the resulting business event.
