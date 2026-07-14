# AI-COMPANY-111 — Manual Cloud Agent Result Import V1

> **Status:** Implemented (domain/application)
> **Basis:** [cursor-execution-path-c-v1.md](./cursor-execution-path-c-v1.md), [cursor-result-envelope-v1.md](./cursor-result-envelope-v1.md), [cursor-execution-route-policy-v1.md](./cursor-execution-route-policy-v1.md)
> **Date:** 2026-07-14

---

## 1. Purpose

V1 import flow for **MANUAL_CLOUD_AGENT** operator results. AI Company accepts a structured manual payload, normalizes it into **CursorResultEnvelope**, binds it to an existing **ToolExecutionRun**, and routes successful execution into **Builder Review** without treating import as final business success.

**Explicitly out of scope:** launching Cursor, webhooks, Cloud Agents API, polling, GitHub discovery, UI, DB migrations.

---

## 2. Module location

```
apps/ai-company/src/domain/manualCloudAgentImport/
  manualCloudAgentImportTypes.ts
  manualCloudAgentImportValidation.ts
  manualCloudAgentImportEnvelope.ts
  manualCloudAgentImportObservability.ts
  toolExecutionRunExecutionRoute.ts
  unifiedToLegacyReviewEnvelope.ts
  importManualCloudAgentResult.ts          # core use case (injectable deps)
  manualCloudAgentImportDefaultDeps.ts     # browser/localStorage wiring
  manualCloudAgentImport.test.ts
  index.ts
```

**Entry points:**

| Function | Use |
|----------|-----|
| `importManualCloudAgentResult(input, deps)` | Tests, adapters — explicit deps |
| `importManualCloudAgentResultWithDefaults(input, partialDeps?)` | Browser / app — localStorage persistence |

---

## 3. Import contract

```typescript
type ManualCloudAgentImportInput = {
  toolExecutionRunId: string
  branch: string | null
  commitSha: string | null
  pullRequestUrl: string | null
  summary: string
  changedFiles: string[]
  checks: Array<{ name: string; status: 'PASSED' | 'FAILED' | 'SKIPPED'; details?: string }>
  artifacts: Array<{ type: string; reference: string; description?: string }>
  errors: Array<{ code: string; message: string; details?: unknown }>
  startedAt: string | null
  finishedAt: string
  finalStatus: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'
  externalCorrelationId?: string | null
  metadata?: Record<string, unknown>
}
```

Normalization uses `normalizeManualCloudAgentResult()` in `cursorResultEnvelopeFactories.ts` via `buildManualCloudAgentEnvelopeFromImport()`.

---

## 4. Validation

| Check | Reason code |
|-------|-------------|
| `toolExecutionRunId` required | `TOOL_EXECUTION_RUN_NOT_FOUND` (input) |
| Run exists | `TOOL_EXECUTION_RUN_NOT_FOUND` |
| `route === MANUAL_CLOUD_AGENT` | `ROUTE_MISMATCH` |
| Run not terminal / importable (`approved`, `queued`, `running`) | `RUN_ALREADY_TERMINAL` |
| No prior imported envelope | `RESULT_ALREADY_IMPORTED` |
| `finishedAt` valid ISO | `INVALID_STATUS_COMBINATION` |
| `branch` not empty string when present | `INVALID_STATUS_COMBINATION` |
| `commitSha` hex 7–40 when present | `INVALID_COMMIT_SHA` |
| `pullRequestUrl` HTTP(S) PR/MR when present | `INVALID_PULL_REQUEST_URL` |
| `SUCCEEDED` requires evidence | `EXECUTION_EVIDENCE_REQUIRED` |
| `SUCCEEDED` cannot include `errors` | `INVALID_STATUS_COMBINATION` |
| `FAILED` requires errors or summary | `INVALID_STATUS_COMBINATION` |
| `changedFiles` trimmed + deduped | — (normalized in validation) |
| Envelope passes `validateCursorResultEnvelope` | `INVALID_STATUS_COMBINATION` |

**Duplicate import:** returns structured conflict with `existingResultRef` (`run.result.receivedAt`). Does not overwrite terminal/imported state.

---

## 5. Reason codes

Strict union `ManualCloudAgentImportReasonCode`:

- `TOOL_EXECUTION_RUN_NOT_FOUND`
- `ROUTE_MISMATCH`
- `RUN_ALREADY_TERMINAL`
- `RESULT_ALREADY_IMPORTED`
- `INVALID_COMMIT_SHA`
- `INVALID_PULL_REQUEST_URL`
- `EXECUTION_EVIDENCE_REQUIRED`
- `INVALID_STATUS_COMBINATION`
- `IMPORT_ACCEPTED`
- `IMPORT_REQUIRES_REVIEW`

---

## 6. Lifecycle transitions

### 6.1 `finalStatus = SUCCEEDED`

| Artifact | Value |
|----------|-------|
| Envelope `transportStatus` | `DISPATCHED` |
| Envelope `executionStatus` | `SUCCEEDED` |
| Envelope `reviewStatus` | `PENDING` |
| ToolExecutionRun status | `awaiting_employee_review` (via `recordToolExecutionResult`) |
| Builder Review | Created if absent (`EmployeeToolReview`, status `awaiting_employee_review`) |
| Outcome `reasonCode` | `IMPORT_REQUIRES_REVIEW` |

**No fake success:** import does not set run to `accepted` or envelope `reviewStatus` to `APPROVED`.

### 6.2 `finalStatus = FAILED` or `TIMED_OUT`

| Artifact | Value |
|----------|-------|
| Envelope `executionStatus` | `FAILED` / `TIMED_OUT` |
| Envelope `reviewStatus` | `NOT_REQUIRED` |
| ToolExecutionRun status | `failed` |
| Builder Review | Not created |

**Policy:** failed manual imports do not enter Builder Review in V1. Operator must fix and re-dispatch a new run if rework is needed.

### 6.3 `finalStatus = CANCELLED`

| Artifact | Value |
|----------|-------|
| Envelope `executionStatus` | `CANCELLED` |
| Envelope `reviewStatus` | `NOT_REQUIRED` |
| ToolExecutionRun status | `cancelled` |

---

## 7. Persistence strategy

No DB migration in V1.

| Data | Storage |
|------|---------|
| Envelope | `ToolExecutionRun.result.output.cursorResultEnvelopeV110` (serialized JSON) |
| Route marker | `ToolExecutionRun.result.output.executionRoute = 'MANUAL_CLOUD_AGENT'` |
| Import metadata | `ToolExecutionRun.result.output.manualImport` (`importedAt`, `finalStatus`) |
| Builder Review | `EmployeeToolReview` via existing localStorage storage |

Route resolution (`resolveToolExecutionRunExecutionRoute`) reads, in order:

1. `run.result.output.executionRoute`
2. Envelope `route` field
3. Tool Dispatcher result `routeDecision.selectedRoute`

**Known gap:** `executionRoute` is not a first-class `ToolExecutionRun` column; it lives in `result.output` until a future schema slice.

---

## 8. Review integration

1. Successful import maps unified envelope → legacy 113F envelope (`unifiedToLegacyReviewEnvelope`).
2. `evaluateCursorResultForBuilderReview()` produces evaluation snapshot.
3. `createEmployeeToolReview()` persists review; UI posts card via `employeeToolReviewEngine` in browser.
4. MAX Review remains downstream of Builder approval — unchanged pipeline.

Import never auto-approves. `executionStatus` and `reviewStatus` stay orthogonal.

---

## 9. Observability events

| Event | When |
|-------|------|
| `manual_cloud_agent_result_import_started` | Validation passed, run lookup begins |
| `manual_cloud_agent_result_import_accepted` | Import persisted |
| `manual_cloud_agent_result_import_rejected` | Validation or policy rejection |
| `manual_cloud_agent_result_requires_review` | Success path — review gate |
| `manual_cloud_agent_result_duplicate` | Duplicate import blocked |

Payload is not logged verbatim; events carry `toolExecutionRunId`, `reasonCode`, `finalStatus` only.

---

## 10. Examples

### Success (requires review)

```json
{
  "toolExecutionRunId": "terun-manual-001",
  "branch": "feature/ai-111",
  "commitSha": "abc1234567890",
  "pullRequestUrl": "https://github.com/org/repo/pull/42",
  "summary": "Implemented manual import flow",
  "changedFiles": ["apps/ai-company/src/domain/manualCloudAgentImport/"],
  "checks": [{ "name": "build", "status": "PASSED" }],
  "artifacts": [],
  "errors": [],
  "startedAt": "2026-07-14T09:00:00.000Z",
  "finishedAt": "2026-07-14T10:00:00.000Z",
  "finalStatus": "SUCCEEDED"
}
```

Outcome: `ok: true`, `reasonCode: IMPORT_REQUIRES_REVIEW`, `review` populated.

### Failed execution

```json
{
  "finalStatus": "FAILED",
  "summary": "Build failed",
  "errors": [{ "code": "BUILD_FAILED", "message": "tsc error" }],
  "finishedAt": "2026-07-14T10:00:00.000Z"
}
```

Outcome: `ok: true`, `reasonCode: IMPORT_ACCEPTED`, run `status: failed`, `review: null`.

---

## 11. Tests

`manualCloudAgentImport.test.ts` — 19 scenarios (success, failure, cancel, timeout, validation, duplicate, review gate). Domain suite: 62 tests green.

---

## 12. Known gaps & next slice

| Gap | Next slice |
|-----|------------|
| No HTTP endpoint / UI form | AI-COMPANY-112+ application boundary |
| `executionRoute` in `result.output` only | ToolExecutionRun schema extension |
| `postReviewCard` no-op in default deps | Wire to `employeeToolReviewEngine` in browser adapter |
| No GitHub SHA/PR discovery | Operator supplies evidence manually |
| Re-import after rejection | Explicit rework / new run policy |

---

## 13. Constraints preserved

- Multi-tenant via `companyId` on run/review
- Ticket owner = CLIENT (unchanged)
- No Cursor transport invocation
- No webhook / Cloud Agents API
- Existing 109/109F/110 tests remain green
