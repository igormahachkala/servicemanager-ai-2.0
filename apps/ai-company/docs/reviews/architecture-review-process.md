# Architecture Review Process

> **Status:** Engineering governance · **Scope:** `apps/ai-company/**`  
> **Parent:** [AGENTS.md](../AGENTS.md) · **Task:** AI-COMPANY-062  
> **Log:** [platform-review-log.md](../reviews/platform-review-log.md)

---

## Purpose

Architecture Review (AR) is a **mandatory gate** after major development phases.

It prevents silent drift from [North Star](../north-star/north-star.md), accumulates decisions in one place, and feeds [technical-debt.md](../architecture/technical-debt.md).

AR is **not** a code review substitute. It evaluates **system shape**, **product fit**, **UX coherence**, and **readiness to scale**.

---

## When Architecture Review is mandatory

| Trigger | Minimum scope |
|---------|----------------|
| **Every 10 completed tasks** | Incremental AR — delta since last review |
| **Before Beta** | Full platform AR — [beta-readiness-checklist.md](../release/beta-readiness-checklist.md) |
| **Before Production** | Full platform AR — [production-readiness.md](../release/production-readiness.md) |
| **Before new Runtime Provider** | Provider adapter, security, observability, failure modes |
| **Before new product / major initiative** | Domain impact, Canvas visibility, employee roles, delivery path |

**Rule:** If trigger fired and AR not recorded in [platform-review-log.md](../reviews/platform-review-log.md) → **no Go** for next phase.

---

## Participants

| Role | Responsibility |
|------|----------------|
| **Owner** | Final Go / No Go; product priority |
| **Lead agent / engineer** | Presents architecture delta, demos flows |
| **System Architect lens** | Domain model, layers, extensibility, ADR gaps |
| **Product Lead lens** | North Star alignment, Owner value, living company |
| **UX reviewer lens** | Design System V2, i18n, error states, navigation |

V1: Owner + agent roles documented in review log. Multi-human team uses same template.

---

## Review agenda (minimum)

1. **Scope** — tasks / features since last AR  
2. **North Star check** — conflicts and resolutions  
3. **Architecture** — layers, domain entities, storage keys, event model  
4. **Runtime & execution** — providers, orchestrator, visibility (Live Runtime, Run History)  
5. **UX & i18n** — EN/RU, error clarity, empty states  
6. **Security & permissions** — approvals, audit, tool gates (conceptual in V1)  
7. **Technical debt** — new items, reprioritization  
8. **UX debt** — polish gaps, inconsistent surfaces  
9. **Beta / Production blockers** — if applicable  
10. **Decision** — Go / No Go / Go with conditions  

---

## Inputs (prepare before AR)

| Input | Location |
|-------|----------|
| Completed task list | Git log, sprint notes, or Owner backlog |
| ADRs | [architecture/](../architecture/) |
| Domain specs | [domain/](../domain/) |
| Operating rules compliance | [operating-rules/](../operating-rules/) |
| Open debt | [technical-debt.md](../architecture/technical-debt.md) |
| Last review | [platform-review-log.md](../reviews/platform-review-log.md) |

---

## Outputs (mandatory)

Each AR **must** produce one entry in [platform-review-log.md](../reviews/platform-review-log.md) containing:

- date  
- version / milestone  
- participants  
- findings (architecture, product, UX)  
- decisions (including ADR follow-ups)  
- technical debt added or closed  
- UX debt added or closed  
- **Go / No Go / Go with conditions**  

If **No Go** — list blocking items with owners and target task IDs.

---

## AR severity levels

| Level | When | Duration |
|-------|------|----------|
| **L1 — Incremental** | Every 10 tasks | 30–60 min equivalent analysis |
| **L2 — Milestone** | Major feature complete (Runtime, Canvas, Live Monitor) | Full agenda |
| **L3 — Release** | Beta or Production gate | Full agenda + readiness checklists |
| **L4 — Provider / Product** | New Runtime or new product line | Full agenda + threat model sketch |

---

## Architecture review checklist

### Constitution

- [ ] Aligns with [north-star.md](../north-star/north-star.md)  
- [ ] Digital Employee ≠ LLM preserved  
- [ ] Living company — work visible to Owner  
- [ ] Human First — approvals and audit intact  

### Structure

- [ ] UI → hooks → domain → storage layers respected  
- [ ] No ServiceManager coupling unless explicit  
- [ ] New entities documented in [domain-model.md](../domain/domain-model.md)  
- [ ] Events append-only; Run / Report / Timeline integration considered  

### Runtime

- [ ] Provider adapter boundary clear  
- [ ] Failure modes documented (timeout, cancel, partial logs)  
- [ ] Model Router vs Runtime responsibilities separated  

### Scalability (team + employees)

- [ ] New work does not require rewriting constitution  
- [ ] File size and module boundaries sustainable  
- [ ] i18n pattern repeatable for new screens  

---

## After review

| Outcome | Action |
|---------|--------|
| **Go** | Proceed; log decisions; update debt register |
| **Go with conditions** | Create tasks before next milestone; log conditions |
| **No Go** | Stop release/provider/product launch; fix blockers first |

Link follow-up tasks to review log entry ID.

---

## Relation to other governance

| Document | Role |
|----------|------|
| [feature-lifecycle.md](../process/feature-lifecycle.md) | AR at Architecture stage + before Beta/Production |
| [beta-readiness-checklist.md](../release/beta-readiness-checklist.md) | L3 Beta gate |
| [production-readiness.md](../release/production-readiness.md) | L3 Production gate |
| [technical-debt.md](../architecture/technical-debt.md) | Debt captured from AR |

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Architecture review process (AI-COMPANY-062) |
