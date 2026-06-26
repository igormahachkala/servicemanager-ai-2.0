# Beta Readiness Checklist

> **Status:** Release governance · **Gate:** Beta declaration  
> **Parent:** [architecture-review-process.md](../reviews/architecture-review-process.md) · **Task:** AI-COMPANY-062  
> **Log:** Record outcome in [platform-review-log.md](../reviews/platform-review-log.md)

---

## Purpose

Beta means: **selected Owners can run a living digital company daily** — with known limits documented, not hidden.

All sections below must be reviewed. **Blockers** require Owner waiver in writing in the review log.

**Legend:** ☐ not started · ◐ in progress · ☑ ready for Beta · ⛔ blocker

---

## Gate process

1. Complete checklist (honest status).  
2. Run L3 Architecture Review.  
3. Log in [platform-review-log.md](../reviews/platform-review-log.md).  
4. Owner signs **Go / No Go**.  

---

## Runtime

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| R1 | At least one **real** Runtime Provider operational (Ollama or approved alternative) | ◐ | Ollama HTTP integrated; CORS/relay for remote host |
| R2 | Execute → Run → Report → Timeline → Run History pipeline works end-to-end | ☑ | Orchestrator async path |
| R3 | Live Runtime Monitor shows pipeline, logs, elapsed, timeout | ☑ | `/ops/runtime/live` |
| R4 | Failure modes clear: timeout, cancel, network, partial logs | ☑ | AI-COMPANY-054 |
| R5 | Model Router selects catalog model; Runtime adapter executes | ☑ | Separation preserved |
| R6 | Mock provider available for offline demo | ☑ | `provider = mock` |
| R7 | New Runtime Provider requires L4 AR before Beta default | ☑ | Process documented |

---

## Canvas

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| C1 | Company Canvas shows employees, work, relationships | ☑ | `/ops/canvas` |
| C2 | Canvas links to detail routes (employee, project, runtime) | ◐ | Verify all node types |
| C3 | Canvas feels “alive” — status, motion, not static diagram | ◐ | Premium V2 polish ongoing |
| C4 | Canvas consistent with Design System V2 | ◐ | |

---

## Execution

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| E1 | Execution queue visible and actionable | ☑ | `/ops/execution` |
| E2 | Tool execution log linked to runs | ☑ | Tool gateway V1 local |
| E3 | Employee runtime pages launch real or mock runs | ☑ | Employee + settings pages |
| E4 | Approval gate visible when required | ◐ | Mock approval flow |

---

## Sprint

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| S1 | Sprint planning surfaces tasks and progress | ☑ | Sprint engine V1 |
| S2 | Sprint links to projects and employees | ◐ | |
| S3 | Owner sees sprint status on Command Center or project | ◐ | |

---

## Projects

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| P1 | Project list and detail with workspace link | ☑ | |
| P2 | Control room for flagship project (AI Photo Lab) | ☑ | |
| P3 | Project health, tasks, handoffs visible | ◐ | |

---

## Notifications

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| N1 | Notifications generated from events (runtime, approval, etc.) | ☑ | |
| N2 | Runtime inbox filter works | ☑ | `?type=runtime` |
| N3 | Owner can reach source entity from notification | ◐ | |

---

## Knowledge

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| K1 | Knowledge catalog and collections | ☑ | |
| K2 | Knowledge referenced in runtime context (when not lightweight) | ☑ | |
| K3 | Published vs draft states clear | ◐ | |

---

## Handoffs

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| H1 | Handoff catalog and package preview | ☑ | Mock protocol V1 |
| H2 | Owner approval before external send (conceptual) | ☑ | |
| H3 | Return path to reports / timeline documented | ◐ | |

---

## Presence

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| PR1 | Employee presence states visible | ☑ | Presence engine |
| PR2 | Workday phase integration | ☑ | Workday V1 |
| PR3 | Current run linked from presence | ◐ | |

---

## Reports

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| RP1 | Reports created from completed runtime runs | ☑ | |
| RP2 | Report list and detail readable by Owner | ☑ | |
| RP3 | Evidence links to run history | ◐ | |

---

## QA

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| Q1 | `npm run build` green on main branch | ☑ | Required every commit |
| Q2 | Critical user flows manually tested (documented) | ◐ | See quality-gate |
| Q3 | No known P0 bugs open without waiver | ☐ | Owner triage |
| Q4 | Operating rules + governance docs current | ☑ | 058 + 062 |

---

## Performance

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| PF1 | Mission Control usable on typical laptop (no multi-second hangs) | ◐ | localStorage scale limits |
| PF2 | Live monitor polling interval acceptable (500ms) | ☑ | |
| PF3 | Bundle size acknowledged; code-split plan for Beta+ | ◐ | Vite chunk warning |

---

## i18n

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| I1 | EN + RU for all primary nav and new features | ◐ | Ongoing pass |
| I2 | Error messages localized | ◐ | Runtime errors partially EN |
| I3 | Employee codenames consistent across locales | ☑ | |

---

## Documentation

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| D1 | North Star + AGENTS + operating rules current | ☑ | |
| D2 | Engineering governance pack complete | ☑ | 062 |
| D3 | Domain docs match implemented entities | ◐ | Update per feature |
| D4 | Beta known limitations documented for Owners | ☐ | Add to README or release notes |

---

## Beta sign-off

| Role | Name | Date | Go / No Go |
|------|------|------|------------|
| Owner | | | |
| Lead engineer / agent | | | |

**Conditions (if Go with conditions):**

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Beta readiness checklist (AI-COMPANY-062) |
