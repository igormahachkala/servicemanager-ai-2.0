# 10 Coding Standards

These standards are project-specific. They exist to keep ServiceManager.AI
stable across desktop, mobile, push, realtime, MAX, Stage, and Production.

General language, framework, and formatting rules still come from the current
TypeScript, NestJS, React, Prisma, ESLint, and Prettier setup in the repository.
This document covers the rules that matter most for this domain.

## Non-Negotiable Architecture Rules

### Reuse Canonical Access Resolution

All ticket read and operation access must go through the canonical backend
access path.

Current core files:

- `backend/src/tickets/ticket-access.utils.ts`
- `backend/src/service-contracts/service-contracts.service.ts`
- `backend/src/service-contracts/service-contract-location-scope.ts`
- `backend/src/service-contracts/service-contract-window.ts`
- `backend/src/policy/`

Use existing functions such as `resolveReadableTicketAccess()` and
`resolveTicketOperationAccess()` when a ticket operation needs actor-specific
authorization.

BAD:

```ts
const ticket = await prisma.ticket.findFirst({
  where: {
    id,
    OR: [{ companyId: actor.companyId }, { providerCompanyId: actor.companyId }],
  },
})
```

GOOD:

```ts
const access = await resolveReadableTicketAccess({
  prisma,
  serviceContractsService,
  actor,
  ticketId: id,
  linkedClientCompanyId,
  allowedLinkedClientContractRoles,
})
```

### No Second Contract Context Resolver

Do not create another Contract Context resolver in a controller, frontend helper,
notification adapter, MAX adapter, or one-off service.

Contract Context means:

```text
Service Contract
-> Role In Contract
-> Contract Locations
-> Contract Specializations
-> Current Access
```

If a needed contract-context helper does not exist, extend the canonical backend
service or access utility with focused tests. Do not fork the model.

### No Company-Global PRIMARY/SECONDARY

`PRIMARY` and `SECONDARY` are roles in the current `ServiceContract`. A provider
may be `PRIMARY` in one contract and `SECONDARY` in another.

Never infer provider authority from provider company identity alone.

BAD:

```ts
if (provider.companyId === primaryProviderCompanyId) {
  return true
}
```

GOOD:

```ts
const access = await serviceContractsService.getLinkedClientAccess(
  actor.companyId,
  ticket.companyId,
)

if (!access || access.role !== ServiceContractRole.PRIMARY) {
  throw new ForbiddenException()
}
```

### No Frontend Security Decisions

Frontend checks are user experience only. They may hide or disable controls, but
the backend must enforce every permission and data boundary.

BAD:

```tsx
{role === 'MASTER' && <button onClick={acceptTicket}>Accept</button>}
```

GOOD:

```tsx
{ticket.meta.availableActions.canAccept && (
  <button onClick={acceptTicket}>Accept</button>
)}
```

The good example is still not sufficient by itself. The backend mutation must
also deny unauthorized actors.

### No Duplicated Specialization Or Location Checks

Location and specialization eligibility must be resolved by shared helpers, not
copied into ad hoc `where` clauses.

Use existing service-contract location helpers and ticket specialization helpers:

- `backend/src/service-contracts/service-contract-location-scope.ts`
- `backend/src/tickets/ticket-specialization-match.utils.ts`
- `backend/src/tickets/ticket-access.utils.ts`

BAD:

```ts
const sameLocation = user.locationIds.includes(ticket.locationId)
const sameSpecialization = user.specializations.includes(ticket.categoryName)
```

GOOD:

```ts
const readable = await resolveReadableTicketAccess({
  prisma,
  serviceContractsService,
  actor,
  ticketId,
  linkedClientCompanyId,
})
```

## Backend Standards

### Business Logic Belongs In Services

Controllers should validate transport input, apply coarse guards/decorators, and
call services. Domain decisions belong in services, policies, and shared domain
helpers.

BAD:

```ts
@Patch(':id/status')
updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
  if (dto.status === 'DONE') {
    return this.prisma.ticket.update({ where: { id }, data: { status: 'DONE' } })
  }
}
```

GOOD:

```ts
@Patch(':id/status')
updateStatus(@CurrentUser() actor: UserCtx, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
  return this.ticketsStatusService.updateStatus(actor, id, dto)
}
```

### Controllers Are Transport And Coarse Guards Only

Controllers may:

- bind routes;
- validate DTOs;
- read authenticated actor context;
- apply coarse role or permission guards;
- call one service method;
- map expected HTTP responses.

Controllers must not:

- build custom Prisma authorization filters;
- decide Contract Context;
- write workflow transitions directly;
- emit notification side effects directly;
- silently swallow authorization errors.

### Services Own Transactions And Side Effects

Service methods own the complete business operation:

```text
load current data
-> resolve access
-> validate workflow
-> write transaction
-> record history/timeline
-> emit notifications/realtime side effects
-> return API shape
```

If an operation mutates ticket state, the service must preserve actor identity
for history and downstream notification context.

### Policies Are Capability Helpers

Policy files answer whether a role/user has a capability. They do not replace
Contract Context, location scope, specialization scope, or object-level access.

Use policy checks as one ingredient in service authorization, not as the entire
authorization model.

### Fail Closed

Missing or ambiguous context must deny access or return an empty result, not
fall back to broad tenant access.

Fail closed when:

- no active matching `ServiceContract` exists for provider-linked access;
- `SELECTED_LOCATIONS` has no selected locations;
- inherited secondary location scope has no active primary source;
- specialization matching cannot be resolved for a restricted operation;
- user access scope is explicitly restricted but empty;
- actor identity, company, or role is missing.

BAD:

```ts
if (!contract) return true
```

GOOD:

```ts
if (!contract) {
  throw new ForbiddenException('No active service contract')
}
```

List endpoints may return an empty list instead of throwing when that is the
established API shape. Mutations should deny explicitly.

## Ticket And Workflow Standards

### Completion Is Not Acceptance

Provider roles may perform valid operational completion. Client-side actors
perform acceptance.

Provider actors must never finalize work as accepted.

Expected lifecycle separation:

```text
Provider completion -> AWAITING_ACCEPTANCE
Client acceptance -> DONE
Client rejection -> IN_PROGRESS
```

Use:

- `backend/src/workflow/ticket.workflow.ts`
- `backend/src/tickets/tickets.status.service.ts`
- `backend/src/tickets/tickets.acceptance.service.ts`
- `backend/src/tickets/ticket-acceptance-access.ts`

Do not add a frontend-only restriction for acceptance and call the issue fixed.

### Available Actions Must Match Backend Mutations

`availableActions` is a promise to the UI. If metadata says an action is
available, the backend mutation should succeed for the same actor and object
state. If the backend mutation would deny, metadata must not advertise it.

Update both:

- action discovery, for example `backend/src/tickets/ticket-meta.builder.ts`;
- mutation authorization, for example status, assignment, or acceptance service.

### Request Assignment, Claim, Assignment, Visibility, And Notifications Share One Model

Do not let these systems drift:

- visibility;
- assignment;
- candidate list;
- request assignment;
- claim;
- comments;
- attachments;
- history;
- push notification eligibility.

When changing one path, inspect the others for shared resolver usage and add
negative tests for wrong contract, wrong location, and wrong specialization when
the change touches provider access.

## Notification Standards

Notification behavior may have different transports, but recipient eligibility
must use the same access model as ticket visibility.

- `notifications` owns notification records and event-to-recipient orchestration.
- `push` owns browser push subscriptions and delivery.
- `realtime` owns websocket fanout.
- `max-bot` owns MAX transport and command runtime.

Do not create MAX-only, push-only, or realtime-only authorization. Transport
adapters should receive eligible work from backend services.

## Frontend Standards

### Render Backend Decisions

The frontend should render backend metadata:

- `availableActions`;
- action hints;
- ticket status;
- assignment state;
- linked-client scope;
- notification preferences and read state.

Frontend code may explain unavailable actions, but it must not grant actions.

### Keep API Calls Centralized

Use `web/src/lib/api.ts` for API wrappers and shared DTO-facing types. Add
focused helper files under `web/src/lib/` only when the helper is reused or
separates a real concern.

Do not scatter raw `fetch()` calls through page components when an API helper
already exists.

### Keep Mobile And Desktop Consistent

Mobile and desktop share the same backend. If a ticket list, status action,
comment, attachment, notification, or completed-ticket behavior changes in one
contour, verify the other contour unless the task explicitly limits scope.

Mobile-specific UI may differ, but data visibility and mutation rules must not.

### Browser Storage Must Not Become Authentication Semantics

Storage failures in Safari/WebKit or constrained browsers must not be presented
as invalid credentials. Preserve the successful auth response separately from
browser-storage errors and show a safe user-facing message.

Do not expose raw browser exception text to users.

## Testing Standards

### Positive And Negative Cases

Every authorization or workflow change needs both:

- a positive test for the actor who should succeed;
- a negative test for the actor, contract, location, specialization, status, or
  contour that must fail.

Examples:

- valid client acceptance passes;
- provider `ADMIN`, `MASTER`, `DISPATCHER`, and `TECHNICIAN` acceptance denies;
- secondary provider wrong contract denies;
- wrong location denies;
- wrong specialization denies;
- valid primary provider workflow still passes.

### Focused Tests First, Full Checks Before Commit

Run checks that match the changed surface.

Backend behavior:

```bash
cd backend
npx prisma validate
npm run prisma:generate
npm run build
npm test
```

Frontend behavior:

```bash
cd web
npm run build
npm run lint
```

Repository whitespace:

```bash
git diff --check
```

Use focused tests while iterating, then run the broader checks required by the
task.

### Runtime Proof For Authorization And Workflow Changes

For authorization, visibility, workflow, assignment, claim, notification, or
mobile behavior, local tests are not enough when the task asks for runtime
acceptance.

Runtime evidence should include:

- environment;
- deployed HEAD;
- actor account and role;
- object IDs or ticket numbers;
- operation attempted;
- expected result;
- actual result;
- console and network/API failures when browser verification is involved.

Use Stage unless the task explicitly authorizes Production.

## Git And Task Standards

### One Task Equals One Commit

Keep each task focused. Do not mix unrelated fixes, formatting sweeps, cleanup,
or documentation edits into a behavior commit unless the task requires them.

Before staging:

```bash
git status --short
git diff --check
```

Stage explicit files only:

```bash
git add backend/src/tickets/ticket-access.utils.ts
```

Do not use broad staging when the worktree contains unrelated changes.

### Preserve Existing User Work

If the worktree contains changes you did not make, do not revert them. If they
are unrelated, leave them alone. If they affect your task, inspect them and work
with them.

### Update Canonical Docs When Architecture Changes

When accepted architecture changes, update the numbered docs that own the rule:

- `02_ARCHITECTURE.md` for system boundaries;
- `03_ACCESS_MODEL.md` for access, visibility, assignment, claim, acceptance, and notification eligibility;
- `06_DOMAIN_MODEL.md` for entities and relationships;
- `07_TICKET_LIFECYCLE.md` for lifecycle rules;
- `08_PERMISSIONS_MATRIX.md` for capability matrix changes;
- `09_REPOSITORY_GUIDE.md` for module ownership or structure changes;
- `10_CODING_STANDARDS.md` for engineering rules.

Do not create another root entry point. `README.md` points to
`docs/00_START_HERE.md`, and `00_START_HERE.md` owns onboarding order.

## Review Checklist

Before marking a code task ready:

- canonical resolver reused;
- no second Contract Context resolver;
- no company-global `PRIMARY` or `SECONDARY`;
- no frontend security decision treated as enforcement;
- no duplicated specialization/location checks;
- business logic is in the service layer;
- controllers only handle transport and coarse guards;
- missing context fails closed;
- positive and negative tests exist;
- runtime proof exists for authorization or workflow changes when required;
- canonical docs are updated if accepted architecture changed;
- one task equals one commit.
