# Runtime Acceptance Criteria

> **Status:** Governance · Definition of Done for **production Runtime**  
> **Task:** AI-COMPANY-063  
> **Parent:** [Runtime domain spec](../../apps/ai-company/docs/domain/runtime.md) · [Model independence](../../apps/ai-company/docs/vision/model-independence-and-experience.md)

**Runtime** is the replaceable inference and tool execution engine. It is **not** the Employee.

This document defines when Runtime moves from **V1 mock** to **Production Ready (GA)** for customer companies.

---

## Scope

Applies to:

- Runtime orchestrator  
- Model Router  
- Provider adapters (Ollama, cloud APIs)  
- Tool Gateway invocation path  
- Run lifecycle UI (`/ops/runtime`, `/ops/runtime/runs/:id`)  

Does **not** replace [Digital Employee Acceptance](../employees/digital-employee-acceptance.md) — Employee must still have Runtime **profile** configured.

---

## Acceptance dimensions

### A. Identity & boundaries

| # | Criterion | Pass |
|---|-----------|------|
| A1 | Runtime does not store Employee or Workspace as owner | State in Run + context snapshot only |
| A2 | Run always references `employeeId`, `runtimeProfileId`, `modelId` | Traceable audit |
| A3 | Swapping model mid-policy does not mutate Employee DNA | Identity unchanged |
| A4 | Runtime never grants permissions — reads effective policy | Tool deny is explicit |

---

### B. Run lifecycle

| # | Criterion | Pass |
|---|-----------|------|
| B1 | States: queued → preparing → running → completed / failed / cancelled | Documented FSM |
| B2 | `waiting_approval` gate for restricted actions | Human First |
| B3 | Pipeline steps visible in UI with order + status | Live monitor |
| B4 | `startedAt`, `finishedAt`, duration recorded | Metrics |
| B5 | Idempotent recovery after client refresh | Run resumable view |
| B6 | Cancel and retry paths | Operator control |

**V1 mock partial:** localStorage runs — label as mock until B1–B6 on server.

---

### C. Context assembly

| # | Criterion | Pass |
|---|-----------|------|
| C1 | Context layers documented and loaded per policy | Employee, workspace, memory, knowledge, task, tools |
| C2 | Context snapshot stored on Run | Reproducibility |
| C3 | Token / size limits with truncation strategy | No silent drop |
| C4 | PII / secrets redaction before provider call | Security |
| C5 | Context build emits Event | Observable AI |

---

### D. Model Router

| # | Criterion | Pass |
|---|-----------|------|
| D1 | Route by policy: cost, locality, capability, health | Not hard-coded single model |
| D2 | Fallback when primary unhealthy | Degraded mode |
| D3 | Provider health in Tools Registry | Status visible |
| D4 | Employee preference honored within policy | Owner override possible |
| D5 | Router decision logged on Run | Explainability |

---

### E. Tool Gateway

| # | Criterion | Pass |
|---|-----------|------|
| E1 | Tools invoked only through gateway | No direct MCP bypass |
| E2 | Permission check before invoke | Two-level permissions |
| E3 | Tool execution status tracked | Tool Executions page |
| E4 | Approval required tools pause Run | Aligns with approval engine |
| E5 | Tool results attached to Run result | Reports can cite |

See [ADR-002 Tool Registry](../../apps/ai-company/docs/architecture/adr-002-tool-registry.md).

---

### F. Observability

| # | Criterion | Pass |
|---|-----------|------|
| F1 | Structured logs per Run | Runtime logs panel |
| F2 | Events for start, complete, fail, approval | Company timeline |
| F3 | Warnings surface in UI | Not log-only |
| F4 | Live stream for active runs | Live Runtime Monitor |
| F5 | Metrics: latency, tokens, cost estimate | Run detail |

---

### G. Human gates

| # | Criterion | Pass |
|---|-----------|------|
| G1 | Production deploy requires approval | Existing approval types |
| G2 | Permission elevation requires approval | |
| G3 | Owner can approve from Run UI | One-click mock → real |
| G4 | Denied approval cancels or pauses Run | Clear outcome |
| G5 | Approval linked in audit trail | |

---

### H. Reports & outcomes

| # | Criterion | Pass |
|---|-----------|------|
| H1 | Run may produce Report artifact | `reportId` on Run |
| H2 | Report linked from Run detail | |
| H3 | Failed runs still produce diagnostic summary | No silent fail |
| H4 | Reports-first: outcome readable by Owner | |

---

### I. Provider adapters

| # | Criterion | Pass |
|---|-----------|------|
| I1 | Ollama adapter (local) | Health probe |
| I2 | ≥1 cloud adapter | Configurable keys |
| I3 | Adapter version pinned | Reproducible runs |
| I4 | Streaming tokens to UI (when applicable) | |
| I5 | Graceful offline provider | Queue or fail clear |

---

### J. Multi-tenant readiness (2029 gate)

| # | Criterion | Pass |
|---|-----------|------|
| J1 | Runs scoped by `companyId` | No cross-tenant |
| J2 | Provider credentials tenant-isolated | |
| J3 | Usage metering hooks | Billing ready |

---

## Readiness levels

| Level | Description | Typical date |
|-------|-------------|--------------|
| **RT0 Mock** | localStorage orchestrator, mock inference | 2026 (current) |
| **RT1 Alpha** | Real Ollama path, single tenant | 2027 H1 |
| **RT2 Beta** | Router + Gateway + approval gates | 2027 H2 |
| **RT3 GA** | All A–I pass, production SLO | 2028 |
| **RT4 Cloud** | J1–J3 for SaaS | 2029 |

---

## GA sign-off checklist

```markdown
## Runtime GA Review
**Date:** YYYY-MM-DD  
**Target:** RT3

| Section | Pass | Blockers |
|---------|------|----------|
| A Identity | ☐ | |
| B Lifecycle | ☐ | |
| C Context | ☐ | |
| D Router | ☐ | |
| E Tools | ☐ | |
| F Observability | ☐ | |
| G Human gates | ☐ | |
| H Reports | ☐ | |
| I Adapters | ☐ | |
| J Multi-tenant | ☐ N/A until cloud |

**Owner sign-off:** ☐
```

---

## V1 mock explicit non-claims

Until **RT1**, Runtime UI **must** communicate:

- inference is simulated or local-only  
- tool calls may not hit real infrastructure  
- runs stored in browser localStorage  

Register gaps in [UX Debt](../design/ux-debt.md) if labeling missing.

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Runtime acceptance criteria (AI-COMPANY-063) |
