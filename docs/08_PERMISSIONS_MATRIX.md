# 08 Permissions Matrix

The full capability table for the current runtime. Every cell is derived from code —
controller guards, permission blocks, and the access resolvers described in
[03 Access Model](03_ACCESS_MODEL.md). Nothing here is aspirational.

## How To Read This Document

### Legend

| Mark | Meaning |
|---|---|
| **A** | Allow — the role passes the role gate and the permission gate for this capability |
| **D** | Deny — the role is not in the role gate, or the capability does not exist for it |
| **C** | Conditional — passes the gates, but a resolver, policy, or workflow decides the outcome per object |

**Conditional is the normal case, not an exception.** Most ticket capabilities in this
system are `C`, because passing the endpoint guard only earns you the right to be
evaluated. Contract, location, specialization, and relationship state decide the rest.

### Columns

Columns are `(role, company type)` pairs, because the same role behaves differently
depending on whether it sits in a client or a provider company.

| Column | Backend role | Company type |
|---|---|---|
| CLIENT ADMIN | `ADMIN` | `CLIENT` |
| NETWORK DIRECTOR | `NETWORK_DIRECTOR` | `CLIENT` |
| TERRITORIAL MANAGER | `TERRITORIAL_MANAGER` | `CLIENT` |
| PROVIDER ADMIN | `ADMIN` | `PROVIDER` |
| MASTER | `MASTER` | `PROVIDER` |
| DISPATCHER | `DISPATCHER` | `PROVIDER` |
| TECHNICIAN | `TECHNICIAN` | `PROVIDER` |
| PLATFORM ADMIN | `PLATFORM_ADMIN` | platform |

The `CLIENT` role itself (an end requester inside a client company) is not a column
here. Where its behavior differs from client management, it is called out in comments.

### The three gates

Every request passes up to three gates in order:

```text
1. @Roles(...)              coarse role gate on the controller or method
2. @RequirePermission(...)  permission block from the PBAC matrix
3. access resolver          contract, location, specialization, relationship
```

A capability marked **A** clears gates 1 and 2 unconditionally. A capability marked
**C** clears 1 and 2 but its result depends on gate 3. **D** fails gate 1 or 2.

Gate 3 is the one that matters most and the one this table cannot fully express —
that is what document 03 is for.

---

## 1. Tickets — Core

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| View list / board | C | C | C | C | C | C | C | C |
| View detail | C | C | C | C | C | C | C | C |
| View available (unassigned) | D | D | D | C | C | C | C | D |
| Create | A | A | A | A | A | A | A | D |
| Create child ticket | D | D | D | A | A | A | D | D |
| Edit fields | C | C | C | C | C | C | D | D |
| Delete | D | D | D | D | D | D | D | D |
| Timeline | C | C | C | C | C | C | C | C |

**Comments.**

*View* requires `TICKETS_VIEW` and admits every role including `PLATFORM_ADMIN`, so
the role gate is wide. Everything meaningful happens in the resolver: a provider user
sees a client ticket only through an active contract covering the ticket location and
specialization. This is why every view cell is `C` and none is `A`.

*View available* is a separate permission, `TICKETS_VIEW_AVAILABLE`, and its role gate
is provider-side only: `TECHNICIAN, ADMIN, MASTER, DISPATCHER`. Client management has
no notion of "available to claim", hence `D`.

*Create* is the widest capability in the system: seven roles pass, and no contract
check applies, because creating a ticket in your own company needs no counterparty.
`PLATFORM_ADMIN` is deliberately absent — platform staff do not create tenant work.

*Create child ticket* narrows to provider management (`ADMIN, MASTER, DISPATCHER`).
A child ticket is a delegation artifact, not a request.

*Edit* requires `TICKETS_EDIT` and excludes `TECHNICIAN`. A technician performs work
and reports it; changing the ticket's definition is management. Note the asymmetry:
technicians can create tickets but cannot edit them, including their own.

*Delete* does not exist. There is no delete endpoint for tickets in the API. Tickets
are cancelled through status, never removed. The row is kept because its absence is a
deliberate design decision, not an oversight.

---

## 2. Tickets — Content

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| Comments — read | C | C | C | C | C | C | C | C |
| Comments — add | C | C | C | C | C | C | C | D |
| Attachment — list | C | C | C | C | C | C | C | C |
| Attachment — upload | C | C | C | C | C | C | C | D |
| Attachment — delete | C | C | C | C | C | C | C | D |
| Photo | C | C | C | C | C | C | C | D |
| Video | C | C | C | C | C | C | C | D |

**Comments.**

Comments and attachments have **no visibility logic of their own**. They require
readable ticket access through the same resolver; if the actor cannot read the ticket,
these fail closed. That is why every cell mirrors the view row.

*Photo* and *Video* are not separate capabilities — they are attachment MIME classes.
Video is supported (`video/mp4`, `video/quicktime`, `video/webm`, `video/x-m4v`) with
a 100 MB ceiling; images have their own smaller ceiling. Both go through the same
upload endpoint and the same authorization. They are listed separately only because
product discussions treat them as distinct features.

`PLATFORM_ADMIN` reads but does not write. It is absent from every content mutation
role gate — consistent with document 03: the platform role must not become a shortcut
for tenant operations.

Attachment purposes are `REQUEST`, `WORK_REPORT`, `DECLINE_REPORT`. Purpose affects
workflow evidence requirements, not authorization.

---

## 3. Tickets — Work Lifecycle

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| Assignment (assign / reassign) | D | C | D | C | C | C | D | D |
| Assignment candidates | D | C | C | C | C | C | D | D |
| Smart assign | D | C | D | C | C | C | D | D |
| Request assignment | D | D | D | C | C | C | C | D |
| Claim | D | C | D | C | C | C | C | D |
| Status change | D | C | D | C | C | C | C | D |
| Completion | D | D | D | C | C | C | C | D |
| Acceptance | C | C | C | D | D | D | D | D |

**Comments.**

*Assignment* requires `TICKETS_ASSIGN`, role gate `ADMIN, MASTER, DISPATCHER,
NETWORK_DIRECTOR`. Every cell is `C` because assignment authority is contract-scoped:
a PRIMARY provider may assign to its own executors and to eligible SECONDARY-provider
executors; a SECONDARY provider may only manage its own workforce. `TERRITORIAL_MANAGER`
appears in the candidate-list gate but not in the assign gate — it can see who could
be assigned without being able to assign. Treat that asymmetry as intentional but
verify before relying on it.

*Request assignment* is the SECONDARY path: ask the general contractor to assign.
The resolver additionally requires the ticket to be `NEW` and unassigned, the provider
to be `SECONDARY` for that client contract, and the contract to cover location and
specialization. A supplied `targetUserId` must be an eligible executor in the same
secondary company.

*Claim* is direct self-assignment under `TICKETS_CLAIM`. Provider-side only. The
decisive rule is not in the role gate: a SECONDARY provider cannot directly claim
client-created or primary-created work — it must request assignment. The self-created
exception applies when the actor created the ticket and is an eligible executor inside
valid contract, location, and specialization scope.

*Completion* is a provider operational action, not finalization. The backend maps a
provider completion request to `AWAITING_ACCEPTANCE` and requires work evidence.
Provider actors must never move `AWAITING_ACCEPTANCE -> DONE`.

*Acceptance* deserves care. The role gate on `POST /tickets/:id/acceptance` is
**permissive** — it lists `ADMIN, MASTER, TECHNICIAN, TERRITORIAL_MANAGER,
NETWORK_DIRECTOR`, which includes provider roles. The client-only restriction is
enforced deeper, in the acceptance access layer, by company type and ticket ownership.
So the cells read `D` for provider columns because that is the effective behavior,
even though the role decorator alone would let them through. If you are auditing this
endpoint, do not stop at the decorator.

---

## 4. Delivery Channels

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| Notifications — read own | A | A | A | A | A | A | A | D |
| Notifications — receive | C | C | C | C | C | C | C | D |
| Push — subscribe / preferences | A | A | A | A | A | A | A | A |
| Push — receive | C | C | C | C | C | C | C | D |
| MAX — receive | C | C | C | C | C | C | C | D |
| MAX — admin/test endpoints | D | D | D | D | D | D | D | A |

**Comments.**

*Reading your own notifications* is `A`: the endpoint has no permission block and
scopes by `userId`. You can only read your own.

*Receiving* is `C` for everyone, and this is the important line. A candidate recipient
is selected by role interest lists, then **each candidate is individually checked
against the canonical ticket access resolver**. Wrong contract, wrong location, wrong
specialization, unrelated provider, inactive or deleted user — no notification.

*Push* subscription management is `A` for all roles including `PLATFORM_ADMIN` and
`STAFF`; delivery follows the notification decision plus the per-user
`PushPreference` toggle. Push adds no visibility of its own.

*MAX* is the exception that must be understood before relying on this table. MAX
delivers four event types — ticket created, assigned, claimed, status changed — to a
**single shared group chat**, and that path does **not** go through the access
resolver. Membership of the MAX group is therefore the effective access policy for
those four events. The `C` marks describe intent; the current implementation is
coarser. Everything else — comments, attachments, SLA, acceptance, assignment
requests — is not delivered to MAX at all.

MAX administrative endpoints are `PLATFORM_ADMIN` only via a class-level guard.

---

## 5. Directories And Configuration

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| Locations — view | C | C | C | C | C | C | C | D |
| Locations — manage | A | D | D | A | A | D | D | D |
| Equipment — view | C | C | C | C | C | C | C | D |
| Equipment — manage | D | D | D | A | A | A | D | D |
| Problem categories — view | A | A | A | A | A | A | A | D |
| Problem categories — manage | A | D | D | A | D | D | D | D |
| Specializations — manage | A | D | D | A | D | D | D | D |
| Company settings | A | D | D | A | D | D | D | D |
| Companies — list / create | D | D | D | D | D | D | D | A |
| Contracts — view linked | D | C | D | C | C | C | D | D |
| Contracts — manage | D | D | D | D | D | D | D | A |

**Comments.**

*Locations manage* is `ADMIN, MASTER` with `LOCATIONS_MANAGE`. `DISPATCHER` can view
but not manage, which is the opposite of equipment, where `DISPATCHER` can manage.
This asymmetry is real and worth knowing before you assume symmetry.

*Problem categories* and *Specializations* are `ADMIN`-only under
`COMPANY_SETTINGS_EDIT`. The specializations controller carries a **class-level**
`@Roles(ADMIN)` — none of its methods declare guards individually. Do not conclude
from the method bodies that it is unguarded.

*Contracts* are created and edited only by `PLATFORM_ADMIN`. Tenants can read the
relationships they participate in (`linked-clients`, `linked-providers`) but cannot
create or alter a contract. This is deliberate: contracts define the access boundary,
so tenants must not be able to widen their own scope.

*Companies* are platform-owned. Tenant `ADMIN` may edit its own company record and
auto-assign settings, but not create companies or assign company admins.

---

## 6. Workforce

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| WorkShift — open / close own | D | D | D | A | A | A | A | D |
| WorkShift — view all | D | C | C | A | A | A | D | A |
| WorkLog — start / stop | D | D | D | A | A | A | A | D |
| Workforce settings | D | D | D | A | D | D | D | D |
| Technicians — list | D | D | D | A | D | D | D | D |
| Technicians — specializations | D | D | D | A | D | D | D | D |
| Technicians — location bindings | D | D | D | A | D | D | D | D |
| Technicians — own profile | D | D | D | D | D | D | A | D |

**Comments.**

Shift and work-log operations use `WORKFORCE_SHIFT_USE` and are open to all four
provider roles — management can also be executors when `isExecutor=true`. Viewing all
shifts is a separate permission, `WORKFORCE_VIEW`, which admits client-side management
and `PLATFORM_ADMIN` for oversight but excludes `TECHNICIAN`.

The technicians controller has a class-level gate of
`ADMIN, MASTER, DISPATCHER, NETWORK_DIRECTOR`, but every management method also
requires `USERS_MANAGE`, which in practice narrows it to `ADMIN`. Two endpoints —
`GET` and `PUT /:id/location-bindings` — declare `USERS_MANAGE` without a method-level
role list and rely on the class gate.

`GET /technicians/me` and `/me/bound-contexts` are `TECHNICIAN`-only: the executor's
view of their own assignment context.

---

## 7. Administration

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| Users — list | A | D | D | A | D | D | D | A |
| Users — create / edit | A | D | D | A | D | D | D | D |
| Users — deactivate / delete / restore | A | D | D | A | D | D | D | D |
| Users — set specializations | C | C | C | C | C | C | C | C |
| Permissions — view own effective | A | D | D | A | D | D | D | A |
| Permissions — grant / revoke | A | D | D | A | D | D | D | A |
| Permissions — global matrix | D | D | D | D | D | D | D | A |
| Analytics | D | A | D | A | A | A | D | A |
| Impersonate | D | D | D | D | D | D | D | C |

**Comments.**

User management is `ADMIN` plus `USERS_MANAGE`, scoped to the actor's own company.
`PLATFORM_ADMIN` can list users but is absent from create, edit, deactivate, and
delete role gates — it observes rather than administers tenants.

**`PUT /users/:id/specializations` carries no role and no permission decorator**, and
its controller has no class-level guard. It is protected only by `JwtAuthGuard` and by
service-level scoping to `req.user.companyId`. Any authenticated user of a company can
call it for a user of that company. This is marked `C` rather than `A` because company
scoping does constrain it, but it is the weakest authorization surface in this table
and should be reviewed rather than relied upon.

Per-user permission grants are `ADMIN` or `PLATFORM_ADMIN`. The **global** matrix —
which role gets which permission block by company type — is `PLATFORM_ADMIN` only.

*Analytics* uses `ANALYTICS_VIEW` with role gate `ADMIN, MASTER, DISPATCHER,
NETWORK_DIRECTOR, PLATFORM_ADMIN`. Note that `TERRITORIAL_MANAGER` is excluded while
`NETWORK_DIRECTOR` is included — client-side analytics is a network-level view.
`TECHNICIAN` has no analytics access.

*Impersonation* exists on the auth controller and is `C`: guarded at the service level
rather than by a role decorator. Treat it as platform-only and audit any change to it.

---

## 8. Inspections

| Capability | CLIENT ADMIN | ND | TM | PROVIDER ADMIN | MASTER | DISPATCHER | TECHNICIAN | PLATFORM ADMIN |
|---|---|---|---|---|---|---|---|---|
| Templates — view | D | C | D | C | C | C | C | D |
| Templates — create | D | C | D | C | C | C | D | D |
| Runs — view / execute | D | C | D | C | C | C | C | D |
| Runs — review | D | C | D | C | C | C | D | D |

**Comments.**

Inspections reuse `LOCATIONS_VIEW` and `LOCATIONS_MANAGE` rather than defining their
own permission blocks. Execution is open to `TECHNICIAN`; template authoring and report
review are management-only. `TERRITORIAL_MANAGER` and `CLIENT ADMIN` are absent from
every inspection role gate.

---

## 9. Capabilities That Do Not Exist

Listed because their absence is frequently assumed to be an oversight.

| Capability | Status |
|---|---|
| Warehouse / inventory | **Not implemented.** No module, no model, no endpoint. |
| Ticket deletion | **Not implemented.** Cancellation is a status transition. |
| Client-side assignment to provider workforce | Not exposed. Client management does not assign. |
| Provider acceptance | Deliberately impossible — see §3. |
| Per-user MAX delivery | Not implemented. MAX delivers to one shared group chat. |

---

## 10. Reading Order For Auditors

When verifying a specific cell, check in this order:

1. **Controller** — method decorators, then class decorators. A missing method-level
   guard does not mean unguarded.
2. **Permission block** — `@RequirePermission(...)` against the PBAC matrix for the
   actor's `(role, companyType)`.
3. **Access resolver** — the `C` cells live here. See document 03.
4. **Workflow table** — for status transitions, the allowed transition set is a
   separate gate again.

A cell that looks wrong is usually a case where the role gate is broader than the
effective behavior, as with acceptance in §3. Verify the deepest gate, not the first.

---

## Related Documents

- [03 Access Model](03_ACCESS_MODEL.md) — the canonical rules behind every `C` in this table
- [04 Development Workflow](04_DEVELOPMENT_WORKFLOW.md) — how to change any of this safely
- [Legacy Ticket Visibility Matrix](LEGACY/TICKET_VISIBILITY_MATRIX.md) — older visibility notes; verify against code before use
- [Legacy RBAC Matrix](LEGACY/RBAC_MATRIX.md) — predates the current permission model; superseded by this document
