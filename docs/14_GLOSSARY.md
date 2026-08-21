# 14 Glossary

Project terminology. Definitions here are the ones the code uses. Where a word is
commonly used loosely in conversation, the loose meaning is called out so the two do
not get confused.

Consistent with [02 Architecture](02_ARCHITECTURE.md),
[03 Access Model](03_ACCESS_MODEL.md), [06 Domain Model](06_DOMAIN_MODEL.md),
[07 Ticket Lifecycle](07_TICKET_LIFECYCLE.md), and
[08 Permissions Matrix](08_PERMISSIONS_MATRIX.md).

---

## Relationship And Contract

### Service Contract

A persisted agreement between exactly one client company and one provider company.
The pair is unique — there is at most one contract per `(client, provider)`.

A contract carries its role (`PRIMARY` or `SECONDARY`), its status and validity window,
its covered locations, and its covered specializations. It is the outer boundary of
everything a provider may do for that client.

Only platform administration creates or edits contracts. Tenants can read the
relationships they participate in but cannot widen their own scope.

### Contract Context

The resolved answer to "in which client–provider relationship is this provider acting
right now?"

It contains the client company, the provider company, the contract id, the contract
role, the contract location scope, and the contract specialization scope. It is
produced by the canonical contract context service and is the input to every
provider-side access decision.

Contract context is per operation, not per session. The same user resolves a different
context when acting on a different client's ticket.

### PRIMARY

A **contract role**, not a user role and not a company label. The provider holding the
direct relationship with the client for that contract.

A primary provider may assign work to its own executors and to eligible executors of a
secondary provider whose own contract covers the same location and specialization.

### SECONDARY

A **contract role**. The provider working under delegation for that client.

A secondary provider manages only its own workforce, cannot directly claim work created
by the client or the primary provider, and uses request assignment instead.

> The same company can be `PRIMARY` in one contract and `SECONDARY` in another. Never
> reason about "a secondary company" — reason about a role in a specific contract.

---

## Authorization Vocabulary

### Capability

What kind of action an actor may perform at all — create a ticket, assign, accept.
Answered by role and permission. Capability says nothing about which objects.

### Scope

Which data an actor may see or affect. Answered by contract, location, and
specialization. Scope says nothing about which actions.

Capability and scope are independent, and a permission never widens scope. Holding
`TICKETS_ASSIGN` does not add a single ticket to what you can see.

### Permission

A named permission block from the PBAC matrix, such as `TICKETS_ASSIGN` or
`USERS_MANAGE`, granted to a `(role, companyType)` pair and optionally to an individual
user. Enforced by the permission guard on endpoints that declare it.

### Policy

Domain rules that decide an operation after capability and scope have passed — for
example whether this actor may assign this ticket given its current state and the
relationship involved. Policy lives in the ticket policy layer, not in controllers.

### Readable Access

The canonical answer to "may this actor read this ticket?", produced by the ticket
access resolver. It is the single gate used by ticket detail, lists, comments,
attachments, timeline, and notification eligibility.

When readable access fails, the system returns **404, not 403** — deliberately, so that
error codes cannot be used to discover which tickets exist outside your scope.

### Operational Scope

An **executor-level** restriction: work assigned to the company's executors, or at
locations its users are bound to. It narrows what a technician may act on.

It is not part of contract context and must not gate management roles. Management
visibility comes from the contract; requiring operational bindings of an `ADMIN`,
`MASTER` or `DISPATCHER` is a defect.

### Location Scope

The set of locations available to an actor, after the user's own bindings are
intersected with the contract's locations.

Three states matter. No explicit mode and no bindings means the whole contour. An
explicit mode with a location list means those locations. An explicit mode with an
empty list means nothing — a deliberate closed state, not a misconfiguration.

Contract locations may be inherited from the primary contract when the contract's mode
says so.

### Technician Specialization

What an individual executor is qualified to do. Used for **executor eligibility**:
whether this technician may take or be assigned this work.

Never used for management visibility.

### Contract Specialization

What kinds of work a contract covers. Used for **scope**: whether the ticket's category
falls inside the relationship at all.

Both dimensions can apply to the same request. A technician needs the contract to cover
the specialization *and* to hold it personally.

### Fail Closed

When a required input is missing, ambiguous, or unresolvable, access is denied rather
than granted.

Applies to: no active contract, contract outside its validity window, contract not
covering the location or specialization, user scope removing the location, missing
permission block, ineligible assignment target, any provider attempting client
acceptance.

The opposite — granting on missing data — is the failure mode this system is built to
avoid.

---

## Organisations And Roles

### Tenant

One company's isolated data boundary. Tickets, users, locations and settings belong to
a tenant. Cross-tenant work happens only through a contract.

### Client

The company that owns the work: it owns the ticket records, the locations, and the
acceptance decision.

Also the name of an end-requester role inside a client company. Context distinguishes
the two; where it matters, this documentation says "client company" or "the `CLIENT`
role".

### Provider

The company performing the work under a contract. Sees client data only through
contract context.

### Management Role

`ADMIN`, `MASTER`, `DISPATCHER` — the roles that organise work rather than perform it.

Their visibility is contract, location and specialization plus their own permissions.
They are not subject to technician-style operational bindings.

`NETWORK_DIRECTOR` and `TERRITORIAL_MANAGER` are client-side oversight roles and are
**not** included in this term; they follow their own rules and remain subject to the
operational restriction where it applies.

### Executor

A user who performs work: an executor-capable role with `isExecutor = true`.

`ADMIN`, `MASTER` and `DISPATCHER` can be executors when the flag is set, which is how
a small provider's manager also carries out jobs.

---

## Ticket Operations

### Assignment

Attaching a ticket to a specific executor. A mutation that must pass permission, policy,
readable access, and contract context.

Assignment targets a **user**. There is no company-level assignment field; the executor's
company is derived from the user.

### Assignment Authority

Who may assign whom, given the contract context. The rule that makes candidate lists
trustworthy.

### Candidate List

The set of executors offered for assignment on a ticket.

**Candidate list equals assignment authority.** If a technician appears in the list,
assigning them must succeed; if assigning would fail, they must not appear. A mismatch
in either direction is a defect, not a cosmetic issue.

### Request Assignment

The secondary provider path: asking the primary contractor to assign a ticket, instead
of taking it directly.

Requires readable access, a `NEW` unassigned ticket, `SECONDARY` role in the covering
contract, and contract coverage of location and specialization. The requested target
defaults to the requester; a supplied target must be an eligible executor of the same
provider company.

Requesting never widens visibility.

### Claim

Direct self-assignment by an eligible executor.

Allowed for a primary provider when normal eligibility passes. **Not** allowed for a
secondary provider on client-created or primary-created work — that path is request
assignment.

### Self-created exception

When a contractor or subcontractor employee created the ticket themselves, they may
take it into work even without the usual operational reach, provided they are an
eligible executor and the ticket sits inside valid contract, location and specialization
scope.

Creating a ticket grants visibility and the right to ask. It does not turn a
non-executor into an executor.

### Completion

A **provider-side operational action** meaning "the work is finished from our side".

Completion does not finalize the ticket. The backend maps provider completion to
`AWAITING_ACCEPTANCE` and requires work evidence. Provider actors must never move
`AWAITING_ACCEPTANCE -> DONE`.

### Acceptance

A **client action**: confirming or rejecting completed work.

Only valid client-side actors, only for tickets their company owns, only through normal
readable access. Accepted work becomes `DONE`; rejected work returns to `IN_PROGRESS`.

No provider role can accept — including provider `ADMIN`. The role gate on the
acceptance endpoint is permissive and the real restriction is enforced deeper, so
auditing the decorator alone gives the wrong answer.

---

## Delivery

### Push

Web Push delivery to a subscribed browser or PWA.

Push carries no visibility of its own: recipients are decided by the same access model
as in-app notifications, then filtered by the user's per-event preference toggle. No
subscription means no push, which is not a defect.

### MAX

An external messenger integration.

Currently delivers four event types — ticket created, assigned, claimed, status changed
— to a **single shared group chat**, and that path does not pass through the access
resolver. Group membership is therefore the effective access policy for those events.
Comments, attachments, SLA events, acceptance and assignment requests are not delivered
to MAX at all.

MAX is a transport. It must not implement its own visibility rules, and the current
group behavior is a known limitation rather than a pattern to extend.

---

## Environments And Release

### Stage

The acceptance contour. Separate database, separate containers.

Two properties surprise people: the web image bakes its API base URL at build time, so
frontend changes need a rebuild; and Stage does **not** run migrations on start, unlike
production, so schema changes must be applied explicitly.

### Production

The live environment. Runs `prisma migrate deploy` on every container start. Migrations
move forward only; a code rollback does not roll back schema.

### Integration Candidate

A branch assembling several task branches into one testable set, named
`integration/...`. Because releases are assembled by cherry-picking individual commits,
a commit that mixes concerns cannot be taken partially — which is why one task is one
commit.

### Runtime Acceptance

Verification against a deployed environment, under real roles, including negative cases.

Green automated tests are not runtime acceptance. Acceptance answers "does this work for
a user", and its first step is proving that the deployed artifact is the candidate under
test.

### Rollback

Redeploying previous application code. It is not a database restore.

Because migrations are forward-only, new tables and enum values remain after a rollback.
Where a rollback touches roles or enum values, data is corrected first and code moved
back second.

---

## Related Documents

- [03 Access Model](03_ACCESS_MODEL.md) — the rules these terms describe
- [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md) — capability by role
- [13 Troubleshooting](13_TROUBLESHOOTING.md) — what to do when a rule bites
