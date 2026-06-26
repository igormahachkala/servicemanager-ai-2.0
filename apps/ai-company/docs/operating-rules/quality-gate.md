# Product Quality Gate

> **Status:** Mandatory pre-commit gate · **Scope:** Every change on `apps/ai-company/**`  
> **Parent:** [senior-product-engineering-rules.md](./senior-product-engineering-rules.md)  
> **Task:** AI-COMPANY-058

---

## Purpose

**Build passing is necessary but not sufficient.**

Before commit, the agent acts as **release owner**: product, UX, architecture, and Owner trust.

---

## Pre-commit checklist (mandatory)

### Build & scope

| Check | Requirement |
|-------|-------------|
| ☐ **Build** | `cd apps/ai-company && npm run build` — green |
| ☐ **Routes** | New/changed routes registered; no broken links in nav or CTAs |
| ☐ **Scope** | Changes only under `apps/ai-company/**` |
| ☐ **No SM drift** | No ServiceManager / `web/` / `backend/` changes unless task explicitly requests |
| ☐ **No unrelated files** | No drive-by refactors, `.qa-tmp`, secrets, or accidental deps |

### UX & i18n

| Check | Requirement |
|-------|-------------|
| ☐ **Design System V2** | Uses Mission Control / AC patterns — panels, metrics, badges, `mc*` classes |
| ☐ **Russian UI** | Every new user-visible string in `en.ts` **and** `ru.ts` |
| ☐ **Error states** | Failures show clear message — timeout vs cancel vs network; not generic “error” |
| ☐ **Empty states** | New lists/panels explain what to do next |
| ☐ **Employee language** | Codenames and roles — not “LLM” or “bot” in product UI |

### Product & visibility

| Check | Requirement |
|-------|-------------|
| ☐ **Owner visibility** | Owner can see what changed — Timeline, Run, Report, or dedicated surface |
| ☐ **Test path** | Agent documents manual test path (route + action + expected result) |
| ☐ **Mock honesty** | Mock flows labeled; partial logs on failure where applicable |
| ☐ **Approval gates** | Protected actions still route through approval model in docs/code |

### Architecture & maintainability

| Check | Requirement |
|-------|-------------|
| ☐ **Layers** | UI → hooks → domain/storage — no business rules trapped in one-off components |
| ☐ **File size** | No file >800 lines; >500 lines needs split plan if touched |
| ☐ **Domain fit** | Entities align with [domain-model.md](../domain/domain-model.md) |
| ☐ **Digital DNA** | Employee identity not replaced by model/provider IDs in product copy |

---

## User-visible flow test (required for UI tasks)

For any user-facing change, verify:

1. **Entry** — how Owner reaches the feature (nav, link, Command Center)  
2. **Happy path** — primary action completes; result visible  
3. **Failure path** — error/timeout/cancel readable; run not silently lost  
4. **Integration links** — Run History, Timeline, Reports, Notifications where applicable  

No Playwright required in V1 — **manual path documented in commit or PR body**.

---

## Commit message bar

Commit message must imply **product value**, not only file list.

| Weak | Strong |
|------|--------|
| `update runtime files` | `feat(ai-company): add live runtime monitor for Owner visibility` |
| `fix stuff` | `fix(ai-company): distinguish Ollama timeout from user cancel` |
| `docs` | `docs(ai-company): add senior product engineering operating rules` |

---

## Senior review sign-off (agent self-review)

Before commit, confirm:

| Review area | Question |
|-------------|----------|
| Architecture | Will this complicate backend migration later? |
| UX | Would Owner understand without explanation? |
| Data model | Are IDs and storage keys coherent? |
| Edge cases | Timeout, empty roster, missing run, approval pending? |
| Extensibility | Is the next increment obvious? |
| Maintainability | Would another agent understand this in 6 months? |
| Product value | One-sentence Owner benefit? |

If any answer is weak — fix or scope down before commit.

---

## Forbidden commit patterns

- ❌ Build red or skipped  
- ❌ English-only UI strings  
- ❌ New route not in router / pageTitle / nav  
- ❌ Hidden localStorage writes with no UI  
- ❌ Mock execution without logs or pipeline steps  
- ❌ ServiceManager coupling “while we’re here”  
- ❌ Constitution or North Star contradiction  

---

## Relation to other gates

| Gate | When |
|------|------|
| [task-decision-filter.md](./task-decision-filter.md) | **Before** starting work |
| [north-star.md](../north-star/north-star.md) | **Always** — supreme law |
| [quality-gate.md](./quality-gate.md) | **Before** commit |
| [AGENTS.md](../AGENTS.md) | Scope + escalation anytime |

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Product quality gate (AI-COMPANY-058) |
