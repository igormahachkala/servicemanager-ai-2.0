# AI-COMPANY-113B — Builder Tool Decision & Owner Approval V1

## Summary

Builder evaluates whether a Work Queue task needs Cursor after Decision Plan. If yes, it registers a Tool Dispatcher request and creates a `BuilderToolExecutionRun` in `awaiting_owner` — **without launching Cursor**.

## Flow

1. Owner assigns UI/code task to Builder queue
2. Run Next → `runEmployeeWorkerLoop({ workItem })`
3. Decision Plan (Builder brain)
4. `evaluateBuilderToolDecision()` — signals from task text, structuredPayload, Decision Plan
5. If `code_change_cursor`:
   - `submitBuilderCursorToolRequest()` → Tool Dispatcher (request only) + `BuilderToolExecutionRun`
   - Worker Loop → `waiting_approval` (no Runtime, no fake code execution)
6. `/mobile/decisions` — Owner approve/reject
7. Approve → status `ready_for_adapter` (Cursor NOT launched)

## Domain

| Module | Role |
|--------|------|
| `builderToolDecision/` | Evaluation, storage, execution run, dispatcher bridge |
| `builderToolDecisionWorkerLoopBridge.ts` | Hook after Decision Plan in Worker Loop |

## Manual QA

1. Task: «Изменить mobile UI карточки Builder на /mobile/employees/ag-builder»
2. Run Next on Builder profile
3. Decision card in `/mobile/decisions` (filter Cursor)
4. Approve → Builder profile/chat: «Cursor разрешён»
5. Verify: no Cursor API, no mock execution, no shell

**Task:** AI-COMPANY-113B
