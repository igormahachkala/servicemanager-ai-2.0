# 02 Architecture

This document describes the accepted runtime architecture of ServiceManager.AI.

## Core Principles

ServiceManager.AI is an operational service-management system for client companies and provider companies. The backend is the source of truth for business decisions and authorization.

The platform follows these rules:

- `Company` is the tenant boundary.
- Ticket data is owned by the client company in `Ticket.companyId`.
- Provider access is relationship-driven through active service contracts.
- Roles control actions, not data visibility by themselves.
- Ticket visibility is constrained by contract, location, specialization, and user access.
- Completion and acceptance are separate lifecycle actions.
- Notifications use the same eligibility model as ticket visibility.
- Frontend, mobile, MAX, and push are clients of backend decisions. They are not security boundaries.

The effective access formula is:

```text
Access = Capability + Contract Context + Location Scope + Specialization Scope + User Access
```

## Domain Model

### Company

`Company` is the tenant boundary. A company is either:

- `CLIENT` - owns locations, problem categories, equipment, and tickets.
- `PROVIDER` - performs work under service contracts.

Company identity is never replaced by a selected client context. A provider user remains a provider-company actor even when operating inside a client contract context.

### User

`User` belongs to exactly one company and has one system role.

Important user attributes:

- `role` - action profile such as `ADMIN`, `MASTER`, `DISPATCHER`, `TECHNICIAN`, `CLIENT`, `NETWORK_DIRECTOR`, `TERRITORIAL_MANAGER`, or `PLATFORM_ADMIN`.
- `isActive` and `deletedAt` - runtime availability.
- `isExecutor` - whether a user may perform executor work when the role supports it.
- `UserLocationBinding` - explicit location access.
- `TechnicianSpecialization` - user specialization bindings for executor eligibility.

### Location

`Location` belongs to a client company. Ticket visibility and assignment eligibility require that the relevant contract and user scope allow the ticket location.

### Specialization And Problem Category

`Specialization` belongs to a company. `ProblemCategory` belongs to a client company and can be linked to one or more specializations through `ProblemCategorySpecialization`.

Ticket specialization requirements are derived from the ticket problem category. The canonical matcher compares category links with effective user and contract specialization scopes. Callers must not implement their own ad hoc specialization checks.

### Service Contract

`ServiceContract` connects one client company to one provider company. It is the source of provider relationship context.

Important fields:

- `clientCompanyId`
- `providerCompanyId`
- `status`
- `role` - `PRIMARY` or `SECONDARY`
- `locationMode`
- `ServiceContractLocation`
- `ServiceContractSpecialization`

Only active, currently effective contracts participate in runtime access.

### Ticket

`Ticket` belongs to the client company in `companyId`.

Important fields:

- `locationId`
- `problemCategoryId`
- `status`
- `assignedTechnicianId`
- `createdByUserId`
- SLA timestamps
- attachments and status history

Ticket read and write operations must resolve access against the owning client company and the active contract context when the actor is a provider.

### Timeline, History, And Events

Ticket operational changes are recorded through status history, timeline/domain events, and notification scheduling. History must preserve actor identity and old/new values for meaningful operational changes. The timeline is the user-facing operational history; domain events are the source for downstream side effects such as notifications.

## Service Contract Context

A service contract defines a provider's relationship to one client company.

`PRIMARY` and `SECONDARY` are contract roles. They are not user roles and they are not provider-company global flags.

A provider can be `PRIMARY` for one client contract and `SECONDARY` for another. Runtime authority is decided per contract.

### PRIMARY

A `PRIMARY` provider is the general contractor for the contract context.

Within the contract's location and specialization scope, a primary provider can manage work according to the actor's role and permissions. Primary management actors can assign work to eligible own executors and eligible secondary-provider executors when the secondary contract also covers the ticket.

### SECONDARY

A `SECONDARY` provider is a subcontractor for the contract context.

Within the contract's location and specialization scope, a secondary provider can see relevant delegated work and request assignment. Secondary management can manage only its own workforce and only inside the secondary provider contour.

If a provider operation needs a client relationship and no active matching contract exists, the operation fails closed.

Contract context never grants a capability by itself. It describes the relationship and data boundary in which an already-capable actor may operate.

## Backend Boundaries

The backend is a NestJS application with Prisma persistence.

Architectural boundaries:

- Guards authenticate the actor and check coarse permission requirements.
- Policy and service-level access checks decide whether a specific operation is allowed on specific data.
- Controllers receive HTTP input, validate DTOs, and call services.
- Business logic belongs in services and shared domain helpers, not controllers.
- Database access goes through Prisma unless a task explicitly justifies another path.
- Errors should use NestJS exceptions instead of raw unclassified errors.
- Secrets and environment values are loaded from runtime configuration, never committed.

Key modules:

- `auth` - login, JWT, current user identity.
- `permissions` - role permission matrix and user access summaries.
- `policy` - action-level policy checks for tickets, users, and inspections.
- `company` - tenant/company management.
- `users` - user lifecycle, role changes, location and specialization bindings.
- `locations` - client-owned operational locations.
- `specializations` - specialization catalog.
- `problem-categories` - client categories and category-specialization links.
- `service-contracts` - contracts, location scope, specialization scope, and contract context.
- `tickets` - ticket read paths, creation, editing, assignment, claim, request assignment, status, acceptance, attachments, and metadata.
- `timeline` - ticket-facing event history.
- `notifications` - database notifications, push scheduling, and MAX notification integration.
- `push` - web push subscriptions and preferences.
- `workforce` - shifts and work logs.
- `analytics` - operational analytics over accessible ticket scope.
- `realtime` - websocket invalidation/notification transport.
- `max-bot` - MAX notification transport and command runtime integration.

## Frontend Boundaries

The frontend is a React/Vite application.

Key areas:

- Desktop shell and route map in `web/src/App.tsx` and routing files.
- API client and shared helpers in `web/src/lib/`.
- Management board and registry views in `web/src/views/` and `web/src/components/`.
- Service contracts and access management surfaces in management/platform pages.
- Mobile shell and mobile routes in `web/src/mobile/`.
- Push and realtime client code in shared frontend hooks and libraries.
- Browser storage safety in `web/src/lib/browserStorage.ts`.

The frontend renders backend-provided actions and metadata. It may hide buttons for usability, but backend services remain authoritative for every mutation.

## Ticket Lifecycle

Detailed lifecycle rules are documented in [07 Ticket Lifecycle](07_TICKET_LIFECYCLE.md).

The accepted lifecycle states are:

```text
NEW
ASSIGNED
IN_PROGRESS
AWAITING_ACCEPTANCE
DONE
CANCELED
```

Workflow transitions are controlled by `decideTicketTransition()`.

Provider completion and client acceptance are separate:

- Provider completion moves work to `AWAITING_ACCEPTANCE`.
- Client rejection moves work back to `IN_PROGRESS`.
- Client acceptance moves work to `DONE`.
- Provider actors must not finalize `AWAITING_ACCEPTANCE -> DONE`.

Status changes are implemented in ticket status services. Acceptance is implemented in the acceptance service and requires a valid client-side actor.

## Main Runtime Services

| Area | Main backend files |
| --- | --- |
| Contract context | `service-contracts/contract-context.service.ts` |
| Contract location scope | `service-contracts/service-contract-location-scope.ts` |
| Contract active window | `service-contracts/service-contract-window.ts` |
| Ticket read access | `tickets/ticket-access.utils.ts` |
| Ticket query/list | `tickets/tickets.query.service.ts` |
| Ticket metadata/actions | `tickets/ticket-meta.builder.ts` |
| Assignment and claim | `tickets/tickets.assignment.service.ts` |
| Status workflow | `tickets/tickets.status.service.ts`, `workflow/ticket.workflow.ts` |
| Client acceptance | `tickets/tickets.acceptance.service.ts`, `tickets/ticket-acceptance-access.ts` |
| Attachments | `tickets/ticket-attachments.service.ts` |
| Notifications | `notifications/notifications.service.ts` |
| Workforce | `workforce/workforce.service.ts` |

## Standard Request Flow

Read flow:

```text
JWT actor
-> permission guard
-> ticket access resolver
-> contract context when linked provider access is involved
-> location and specialization scope
-> Prisma query
-> response metadata and available actions
```

Mutation flow:

```text
JWT actor
-> permission guard
-> canonical service method
-> operation access resolver
-> policy check
-> contract context and scope check when provider-linked
-> Prisma transaction
-> timeline/status history/domain event
-> notification scheduling
```

Notification flow:

```text
business event
-> candidate recipients
-> contract context
-> readable ticket access resolver
-> dedupe
-> Notification rows / push / MAX notification transport
```

## Extension Rules

New product work must follow the current architecture:

- Add or reuse a canonical backend service method for business behavior.
- Reuse contract context instead of adding provider-specific branches.
- Reuse ticket access utilities instead of writing direct company filters.
- Reuse policy classes for capability decisions.
- Add frontend controls only as a reflection of backend permissions and available actions.
- Emit timeline/history/notification events from backend mutations.
- Keep MAX, mobile, push, and frontend as adapters over canonical backend behavior.
