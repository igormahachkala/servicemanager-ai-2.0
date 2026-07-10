# AI-COMPANY-113A — Tool Execution Lifecycle V1

## Goal

Persisted lifecycle for external tool usage by digital employees.  
Builder can request Cursor via Tool Dispatcher — **no real Cursor launch in V1**.

## Lifecycle model

Entity: **`ToolExecutionRun`** (`domain/toolExecution/toolExecutionRunTypes.ts`)

| Field | Purpose |
|-------|---------|
| `companyId`, `employeeId`, `workItemId` | Multi-tenant isolation (required) |
| `toolId`, `toolRequestId` | Link to Tool Dispatcher |
| `delegationPlanId` | Optional delegation context |
| `title`, `instructions`, `expectedResult` | Work package |
| `fileScope`, `checks` | Scope + validation checklist |
| `status` | Lifecycle state |
| `result`, `error` | Outcome |
| `history` | Append-only status transitions |

### Statuses

```
draft
  → awaiting_owner   (created from Dispatcher bridge)
  → approved         (Owner approve)
  → queued           (ready for external executor)
  → running
  → result_received
  → awaiting_employee_review
  → accepted | rework_requested | rejected | failed | cancelled
```

Storage: `localStorage` key **`ai-company-tool-execution-runs`**  
Sync event: **`ai-company-tool-execution-runs-sync`**

## Tool Dispatcher bridge

```
Builder WorkItem
      ↓
dispatchToolRequestPlannedOnly()   ← no mock_completed, no Cursor API
      ↓
ToolRequest + ToolResult (plannedOnly: true, lifecycleStatus: awaiting_owner)
      ↓
createToolExecutionFromDispatcherRequest()
      ↓
ToolExecutionRun (status: awaiting_owner)
```

Helper for Manual QA:

```typescript
import {
  requestBuilderCursorToolExecution,
  approveToolExecutionRun,
} from '../domain/toolExecution'

const { run, dispatch } = requestBuilderCursorToolExecution({
  workItemId: 'ewq-…',
  title: 'Fix mobile CSS',
  instructions: '…',
  fileScope: ['apps/ai-company/src/mobile'],
  checks: ['npm run build passes'],
})

// dispatch.result.status === 'planned'
// dispatch.result.output.plannedOnly === true
// run.status === 'awaiting_owner'

approveToolExecutionRun(run.id) // → approved
```

Legacy API preserved:

- `dispatchToolRequest()` — still returns `mock_completed` (111B compatibility)
- `dispatchToolRequestPlannedOnly()` — lifecycle V1 path

## History

Every status change appends to `history[]`:

```typescript
{
  id: 'terh-…',
  status: 'approved',
  at: '2026-…',
  message: 'Owner approved tool execution.',
}
```

Implemented in `toolExecutionRunStorage.ts` via `patchRun()`.

## API

| Function | Transition |
|----------|------------|
| `createToolExecutionRun()` | → `draft` / `awaiting_owner` |
| `approveToolExecutionRun()` | `awaiting_owner` → `approved` |
| `rejectToolExecutionRun()` | `awaiting_owner` → `rejected` |
| `markToolExecutionQueued()` | `approved` → `queued` |
| `markToolExecutionRunning()` | `queued` → `running` |
| `recordToolExecutionResult()` | `running` → `result_received` → `awaiting_employee_review` |
| `requestToolExecutionRework()` | `awaiting_employee_review` → `rework_requested` |
| `acceptToolExecutionResult()` | `awaiting_employee_review` → `accepted` |
| `failToolExecutionRun()` | non-terminal → `failed` |

## Constraints (respected)

- Tools ≠ employees (`ToolCapability.isEmployee === false`)
- No Cursor API / shell / IP
- No fake progress in lifecycle V1 path
- Runtime architecture unchanged
- Old `ToolExecution` gateway (`toolGateway.ts`) unchanged

## Manual QA

1. Builder WorkItem in queue (delegated)
2. `requestBuilderCursorToolExecution({ workItemId, title, instructions })`
3. `run.status === 'awaiting_owner'`
4. `approveToolExecutionRun(run.id)` → `approved`
5. Reload page → run persists in localStorage
6. `run.history` contains `awaiting_owner` and `approved` entries

## What remains before real Cursor launch

- [ ] Wire `markToolExecutionQueued` / `markToolExecutionRunning` to Cursor adapter submit
- [ ] Poll Cursor status → `recordToolExecutionResult`
- [ ] Owner approval UI (mobile decisions / Builder profile)
- [ ] Employee review UI after result
- [ ] Integration with Worker Loop (post-execution, not rewrite)
- [ ] Replace legacy `dispatchToolRequest` mock path in product flows

## Checks

```bash
npm --prefix apps/ai-company run build
```

Build: ✅
