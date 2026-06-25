# AI Company — Agent Instructions

> **Mandatory entrypoint for every AI agent working on `apps/ai-company/**`**

You are working on **AI Company** — an operating system for a digital organization, not a chatbot or prompt launcher. Before writing or changing code, you **must** read the documents below.

---

## Required reading (in order)

| # | Document | Why |
|---|----------|-----|
| 1 | [vision/ai-company-vision.md](./vision/ai-company-vision.md) | Product direction and non-goals |
| 2 | [vision/core-principles.md](./vision/core-principles.md) | 17 non-negotiable principles |
| 3 | [vision/digital-employee-model.md](./vision/digital-employee-model.md) | What an Employee is |
| 4 | [vision/human-control-and-reporting.md](./vision/human-control-and-reporting.md) | Approval, audit, reports-first |
| 5 | [vision/tools-mcp-and-access-model.md](./vision/tools-mcp-and-access-model.md) | Tools, MCP, two-level permissions |
| 6 | [vision/model-independence-and-experience.md](./vision/model-independence-and-experience.md) | Model Router, experience store |
| 7 | [vision/communication-model.md](./vision/communication-model.md) | Conversations and unified chat |
| 8 | [architecture/adr-001-ai-company-platform.md](./architecture/adr-001-ai-company-platform.md) | Platform ADR |
| 9 | [domain/domain-model.md](./domain/domain-model.md) | Entity catalog and flows |

**Estimated read time:** 25–40 minutes. Do not skip.

---

## Hard rules

### 1. Preserve principles

Any implementation **must** preserve the principles in [core-principles.md](./vision/core-principles.md).

If your task conflicts with vision, domain model, or ADR-001:

```
STOP → explain the conflict → ask the human owner for clarification
```

Do **not** silently compromise on:

- Human control and approval gates
- Employee as primary entity (not LLM/session)
- Employee ≠ Workspace ownership (use Assignment)
- Conversation as first-class (not only Tasks)
- Permissions and audit trail
- Scope boundary: `apps/ai-company/**` only unless explicitly told otherwise

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
| **Employee** | Primary identity; not owned by Workspace |
| **Workspace** | Project container; Knowledge, Documents, scoped work |
| **Assignment** | Only link Employee ↔ Workspace |
| **Conversation** | Persistent direct thread; independent of Task |
| **Discussion** | Group async thread |
| **Task** | One activity mode among many |
| **Run** | Execution unit; uses Runtime + Tools |
| **Runtime** | Swappable LLM engine |
| **Event** | Append-only audit |

### 5. Before submitting changes

- [ ] Read required docs (or confirm task is docs-only)
- [ ] No principle violations
- [ ] `cd apps/ai-company && npm run build` passes (for code changes)
- [ ] i18n EN + RU for user-visible strings
- [ ] Changes only under `apps/ai-company/**`

---

## V1 app map (where things live)

| Area | Path |
|------|------|
| Mission Control pages | `src/mission-control/pages/` |
| Domain data + localStorage | `src/mission-control/data/` |
| Hooks | `src/mission-control/hooks/` |
| Flow Workspace | `src/flow-workspace/` |
| i18n | `src/i18n/en.ts`, `ru.ts` |
| Styles | `src/mission-control/styles/mission-control.css` |
| Vision docs | `docs/vision/` |
| Architecture | `docs/architecture/` |
| Domain specs | `docs/domain/` |

### Key routes (V1)

| Route | Feature |
|-------|---------|
| `/ops/employees` | Roster |
| `/ops/employees/:id` | Employee profile |
| `/ops/employees/:id/conversation` | Direct conversation |
| `/ops/workspaces` | Workspace list |
| `/ops/workspaces/:id` | Workspace + assignments |
| `/ops/discussions` | Group discussions |

---

## When to update documentation

Update vision/domain docs **in the same PR/commit** when you:

- Introduce a new platform entity
- Change permission or approval model
- Add a new communication channel type
- Change Employee ↔ Workspace relationship

ADR required for architectural decisions that affect multiple entities.

---

## Conflict escalation template

When stopping for clarification, include:

1. **Task summary** — what you were asked to do
2. **Conflicting principle** — quote principle # or doc section
3. **Options** — 2–3 compliant alternatives
4. **Question** — specific decision needed from human

---

## Related

- [README.md](../README.md) — quick start and source-of-truth links
- [ai-company-vision.md](./vision/ai-company-vision.md) — start here if unsure

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial agent entrypoint |
