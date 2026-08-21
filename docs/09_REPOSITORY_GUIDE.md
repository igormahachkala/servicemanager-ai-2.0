# 09 Repository Guide

This guide maps the current ServiceManager.AI repository. Use it to find the
right module before changing code.

The implementation source of truth is the code on the current branch. If this
guide and code disagree, inspect the code first and update the guide in the same
architecture task.

## Top-Level Map

| Path | Purpose | Main entry points | Changes that belong here | Changes that do not belong here |
| --- | --- | --- | --- | --- |
| `backend/` | NestJS API, Prisma schema, migrations, backend tests, runtime integrations. | `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/package.json`, `backend/prisma/schema.prisma`. | Backend services, controllers, policies, access checks, database schema, migrations, backend tests. | Frontend-only rendering, browser state, deployment-only host notes, generated runtime uploads. |
| `web/` | React/Vite management platform, mobile web app, MAX web entry, PWA assets. | `web/src/main.tsx`, `web/src/App.tsx`, `web/src/router.tsx`, `web/src/lib/api.ts`, `web/package.json`. | Screens, components, frontend API calls, mobile UI, route wiring, browser-facing UX. | Backend authorization, database writes, independent security decisions, server-side workflow rules. |
| `agent-runner/` | Supporting Engineering Agent runner package. | `agent-runner/src/index.ts`, `agent-runner/src/executor.ts`, `agent-runner/package.json`. | Runner configuration, task polling, context loading, read-only analysis behavior. | Product API rules, ticket workflow, ServiceManager runtime authorization, frontend screens. |
| `scripts/` | Repository utility scripts. | `scripts/ai_context_export.sh`, `scripts/build_docs_pdf.sh`. | Repository-level documentation/export helpers. | Application business logic, migrations, deployment state. |
| `test/` | Shared test infrastructure outside the backend package. | `test/docker-compose.test.yml`. | Shared test containers and cross-package test support. | Backend unit tests, e2e specs, application code. |
| `docs/` | Canonical onboarding, architecture, workflow, and reference documentation. | `docs/00_START_HERE.md`, `docs/01_PROJECT_OVERVIEW.md`, `docs/02_ARCHITECTURE.md`. | Current developer guidance, accepted architecture, runtime rules, operational references. | Source code, secrets, generated reports, historical guidance as active documentation. |
| `docker-compose.yml` | Production-oriented compose definition. | `docker-compose.yml`. | Production compose changes only when explicitly authorized. | Stage-only changes, local dev hacks, secrets. |
| `docker-compose.stage.yml` | Stage compose definition. | `docker-compose.stage.yml`. | Stage deployment wiring when explicitly authorized. | Production changes, application behavior changes. |

There is no root `package.json`. Backend, frontend, and agent-runner commands are
run from their own package directories.

## Backend Overview

The backend is a NestJS application. `backend/src/app.module.ts` wires the
runtime modules. `backend/src/main.ts` starts the HTTP server. Prisma schema,
migrations, and seeds live under `backend/prisma/`.

The usual NestJS module shape is:

```text
<module>.module.ts
<module>.controller.ts
<module>.service.ts
dto/
*.spec.ts
```

Not every folder has the full shape. Some folders contain shared helpers rather
than a Nest module.

## Backend Modules

### auth

- Purpose: login, JWT validation, current user identity, impersonation, and login rate limiting.
- Main entry files: `backend/src/auth/auth.module.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/jwt.guard.ts`, `backend/src/auth/jwt.strategy.ts`, `backend/src/auth/login-rate-limiter.service.ts`.
- Belongs here: credential verification, JWT payload construction, `/auth/login`, `/auth/me`, impersonation transport, auth-specific rate-limit behavior.
- Do not implement here: ticket access rules, contract role resolution, user administration workflows, frontend session storage behavior.

### users

- Purpose: user lifecycle, role changes, profile updates, and user-related management operations.
- Main entry files: `backend/src/users/users.module.ts`, `backend/src/users/users.controller.ts`, `backend/src/users/users.service.ts`, `backend/src/users/dto/`.
- Belongs here: creating users, updating users, role changes, user profile data, user-facing management records.
- Do not implement here: ticket visibility, contract-context access decisions, assignment candidate filtering, notification delivery.

### company

- Purpose: company and tenant management.
- Main entry files: `backend/src/company/company.module.ts`, `backend/src/company/company.controller.ts`, `backend/src/company/company.service.ts`, `backend/src/company/dto/`.
- Belongs here: company creation, company settings, company administrator creation, tenant-level metadata.
- Do not implement here: provider access to client work, ticket workflow transitions, user-specific permissions.

### service-contracts

- Purpose: client-provider contract records, contract role, active windows, location scope, linked client/provider lists.
- Main entry files: `backend/src/service-contracts/service-contracts.module.ts`, `backend/src/service-contracts/service-contracts.controller.ts`, `backend/src/service-contracts/service-contracts.service.ts`, `backend/src/service-contracts/service-contract-location-scope.ts`, `backend/src/service-contracts/service-contract-window.ts`, `backend/src/service-contracts/dto/`.
- Belongs here: `ServiceContract` CRUD, contract active-window checks, contract location-mode resolution, linked client/provider contract context.
- Do not implement here: ticket mutation workflow, available action metadata, push/MAX transport behavior, frontend route behavior.

### tickets

- Purpose: ticket creation, board/query/detail access, assignment, claim, request assignment, comments, attachments, status changes, acceptance, metadata.
- Main entry files: `backend/src/tickets/tickets.module.ts`, `backend/src/tickets/tickets.controller.ts`, `backend/src/tickets/tickets.service.ts`, `backend/src/tickets/tickets.query.service.ts`, `backend/src/tickets/ticket-access.utils.ts`, `backend/src/tickets/tickets.assignment.service.ts`, `backend/src/tickets/tickets.status.service.ts`, `backend/src/tickets/tickets.acceptance.service.ts`, `backend/src/tickets/ticket-acceptance-access.ts`, `backend/src/tickets/ticket-meta.builder.ts`, `backend/src/tickets/ticket-attachments.service.ts`, `backend/src/tickets/dto/`.
- Belongs here: ticket read and operation access, board/list filters, ticket detail, ticket lifecycle mutations, assignment requests, comments, attachments, metadata and `availableActions`.
- Do not implement here: company CRUD, role-permission catalog editing, raw notification transport adapters, frontend-only display choices.

### permissions

- Purpose: permission catalog, role matrix, user access management summaries.
- Main entry files: `backend/src/permissions/permissions.module.ts`, `backend/src/permissions/permissions.controller.ts`, `backend/src/permissions/permissions.service.ts`, `backend/src/permissions/dto/`.
- Belongs here: permission block catalog, role permission matrix, user permission assignment, access summary APIs.
- Do not implement here: ticket-specific access shortcuts, ServiceContract location/specialization logic, frontend authorization.

### policy

- Purpose: action-level policy helpers used by services.
- Main entry files: `backend/src/policy/tickets.policy.ts`, `backend/src/policy/users.policy.ts`, `backend/src/policy/inspection.policy.ts`, `backend/src/policy/policy.utils.ts`, `backend/src/policy/policy.types.ts`.
- Belongs here: reusable capability decisions and policy utility functions.
- Do not implement here: database writes, controller transport code, side effects, notification delivery.

### notifications

- Purpose: database notifications and notification recipient preparation for application events.
- Main entry files: `backend/src/notifications/notifications.module.ts`, `backend/src/notifications/notifications.controller.ts`, `backend/src/notifications/notifications.service.ts`.
- Belongs here: notification rows, unread/read state, event-to-recipient orchestration, recipient eligibility that reuses canonical ticket access.
- Do not implement here: separate visibility rules, web push subscription CRUD, MAX polling details, ticket status transitions.

### push

- Purpose: browser/web push subscriptions, preferences, VAPID public key endpoint, push delivery integration.
- Main entry files: `backend/src/push/push.module.ts`, `backend/src/push/push.controller.ts`, `backend/src/push/push.service.ts`, `backend/src/push/dto/`.
- Belongs here: push endpoint subscription, unsubscribe, push preferences, delivery to browser push endpoints.
- Do not implement here: notification matrix redesign, MAX delivery, ticket recipient authorization that bypasses `notifications` and `tickets`.

### workflow

- Purpose: pure ticket status transition decisions.
- Main entry files: `backend/src/workflow/ticket.workflow.ts`, `backend/src/workflow/workflow.types.ts`.
- Belongs here: allowed status transition graph and pure transition decision helpers.
- Do not implement here: database writes, role-specific authorization, comment/history persistence, notification side effects.

### workforce

- Purpose: work shifts, work logs, workforce settings, auto-close behavior.
- Main entry files: `backend/src/workforce/workforce.module.ts`, `backend/src/workforce/workforce.controller.ts`, `backend/src/workforce/workforce.service.ts`, `backend/src/workforce/workforce-auto-close.service.ts`, `backend/src/workforce/workforce-time.ts`, `backend/src/workforce/dto/`.
- Belongs here: opening/closing shifts, work-log records, workforce time helpers, workforce configuration.
- Do not implement here: ticket lifecycle authorization, contract role resolution, analytics presentation.

### analytics

- Purpose: operational analytics over accessible service data.
- Main entry files: `backend/src/analytics/analytics.module.ts`, `backend/src/analytics/analytics.controller.ts`, `backend/src/analytics/analytics.service.ts`.
- Belongs here: aggregate metrics, dashboard data, analytics queries that reuse access scope.
- Do not implement here: write-side ticket workflow, permission catalog changes, independent visibility logic.

### timeline

- Purpose: user-facing timeline/event history for tickets and operational activity.
- Main entry files: `backend/src/timeline/timeline.module.ts`, `backend/src/timeline/timeline.controller.ts`, `backend/src/timeline/timeline.service.ts`, `backend/src/timeline/timeline.types.ts`.
- Belongs here: timeline reads and timeline event recording helpers.
- Do not implement here: ticket workflow authorization, notification delivery adapters, file upload storage.

### realtime

- Purpose: realtime invalidation and websocket notification transport.
- Main entry files: `backend/src/realtime/realtime.module.ts`, `backend/src/realtime/realtime.service.ts`.
- Belongs here: websocket fanout and realtime client invalidation.
- Do not implement here: authorization decisions, notification recipient selection, ticket mutation side effects.

### max-bot

- Purpose: MAX integration runtime, webhook/polling endpoints, commands, and MAX transport support.
- Main entry files: `backend/src/max-bot/max-bot.module.ts`, `backend/src/max-bot/max-bot.service.ts`, `backend/src/max-bot/max-bot-runtime.ts`, `backend/src/max-bot/max-bot-polling.service.ts`, `backend/src/max-bot/max-bot-command.service.ts`, `backend/src/max-bot/max-bot.controller.ts`, `backend/src/max-bot/max-bot-webhook.controller.ts`, `backend/src/max-bot/max-bot.types.ts`.
- Belongs here: MAX API transport, MAX command parsing, polling/webhook runtime behavior, MAX-specific diagnostics.
- Do not implement here: a separate MAX authorization model, ticket access rules, notification matrix redesign, TLS bypasses.

### common

- Purpose: shared guards, decorators, permission constants, and small cross-module utilities.
- Main entry files: `backend/src/common/permissions.guard.ts`, `backend/src/common/permissions-context.guard.ts`, `backend/src/common/permissions.decorator.ts`, `backend/src/common/roles.guard.ts`, `backend/src/common/roles.decorator.ts`, `backend/src/common/permissions.constants.ts`, `backend/src/common/permissions-matrix.ts`, `backend/src/common/executor.utils.ts`, `backend/src/common/user-access-scope-mode.utils.ts`.
- Belongs here: reusable guards, decorators, permission constants, small pure utilities with broad reuse.
- Do not implement here: module-specific business workflows, database transactions, UI behavior.

### prisma

- Purpose: Prisma client wiring plus schema, migrations, and seed scripts.
- Main entry files: `backend/src/prisma/prisma.module.ts`, `backend/src/prisma/prisma.service.ts`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/prisma/seed.ts`, `backend/prisma/seed-demo-data.js`, `backend/prisma/seed-users.js`.
- Belongs here: database schema, migrations, Prisma service lifecycle, seed data required by explicit tasks.
- Do not implement here: raw SQL shortcuts for business rules, hand-made Stage/Production schema edits, secrets.

## Other Backend Areas

| Path | Purpose | Main entry files |
| --- | --- | --- |
| `backend/src/assignment/` | Assignment engine and strategy helpers. | `assignment.engine.ts`, `assignment.service.ts`, `assignment.strategies.ts`, `assignment.types.ts`. |
| `backend/src/locations/` | Client location CRUD and status. | `locations.controller.ts`, `locations.service.ts`, `dto/`. |
| `backend/src/equipment/` | Equipment CRUD and repository. | `equipment.controller.ts`, `equipment.service.ts`, `equipment.repository.ts`, `dto/`. |
| `backend/src/specializations/` | Company specialization catalog. | `specializations.controller.ts`, `specializations.service.ts`, `dto/`. |
| `backend/src/problem-categories/` | Problem categories and specialization links. | `problem-categories.controller.ts`, `problem-categories.service.ts`, `dto/`. |
| `backend/src/public-request/` | Public request token and intake flow. | `public-request.controller.ts`, `public-request.service.ts`, `public-request-security.service.ts`, `dto/`. |
| `backend/src/inspection/` | Inspection templates, runs, reports, and ticket creation from inspection items. | `inspection.controller.ts`, `inspection.service.ts`, `inspection.export.service.ts`, `inspection.report.mapper.ts`, `dto/`. |
| `backend/src/sla/` | SLA worker module. | `sla.module.ts`, `sla.worker.service.ts`. |
| `backend/src/agent-tasks/` | Engineering Agent task API and owner guard. | `agent-tasks.controller.ts`, `agent-tasks.service.ts`, `engineering-agent.guard.ts`, `dto/`. |
| `backend/src/map/` | Map data API. | `map.controller.ts`, `map.service.ts`. |
| `backend/src/technicians/` | Technician bindings, specializations, locations, workload. | `technicians.controller.ts`, `technicians.service.ts`, `technicians.workload.service.ts`, `dto/`. |
| `backend/src/events/` | Domain event bus and event type definitions. | `events.bus.ts`, `events.types.ts`. |
| `backend/src/uploads/` | Upload module placeholder/area. | Current tree contains the folder; ticket attachment handling is in `backend/src/tickets/ticket-attachments.service.ts`. |

## Backend Test Locations

- Unit and focused specs usually sit beside source files under `backend/src/**/*.spec.ts`.
- E2E specs live under `backend/test/`.
- Shared test database compose file lives at `test/docker-compose.test.yml`.
- Backend Jest root is configured in `backend/package.json` with `rootDir: "src"`, so source specs run through `npm test` from `backend/`.

## Frontend Overview

The frontend is a React/Vite app. It contains the desktop management platform,
mobile technician flow, MAX web entry, shared components, and frontend API
helpers.

Primary runtime entry points:

- `web/src/main.tsx` - React root bootstrap.
- `web/src/App.tsx` - query client, error boundary, global bridges, app routes.
- `web/src/router.tsx` - route map for desktop, mobile, public request, and MAX routes.
- `web/src/lib/api.ts` - API client, auth/session helpers, scope helpers, and DTO-facing types.
- `web/src/app.css`, `web/src/index.css`, `web/src/mobile/mobile.css` - global and mobile styling.

## Frontend Areas

### views

- Purpose: desktop management pages.
- Main entry files: `web/src/views/BoardPage.tsx`, `web/src/views/TicketPage.tsx`, `web/src/views/CreateTicketPage.tsx`, `web/src/views/DashboardPage.tsx`, `web/src/views/ServiceContractsPage.tsx`, `web/src/views/EmployeesPage.tsx`, `web/src/views/LocationsPage.tsx`, `web/src/views/WorkforcePage.tsx`, `web/src/views/LoginPage.tsx`.
- Belongs here: route-level desktop screen composition, page data loading, page-level user flows.
- Do not implement here: backend authorization, duplicated Contract Context checks, reusable low-level API transport.

### pages

- Purpose: additional routed pages that are not under `views`, currently map/platform pages.
- Main entry files: `web/src/pages/MapPage.tsx`, `web/src/pages/platform/AccessConstructorPage.tsx`, `web/src/pages/platform/PermissionsPage.tsx`.
- Belongs here: standalone page surfaces and platform administration screens.
- Do not implement here: canonical backend permissions, direct database assumptions, duplicated server validation.

### components

- Purpose: reusable desktop and shared UI components.
- Main entry files: `web/src/components/`, `web/src/components/dashboard/`, `web/src/components/permissions/`, `web/src/components/ticket-card-v2/`, `web/src/components/ticket-page/`.
- Belongs here: presentational panels, form sections, ticket page panels, dashboard widgets, permission table rendering.
- Do not implement here: route ownership, API authorization, backend mutation rules.

### ui

- Purpose: app shell and shared layout utilities.
- Main entry files: `web/src/ui/Shell.tsx`, `web/src/ui/useWsInvalidation.ts`.
- Belongs here: top-level authenticated layout, navigation shell, websocket invalidation integration.
- Do not implement here: ticket business actions, service contract mutation rules, permission matrix editing.

### hooks

- Purpose: reusable React hooks for app workflows.
- Main entry files: `web/src/hooks/useCreateTicketFlow.ts`, `web/src/hooks/useLinkedBoardScope.ts`, `web/src/hooks/useMapLocations.ts`, `web/src/hooks/useRealtimeNotifications.ts`.
- Belongs here: shared frontend state composition, route-friendly data flow helpers.
- Do not implement here: hidden backend permissions, permanent business state, custom access resolvers.

### lib

- Purpose: frontend API client and cross-screen helpers.
- Main entry files: `web/src/lib/api.ts`, `web/src/lib/appToast.ts`, `web/src/lib/assignmentExplain.ts`, `web/src/lib/boardNavigationContext.ts`, `web/src/lib/browserNotifications.ts`, `web/src/lib/pushNotifications.ts`, `web/src/lib/realtimeNotificationToast.ts`, `web/src/lib/ticketArchive.ts`, `web/src/lib/ticketAttachmentMedia.ts`, `web/src/lib/ticketOperationalErrors.ts`, `web/src/lib/ticketOperationalModel.ts`.
- Belongs here: API wrappers, local formatting, browser notification helpers, shared client-side utilities.
- Do not implement here: independent security decisions, server-side access filtering, separate lifecycle state machines.

### mobile

- Purpose: mobile web application for technician and field workflows.
- Main entry files: `web/src/mobile/MobileShell.tsx`, `web/src/mobile/MobileHome.tsx`, `web/src/mobile/home/MobileHome.tsx`, `web/src/mobile/MobileMyTickets.tsx`, `web/src/mobile/MobileTicketPage.tsx`, `web/src/mobile/MobileTicketDetails.tsx`, `web/src/mobile/MobileTicketActionsSheet.tsx`, `web/src/mobile/MobileCreateTicket.tsx`, `web/src/mobile/MobileNotificationsPage.tsx`, `web/src/mobile/MobilePushSettingsPage.tsx`, `web/src/mobile/MobileShiftPage.tsx`, `web/src/mobile/offlineQueue.ts`, `web/src/mobile/mobile.css`.
- Belongs here: mobile navigation, mobile ticket list/detail UI, mobile comments/attachments presentation, offline queue behavior, mobile push settings.
- Do not implement here: mobile-only backend authorization, alternate completed-ticket semantics, separate provider access rules.

### it-company

- Purpose: provider/IT-company management surfaces and mission-control style pages.
- Main entry files: `web/src/it-company/index.ts`, `web/src/it-company/routes.ts`, `web/src/it-company/pages/ITCompanyPage.tsx`, `web/src/it-company/pages/MissionControlPage.tsx`, `web/src/it-company/dashboard/ITCompanyDashboard.tsx`.
- Belongs here: provider-oriented management UI and route composition.
- Do not implement here: provider authority rules, ServiceContract role inference, backend assignment eligibility.

### max

- Purpose: frontend MAX entry and bridge.
- Main entry files: `web/src/max/MaxApp.tsx`, `web/src/max/MaxTicketEntry.tsx`, `web/src/max/maxBridge.ts`.
- Belongs here: MAX-hosted web UI entry behavior and bridge integration.
- Do not implement here: MAX notification delivery, MAX authorization, backend ticket access.

### assets and public

- Purpose: static assets and PWA public files.
- Main entry files: `web/src/assets/`, `web/public/manifest.json`, `web/public/sw.js`, `web/public/icons/`.
- Belongs here: logos, generated support QR assets, PWA manifest and service worker assets.
- Do not implement here: source logic, secrets, runtime configuration.

### web scripts

- Purpose: frontend utility scripts.
- Main entry files: `web/scripts/gen-support-qr.mjs`, `web/scripts/gen-pwa-icons.mjs`, `web/scripts/verify-mobile-rc-fixes.mjs`, `web/scripts/test-ticket-actor-identity.mjs`, `web/scripts/split-api-layer.mjs`, `web/scripts/split_api_layer.py`.
- Belongs here: frontend asset generation, frontend verification scripts, API-layer maintenance helpers.
- Do not implement here: production deployment logic, backend authorization behavior, test data mutation unless explicitly allowed.

## Documentation Areas

- Numbered docs are active onboarding and architecture references.
- `docs/LEGACY/` is historical material. Do not use it as active architecture guidance.
- `docs/process/` contains process-specific workflow references.
- `docs/ai-company/`, `docs/management/`, and `docs/operations/` contain focused product/process references.

When an architecture rule changes, update the numbered canonical docs that
describe that rule.
