# AI-COMPANY-112 — First Real Manual Cursor Task Flow V1

> **Status:** Implemented (DEV-only Owner flow)
> **Basis:** [cursor-execution-path-c-v1.md](../architecture/cursor-execution-path-c-v1.md), [manual-cloud-agent-result-import-v1.md](../architecture/manual-cloud-agent-result-import-v1.md)
> **Date:** 2026-07-14

---

## 1. Owner journey

```
/mobile/cursor-task
  → Create task (DEV, Builder)
  → Route decision (MANUAL_CLOUD_AGENT)
  → Owner approval
  → Copy Cursor Task Package
  → Run Cursor Cloud Agent manually
  → Import result (branch / commit / PR / summary / checks)
  → Builder Review (in-flow or Builder chat)
  → MAX Review
  → Final report (not success until MAX accepts)
```

**Entry URL:** `/mobile/cursor-task` or `/mobile/cursor-task/:runId`

---

## 2. Screen states

| UI state | Meaning |
|----------|---------|
| Planned | Run created, route attached |
| Awaiting Owner Approval | `ToolExecutionRun.awaiting_owner` |
| Ready for Cursor | Approved; package available |
| Waiting for Cursor Result | Approved, no envelope yet |
| Result Imported | Envelope stored (non-terminal review path) |
| Awaiting Builder Review | `awaiting_employee_review` |
| Awaiting MAX Review | Builder accepted, delegation review open |
| Completed | MAX accepted |
| Failed / Cancelled | Terminal execution failure |

Labels are human-readable (`uiStateLabel`); internal enums are not shown raw.

---

## 3. Data flow

| Step | Use case | Persistence |
|------|----------|-------------|
| Create | `createManualCursorOwnerTask()` | WorkItem, DelegationPlan, ToolExecutionRun, Dispatcher result |
| Route | `evaluateCursorExecutionDispatch` via dispatcher | `result.output.routeDecision` |
| Approve | `approveManualCursorOwnerExecution()` | Run → `approved`, metadata `ownerApprovedAt` |
| Package | `generateCursorTaskPackageText()` | Derived (not SoT) |
| Import | `submitManualCursorResultImport()` → `importManualCloudAgentResultWithDefaults()` | Envelope in `result.output.cursorResultEnvelopeV110` |
| Builder | `acceptBuilderReviewForManualCursorFlow()` | EmployeeToolReview + Report |
| MAX | `acceptMaxReviewForManualCursorFlow()` | DelegationReview |

Metadata: `result.output.manualCursorTaskFlow` (repository, baseBranch, flags, timestamps).

---

## 4. Domain boundaries

```
apps/ai-company/src/domain/manualCursorTaskFlow/   # application services
apps/ai-company/src/mobile/hooks/useManualCursorTaskFlow.ts
apps/ai-company/src/mobile/pages/MobileManualCursorTaskFlowPage.tsx
```

UI does not mutate `ToolExecutionRun` internals directly — only calls domain use cases.

---

## 5. Task package

Deterministic text block (`AI COMPANY TASK`) with:

- Task ID, Employee, Repository, Base branch
- Objective, Instructions, Constraints, Deliverables, Checks
- Required report sections (Task / Files / Changes / …)

No secrets, tokens, or webhook keys.

---

## 6. Result import

Reuses AI-COMPANY-111 `importManualCloudAgentResult()` — UI displays structured errors (`ROUTE_MISMATCH`, `INVALID_COMMIT_SHA`, `RESULT_ALREADY_IMPORTED`, etc.).

---

## 7. Reviews

- **Builder:** `EmployeeToolReview` created on successful SUCCEEDED import (111). In-flow accept/reject or Builder chat cards.
- **MAX:** Requires `delegationPlanId` on run; `DelegationReview` after Builder accept.
- Execution success ≠ business success; `completed` only when MAX accepts.

---

## 8. Safety

| Rule | Implementation |
|------|----------------|
| DEV only | `validateCreateManualCursorOwnerTaskInput` rejects non-`dev` |
| No Production deploy | Task package constraints + no deploy actions in UI |
| No secrets in input | Pattern scan in validation |
| No paid API / webhook / bridge execution | MANUAL route only; approval skips local bridge queue |
| No fake success | Import → `awaiting_employee_review`; final report `completed` gated on MAX |

---

## 9. Local test procedure

```bash
npm --prefix apps/ai-company run test:domain   # 80 tests
npm --prefix apps/ai-company run build
```

**Manual acceptance:**

1. Open `http://localhost:5173/mobile/cursor-task`
2. Create task for `tmp/first-real-ai-company-task.txt`
3. Confirm route `MANUAL_CLOUD_AGENT` + `OWNER_APPROVAL_REQUIRED`
4. Approve → copy package
5. Run Cursor Cloud Agent
6. Import branch / commit / PR / summary
7. Accept Builder review → Accept MAX review
8. Verify final report shows `completed: false` until MAX accepts, then `true`

---

## 10. Stage readiness checklist

- [ ] Persist `executionRoute` / flow metadata in DB (not only `result.output`)
- [ ] Wire `postReviewCard` to `employeeToolReviewEngine` in browser adapter
- [ ] Stage environment policy (currently DEV-only)
- [ ] E2E Playwright for `/mobile/cursor-task`
- [ ] Owner notification when awaiting approval / import

---

## 11. Known gaps

- Single happy path (MANUAL_CLOUD_AGENT only)
- Builder employee fixed to `ag-builder`
- No GitHub API / PR discovery
- `approveToolExecutionRun` global path still queues local bridge for cursor runs — manual flow uses dedicated approve use case
- Stage/Production deploy out of scope for V1

---

## 12. Next slice

- Stage environment gate with config
- Desktop Owner console parity
- Automatic link from Work Queue / Decisions
- Rework path after Builder reject
