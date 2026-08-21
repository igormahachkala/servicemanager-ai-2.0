# 03 Access Model

This is the canonical access architecture document for the accepted ServiceManager.AI runtime.

It states the rules. For the cell-level capability table — which role may do what, and
where the answer is conditional — see [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md).
When the two documents disagree, this one defines intent and the matrix records the
current implementation; reconcile against code before changing behavior.

## Source Of Truth

The backend is the only source of truth for access.

Access is not decided by the frontend, mobile UI, MAX buttons, push client, or a raw role check. These clients may adapt the interface, but backend services must authorize every read and mutation.

Every provider-side eligibility decision must resolve through:

```text
Service Contract
-> Role In Contract
-> Contract Locations
-> Contract Specializations
-> Allowed Work Area
-> User Permissions
```

The operation is allowed only when every required layer passes.

## Concepts

Capability answers: can this actor perform this kind of action?

Scope answers: which data can this actor see or affect?

Contract context answers: in which client-provider relationship is the provider acting?

Allowed work area answers: which ticket location and category are covered after contract scope and user scope are intersected?

Relationship state answers: is the actor assigned, requesting assignment, managing own workforce, or acting as client management?

## Contract Context

Contract context is resolved from active `ServiceContract` records.

The context contains:

- client company;
- provider company;
- service contract id;
- contract role: `PRIMARY` or `SECONDARY`;
- contract location scope;
- contract specialization scope.

`PRIMARY` and `SECONDARY` are contract roles only. They are not user roles and they are not persistent provider labels.

Provider authority is evaluated per contract. A provider company can be primary in one contract and secondary in another; the current contract decides behavior.

When a provider acts on a client ticket, the selected client context must resolve to an active service contract. If no active contract exists, access fails closed.

## Visibility

Ticket visibility requires all of:

```text
active contract or same-client ownership
AND allowed location
AND allowed specialization
AND current user access
```

For client-company users, the client company owns the ticket data. Their role and user scope still decide which locations and operations are available.

For provider-company users, a matching active service contract must exist for the ticket's client company. The contract must cover the ticket location and ticket category specialization, and the user's own scope must not remove that work area.

The access resolver must be used for:

- board;
- ticket list;
- ticket detail;
- mobile ticket list;
- mobile ticket detail;
- assignment candidates;
- claim and request assignment;
- comments and attachments;
- status changes;
- notifications;
- analytics.

Direct ticket URLs are not a bypass. Detail access must enforce the same contract, location, specialization, and user access rules as list access.

Completed tickets remain visible when the actor still satisfies the same access model.

## Roles

Roles are action profiles. They do not grant data visibility by themselves.

Current runtime roles include:

- `ADMIN`
- `MASTER`
- `DISPATCHER`
- `TECHNICIAN`
- `CLIENT`
- `NETWORK_DIRECTOR`
- `TERRITORIAL_MANAGER`
- `PLATFORM_ADMIN`

Role usage:

- `ADMIN`, `MASTER`, and `DISPATCHER` are management roles inside their tenant or provider contract context.
- `TECHNICIAN` performs executor work when `isExecutor=true`.
- Client management roles accept or reject completed work.
- `PLATFORM_ADMIN` is a platform role and must not become a shortcut for provider/client operational mutations.

Adding a role does not automatically expand data scope. The role must be combined with permissions and canonical access scope.

## Management Behavior

`ADMIN`, `MASTER`, and `DISPATCHER` use contract specializations for provider-side management visibility.

Management visibility is:

```text
contract
AND location
AND specialization
AND current user permissions
```

Management users may receive additional actions depending on role and policy:

- open ticket;
- assign or reassign;
- request assignment;
- comment;
- attach files;
- change operational status when allowed;
- view analytics;
- manage workforce where applicable.

Management roles must not depend on technician specialization bindings for management visibility. Technician specialization remains executor eligibility.

The backend returns ticket metadata and available actions. UI buttons must be derived from those backend decisions where possible.

## Technician Restrictions

Technician access is executor-oriented.

A technician can see:

- tickets assigned to them when the ticket remains in scope;
- available unassigned tickets when claim/request rules allow visibility;
- tickets created by them when the creator exception applies;
- completed tickets that remain in their effective scope.

Technician eligibility requires:

- active user;
- executor-capable role and `isExecutor=true`;
- allowed location;
- matching specialization;
- valid contract context when the ticket belongs to a linked client.

Technician specialization matching must go through the canonical matcher. Callers must not implement separate name or label checks.

## Candidate List Equals Assignment Authority

If a technician appears in assignment candidates, the same eligibility model must allow assigning that technician.

Candidate eligibility requires:

- active user;
- not deleted;
- executor-capable role;
- `isExecutor=true`;
- same eligible workforce contour for the assignment action;
- location allowed;
- specialization allowed;
- contract context covers the ticket.

Candidate lists must not include:

- foreign provider workforce;
- technicians outside the selected contract;
- technicians without the ticket location;
- technicians without the required specialization;
- inactive or deleted users;
- users who would fail actual assignment authorization.

## Assignment

Assignment is a mutation and must pass permission, policy, ticket access, and contract context checks.

### PRIMARY Provider

A primary provider management actor can assign within the primary contract context when role and permissions allow.

The primary provider may assign to:

- eligible own executors;
- eligible secondary-provider executors when that secondary provider has an active contract covering the same ticket location and specialization.

The primary provider cannot use assignment to bypass a secondary provider's contract scope.

### SECONDARY Provider

A secondary provider can manage only its own workforce.

Secondary management may reassign internally after the ticket is already inside the secondary provider contour. Internal reassignment still requires candidate eligibility and must not expose another provider's workforce.

A secondary provider must not assign another provider's technicians.

### Client Company

Client-side management may operate according to client role, permission, and policy rules. Client assignment to provider workforce must still use the same candidate eligibility model.

## Request Assignment

Request assignment is the secondary provider path for asking the primary/general contractor to assign a ticket.

Rules:

- The requester must have readable access to the ticket.
- The ticket must be new and unassigned.
- The provider must be `SECONDARY` for the ticket's client contract.
- The contract context must cover the ticket location and specialization.
- The requested target defaults to the requester when `targetUserId` is absent.
- A supplied `targetUserId` must be an eligible executor in the same secondary provider company.
- Duplicate detection must include the requested target user.

Request assignment must not expand visibility.

## Claim

Claim is direct self-assignment.

Rules:

- The actor must be an eligible executor.
- The ticket must be new and unassigned.
- The ticket must be visible through the same access model.
- The location and specialization must match.
- The contract context must allow the claim path.

Primary provider direct claim remains allowed when all normal eligibility rules pass.

Secondary provider direct claim for client-created or primary-created work is not allowed. The secondary provider should request assignment instead.

Self-created exception:

- If a contractor or subcontractor employee created the ticket, the creator may take the ticket into work when they are an eligible executor and the ticket is inside valid contract, location, and specialization scope.

## Status, Completion, And Acceptance

Detailed lifecycle rules are documented in [07 Ticket Lifecycle](07_TICKET_LIFECYCLE.md).

### Status Changes

Provider status changes are executor operations. They must pass:

- active provider company check;
- operation access resolver;
- ticket policy;
- workflow transition table;
- evidence requirements where applicable.

### Completion

Completion is a provider-side operational action. Completion does not mean client acceptance.

When a provider requests completion before client acceptance, the backend maps the operation to `AWAITING_ACCEPTANCE` and requires work evidence according to the current rules.

Provider actors must not finalize `AWAITING_ACCEPTANCE -> DONE`.

### Acceptance

Acceptance is a client action.

Only valid client-side actors may accept or reject work, and only for tickets owned by their client company and readable through the normal access model.

Accepted work moves:

```text
AWAITING_ACCEPTANCE -> DONE
```

Rejected work moves:

```text
AWAITING_ACCEPTANCE -> IN_PROGRESS
```

Provider roles `ADMIN`, `MASTER`, `DISPATCHER`, and `TECHNICIAN` must never perform acceptance, and `availableActions.canAccept` must be false for provider-side actors.

## Comments And Attachments

Comments and attachments require readable ticket access and action permission.

They must not create their own visibility logic. If the actor cannot read the ticket through the canonical access resolver, comments and attachments must fail closed.

Attachment storage and metadata remain backend-owned. MAX, mobile, and web use the existing backend attachment pipeline.

## Notification Eligibility

Notifications use the same access model as ticket reads.

Notification delivery flow:

```text
business event
-> candidate recipients
-> contract context
-> readable ticket access
-> dedupe
-> persisted notification / push / MAX transport
```

Recipient selection alone is not enough. A candidate recipient receives a ticket notification only if the recipient can read the ticket through canonical access.

Notification eligibility must enforce:

- contract context;
- location scope;
- specialization scope;
- same-client ownership or linked provider relationship;
- user activity and deletion state;
- deduplication for overlapping recipient paths.

Wrong contract, wrong location, wrong specialization, unrelated provider, revoked relationship context, inactive user, and deleted user must result in no notification.

MAX notification transport is a delivery channel. It must not implement separate ticket visibility rules.

## Fail-Closed Cases

Access must fail closed when:

- no active service contract exists for a provider/client relationship;
- a contract is inactive, ended, or outside its effective dates;
- the contract does not cover the ticket location;
- the contract does not cover the ticket specialization;
- the user's location access removes the ticket location;
- the actor lacks the required permission block;
- the target candidate is outside the provider/company context;
- the target candidate is inactive, deleted, not executor-capable, or specialization-mismatched;
- a secondary provider attempts to reach unrelated client work;
- any provider-side actor attempts client acceptance.

## Related Documents

- [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md) — the full capability table derived from controller guards, permission blocks, and these rules
- [04 Development Workflow](04_DEVELOPMENT_WORKFLOW.md) — how to change access code safely
