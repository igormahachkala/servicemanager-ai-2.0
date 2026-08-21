# 15 Architecture Status

This document is the current architecture status index. It tells a developer which
canonical documents describe the accepted runtime and where to look before changing
behavior.

## Current Accepted Model

The accepted architecture is:

```text
Access = Capability + Contract Context + Location Scope + Specialization Scope + User Access
```

Current status:

- roles remain action profiles;
- backend services are authoritative;
- Contract Context is the provider relationship source of truth;
- ticket visibility is contract plus location plus specialization;
- assignment candidates must match assignment authority;
- provider completion and client acceptance are separate;
- notification eligibility uses readable ticket access;
- desktop, mobile, MAX, push, and realtime are clients of backend decisions.

## Canonical Documents

| Document | Status |
| --- | --- |
| [02 Architecture](02_ARCHITECTURE.md) | Current system structure and boundaries. |
| [03 Access Model](03_ACCESS_MODEL.md) | Current authorization, visibility, assignment, claim, acceptance, and notification rules. |
| [06 Domain Model](06_DOMAIN_MODEL.md) | Current entity map and ownership rules. |
| [07 Ticket Lifecycle](07_TICKET_LIFECYCLE.md) | Current ticket status, completion, acceptance, event, and notification rules. |
| [08 Permissions Matrix](08_PERMISSIONS_MATRIX.md) | Current role/capability table. |
| [09 Repository Guide](09_REPOSITORY_GUIDE.md) | Current module ownership and file map. |
| [10 Coding Standards](10_CODING_STANDARDS.md) | Current implementation rules. |
| [11 Runtime Acceptance](11_RUNTIME_ACCEPTANCE.md) | Current Stage acceptance protocol. |
| [12 Release Process](12_RELEASE_PROCESS.md) | Current release, migration, Production gate, and rollback process. |
| [13 Troubleshooting](13_TROUBLESHOOTING.md) | Current debugging entry points. |
| [14 Glossary](14_GLOSSARY.md) | Current terminology. |
| [16 Architecture Changelog](16_ARCHITECTURE_CHANGELOG.md) | Decision history leading to the current model. |
| [17 Decision Log](17_DECISION_LOG.md) | Why each rule exists, and which alternatives were rejected. |

## Stable Decisions

These decisions are accepted and should not be reopened inside a feature task:

- `PRIMARY` and `SECONDARY` are service-contract roles, not user roles.
- Provider authority is evaluated per contract, not per provider company globally.
- Permission grants never widen data scope.
- Relationship context never grants a capability by itself.
- Client acceptance is not a provider status transition.
- Candidate list must not show a user who cannot actually be assigned.
- Notification delivery must not leak ticket data beyond readable access.
- UI visibility is not a security boundary.

## Open Change Rule

When a task changes an accepted architecture rule:

1. update the implementation source of truth;
2. update the relevant numbered document;
3. record the change in [16 Architecture Changelog](16_ARCHITECTURE_CHANGELOG.md), and
   — when the change constrains future work and the reason is not obvious from the
   code — add an entry to [17 Decision Log](17_DECISION_LOG.md) covering the
   alternatives that were rejected;
4. verify Stage runtime behavior when the change affects access, lifecycle, assignment,
   notifications, mobile, MAX, or release safety.

Do not document aspirational behavior as current architecture. If a rule is planned
but not implemented, keep it out of the current architecture documents.
