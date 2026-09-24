# Platform Constitution V2 - ServiceManager.AI

Status: Active

Purpose: define the high-level engineering invariants that protect the
ServiceManager.AI product. This is a reference document. The official freeze
state is [15 Architecture Status](15_ARCHITECTURE_STATUS.md), and the numbered
documents remain the onboarding source of truth.

## 1. Product Boundary

ServiceManager.AI is a service operations platform for client companies and
provider companies.

The product manages:

- service contracts;
- locations and equipment;
- tickets;
- assignment and claim;
- provider completion;
- client acceptance;
- comments, attachments, history, and timeline;
- notifications across web, push, realtime, and MAX.

Internal engineering tooling is not customer-facing product functionality.

## 2. Source Of Truth

The backend is the authority for business rules.

The database schema and Prisma migrations are the authority for persistent
state.

The numbered documentation path is the authority for onboarding and current
architecture:

```text
README.md
-> docs/00_START_HERE.md
-> docs/01_PROJECT_OVERVIEW.md through docs/17_DECISION_LOG.md
```

Legacy documents are historical only. They must not override the numbered
documents or current code.

## 3. Tenant And Contract Model

Every operational record must stay tenant-scoped.

`Company` is the tenant boundary. `ServiceContract` is the source of truth for
client-provider work.

`PRIMARY` and `SECONDARY` are roles in a current `ServiceContract`. They are not
global properties of a provider company.

Contract Context is canonical:

```text
Service Contract
-> Role In Contract
-> Contract Locations
-> Contract Specializations
-> Current Access
```

No feature may introduce company-global PRIMARY or SECONDARY assumptions.

## 4. Authorization

Access must fail closed.

Controllers handle transport, DTOs, authentication guards, and coarse route
guards. Services, policies, and shared access helpers own object-level business
authorization.

Frontend checks are presentation only. Frontend code may render backend
decisions, but it must not be the source of security decisions.

Candidate List equals Assignment Authority. If a user can assign work to a
person or company, that target must come from the same eligibility model used by
the backend mutation.

Management provider roles use Contract Specialization. Technicians additionally
use Technician Specialization where operational rules require it.

## 5. Workflow

Completion is not Acceptance.

Providers perform Completion. A valid provider completion moves work to
`AWAITING_ACCEPTANCE`.

Clients perform Acceptance. Only a valid client-side actor may finalize accepted
work as `DONE`.

No provider-side role may perform Acceptance, including:

- `ADMIN`;
- `MASTER`;
- `DISPATCHER`;
- `TECHNICIAN`.

## 6. Notifications

Notification eligibility must follow Contract Context.

Web notifications and Push notifications may share internal recipient
eligibility helpers, but they must not fork authorization rules.

MAX is a delivery transport. MAX must not create a separate access model.

## 7. Runtime Safety

Stage and Production are separate operational contours.

Production work requires explicit authorization, backup readiness, rollback
readiness, and exact task boundaries.

Deploy only clean, reproducible commits. Do not deploy dirty worktrees or
server-local hotfixes.

Use Prisma migrations for schema changes. Do not fabricate schema objects
manually.

Do not print secrets, tokens, passwords, private keys, or credential-bearing
environment values in reports.

## 8. Documentation Maintenance

When architecture changes, update the numbered documents that describe the
changed rule.

Common updates:

- domain/entity change: update `06_DOMAIN_MODEL.md`;
- access or visibility change: update `03_ACCESS_MODEL.md`,
  `08_PERMISSIONS_MATRIX.md`, and `15_ARCHITECTURE_STATUS.md` if an invariant
  changes;
- lifecycle change: update `07_TICKET_LIFECYCLE.md`;
- release or runtime change: update `11_RUNTIME_ACCEPTANCE.md` and
  `12_RELEASE_PROCESS.md`;
- architectural decision: update `16_ARCHITECTURE_CHANGELOG.md` and
  `17_DECISION_LOG.md`.
