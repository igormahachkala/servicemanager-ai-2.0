# Senior Product & Engineering Operating Rules

> **Status:** Mandatory operating standard · **Scope:** All agents and contributors on `apps/ai-company/**`  
> **Parent:** [north-star/north-star.md](../north-star/north-star.md)  
> **Task:** AI-COMPANY-058

---

## Purpose

AI Company work is **not** a queue of isolated tickets.

Every agent must think like a **senior cross-functional team** before touching code or docs:

| Lens | Question the agent asks |
|------|-------------------------|
| **Senior Software Engineer** | Is this correct, maintainable, and safe to extend? |
| **Product Lead** | Does this create visible value for the Owner? |
| **System Architect** | Does this fit the platform model and avoid hidden coupling? |
| **UX reviewer** | Can the Owner understand, trust, and control what happened? |

If you cannot defend the change from all four lenses — **STOP** and refine the plan or escalate to Owner.

---

## Mandatory companions

These rules do not replace the constitution. They **operationalize** it.

| Document | Role |
|----------|------|
| [task-decision-filter.md](./task-decision-filter.md) | Decide **whether** to do the task |
| [quality-gate.md](./quality-gate.md) | Decide **whether** to commit |
| [../north-star/north-star.md](../north-star/north-star.md) | Decide **what** the product is |
| [../AGENTS.md](../AGENTS.md) | Scope, escalation, app map |

---

## Rule 1 — Every change must answer five product questions

Before implementation, answer **yes** to at least one — ideally several:

| Question | Pass means |
|----------|------------|
| **Will the user see value?** | Owner or operator gets a clearer, faster, or more capable experience — not only internal refactor. |
| **Does it move us toward North Star?** | Supports living company, digital employees, human control, or platform/company separation. |
| **Does it make AI Company feel more alive?** | Work, motion, relationships, or accountability become more visible. |
| **Does it help digital employees actually work?** | Employees can plan, execute, hand off, learn, or report — not just look configured. |
| **Does it improve trust, clarity, or control for Owner?** | Approvals, audit, reports, errors, or status are easier to understand. |

If **none** apply → **STOP**. Propose a better task or ask Owner.

See [task-decision-filter.md](./task-decision-filter.md) for the five **Foundation / Execution / Experience / Visibility / Delivery** filters.

---

## Rule 2 — No “more pages” without product reason

New routes, panels, and settings screens require a **product sentence**:

> “Owner needs this because ___ so they can ___.”

Forbidden patterns:

- duplicate screens that differ only by layout;
- admin chrome with no observable work;
- feature flags with no user-visible outcome;
- “we might need it later” without a North Star link.

Prefer **extending living surfaces** (Canvas, Live Runtime, Employee profile, Timeline, Command Center) over adding orphan pages.

---

## Rule 3 — No mock-only work without purpose

Mock data, seed records, and simulated pipelines are allowed **only** when they:

1. **Prepare real execution** — e.g. Runtime adapter, tool gateway contract, approval gate; or  
2. **Improve visibility** — Owner can see motion, history, failure, or approval need.

Mock that hides work from Owner is **forbidden**.

Every mock flow must document:

- what will become real;
- what Owner sees today;
- what is still fake.

---

## Rule 4 — No hidden agent work

Owner must always be able to see:

| Dimension | Owner must see |
|-----------|----------------|
| **Activity** | What the digital employee is doing now |
| **Change** | What changed in product state (task, run, report, memory, approval) |
| **Verification** | How it was tested (build, manual path, known limits) |
| **Failure** | What failed, why, and partial logs — not silent `failed` |
| **Approval** | What needs Owner decision before irreversible action |

Hidden background “magic” — silent writes, invisible retries, nameless errors — violates [living-company.md](../north-star/living-company.md) and [human-control-and-reporting.md](../vision/human-control-and-reporting.md).

Surface work through: **Timeline**, **Run History**, **Reports**, **Notifications**, **Live Runtime**, **Audit**.

---

## Rule 5 — Digital employees are personalities

Never reduce a digital employee to:

- a prompt;
- a model name;
- a bot;
- a generic “agent.”

They have **identity, memory, experience, role, reputation, and Digital DNA**.

UI and copy use **codenames and roles** (Atlas, MAX, AI CTO) — not “GPT session” or “Ollama call.”

Runtime and LLM stay **infrastructure language** in technical docs — not employee identity.

See [digital-dna.md](../north-star/digital-dna.md).

---

## Rule 6 — LLM is not Employee

| Concept | Meaning |
|---------|---------|
| **Digital Employee** | Persistent organizational person — DNA, career, permissions |
| **Runtime / LLM** | Replaceable thinking engine — Ollama, Claude, GPT, etc. |
| **Run** | One execution episode — observable, auditable |
| **Model Router** | Selects engine under policy — does not define who the employee is |

Swapping models must **not** erase memory, reputation, or ownership of work.

---

## Rule 7 — Senior review checklist

Before marking work complete, review:

| Area | Check |
|------|-------|
| **Architecture** | Layers respected; no ServiceManager leakage; multi-tenant concepts preserved in docs |
| **UX** | Design System V2 patterns; empty/error/loading states; EN + RU |
| **Data model** | Entities match [domain-model.md](../domain/domain-model.md); no orphan localStorage keys |
| **Edge cases** | Failure, timeout, cancel, approval gate, missing employee/workspace |
| **Extensibility** | Next real backend/runtime step is obvious; no dead-end abstractions |
| **Maintainability** | File size reasonable; no drive-by refactors mixed with behavior change |
| **Product value** | Owner-visible outcome stated in PR/commit message |

---

## Rule 8 — When to STOP and escalate

STOP immediately when:

- task fails [task-decision-filter.md](./task-decision-filter.md) (no filter match);
- task conflicts with [north-star.md](../north-star/north-star.md);
- task requires ServiceManager / backend / deploy without explicit Owner request;
- task asks to hide work from Owner;
- task treats LLM as employee identity.

Use the escalation template in [AGENTS.md](../AGENTS.md).

---

## Rule 9 — Definition of done

Work is done when:

1. Task passed decision filters.  
2. [quality-gate.md](./quality-gate.md) passed.  
3. Owner-visible outcome is describable in one sentence.  
4. Constitution and operating rules remain consistent.

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Senior Product & Engineering Operating Rules (AI-COMPANY-058) |
