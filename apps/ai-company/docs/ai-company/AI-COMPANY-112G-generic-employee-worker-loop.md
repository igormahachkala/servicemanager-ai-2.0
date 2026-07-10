# AI-COMPANY-112G — Generic Employee Worker Loop Foundation

## Summary

Any digital employee can execute Work Queue items through the same Worker Loop pipeline. MAX remains a thin wrapper over the generic API.

## Generic API

| Function | Role |
|----------|------|
| `runEmployeeWorkerLoop({ employeeId, input })` | Core execution: Decision Plan → (optional peer) → Task Runner → Runtime → Report → Journal |
| `runEmployeeWorkQueueNextItem(employeeId)` | Picks next pending Work Queue item and runs Worker Loop |
| `runEmployeeWorkQueueAll(employeeId)` | Drains queue until empty or failure |

## MAX wrappers (legacy)

| Function | Delegates to |
|----------|--------------|
| `runMaxWorkerLoop(input)` | `runEmployeeWorkerLoop({ employeeId: 'ag-max', input })` |
| `runMaxWorkerLoopV1(input)` | `runMaxWorkerLoop(input)` |
| `runMaxEmployeeWorkQueueNextItem()` | `runEmployeeWorkQueueNextItem('ag-max')` |

## Worker Loop Record

- `MaxWorkerLoopRecord.employeeId` is now `string` (any employee).
- Storage key unchanged: `ai-company-max-worker-loops`.
- IDs: `max-loop-*` for MAX, `emp-loop-{slug}-*` for others.

## Builder execution flow

1. Owner adds task to Builder Work Queue (`ag-builder`).
2. Mobile profile → **Run Next** → `runEmployeeWorkQueueNextItem('ag-builder')`.
3. `runEmployeeWorkerLoop` builds context from:
   - registry profile
   - runtime profile
   - conversation memory
   - operating day
   - recent journal / reports
   - brain profile (`ag-builder` preset)
4. Decision Plan via `buildEmployeeBrainDecisionPlan` with Builder brain.
5. Peer consult **skipped** (MAX-only in V1).
6. `startTaskRunner` → existing Runtime Engine (unchanged).
7. On success: Runtime Report, Daily Journal entry, Work Queue item completed.

**Without:** Cursor Automation enrichment, Tool Dispatcher, autonomous demo (MAX-only features).

## What became generic

- Worker Loop execution engine (`runEmployeeWorkerLoop`)
- Work Queue → Loop bridge (`runEmployeeWorkQueueNextItem`)
- Loop record storage / parsing for any `employeeId`
- Mobile Run Next for any employee with `worker_loop` capability
- Runtime Live active loop lookup per employee

## What stays MAX-specific

- `runMaxWorkerLoop` / `runMaxWorkerLoopV1` aliases
- Peer consultation phase
- Cursor Automation snapshot enrichment
- Autonomous demo scenarios
- Cursor handoff, golden path defaults tied to MAX chat
- `findActiveMaxWorkerLoop()` (filters `ag-max` only)

## Manual check

1. `/mobile/employees/ag-builder` — add queue task
2. Run Next → confirm sheet
3. Runtime Live shows Builder loop phases
4. Report + Journal appear on Builder profile

## Files

- `src/domain/employeeWorkerLoop/` — generic module
- `src/domain/maxWorkerLoop/maxWorkerLoopEngine.ts` — implementation
- `src/domain/mobileEmployee/mobileEmployeeRegistry.ts` — Builder `worker_loop`, `runtime_live`

**Task:** AI-COMPANY-112G
