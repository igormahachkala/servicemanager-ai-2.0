# 16 Architecture Changelog

This document records the architectural decision history that led to the current
accepted ServiceManager.AI runtime.

It is not a git changelog. It captures product and architecture decisions that a
developer must understand before changing access, tickets, notifications, mobile,
MAX, or release operations.

## 1. Role System V2 And Permission Matrix

Problem:

The platform had roles, permission blocks, scopes, and relationship checks, but the
runtime model was hard to reason about. Some behavior could be confused with
hardcoded role checks.

Decision:

Keep roles as action profiles and use the permission matrix as the capability model.
Do not make roles decide data visibility by themselves.

Reason:

Roles answer what kind of work a user may do. They cannot answer which client,
contract, location, specialization, ticket, or workforce record is in scope.

Result:

The accepted formula became:

```text
Access = Capability + Contract Context + Location Scope + Specialization Scope + User Access
```

The current capability reference is [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md).

## 2. Provider Delegation

Problem:

Provider access originally needed to represent primary providers and delegated
secondary providers. Treating this as broad company access risked letting a provider
see or act outside the intended client relationship.

Decision:

Model provider access through explicit client-provider relationships and fail closed
when relationship context is missing, invalid, revoked, expired, or out of scope.

Reason:

Provider access is not tenant ownership. The ticket still belongs to the client
company, and provider work is valid only through an active relationship.

Result:

Delegated access became relationship-driven. Later Contract Context work consolidated
this into the service contract model and removed company-global assumptions.

## 3. Contract Context

Problem:

The same provider company can be primary for one client and secondary for another.
Company-level labels such as "primary provider" or "secondary provider" were not
precise enough for runtime decisions.

Decision:

Make `ServiceContract` the source of provider relationship context. Resolve the
current contract per operation.

Reason:

Assignment, claim, visibility, request assignment, and notifications all depend on
the contract active at that moment, not on a permanent provider-company identity.

Result:

`PRIMARY` and `SECONDARY` are contract roles only. Provider authority is evaluated
per contract, and no active matching contract means fail closed.

## 4. Contract Specialization

Problem:

Location scope alone could not express which kinds of work a provider contract covers.
Ticket category/specialization access also had to be bounded by the contract.

Decision:

Add contract specialization scope and require ticket visibility to pass contract,
location, and specialization checks.

Reason:

A provider may service one location but only for certain problem categories. Visibility
and assignment must reflect both dimensions.

Result:

Provider-side ticket visibility is:

```text
active Service Contract
AND Contract Location
AND Contract Specialization
AND User Scope
```

## 5. Provider Visibility

Problem:

List, detail, analytics, mobile, and related read paths could diverge if each one
implemented its own provider filters.

Decision:

Use the canonical ticket access resolver for ticket visibility and require direct
ticket detail to enforce the same contract, location, specialization, and user access
rules as board/list views.

Reason:

Direct URLs must not bypass list visibility. A user who cannot see a ticket in the
board because of contract, location, or specialization must not open it by id.

Result:

The accepted read rule is shared across management, mobile, comments, attachments,
timeline, notifications, and analytics where ticket visibility is involved.

## 6. Assignment Authority

Problem:

Candidate lists can become unsafe if they show users who later fail actual assignment,
or if secondary providers can see another provider's workforce.

Decision:

Make candidate list eligibility equal assignment authority.

Reason:

Assignment UI is operational decision support. Showing an unassignable candidate is
both a UX defect and a security smell.

Result:

Candidates must be active, executor-capable, in the correct workforce contour, and
eligible by contract, location, and specialization. Secondary providers manage only
their own workforce.

## 7. Claim And Request Assignment

Problem:

Secondary providers need a way to participate in unassigned work, but direct claim
could bypass the primary/general contractor's assignment authority.

Decision:

Keep direct claim for eligible primary provider executors. Secondary providers use
request assignment for client-created or primary-created work. Preserve the
self-created exception for an eligible creator.

Reason:

This keeps secondary participation operational without letting secondary providers
take over work outside the approved assignment flow.

Result:

Claim requires readable ticket access, executor eligibility, location, specialization,
and contract authority. Request assignment carries the requested target and remains
inside secondary provider scope.

## 8. Completion And Acceptance Split

Problem:

Provider-side status flow could collapse completion into acceptance if a provider
could move `AWAITING_ACCEPTANCE` to `DONE`.

Decision:

Separate provider completion from client acceptance. Provider completion moves work
to `AWAITING_ACCEPTANCE`; only a valid client-side acceptance action can move it to
`DONE`.

Reason:

Completion proves that the provider submitted work. Acceptance proves that the client
accepted it. These are different business events with different actors.

Result:

Provider actors cannot finalize `AWAITING_ACCEPTANCE -> DONE`. Client acceptance and
rejection are implemented in the acceptance service and documented in
[07 Ticket Lifecycle](07_TICKET_LIFECYCLE.md).

## 9. Ticket History And Domain Events

Problem:

Operational changes must remain explainable after the ticket changes. History cannot
lose previous values or actor identity.

Decision:

Record ticket operations through status history, timeline/domain events, and existing
assignment/comment/attachment history paths.

Reason:

The operational timeline is the user-facing audit trail, while domain events drive
downstream side effects such as notifications.

Result:

Ticket lifecycle and assignment changes preserve actor, timestamp, previous value,
new value, and operation context where the current model supports it.

## 10. Notification Resolver

Problem:

Notification recipients could not safely be selected by role interest lists alone.
A candidate recipient might not have access to the ticket.

Decision:

Route notification recipient eligibility through the same readable ticket access
model used by the application.

Reason:

Notifications contain ticket information. Delivery must not become a second visibility
model or leak data outside contract, location, and specialization scope.

Result:

Notification delivery filters candidates by readable ticket access, dedupes recipients,
and then uses configured channels such as database notifications, push, and MAX
transport where available.

## 11. MAX As Transport

Problem:

MAX started as a useful notification and work interface, but placing ticket business
logic inside MAX would create a second system.

Decision:

Keep MAX as an adapter/transport over backend services. MAX must not own ticket
workflow, visibility, assignment, or permission rules.

Reason:

ServiceManager.AI remains the source of truth. MAX callbacks, buttons, and messages
are not authorization proof.

Result:

MAX notification behavior remains transport-level. Work-console-style actions, when
enabled, must call canonical backend services and repeat authorization.

## 12. Browser Storage Reliability

Problem:

Browser storage failures in Safari/WebKit, private browsing, quota exhaustion, or
disabled storage could make a successful backend login look like an authentication
failure.

Decision:

Treat authentication result and session persistence as separate concerns and route
critical session storage through safe browser-storage helpers.

Reason:

The user should not see "invalid credentials" or raw browser exception text when the
backend accepted the login but the browser failed to persist session data.

Result:

Storage failures are classified and surfaced as session-persistence problems, not
credential failures. Login, restore, and logout paths have a safer storage boundary.

## 13. Mobile Completed Tickets

Problem:

Completed tickets could disappear from the mobile contour even when the actor still
had valid access.

Decision:

Treat `DONE` as a final lifecycle state, not an archive boundary that removes the
ticket from authorized mobile views.

Reason:

Management and mobile must show the same lifecycle data to authorized users. A
completed ticket remains operational history.

Result:

Mobile completed-ticket views must use backend-authorized data and preserve status,
tab, and navigation context without dropping valid completed tickets locally.

## 14. Stage Runtime Acceptance

Problem:

Automated tests and local checks did not prove real Stage behavior for contract
context, assignment, completion, acceptance, notifications, and mobile flows.

Decision:

Make Stage runtime acceptance a formal release gate with canonical accounts, semantic
fixtures, positive cases, negative cases, actual API mutation checks, `availableActions`
checks, log scans, and `500` detection.

Reason:

Runtime behavior can fail because of deployed SHA drift, schema drift, environment
configuration, fixture ambiguity, or UI/API mismatch even when local tests pass.

Result:

[11 Runtime Acceptance](11_RUNTIME_ACCEPTANCE.md) defines the evidence format and
PASS/FAIL/BLOCKED criteria. [12 Release Process](12_RELEASE_PROCESS.md) places it in
the release path before Production authorization.

## 15. Release Process And Rollback

Problem:

Production release safety requires more than a successful build. Migration order,
backup readiness, rollback compatibility, and smoke checks must be explicit.

Decision:

Document the full release path from local checks through integration, Stage deploy,
Stage migrations, runtime acceptance, backup, Production deploy, Production
migrations, smoke, monitoring, and rollback.

Reason:

Production is live. Deploying from dirty worktrees, assuming implicit migrations, or
preparing rollback after deployment increases operational risk.

Result:

Production deploy requires authorization, verified backup readiness, explicit
migration handling, clean source, smoke checks, monitoring, and rollback prepared
before deployment.

## Maintenance Rule

When an architecture decision changes current runtime behavior, add a new entry here
with:

- Problem;
- Decision;
- Reason;
- Result.

Do not rewrite history to make old decisions disappear. If an older decision is
superseded, add a later entry that explains the replacement.

## Relationship To The Decision Log

This document records **what changed and when**. [17 Decision Log](17_DECISION_LOG.md)
records **why**, including the alternatives that were considered and rejected.

Use this changelog to answer "when did this behavior change". Use the decision log
before proposing to undo a rule that looks unnecessarily strict — most such rules exist
because the simpler version was tried first and failed.

An entry can appear in both: here as a dated change, there as a durable constraint.
