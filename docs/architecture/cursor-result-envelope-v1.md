# AI-COMPANY-110 — Unified Cursor Result Envelope V1

> **Status:** Implemented (domain contract)
> **Basis:** [cursor-execution-path-c-v1.md](./cursor-execution-path-c-v1.md), [cursor-execution-route-policy-v1.md](./cursor-execution-route-policy-v1.md)
> **Date:** 2026-07-14

---

## 1. Purpose

Single normalized domain contract for Cursor execution results across Path C routes:

| Route | Role |
|-------|------|
| `LOCAL_CURSOR_BRIDGE` | Primary automated — outbox / bridge ingest |
| `MANUAL_CLOUD_AGENT` | Operator import — branch, commit, PR |
| `CURSOR_AUTOMATION_WEBHOOK` | Enqueue only — HTTP 200 ≠ success |

**Orthogonal dimensions:**

- **Transport** — did the external surface accept the handoff?
- **Execution** — did verifiable work complete?
- **Review** — did Builder / MAX accept the outcome?

---

## 2. Module location

```
apps/ai-company/src/domain/cursorResultEnvelope/
  cursorResultEnvelopeTypes.ts
  cursorResultEnvelopeValidation.ts
  cursorResultEnvelopeFactories.ts
  cursorResultEnvelopeSerialization.ts
  cursorResultEnvelopeAdapters.ts
  cursorResultEnvelope.test.ts
  index.ts
```

**Related (unchanged):** `domain/cursorResult/` — legacy 113F outbox schema + ingest pipeline. Adapter: `normalizeLegacyOutboxEnvelope()`.

---

## 3. Status enums

### Execution (`CursorExecutionStatus`)

| Status | Meaning |
|--------|---------|
| `RESULT_PENDING` | Awaiting result / reconciliation |
| `SUCCEEDED` | Verifiable execution evidence present |
| `FAILED` | Terminal execution or transport failure |
| `CANCELLED` | Cancelled before success |
| `TIMED_OUT` | SLA / reconciliation timeout |

### Transport (`CursorTransportStatus`)

| Status | Meaning |
|--------|---------|
| `NOT_DISPATCHED` | No transport handoff yet |
| `DISPATCHED` | Transport accepted (incl. webhook HTTP 200) |
| `TRANSPORT_FAILED` | Transport rejected / errored |

### Review (`CursorReviewStatus`)

| Status | Meaning |
|--------|---------|
| `NOT_REQUIRED` | No review gate yet |
| `PENDING` | Awaiting Builder / MAX |
| `APPROVED` | Review accepted |
| `REJECTED` | Review rejected — **does not rewrite execution success** |

---

## 4. Envelope contract

The envelope is **route-neutral**. `ExecutionResultEnvelope` carries the result of any
execution route; `CursorResultEnvelope` is its Cursor Path C narrowing.

```typescript
type ExecutionResultEnvelope = {
  toolExecutionRunId: string
  route: ExecutionRouteId          // superset: Cursor routes + LOCAL_OLLAMA_ANALYSIS
  transportStatus: CursorTransportStatus
  executionStatus: CursorExecutionStatus
  reviewStatus: CursorReviewStatus
  summary: string | null
  branch: string | null
  commitSha: string | null
  pullRequestUrl: string | null
  changedFiles: string[]
  checks: CursorCheckResult[]
  artifacts: CursorRepositoryArtifact[]
  errors: CursorExecutionError[]
  externalCorrelationId: string | null  // e.g. backgroundComposerId
  startedAt: string | null
  finishedAt: string | null
  metadata: Record<string, unknown>
}

type CursorResultEnvelope = Omit<ExecutionResultEnvelope, 'route'> & {
  route: CursorExecutionRouteId
}
```

### Why `Omit`, not an intersection

`{ route: ExecutionRouteId } & { route: CursorExecutionRouteId }` types the property as
the *intersection* of both unions. That reads as `CursorExecutionRouteId` today, but
collapses to `never` the moment the two sets stop overlapping — silently, at every
construction site. `Omit` + a re-declared property states the narrowing outright and
fails loudly instead.

### Repository fields are optional, not degraded

`branch`, `commitSha`, `pullRequestUrl` were already nullable and `changedFiles` /
`artifacts` already default to empty. `hasExecutionEvidence` accepts a single non-empty
`summary`, so a local analysis result — a written finding and nothing else — is a
complete `SUCCEEDED` envelope, not a partial one. No invariant has ever required a
repository artefact.

### Route identifiers

`ExecutionRouteId` and `CursorExecutionRouteId` live in `domain/executionRoute/`, where a
compile-time `_subsetCheck` proves the Cursor tuple is a subset of the platform one.
Route policy and cost guard in `domain/cursorExecutionRoute/` keep operating over the
Cursor subset alone — both of their route switches carry a `default` branch and would
absorb an unknown route silently.

---

## 5. Invariants

| Rule | Enforcement |
|------|-------------|
| Webhook HTTP 200 | `createPendingAutomationEnvelope()` → `DISPATCHED` + `RESULT_PENDING` only |
| `backgroundComposerId` | Stored **only** as `externalCorrelationId` |
| `SUCCEEDED` | Requires `finishedAt`, execution evidence, no terminal errors, `transportStatus !== NOT_DISPATCHED` |
| `TRANSPORT_FAILED` | Requires `executionStatus = FAILED` |
| Review rejection | `applyBuilderReview` / `applyMaxReview` change `reviewStatus` only |
| Webhook enqueue | `metadata.enqueueOnly: true` blocks `SUCCEEDED` until reconciled (clear flag via future factory) |
| `commitSha` | 7–40 hex chars when present |
| `pullRequestUrl` | Valid HTTP(S) PR/MR URL when present |

---

## 6. Factories

| Function | Route | Output |
|----------|-------|--------|
| `createAnalysisResultEnvelope()` | `LOCAL_OLLAMA_ANALYSIS` | Local model run — summary as evidence, no repository artefacts, returns `ExecutionResultEnvelope` |
| `createPendingAutomationEnvelope()` | `CURSOR_AUTOMATION_WEBHOOK` | Enqueue pending |
| `createTransportFailureEnvelope()` | any | Transport failed |
| `normalizeLocalBridgeResult()` | `LOCAL_CURSOR_BRIDGE` | Bridge payload → envelope |
| `normalizeManualCloudAgentResult()` | `MANUAL_CLOUD_AGENT` | Import form → envelope |
| `applyBuilderReview()` | any | Review update only |
| `applyMaxReview()` | any | Review update only |
| `normalizeLegacyOutboxEnvelope()` | `LOCAL_CURSOR_BRIDGE` | 113F adapter |

---

## 7. Normalization by route

### LOCAL_CURSOR_BRIDGE

Input: `CursorLocalResultPayload` (113E bridge) or legacy 113F outbox via adapter.

- `completed` → `SUCCEEDED`, `reviewStatus: PENDING`
- `failed` → `FAILED` with preserved errors
- `partial` → `RESULT_PENDING`

### MANUAL_CLOUD_AGENT

Input: branch, commitSha, optional PR, changedFiles, checks, summary.

- Populates repository artifacts
- Validates SHA / PR URL on success

### CURSOR_AUTOMATION_WEBHOOK

Input: HTTP 200 response with `backgroundComposerId`.

- **Never** auto-`SUCCEEDED`
- `externalCorrelationId = backgroundComposerId`
- `metadata.enqueueOnly = true`

---

## 8. Review semantics

```text
executionStatus: SUCCEEDED
reviewStatus: PENDING → applyBuilderReview(APPROVED) → APPROVED
reviewStatus: PENDING → applyBuilderReview(REJECTED) → REJECTED
executionStatus remains SUCCEEDED in both cases
```

MAX review uses `applyMaxReview()` with the same isolation rule.

---

## 9. Examples

### Webhook enqueue (HTTP 200)

```json
{
  "toolExecutionRunId": "terun-abc",
  "route": "CURSOR_AUTOMATION_WEBHOOK",
  "transportStatus": "DISPATCHED",
  "executionStatus": "RESULT_PENDING",
  "reviewStatus": "NOT_REQUIRED",
  "externalCorrelationId": "bc-smoke-001",
  "finishedAt": null,
  "metadata": { "enqueueOnly": true }
}
```

### Manual Cloud Agent success

```json
{
  "route": "MANUAL_CLOUD_AGENT",
  "transportStatus": "DISPATCHED",
  "executionStatus": "SUCCEEDED",
  "reviewStatus": "PENDING",
  "branch": "feature/cursor-manual",
  "commitSha": "abc1234567890",
  "pullRequestUrl": "https://github.com/org/repo/pull/42",
  "finishedAt": "2026-07-14T10:00:00.000Z"
}
```

### Execution success + review rejected

```json
{
  "executionStatus": "SUCCEEDED",
  "reviewStatus": "REJECTED",
  "metadata": {
    "review": {
      "builder": { "decision": "REJECTED", "notes": "Missing tests" }
    }
  }
}
```

---

## 10. Integration (minimal)

| Adapter | Location | Behavior |
|---------|----------|----------|
| `mapEnvelopeToToolResultOutput()` | `cursorResultEnvelopeAdapters.ts` | Attach envelope to `ToolResult.output` |
| `readEnvelopeFromToolResult()` | same | Read back from dispatch result |
| `normalizeLegacyOutboxEnvelope()` | factories | Bridge from 113F without changing ingest |

**Not changed:** Tool Dispatcher route policy, Cost Guard, `toolDispatcherDispatch.ts` decision logic, UI, webhook transport.

---

## 11. Known gaps

| Gap | Next slice |
|-----|------------|
| Webhook reconciliation → `SUCCEEDED` factory | AI-COMPANY-113 automation adapter |
| Persist envelope on `ToolExecutionRun` | DB migration phase |
| Auto attach on dispatch | Wire `mapEnvelopeToToolResultOutput` in dispatcher when approved |
| 113F ingest uses unified envelope internally | Optional refactor — adapter ready |
| No caller produces an analysis envelope yet | Needs `ollama` in `TOOL_DISPATCHER_TOOL_IDS` + a dispatcher branch |
| `checksPassed` conflates "not required" with "failed" | Commit 6 — `checksOutcome` with four states |
| `transportStatus` has no marker for a local call | Commit 7 — `metadata.transportKind: 'local_inprocess'`; the enum is deliberately not extended |

**Closed since v1:** manual import HTTP endpoint (AI-COMPANY-112); the parser route
allow-list, which was the single blocker for non-Cursor routes.

---

## 12. Tests

```bash
npm --prefix apps/ai-company run test:domain
```

16 scenarios in `cursorResultEnvelope.test.ts` covering all required cases.

---

## 13. Next slice

**AI-COMPANY-111 — Manual Cloud Agent Result Import:** HTTP/UI import endpoint calling `normalizeManualCloudAgentResult()` + existing review pipeline.
