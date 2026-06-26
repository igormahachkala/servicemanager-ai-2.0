# Product Review Board (PRB)

> **Status:** Governance · Mandatory for feature intake  
> **Task:** AI-COMPANY-063  
> **Parent:** [Product Principles](../principles/product-principles.md) · [North Star](../../apps/ai-company/docs/north-star/north-star.md)

Every feature, screen, engine, or integration that ships in **AI Company** passes through the Product Review Board **before** implementation is approved and **after** before release.

The PRB is not a meeting calendar — it is a **decision framework** Owner and agents use to prevent drift into CRM, admin panel, or workflow-builder territory.

---

## When PRB applies

| Must review | Examples |
|-------------|----------|
| New user-facing surface | Command Center, Visual Lab, Control Room, Canvas |
| New platform engine | Runtime, Execution, Sprint, Workday, Handoffs |
| New entity or lifecycle change | Employee DNA field, Assignment rules |
| Cross-cutting UX change | Navigation, design tokens, global empty states |
| Marketplace / billing touch | Templates, licensing, hire flow |

| May skip formal PRB | Copy fix, bug fix with no UX change, internal refactor with zero behavior change |

If unsure → **review**.

---

## Review dimensions

Each proposal is scored **1–5** (1 = weak / harmful, 5 = strong / essential) on six dimensions. **Minimum bar to proceed:** no dimension below **3**, and **North Star Alignment ≥ 4**.

### 1. Product Value

Does this make AI Company more clearly an **Operating System for Digital Organizations**?

- Adds observable company motion (presence, execution, reports)?
- Strengthens Employee-as-entity (not chat session)?
- Creates durable platform capability (reusable across customer companies)?

**Red flags:** one-off demo screen with no domain model; feature that only works for a single mock project.

### 2. Business Value

Does this move the platform toward **marketplace, retention, or expansion**?

- Enables template → hire → operate journey?
- Reduces Owner time-to-trust?
- Supports future billing / licensing hooks?

**Red flags:** engineering vanity; parity with unrelated SaaS categories.

### 3. User Value (Owner-first)

Does the **Owner** gain clarity, control, or speed?

- Can Owner answer who / what / risk / decision in fewer steps?
- Does it respect Human First (recommend vs decide)?
- Is the primary user the Owner, not the agent?

**Red flags:** agent-centric UI with no Owner observability; hidden automation.

### 4. Simplicity

Is this the **smallest correct** solution?

- One clear entry point and one clear outcome?
- Reuses existing engines (Execution, Runtime, Events) instead of parallel systems?
- Avoids new concepts when an existing entity fits?

**Red flags:** duplicate queues, duplicate timelines, duplicate approval flows.

### 5. Future Cost

What does this cost to maintain, extend, and explain in 12–24 months?

- Adds permanent concepts to domain model?
- Locks us into a vendor or UI pattern?
- Requires ongoing mock → real migration path?

**Score 5** when the feature **reduces** future cost (shared engine, shared tokens, shared events).

### 6. North Star Alignment

Direct check against [North Star](../../apps/ai-company/docs/north-star/north-star.md):

| Question | Must be **yes** |
|----------|-----------------|
| Is this part of a living company, not a chat shell? | |
| Does it preserve Employee identity separate from LLM? | |
| Does it respect Platform → Company → Project → Task hierarchy? | |
| Does it increase observability and human gates where needed? | |
| Is it explicitly **not** CRM / Jira / n8n core? | |

---

## PRB worksheet (copy per feature)

```markdown
## Feature: [name]
**Author:** [human / agent]  
**Date:** YYYY-MM-DD  
**Route / module:** [e.g. /ops/visual-lab]

### One-line outcome
[What Owner can do after this ships]

### Scores (1–5)
| Dimension | Score | Notes |
|-----------|-------|-------|
| Product Value | | |
| Business Value | | |
| User Value | | |
| Simplicity | | |
| Future Cost | | |
| North Star Alignment | | |

### Non-goals (explicit)
- [What we are NOT building]

### Dependencies
- Domain: [entities touched]
- UX: [checklist link]
- Runtime / Employee acceptance: [if applicable]

### Decision
- [ ] Proceed
- [ ] Proceed with scope cut: …
- [ ] Defer
- [ ] Reject — violates: …
```

---

## Decision authority

| Decision | Authority |
|----------|-----------|
| Proceed / reject | **Owner** |
| Score draft | Product + implementing agent |
| UX gate | [UX Review Checklist](../design/ux-review-checklist.md) |
| Visual gate | [Visual Language](../design/visual-language.md) |
| Runtime / Employee gate | [Runtime Acceptance](../runtime/runtime-acceptance.md) · [Digital Employee Acceptance](../employees/digital-employee-acceptance.md) |

Agents **must STOP** and escalate when any dimension scores **1–2** or North Star Alignment **< 4**. See [task-decision-filter](../../apps/ai-company/docs/operating-rules/task-decision-filter.md).

---

## Release checklist (post-build)

Before marking a feature **done**:

1. PRB worksheet filed (or updated) in task / PR description  
2. UX checklist signed  
3. No new [UX debt](../design/ux-debt.md) without registry entry  
4. i18n EN + RU for user-visible strings (when code ships)  
5. Linked from [Master Roadmap](../roadmap/master-roadmap.md) phase if applicable  

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial PRB framework (AI-COMPANY-063) |
