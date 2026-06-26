# AI Company — Agent Instructions

> **Mandatory entrypoint for every AI agent working on `apps/ai-company/**`**

You are working on **AI Company** — an **Operating System for Digital Organizations**, not a chatbot, agent bag, workflow builder, or CRM.

Before writing or changing **anything**, you **must** read the constitution and linked documents below.

---

## Required reading (in order)

| # | Document | Why |
|---|----------|-----|
| **0** | **[north-star/north-star.md](./north-star/north-star.md)** | **Platform constitution — supreme source of truth** |
| 1 | [north-star/digital-dna.md](./north-star/digital-dna.md) | Digital DNA — identity persists across models |
| 2 | [north-star/platform-vs-company.md](./north-star/platform-vs-company.md) | Platform L1 vs Customer L2 |
| 3 | [north-star/living-company.md](./north-star/living-company.md) | Living company UX principle |
| 4 | [vision/](./vision/) | All vision docs — see [vision/README.md](./vision/README.md) |
| 5 | [architecture/adr-001-ai-company-platform.md](./architecture/adr-001-ai-company-platform.md) | Platform ADR |
| 6 | [architecture/adr-002-tool-registry.md](./architecture/adr-002-tool-registry.md) | Tool Registry ADR |
| 7 | [AGENTS.md](./AGENTS.md) | This file — scope, rules, escalation |
| 8 | [domain/domain-model.md](./domain/domain-model.md) | Entity catalog (for code tasks) |

**Minimum before any task:** `north-star.md` + relevant north-star/vision sections + ADR-001 + ADR-002.

**Estimated full read time:** 35–50 minutes. Do not skip the constitution.

---

## Conflict policy (mandatory)

Compare every task against [north-star/north-star.md](./north-star/north-star.md).

If the task or current implementation **conflicts** with North Star, vision, domain model, or ADRs:

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

- [ ] Read North Star + required docs (or confirm task is constitution/docs-only)
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
| i18n | `src/i18n/en.ts`, `ru.ts` |
| Styles | `src/styles/` |
| **Constitution** | `docs/north-star/` |
| Vision docs | `docs/vision/` |
| Architecture | `docs/architecture/` |
| Domain specs | `docs/domain/` |

### Key routes (V1)

| Route | Feature |
|-------|---------|
| `/ops` | Executive dashboard |
| `/ops/canvas` | Living company operational graph |
| `/ops/employees` | Roster |
| `/ops/employees/:id` | Employee profile |
| `/ops/workspaces` | Workspace list |
| `/ops/execution` | Execution queue |
| `/ops/chats` | Unified chat |

---

## When to update documentation

Update North Star or vision/domain docs **in the same PR/commit** when you:

- Introduce a new platform entity or lifecycle stage
- Change permission, approval, or Human First model
- Change Digital DNA components or model-independence rules
- Change Platform L1 vs Customer L2 boundary
- Add marketplace or template semantics

ADR required for architectural decisions that affect multiple entities.

North Star changes require **explicit Owner approval** — not drive-by edits.

---

## Conflict escalation template

When stopping for clarification, include:

1. **Task summary** — what you were asked to do
2. **Conflicting constitution** — quote North Star / principle / ADR section
3. **Options** — 2–3 compliant alternatives
4. **Question** — specific decision needed from Owner

---

## Related

- [README.md](../README.md) — quick start and constitution links
- [north-star/north-star.md](./north-star/north-star.md) — start here always

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial agent entrypoint |
| 2.0 | 2026-06-24 | North Star constitution mandatory (AI-COMPANY-048) |
