# Autonomous Builder — Cursor Automation Flow V1

> **Task:** AI-COMPANY-113  
> **Status:** implemented (DEV-only)  
> **Route:** `CURSOR_AUTOMATION_WEBHOOK`  
> **Transport:** Cursor Automations Webhook only — no Cursor API, no Cloud Agents API

---

## 1. Owner journey

1. Owner opens `/mobile/builder-automation` and creates a DEV task (e.g. `tmp/autonomous-builder-test.txt`).
2. Route policy selects `CURSOR_AUTOMATION_WEBHOOK`.
3. Owner taps **«Разрешить и запустить через Cursor Automations»** once.
4. After approval Owner does **not** open Cursor, copy prompts, or import results manually.
5. UI shows lifecycle: Dispatching → Dispatched → Waiting for Cursor result → Result discovered → Builder Review → MAX Review → Completed / Failed / Timed out.
6. MAX delivers the final Owner report.

---

## 2. Builder worker loop

```
Owner task
  → route policy (CURSOR_AUTOMATION_WEBHOOK)
  → Cost Guard (INCLUDED_IN_SUBSCRIPTION only)
  → Owner approval
  → CursorAutomationRunner.runCursorAutomation()
  → pending CursorResultEnvelope (RESULT_PENDING)
  → reconciliation (marker / evidence)
  → Builder Review (only after evidence)
  → MAX Review
  → Owner report
```

Orchestration lives in domain modules — not in React UI.

---

## 3. CursorAutomationRunner

**Module:** `apps/ai-company/src/domain/cursorAutomationRunner/`

`runCursorAutomation()`:

- validates route + Cost Guard + Owner approval
- builds structured payload + instruction template
- enforces business idempotency (`builder-automation:{runId}:enqueue`)
- calls webhook with Bearer auth
- on HTTP 200 + `backgroundComposerId`: stores correlation, `DISPATCHED` + `RESULT_PENDING`
- never marks execution `SUCCEEDED` on HTTP 200 alone

---

## 4. Webhook configuration

Runtime secrets (not in git, not in UI, redacted in logs):

| Variable | Purpose |
|----------|---------|
| `VITE_CURSOR_AUTOMATION_WEBHOOK_URL` / `CURSOR_AUTOMATION_WEBHOOK_URL` | Webhook endpoint |
| `VITE_CURSOR_AUTOMATION_WEBHOOK_API_KEY` / `CURSOR_AUTOMATION_WEBHOOK_API_KEY` | Bearer token |

Also enable route availability:

- `VITE_CURSOR_AUTOMATION_WEBHOOK_AVAILABLE=true`

---

## 5. Payload contract

```json
{
  "toolExecutionRunId": "...",
  "taskId": "...",
  "employeeId": "builder",
  "title": "...",
  "instruction": "...",
  "repository": "...",
  "baseBranch": "...",
  "expectedResult": "...",
  "constraints": ["..."],
  "requiredChecks": ["..."],
  "idempotencyKey": "builder-automation:{runId}:enqueue",
  "environment": "dev",
  "callbackHints": {
    "resultMarkerPath": "tmp/ai-company-results/{runId}.json",
    "branchPrefix": "cursor/"
  }
}
```

Fields are sent as automation instruction; Cursor field visibility is not assumed.

---

## 6. ToolExecutionRun lifecycle

| Phase | Run status | Envelope |
|-------|------------|----------|
| Before dispatch | `approved` → `queued` | — |
| DISPATCHING | `queued` | — |
| After HTTP 200 | `running` | `DISPATCHED` + `RESULT_PENDING` |
| Transport error | `failed` | `TRANSPORT_FAILED` |
| Evidence found | `awaiting_employee_review` | `SUCCEEDED` / `FAILED` + `reviewStatus: PENDING` (success only) |
| Timeout | `failed` | `TIMED_OUT` |

---

## 7. Idempotency

- One business enqueue per `ToolExecutionRun` (duplicate blocked).
- Retry (`isRetry: true`) creates a new `ExecutionAttempt` with `builder-automation:{runId}:attempt:{n}`.
- `backgroundComposerId` stored on attempt + `externalCorrelationId` on envelope.

---

## 8. Reconciliation V1

**Module:** `cursorAutomationReconciliation.ts` + `githubEvidenceReader/`

No Cursor API. Allowed signals:

- **GitHub Evidence Reader** — marker discovery + branch/commit/PR verification via trusted local bridge
- result marker file `tmp/ai-company-results/{toolExecutionRunId}.json` (verified against GitHub, not trusted alone)
- timeout (default 30 min)
- limited polling (60s min interval in domain; 15s UI tick)

Marker validation requires:

- matching `toolExecutionRunId`
- valid `finishedAt`
- branch + commit evidence for `SUCCEEDED`
- status aligned with GitHub-verified evidence

---

## 9. Result marker format

```json
{
  "toolExecutionRunId": "...",
  "status": "SUCCEEDED | FAILED",
  "summary": "...",
  "branch": "cursor/...",
  "commitSha": "...",
  "pullRequestUrl": "...",
  "changedFiles": [],
  "checks": [],
  "errors": [],
  "finishedAt": "..."
}
```

Automation instruction template asks the agent to create this file.

---

## 10. Review flow

- **Builder Review** starts only when reconciliation records execution evidence (`awaiting_employee_review`).
- **MAX Review** requires Builder handoff (`sent_to_max`) — blocked before Builder review.
- Reviews do not mutate `executionStatus`.

---

## 11. Cost rules

Dispatch allowed only when `costClassification = INCLUDED_IN_SUBSCRIPTION`.

Blocked:

- `UNKNOWN_COST`
- `ADDITIONAL_COST_REQUIRED`
- `BLOCKED_BY_COST_POLICY`

No credits purchase, no Max Mode toggle, no paid APIs.

---

## 12. DEV-only acceptance

Local scenario:

1. `npm --prefix apps/ai-company run github:evidence` (trusted GitHub bridge)
2. `npm --prefix apps/ai-company run dev`
3. Set webhook + GitHub evidence env vars in `.env.local` (see `.env.github-evidence.example`).
4. Open `/mobile/builder-automation`, create autonomous task.
5. Approve and launch.
6. Cursor Automation creates branch / commit / draft PR / marker.
7. AI Company discovers result via GitHub Evidence Reader, runs Builder → MAX review.
8. Owner reads final report — without opening Cursor.

---

## 13. Known gaps

| Gap | Notes |
|-----|-------|
| Live webhook success | Smoke test never observed `success: true`; runner implements documented contract |
| Production / Stage | Explicitly blocked |
| Automatic merge / deploy | Out of scope |

---

## 14. Related docs

- [cursor-automation-webhook-smoke-test-v1.md](../research/cursor-automation-webhook-smoke-test-v1.md)
- [cursor-execution-path-c-v1.md](../architecture/cursor-execution-path-c-v1.md)
- [cursor-result-envelope-v1.md](../architecture/cursor-result-envelope-v1.md)
- [github-evidence-reader-v1.md](../architecture/github-evidence-reader-v1.md)
- [first-real-cursor-task-flow-v1.md](./first-real-cursor-task-flow-v1.md) (manual path AI-COMPANY-112)
