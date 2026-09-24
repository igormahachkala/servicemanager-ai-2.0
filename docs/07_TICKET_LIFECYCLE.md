# 07 Ticket Lifecycle

This document describes the accepted ticket lifecycle architecture for ServiceManager.AI.

The backend is the source of truth for every lifecycle decision. Frontend, mobile, MAX, push, and realtime clients may render available actions, but they do not decide whether a transition is allowed.

## Source Of Truth

Lifecycle behavior is implemented through these backend components:

| Area | Source |
| --- | --- |
| Transition table | `backend/src/workflow/ticket.workflow.ts` |
| Provider status changes and completion | `backend/src/tickets/tickets.status.service.ts` |
| Client acceptance and rejection | `backend/src/tickets/tickets.acceptance.service.ts` |
| Acceptance access | `backend/src/tickets/ticket-acceptance-access.ts` |
| Action metadata | `backend/src/tickets/ticket-meta.builder.ts` |
| Assignment, claim, request assignment | `backend/src/tickets/tickets.assignment.service.ts` |
| Timeline/domain events | `backend/src/timeline/timeline.service.ts` |
| Notifications | `backend/src/notifications/notifications.service.ts` |

Every mutation must pass authentication, permission guard, canonical access resolver, policy, workflow, and transaction-level validation.

## Statuses

The current ticket statuses are:

| Status | Meaning |
| --- | --- |
| `NEW` | Ticket is created and not yet assigned to an executor. |
| `ASSIGNED` | Ticket has an assigned executor but active work has not necessarily started. |
| `IN_PROGRESS` | Executor work is active. |
| `AWAITING_ACCEPTANCE` | Provider completed work and submitted it for client acceptance. |
| `DONE` | Client accepted the completed work. This is the final successful state. |
| `CANCELED` | Ticket was canceled. This is a terminal state. |

`DONE` and `CANCELED` are terminal. They do not transition further through the standard workflow.

## Transition Table

The accepted transition table is:

| From | Allowed next statuses |
| --- | --- |
| `NEW` | `ASSIGNED`, `IN_PROGRESS`, `CANCELED` |
| `ASSIGNED` | `IN_PROGRESS`, `AWAITING_ACCEPTANCE`, `DONE`, `CANCELED` |
| `IN_PROGRESS` | `AWAITING_ACCEPTANCE`, `DONE`, `CANCELED` |
| `AWAITING_ACCEPTANCE` | `IN_PROGRESS` |
| `DONE` | none |
| `CANCELED` | none |

The transition table is necessary but not sufficient. A transition is applied only after the actor, ticket, contract context, location scope, specialization scope, permission, policy, and evidence checks pass.

Provider-side completion is intentionally normalized before the workflow decision: when a provider requests `DONE` from an active work state, the backend treats the operation as completion and moves the ticket to `AWAITING_ACCEPTANCE`. Provider-side actors cannot move `AWAITING_ACCEPTANCE` to `DONE`.

## Lifecycle Phases

### Creation

Creation creates a client-owned `Ticket` in `NEW`.

Creation must validate:

- authenticated actor;
- target client context;
- allowed location;
- allowed problem category and specialization;
- contract context when a provider creates inside a linked client;
- attachment ownership when draft attachments are bound.

Creation records:

- `TicketStatusHistory` from `null` to `NEW`;
- timeline/domain event `ticket.created`;
- optional `ticket.comment_added` when the create flow includes a comment;
- optional assignment or claim events when the create flow immediately assigns or self-claims.

Creation notifications are scheduled through `NotificationsService.onTicketCreated()`. Recipient eligibility must still pass the canonical access model before delivery.

### Assignment

Assignment moves a ticket into an executor contour and normally sets `NEW -> ASSIGNED`.

Assignment must validate:

- actor has assignment capability;
- actor can read and operate on the ticket;
- selected contract context covers the ticket;
- target executor is active, not deleted, and `isExecutor=true`;
- target executor has the required location and specialization;
- candidate list eligibility equals actual assignment authority.

Primary provider management may assign eligible own executors and eligible secondary-provider executors when the secondary contract covers the same ticket context.

Secondary provider management may manage only its own workforce after the ticket is already inside the secondary provider contour. Secondary users must not assign another provider's workforce.

Assignment records:

- status history when status changes;
- assignment history with previous executor, new executor, operation type, mode, actor, and operation company;
- timeline/domain events such as `ticket.assigned` or `ticket.assignment_changed`.

Assignment notifications include assignee notifications, client/provider management notifications, push where configured, and MAX where configured. Delivery still depends on recipient access.

### Claim

Claim is direct self-assignment by an eligible executor.

Claim must validate:

- ticket is `NEW`;
- ticket is unassigned;
- actor is active and `isExecutor=true`;
- actor has claim capability;
- actor can read the ticket through contract, location, and specialization scope;
- contract role permits direct claim.

Primary provider direct claim remains allowed when the normal eligibility rules pass.

Secondary provider direct claim for client-created or primary-created work is denied. The secondary path is request assignment.

Self-created exception: when a contractor or subcontractor employee creates their own ticket, the creator may immediately take it into work if they are an eligible executor and the ticket remains inside valid contract, location, and specialization scope.

Claim records:

- status history `NEW -> ASSIGNED`;
- assignment history with `self_claim`;
- timeline/domain event `ticket.claimed`.

Claim notifications are sent to relevant dispatchers/management recipients after access filtering.

### Request Assignment

Request assignment is the secondary provider path for asking the primary/general contractor to assign a ticket.

Request assignment must validate:

- requester can read the ticket;
- ticket is `NEW` and unassigned;
- provider is `SECONDARY` in the active contract context;
- contract location and specialization cover the ticket;
- optional `targetUserId` is in the same secondary provider company;
- target user is active, not deleted, `isExecutor=true`, and eligible for the ticket;
- duplicate checks include the requested target user.

Request assignment records:

- timeline/domain event `ticket.assignment_requested`;
- payload identifying requester and requested target where available.

Request assignment notifications go to eligible primary/provider management recipients after canonical ticket-access filtering.

### Start Work

Start work moves an assigned or claimable ticket to `IN_PROGRESS` when allowed by workflow and policy.

Start work must validate:

- actor is a provider-side executor or allowed provider operational actor;
- provider company is active;
- actor has status-change capability;
- actor can operate on the ticket through canonical access;
- ticket policy allows the actor to change status;
- workflow allows the transition.

Start work records:

- `TicketStatusHistory`;
- timeline/domain event `ticket.status_changed`;
- optional status comment as `ticket.comment_added`;
- status notifications for eligible client/provider recipients and the assigned executor when applicable.

### Completion

Completion is a provider-side operational action. Completion is not client acceptance.

Provider completion means:

```text
provider work finished
-> backend validates evidence
-> ticket moves to AWAITING_ACCEPTANCE
-> client must accept or reject
```

When a provider actor requests `DONE` from `NEW`, `ASSIGNED`, or `IN_PROGRESS`, the backend maps the requested final state to `AWAITING_ACCEPTANCE`. This keeps provider completion and client acceptance separate.

Completion must validate:

- provider company is active;
- actor has status-change capability;
- actor can operate on the ticket through contract, location, specialization, and user scope;
- ticket policy allows the status operation;
- workflow allows the normalized transition;
- at least one work-report photo or video exists;
- at least one comment exists, either as a domain comment event or a legacy status-history comment.

Completion records:

- `TicketStatusHistory` from the previous status to `AWAITING_ACCEPTANCE`;
- timeline/domain event `ticket.status_changed`;
- timeline/domain event `ticket.ready_for_acceptance`;
- optional `ticket.comment_added` when the status-change request includes a comment.

Completion notifications include:

- MAX ticket status update through the existing MAX notification transport;
- client/provider status notifications for eligible recipients;
- awaiting-acceptance notification for eligible client-side recipients;
- assigned-executor notification when the actor is not the assigned executor.

### Acceptance

Acceptance is a client-side action. It is the only path that finalizes completed work as accepted.

Acceptance can happen only from:

```text
AWAITING_ACCEPTANCE
```

Client acceptance decision:

| Decision | Status change |
| --- | --- |
| `ACCEPT` | `AWAITING_ACCEPTANCE -> DONE` |
| `REJECT` | `AWAITING_ACCEPTANCE -> IN_PROGRESS` |

Acceptance must validate:

- actor is active;
- actor belongs to a `CLIENT` company;
- actor role is one of the client management roles allowed by the acceptance access helper;
- actor can read the ticket through the normal access model;
- ticket belongs to the actor's client company;
- ticket is currently `AWAITING_ACCEPTANCE`;
- rejection includes a comment.

The current client acceptance roles are:

- `ADMIN`;
- `NETWORK_DIRECTOR`;
- `TERRITORIAL_MANAGER`.

Provider roles must never accept or reject work. This includes provider `ADMIN`, `MASTER`, `DISPATCHER`, and `TECHNICIAN`.

Acceptance records:

- `TicketStatusHistory`;
- timeline/domain event `ticket.status_changed`;
- timeline/domain event `ticket.accepted` or `ticket.rejected`;
- optional `ticket.comment_added` with source `acceptance`;
- attachment purpose updates for acceptance or rejection evidence when attachment ids are supplied.

Acceptance notifications:

- `ACCEPT` schedules a status-changed notification from `AWAITING_ACCEPTANCE` to `DONE` and an assigned-executor accepted notification when a technician is assigned;
- `REJECT` schedules a status-changed notification from `AWAITING_ACCEPTANCE` to `IN_PROGRESS` and an assigned-executor rejected notification when a technician is assigned.

## Who Can Move Statuses

| Operation | Actor contour | Required backend checks |
| --- | --- | --- |
| Create ticket | Client or provider in valid target context | create permission, target context, location, specialization, DTO validation |
| Assign or reassign | Management actor in client/primary/secondary context | assignment permission, readable ticket, candidate eligibility, contract context, location, specialization |
| Claim | Eligible executor | claim permission, readable ticket, executor flag, location, specialization, contract claim rule |
| Request assignment | Secondary provider actor | claim/request permission, readable ticket, secondary contract context, target executor eligibility |
| Start work | Provider operational actor | status-change permission, provider company, operation access, policy, workflow |
| Complete work | Provider operational actor | status-change permission, operation access, policy, workflow, work-report media, comment |
| Accept work | Client management actor | client company, client role, readable ticket, `AWAITING_ACCEPTANCE` status |
| Reject work | Client management actor | same as acceptance plus required rejection comment |
| Cancel | Actor with allowed status operation | status-change permission, operation access, policy, workflow |

Roles alone do not grant data visibility. Every operation must still pass:

```text
contract or same-client ownership
AND location scope
AND specialization scope
AND user access
AND operation permission/policy
```

## Available Actions

Ticket cards expose action metadata through `ticket-meta.builder.ts`.

The metadata is a UI convenience, not an authorization shortcut. Backend mutation services repeat authorization when the action is submitted.

Important action rules:

- `canClaim` reflects executor and contract claim eligibility;
- `canStart` reflects workflow and status-change eligibility;
- `canComplete` reflects workflow and status-change eligibility, with evidence requirements enforced by the status service;
- `canAccept` and `canReject` are true only for valid client-side acceptance actors while the ticket is `AWAITING_ACCEPTANCE`;
- provider-side actors must receive `canAccept=false`.

## Events

The timeline service maps operational lifecycle events to domain event types.

| Lifecycle change | Timeline event | Domain event type |
| --- | --- | --- |
| Ticket created | `TICKET_CREATED` | `ticket.created` |
| Ticket assigned | `TICKET_ASSIGNED` | `ticket.assigned` |
| Ticket claimed | `TICKET_CLAIMED` | `ticket.claimed` |
| Assignment changed | `TICKET_ASSIGNMENT_CHANGED` | `ticket.assignment_changed` |
| Assignment requested | `TICKET_ASSIGNMENT_REQUESTED` | `ticket.assignment_requested` |
| Ticket fields edited | `TICKET_FIELDS_UPDATED` | `ticket.updated` |
| Status changed | `STATUS_CHANGED` | `ticket.status_changed` |
| Comment added | `COMMENT_ADDED` | `ticket.comment_added` |
| Attachment uploaded | `TICKET_ATTACHMENT_UPLOADED` | `ticket.attachment_uploaded` |
| SLA warning | `SLA_WARNING` | `ticket.sla_warning` |
| SLA breach | `SLA_BREACH` | `ticket.sla_breached` |
| Ready for acceptance | `TICKET_READY_FOR_ACCEPTANCE` | `ticket.ready_for_acceptance` |
| Accepted | `TICKET_ACCEPTED` | `ticket.accepted` |
| Rejected | `TICKET_REJECTED` | `ticket.rejected` |

Events must include the real ServiceManager actor where available. Assignment and status history must preserve previous and new values so history can explain what changed.

## Notifications

Notifications are side effects of domain operations. Recipient delivery is not a separate visibility model.

Notification flow:

```text
business event
-> candidate recipients
-> canonical access resolver
-> contract context
-> location and specialization scope
-> dedupe
-> persisted notification / push / MAX transport
```

Lifecycle notification sources include:

| Source operation | Notification behavior |
| --- | --- |
| Create | Notifies eligible operational recipients for the new ticket. |
| Assign/reassign | Notifies assignee and eligible management/client recipients. |
| Claim | Notifies eligible dispatchers/management recipients. |
| Request assignment | Notifies eligible primary/provider management recipients. |
| Status changed | Notifies eligible status recipients and MAX status transport where configured. |
| Ready for acceptance | Notifies eligible client-side acceptance recipients. |
| Accepted/rejected | Notifies assigned executor when present and eligible. |
| Comment | Notifies eligible comment recipients after readable-ticket filtering. |
| Attachment | Notifies eligible attachment recipients after readable-ticket filtering. |
| SLA warning/breach | Notifies eligible SLA recipients after access filtering. |

Deduplication must prevent duplicate logical notifications when a user appears through multiple candidate paths.

MAX is a delivery transport. It must not implement its own lifecycle authorization or visibility rules.

## Forbidden Cases

The following cases must fail closed:

- provider actor attempts `AWAITING_ACCEPTANCE -> DONE`;
- provider actor calls the client acceptance path;
- client actor uses provider status-change operations;
- acceptance is requested for a ticket that is not `AWAITING_ACCEPTANCE`;
- rejection is submitted without a comment;
- completion is attempted without required work-report media;
- completion is attempted without a comment;
- assignment target lacks location or specialization eligibility;
- candidate appears in the candidate list but would fail actual assignment authorization;
- secondary provider tries to directly claim client-created or primary-created work;
- secondary provider tries to assign or see another provider's workforce;
- direct ticket URL bypasses list visibility;
- completed ticket is hidden from a still-authorized actor;
- notification candidate receives ticket data without readable-ticket access;
- frontend, mobile, MAX, push, or realtime treats a visible button or callback payload as authorization proof.

## Completed Tickets

`DONE` is a final lifecycle state, not an archive boundary.

Completed tickets remain visible when the actor still satisfies the same access model:

```text
contract or same-client ownership
AND location scope
AND specialization scope
AND user access
```

Mobile and desktop may expose completed tickets through different tabs or filters, but both contours must use backend-authorized ticket data and must not drop completed tickets locally when the selected view is meant to show them.

## Acceptance Separation Invariant

The most important lifecycle invariant is:

```text
Completion != Acceptance
```

Provider completion proves that provider work was submitted for review. It moves the ticket to `AWAITING_ACCEPTANCE`.

Client acceptance proves that the client accepted the result. It moves the ticket to `DONE`.

Any future lifecycle change must preserve this separation unless the product owner explicitly changes the business rule and the backend access model is updated accordingly.
