# 15 Architecture Status

This is not architecture documentation.

This is the official architecture status for the accepted ServiceManager.AI
runtime architecture.

## Status

| Field | Value |
| --- | --- |
| Architecture Status | `STABLE` |
| Runtime Acceptance | `PASS` |
| Last Runtime Verification | `2026-08-21` |
| Current Runtime Candidate | `0725149d1291ebdae36ea47da1e172fa3d3818ac` |

## Authority

This document freezes the current architecture invariants. It does not replace
the detailed canonical documentation:

- [02 Architecture](02_ARCHITECTURE.md)
- [03 Access Model](03_ACCESS_MODEL.md)
- [06 Domain Model](06_DOMAIN_MODEL.md)
- [07 Ticket Lifecycle](07_TICKET_LIFECYCLE.md)
- [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md)
- [10 Coding Standards](10_CODING_STANDARDS.md)

Related decision records:

- [16 Architecture Changelog](16_ARCHITECTURE_CHANGELOG.md)
- [17 Decision Log](17_DECISION_LOG.md)

If implementation, tests, or documentation appear to conflict with this status,
do not reinterpret the invariant locally. Reconcile the conflict in an explicit
architecture task.

## Architecture Invariants

### Source Of Truth

- Service Contract is Source Of Truth for provider access to client work.
- Contract Context is canonical.
- The backend is the source of truth for business authorization.
- Frontend, mobile, push, realtime, and MAX clients render backend decisions.
- Ticket data is owned by the client company in `Ticket.companyId`.
- Direct ticket URLs, mobile routes, MAX entry points, and notification links
  are not authorization bypasses.

### Contract Context

- PRIMARY / SECONDARY are Contract roles.
- PRIMARY / SECONDARY are not user roles.
- PRIMARY / SECONDARY are not provider-company global labels.
- No company-global PRIMARY / SECONDARY.
- A provider may be PRIMARY in one Service Contract and SECONDARY in another.
- Runtime authority is evaluated against the current Service Contract.
- Provider access requires an active, currently effective Service Contract.
- Provider access requires the contract to cover the ticket location.
- Provider access requires the contract to cover the ticket specialization.
- User access scope intersects with Contract Context; it does not expand it.
- Missing Contract Context fails closed.
- Missing or empty restricted location scope fails closed.
- Missing or mismatched restricted specialization scope fails closed.

### Roles And Permissions

- Roles define capabilities, not data visibility by themselves.
- Permission blocks grant capabilities only inside valid data scope.
- `ADMIN`, `MASTER`, and `DISPATCHER` are management roles inside their tenant
  or valid provider Contract Context.
- Management roles use Contract Specialization.
- Management visibility must not depend on `TechnicianSpecialization`.
- Technician additionally uses Technician Specialization.
- `TECHNICIAN` executor behavior requires active user state and
  `isExecutor=true`.
- `PLATFORM_ADMIN` must not become a shortcut for provider/client operational
  mutations.

### Visibility And Work Area

- Ticket visibility is the intersection of capability, Contract Context,
  location scope, specialization scope, and user access.
- Client-company users operate on client-owned data through their role,
  permissions, and user scope.
- Provider-company users operate on linked client data only through valid
  Contract Context.
- Completed tickets remain visible only while the actor still satisfies the same
  access model.
- Comments require readable ticket access.
- Attachments require readable ticket access and action permission.
- Analytics over ticket data must use accessible ticket scope.

### Assignment, Candidate List, Request Assignment, And Claim

- Candidate List = Assignment Authority.
- A user who appears in assignment candidates must also pass actual assignment
  authorization for the same ticket.
- A user who would fail assignment authorization must not appear in assignment
  candidates.
- Assignment uses the same Contract Context, location, specialization, and user
  access model as visibility.
- PRIMARY assignment behavior is determined by the current PRIMARY contract.
- SECONDARY assignment/request behavior is determined by the current SECONDARY
  contract.
- SECONDARY providers must not request or assign work to foreign-provider
  workforce.
- SECONDARY providers must not independently claim unrelated client tickets.
- The accepted self-created ticket exception remains limited to the existing
  rule: an eligible secondary employee may take their own ticket into work when
  the ticket is inside valid Contract Context, location, and specialization
  scope.
- Request Assignment must not expand visibility.

### Lifecycle, Completion, And Acceptance

- Completion != Acceptance.
- Provider performs Completion.
- CLIENT performs Acceptance.
- Provider never performs Acceptance.
- Provider roles `ADMIN`, `MASTER`, `DISPATCHER`, and `TECHNICIAN` must never
  receive `availableActions.canAccept=true` in provider context.
- Provider roles must fail backend Acceptance authorization even if a UI bug
  exposes an Acceptance control.
- Provider Completion moves work toward `AWAITING_ACCEPTANCE`.
- Client Acceptance finalizes work as `DONE`.
- Client rejection moves work back from `AWAITING_ACCEPTANCE` to operational
  work state according to the accepted lifecycle.
- Status transitions must use the canonical workflow rules.
- History and timeline must record the actor and meaningful old/new values for
  operational changes.

### Notifications And Delivery Channels

- Notification Eligibility uses Contract Context.
- Notification recipients must pass readable ticket access before receiving
  ticket notifications.
- Push notification recipient eligibility uses the same access model as ticket
  visibility.
- Web/realtime notification behavior must not introduce separate authorization.
- MAX notification transport must not introduce separate authorization.
- MAX group or transport behavior does not replace backend notification
  eligibility.
- Wrong contract, wrong location, wrong specialization, unrelated provider,
  inactive user, deleted user, and revoked relationship context must produce no
  notification.

### Implementation Safety

- Fail Closed.
- Access must fail closed.
- No frontend security decision is authoritative.
- No duplicated location checks outside canonical helpers.
- No duplicated specialization checks outside canonical helpers.
- Business logic belongs in backend services and shared domain helpers.
- Controllers handle transport, DTO validation, actor extraction, and coarse
  guards only.
- Prisma schema changes must use migrations.
- Schema objects must not be fabricated manually in Stage or Production.
- One task equals one commit unless a task explicitly says otherwise.
- Authorization and workflow changes require positive and negative tests.
- Authorization and workflow changes require runtime proof when the task asks
  for runtime acceptance.
- Canonical docs must be updated when accepted architecture changes.

## Forbidden Changes

These architecture changes are forbidden unless a new explicit architecture task
changes the status, updates canonical documentation, implements tests, and
receives runtime acceptance:

- Replacing Service Contract as the provider access source of truth.
- Adding a second Contract Context resolver.
- Treating provider companies as globally PRIMARY or globally SECONDARY.
- Inferring provider authority from company identity alone.
- Using user role alone as a data-visibility rule.
- Implementing frontend-only authorization for a backend mutation.
- Creating mobile-only, desktop-only, push-only, realtime-only, or MAX-only
  access rules.
- Duplicating location-scope checks instead of using canonical helpers.
- Duplicating specialization matching instead of using canonical helpers.
- Letting management roles depend on `TechnicianSpecialization` for management
  visibility.
- Letting `TECHNICIAN` bypass executor eligibility requirements.
- Allowing provider Acceptance from `ADMIN`, `MASTER`, `DISPATCHER`, or
  `TECHNICIAN`.
- Advertising `availableActions.canAccept=true` for provider-side actors.
- Collapsing Completion and Acceptance into one provider-side action.
- Finalizing provider completion directly as client-accepted `DONE`.
- Letting Candidate List and actual Assignment Authority diverge.
- Exposing foreign-provider workforce in assignment or request-assignment flows.
- Letting SECONDARY providers claim unrelated client tickets.
- Expanding Request Assignment into a visibility mechanism.
- Sending ticket notifications to recipients that fail readable ticket access.
- Weakening notification recipient eligibility for push or MAX delivery.
- Bypassing canonical ticket access with ad hoc Prisma `companyId` filters for
  sensitive reads or mutations.
- Failing open when Contract Context, location scope, specialization scope,
  actor identity, permission, or user state is missing.
- Changing schema in deployed environments without migrations.
- Changing accepted architecture without updating this status document and the
  relevant canonical docs.

## Current Freeze Result

The architecture is frozen as:

```text
Service Contract
-> Role In Contract
-> Contract Locations
-> Contract Specializations
-> Allowed Work Area
-> User Permissions
-> Backend Authorization
```

Status: `STABLE`

Runtime Acceptance: `PASS`
