# AI-COMPANY-113F — Cursor Result Envelope & Employee Review V1

## Result envelope

Canonical contract: `CursorResultEnvelope v1` in  
`apps/ai-company/src/domain/cursorResult/cursorResultEnvelopeTypes.ts`

Required fields:

- `version`, `toolExecutionRunId`, `workItemId`, `employeeId`
- `status`: `completed` | `failed` | `partial`
- `summary`, `changedFiles[]`, `checks[]` (`name`, `status`, `outputSummary`)
- `commit`, `pullRequest`, `warnings[]`, `errors[]`, `assumptions[]`, `unfinishedItems[]`
- `completedAt`

Outbox path:

```text
.ai-company/cursor-outbox/<toolExecutionRunId>/result.json
```

Validation (`cursorResultEnvelopeValidation.ts`):

- run exists; `employeeId` / `workItemId` match ToolExecutionRun
- no secrets (reuse `scanCursorLocalSecurityViolations`)
- `changedFiles` inside `fileScope`
- at least one structured check entry

Ingest (`cursorResultIngest.ts`):

1. validate (+ legacy 113E bridge normalization)
2. `ToolExecutionRun` → `result_received` → `awaiting_employee_review`
3. create `EmployeeToolReview` for Builder
4. post review card in Builder chat

Every Cursor `task.md` (bridge + adapter) includes the required outbox block.

## Builder review

Domain: `apps/ai-company/src/domain/employeeToolReview/`

After ingest:

- `EmployeeToolReview` status `awaiting_employee_review`
- reviewer = `ag-builder`
- auto evaluation: file scope, checks, expectedResult alignment, errors/unfinished

UI:

- Builder chat card `cursor_tool_review` — «Cursor вернул результат»
- profile/chat banner via `MobileBuilderCursorToolReviewProfileCard`

Actions:

- **Accept and send to MAX** — `acceptBuilderCursorToolReview`
- **Rework** — `requestBuilderCursorToolReviewRework`
- **Reject** — `rejectBuilderCursorToolReview`
- open task / report links

No auto-accept.

## Rework

On rework:

1. reason stored on review + ToolExecutionRun → `rework_requested`
2. `prepareCursorLocalTask` builds new envelope with original context + notes
3. **No** bridge auto-queue / Cursor auto-run

Owner must re-approve and manually re-launch when ready.

## MAX handoff

On Builder accept:

1. `acceptToolExecutionResult`
2. Cursor completion `Report` created
3. `DelegationReview` (`awaiting_review`) linked to `delegationPlanId`
4. MAX review card posted (`postMaxReviewCardFromToolReview`)
5. Builder chat system event: `BUILDER_CURSOR_ACCEPTED_SENT_TO_MAX`
6. Review status → `sent_to_max`

MAX remains mandatory before Owner closure (112H pipeline unchanged).

## Timeline events

Builder feed adds:

- Cursor Result Received (from ToolExecutionRun)
- Builder Review Started
- Builder Accepted Tool Result
- Builder Requested Rework
- Result Sent to MAX

## Manual QA

1. Approved `ToolExecutionRun` (Owner decisions)
2. Place valid `result.json` in outbox (or bridge ingest)
3. Builder chat → review card
4. Accept → MAX delegation review card
5. Repeat with `errors` / `unfinishedItems` → rework
6. Confirm rework envelope saved, no auto-run

## Remaining for full automation

- Server-side ingest API (still localStorage + bridge)
- Owner re-approval UX for rework re-queue
- Structured file-open actions (currently task link)
- Cursor session status feedback into envelope
- Automated check execution verification (not self-reported)
- Backend persistence / multi-device sync
