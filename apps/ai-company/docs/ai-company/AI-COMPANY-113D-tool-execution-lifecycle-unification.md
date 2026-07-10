# AI-COMPANY-113D — Tool Execution Lifecycle Unification

## Summary

Unified Builder Cursor flow onto canonical `ToolExecutionRun`. `BuilderToolDecision` remains employee decision only; parallel `BuilderToolExecutionRun` storage is deprecated and migrated.

## Canonical lifecycle

Single source of truth: `domain/toolExecution/ToolExecutionRun`

Statuses used by Builder UI and `/mobile/decisions`:

- `awaiting_owner` → Owner decision pending
- `approved` → Owner approved (ready for Cursor Local Bridge)
- `queued` / `running` / `result_received` / `awaiting_employee_review` → bridge lifecycle
- `accepted` / `rework_requested` / `rejected` / `failed` → terminal paths

Flow:

```
evaluateBuilderToolDecision()
  → submitBuilderCursorToolRequest()
    → dispatchToolRequestPlannedOnly()
    → createToolExecutionFromDispatcherRequest()  // terun-*
  → MaxWorkerLoopRecord.toolExecutionRunId + waiting_approval
  → /mobile/decisions reads listToolExecutionRuns({ status: awaiting_owner })
  → approveToolExecutionRun() / rejectToolExecutionRun()
```

## Migration

On first load (`initializeToolExecutionRunStorage` / `loadToolExecutionRuns`):

1. Read legacy `ai-company-builder-tool-execution-runs`
2. For each `bter-*` record, skip if canonical run exists (match: `legacyBuilderRunId`, `toolRequestId`, `workerLoopId+workItemId`)
3. Create `terun-mig-{bter-id}` with mapped status (`ready_for_adapter` → `approved`)
4. Remove legacy storage; set marker `ai-company-builder-tool-execution-runs-migrated-v1`

## Legacy API (deprecated)

| API | Replacement |
|-----|-------------|
| `BuilderToolExecutionRun` storage | `ToolExecutionRun` |
| `createBuilderToolExecutionRun` | `submitBuilderCursorToolRequest` |
| `approveBuilderToolExecutionRun` | `approveToolExecutionRun` |
| `listBuilderToolExecutionRunsAwaitingOwner` | `listToolExecutionRuns({ status: 'awaiting_owner' })` |
| `dispatchToolRequest()` mock_completed | `dispatchToolRequestPlannedOnly` + `dispatchToolRequestLegacyMock` (demo only) |

Deprecated facades remain in `builderToolExecutionRun.ts` for backward-compatible reads.

## Cursor Local Bridge readiness

- Approved `ToolExecutionRun` links: `workerLoopId`, `builderToolDecisionId`, `toolRequestId`
- `bridgeApprovedToolExecutionToCursorLocal()` (113C) — prepare-only, no auto-submit
- `queueToolExecutionRunForCursorBridge()` — queues approved run via bridge
- `syncCursorLocalBridgeToDomain()` — syncs queued/running/result into canonical lifecycle

## Manual QA

1. Builder code-change task → one `terun-*` in localStorage
2. `/mobile/decisions` → one builder_tool_request (no duplicate cursor_owner_gate)
3. Owner approve → Builder profile shows «Cursor разрешён»
4. Reload → status persists
5. Legacy `bter-*` migrated without duplicate `terun-*`
