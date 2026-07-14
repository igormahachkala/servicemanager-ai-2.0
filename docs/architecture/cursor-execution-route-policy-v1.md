# AI-COMPANY-109 — Cursor Execution Route Policy + Cost Guard V1

> **Status:** Implemented (domain slice)  
> **Basis:** [cursor-execution-path-c-v1.md](./cursor-execution-path-c-v1.md)  
> **Date:** 2026-07-14

---

## 1. Implemented scope

| Component | Location | Role |
|-----------|----------|------|
| `ExecutionRoute` | `cursorExecutionRouteTypes.ts` | Route enum (3 values) |
| `CostClassification` | `cursorExecutionRouteTypes.ts` | Cost guard states |
| `CursorExecutionReasonCode` | `cursorExecutionRouteTypes.ts` | Strict reason codes |
| Route Policy | `cursorExecutionRoutePolicy.ts` | Deterministic route selection |
| Cost Guard | `cursorCostGuard.ts` | Cost + production policy gate |
| Preflight | `cursorExecutionRoutePreflight.ts` | Policy + guard merge |
| Dispatch mapper | `routePolicyFromDispatchInput.ts` | `DispatchToolRequestInput` → policy input |
| Observability | `cursorExecutionRouteObservability.ts` | Structured route events |
| Dispatcher integration | `toolDispatcherDispatch.ts` | Preflight before cursor dispatch |

**Not implemented (by design):** webhook calls, Cloud Agents API, UI, migrations, manual import, reconciliation, actual Cursor launch.

---

## 2. Decision inputs

`CursorRoutePolicyInput`:

| Field | Purpose |
|-------|---------|
| `taskType` | Task classification (from action or payload) |
| `requiresAutomaticExecution` | Prefer Local Bridge when true |
| `requiresRepositoryWrite` | Triggers production approval rules |
| `requiresCommitOrPullRequest` | Excludes Local Bridge; prefers Manual |
| `requiresReliableCompletion` | Excludes Automation Webhook |
| `eventDriven` | Enables Automation Webhook candidate |
| `localBridgeAvailable` | Local Bridge eligibility |
| `manualOperatorAvailable` | Manual Cloud Agent eligibility |
| `automationWebhookAvailable` | Webhook eligibility (default false) |
| `ownerApprovalGranted` | Owner approval state |
| `expectedCostClassificationByRoute` | Per-route cost map |
| `environment` | `dev` \| `stage` \| `production` |

Dispatch payload may override any field. Env fallbacks:

- `VITE_AI_COMPANY_ENVIRONMENT` → environment (default `dev`)
- `VITE_CURSOR_AUTOMATION_WEBHOOK_AVAILABLE` → webhook availability (default false)

---

## 3. Selection priority

```text
1. LOCAL_CURSOR_BRIDGE   — automatic + bridge available + no PR-only + cost-safe
2. MANUAL_CLOUD_AGENT    — PR/commit path, bridge unavailable, or non-automatic
3. CURSOR_AUTOMATION_WEBHOOK — event-driven, non-critical, webhook available, cost-safe
```

If no route eligible → `ROUTE_UNAVAILABLE` or `NO_COST_SAFE_ROUTE`.

---

## 4. Cost rules

| Classification | Automatic dispatch |
|----------------|------------------|
| `INCLUDED_IN_SUBSCRIPTION` | Allowed (subject to route + approval) |
| `UNKNOWN_COST` | **Blocked** |
| `ADDITIONAL_COST_REQUIRED` | **Blocked** |
| `BLOCKED_BY_COST_POLICY` | **Excluded** |

No billing API, no credit purchase, no Max Mode toggles.

---

## 5. Environment rules

| Rule | Enforcement |
|------|-------------|
| Production repo write without approval | `PRODUCTION_POLICY_BLOCK` |
| Automation webhook in production | Blocked by policy |
| Direct deployment bypass | Out of scope — no deploy hooks added |
| Stage / DEV | Explicit `environment` value in policy input |

---

## 6. Reason codes

`COST_INCLUDED`, `COST_UNKNOWN`, `ADDITIONAL_COST_REQUIRED`, `BLOCKED_BY_COST_POLICY`, `OWNER_APPROVAL_REQUIRED`, `LOCAL_AUTOMATION_PREFERRED`, `MANUAL_OPERATOR_REQUIRED`, `RELIABLE_COMPLETION_REQUIRED`, `AUTOMATION_NOT_SUITABLE`, `ROUTE_UNAVAILABLE`, `PRODUCTION_POLICY_BLOCK`, `NO_COST_SAFE_ROUTE`.

---

## 7. Dispatcher integration

```text
dispatchToolRequest / dispatchToolRequestPlannedOnly
  → validateDispatchInput
  → (cursor only) evaluateCursorRoutePreflight
      → blocked + approval → planned / awaiting_owner
      → blocked + cost/policy → failed
      → allowed → continue existing flow (no Cursor launch)
  → attach routeDecision to ToolResult.output
```

`ToolExecutionRun` status transitions unchanged. Local Bridge approve→queue path in `toolExecutionRunStorage.ts` untouched.

---

## 8. Examples

### Local Bridge (DEV)

```json
{
  "selectedRoute": "LOCAL_CURSOR_BRIDGE",
  "allowed": true,
  "requiresOwnerApproval": false,
  "costClassification": "INCLUDED_IN_SUBSCRIPTION",
  "reasonCode": "LOCAL_AUTOMATION_PREFERRED"
}
```

### Manual without approval

```json
{
  "selectedRoute": "MANUAL_CLOUD_AGENT",
  "allowed": false,
  "requiresOwnerApproval": true,
  "reasonCode": "OWNER_APPROVAL_REQUIRED"
}
```

### No safe route

```json
{
  "selectedRoute": null,
  "allowed": false,
  "reasonCode": "NO_COST_SAFE_ROUTE"
}
```

---

## 9. Known gaps

| Gap | Notes |
|-----|-------|
| Route decision persistence | Stored in `ToolResult.output.routeDecision` only — no DB migration |
| `ToolExecutionRun.executionRoute` field | Future phase — not in v1 |
| Live bridge probe | `localBridgeAvailable` from payload/env default, not runtime health check |
| Webhook adapter | Policy ready; transport not wired |
| Canonical lifecycle states | v1 statuses (`awaiting_owner`, `approved`, …) unchanged |

---

## 10. Next implementation slice

1. **AI-COMPANY-110** — Result Envelope normalization across routes  
2. **AI-COMPANY-111** — Manual Cloud Agent result import  
3. **AI-COMPANY-112** — Local Bridge hardening + runtime probe  
4. **AI-COMPANY-113** — Optional Automation Webhook adapter (enqueue only)  
5. Persist `executionRoute` on `ToolExecutionRun` when migration approved  

---

## 11. Tests

```bash
npm --prefix apps/ai-company run test:domain
```

13 scenarios: policy (1–12) + dispatcher integration (13).
