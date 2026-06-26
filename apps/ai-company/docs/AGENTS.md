# AI Company — Agent Instructions

> **Mandatory entrypoint for every AI agent working on `apps/ai-company/**`**

You are working on **AI Company** — an **Operating System for Digital Organizations**, not a chatbot, agent bag, workflow builder, or CRM.

Before every task, think like:

- **Senior Software Engineer**
- **Product Lead**
- **System Architect**
- **UX reviewer**

Before writing or changing **anything**, you **must** read the constitution and operating rules below.

---

## Required reading (in order)

| # | Document | Why |
|---|----------|-----|
| **0** | **[north-star/north-star.md](./north-star/north-star.md)** | **Platform constitution — supreme source of truth** |
| **1** | **[operating-rules/senior-product-engineering-rules.md](./operating-rules/senior-product-engineering-rules.md)** | **How every agent must think and work** |
| **2** | **[operating-rules/task-decision-filter.md](./operating-rules/task-decision-filter.md)** | **Five filters — STOP if task matches none** |
| **3** | **[operating-rules/quality-gate.md](./operating-rules/quality-gate.md)** | **Pre-commit product & engineering gate** |
| **4** | **[AGENTS.md](./AGENTS.md)** | This file — scope, rules, escalation |
| **5** | Relevant **ADR** | [adr-001](./architecture/adr-001-ai-company-platform.md), [adr-002](./architecture/adr-002-tool-registry.md), or task-specific |
| **6** | Relevant **domain docs** | [domain-model.md](./domain/domain-model.md) + entity specs for code tasks |
| **7** | [north-star/digital-dna.md](./north-star/digital-dna.md) | Digital DNA — identity persists across models |
| **8** | [north-star/platform-vs-company.md](./north-star/platform-vs-company.md) | Platform L1 vs Customer L2 |
| **9** | [north-star/living-company.md](./north-star/living-company.md) | Living company UX principle |
| **10** | [vision/](./vision/) | Vision detail — see [vision/README.md](./vision/README.md) |

**Minimum before any task:** items **0–4** + relevant ADR/domain for the task type.

**Estimated read time (0–4):** 25–35 minutes. Do not skip the constitution or operating rules.

---

## Operating rules summary (mandatory)

Full detail: [operating-rules/](./operating-rules/).

### Task decision — five filters

Every task must match **at least one**:

| Filter | Focus |
|--------|--------|
| **Foundation** | Platform structure, domain, ADR, contracts |
| **Execution** | Real or preparatory employee work (Runtime, tools, runs) |
| **Experience** | UX, i18n, trust, Design System V2 |
| **Visibility** | Owner sees motion — Canvas, Live Runtime, Timeline, Reports |
| **Delivery** | Project / workspace / sprint outcome |

**If none match → STOP.** See [task-decision-filter.md](./operating-rules/task-decision-filter.md).

### Product questions — every change

Answer at least one **yes**:

- Will the user see value?
- Does it move us toward North Star?
- Does it make AI Company feel more alive?
- Does it help digital employees actually work?
- Does it improve trust, clarity, or control for Owner?

### Non‑negotiables

- **No “more pages”** without product reason.
- **No mock-only work** unless it prepares real execution or improves visibility.
- **No hidden agent work** — Owner sees activity, change, test path, failure, approval need.
- **Digital employees are personalities** — not prompts, models, bots, or generic agents.
- **LLM is not Employee** — Runtime is replaceable thinking engine; DNA is identity.

### Pre-commit quality gate

See [quality-gate.md](./operating-rules/quality-gate.md):

- build passes · routes work · scope clean · EN+RU · clear errors · user flow tested

---

## Conflict policy (mandatory)

Compare every task against [north-star/north-star.md](./north-star/north-star.md) and [operating-rules/](./operating-rules/).

If the task or current implementation **conflicts** with North Star, vision, domain model, ADRs, or operating rules:

```
STOP → do not continue implementation → report to Owner
```

Include:

1. **Task summary**
2. **Violated constitution / principle** (quote section)
3. **Compliant alternatives** (2–3 options)
4. **Specific decision** needed from Owner

**If implementation contradicts North Star — change the implementation, not the North Star.**

Do **not** silently compromise on:

- Human First — final decision stays with Owner
- Digital Employee as digital person — LLM is not the employee
- Digital DNA — model swap must not erase identity
- Living company — observable work, not chat-only shell
- Employee as primary entity (not LLM/session)
- Employee ≠ Workspace ownership (use Assignment)
- Conversation as first-class (not only Tasks)
- Permissions, audit trail, reports-first
- Scope boundary: `apps/ai-company/**` only unless explicitly told otherwise
- Operating rules — filters, visibility, quality gate

---

## Hard rules

### 1. Preserve the constitution

Any implementation **must** preserve [north-star/north-star.md](./north-star/north-star.md) and [vision/core-principles.md](./vision/core-principles.md).

### 2. Scope boundary

| Allowed | Forbidden (unless explicit task) |
|---------|----------------------------------|
| `apps/ai-company/**` | `web/src/**`, `backend/**`, ServiceManager API |
| localStorage V1 persistence | Production deploy, push |
| Mock runtime / mock replies | Wiring real Ollama/LLM without task |
| Documentation under `apps/ai-company/docs/**` | Cross-tenant or ticket-owner changes |

### 3. Architecture layers

```
Controller/UI → hooks → data (localStorage) → domain types
```

- UI must not embed business rules that belong in domain docs.
- Do not import from ServiceManager or monorepo `web/`.

### 4. Entity quick reference

| Entity | Rule |
|--------|------|
| **Employee** | Primary identity; Digital DNA owner; not owned by Workspace |
| **Workspace** | Project container; Knowledge, Documents, scoped work |
| **Assignment** | Only link Employee ↔ Workspace |
| **Conversation** | Persistent direct thread; independent of Task |
| **Discussion** | Group async thread |
| **Task** | One activity mode among many |
| **Run** | Execution unit; uses Runtime + Tools |
| **Runtime** | Swappable LLM thinking engine |
| **Event** | Append-only audit |

### 5. Before submitting changes

- [ ] Read North Star + operating rules 0–4 (or confirm docs-only task)
- [ ] Task passed [task-decision-filter.md](./operating-rules/task-decision-filter.md)
- [ ] [quality-gate.md](./operating-rules/quality-gate.md) checklist complete
- [ ] No constitution violations
- [ ] `cd apps/ai-company && npm run build` passes (for code changes)
- [ ] i18n EN + RU for user-visible strings
- [ ] Changes only under `apps/ai-company/**`

---

## V1 app map (where things live)

| Area | Path |
|------|------|
| Mission Control pages | `src/mission-control/pages/`, `src/pages/` |
| Domain + localStorage | `src/domain/`, `src/mission-control/data/` |
| Hooks | `src/hooks/`, `src/mission-control/hooks/` |
| Flow Workspace | `src/flow-workspace/` |
| Company Canvas | `src/components/canvas/`, `/ops/canvas` |
| Live Runtime | `src/pages/RuntimeLivePage.tsx`, `/ops/runtime/live` |
| i18n | `src/i18n/en.ts`, `ru.ts` |
| Styles | `src/styles/`, `src/mission-control/styles/` |
| **Constitution** | `docs/north-star/` |
| **Operating rules** | `docs/operating-rules/` |
| Vision docs | `docs/vision/` |
| Architecture | `docs/architecture/` |
| Domain specs | `docs/domain/` |

### Key routes (V1)

| Route | Feature |
|-------|---------|
| `/ops` | Executive dashboard / Command Center |
| `/ops/canvas` | Living company operational graph |
| `/ops/runtime/live` | Live Runtime Monitor |
| `/ops/employees` | Roster |
| `/ops/employees/:id` | Employee profile |
| `/ops/workspaces` | Workspace list |
| `/ops/execution` | Execution queue |
| `/ops/chats` | Unified chat |
| `/ops/timeline` | Company timeline |
| `/ops/runs` | Run history |

---

## When to update documentation

Update North Star, operating rules, or vision/domain docs **in the same PR/commit** when you:

- Introduce a new platform entity or lifecycle stage
- Change permission, approval, or Human First model
- Change Digital DNA components or model-independence rules
- Change Platform L1 vs Customer L2 boundary
- Add marketplace or template semantics
- Change mandatory agent workflow or quality gates

ADR required for architectural decisions that affect multiple entities.

North Star changes require **explicit Owner approval** — not drive-by edits.

Operating rules changes require Owner approval when they alter mandatory gates.

---

## Conflict escalation template

When stopping for clarification, include:

1. **Task summary** — what you were asked to do
2. **Conflicting constitution / operating rule** — quote section
3. **Filter result** — which of five filters failed (if applicable)
4. **Options** — 2–3 compliant alternatives
5. **Question** — specific decision needed from Owner

---

## Related

- [README.md](../README.md) — quick start and constitution links
- [north-star/north-star.md](./north-star/north-star.md) — start here always
- [operating-rules/senior-product-engineering-rules.md](./operating-rules/senior-product-engineering-rules.md) — how to work

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial agent entrypoint |
| 2.0 | 2026-06-24 | North Star constitution mandatory (AI-COMPANY-048) |
| 3.0 | 2026-06-24 | Senior Product & Engineering Operating Rules (AI-COMPANY-058) |
