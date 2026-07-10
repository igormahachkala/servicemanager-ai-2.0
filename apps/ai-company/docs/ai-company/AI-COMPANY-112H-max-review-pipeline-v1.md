# AI-COMPANY-112H — MAX Review Pipeline V1

## Flow

```
Builder completes delegated task
        ↓
   Report (localStorage)
        ↓
DelegationReview (awaiting_review)
        ↓
MAX system card in chat
        ↓
   Accept ──→ Owner: «MAX проверил результат.»
        or
   Rework ──→ follow-up WorkItem in Builder queue
```

## Domain: `delegationReview/`

| File | Role |
|------|------|
| `delegationReviewTypes.ts` | Entity + statuses |
| `delegationReviewStorage.ts` | localStorage CRUD |
| `delegationReviewEngine.ts` | Complete / Accept / Rework orchestration |
| `index.ts` | Public API |

### Entity: `DelegationReview`

Statuses:

- `awaiting_result` — Builder still working (reserved for pre-report)
- `awaiting_review` — Report ready, MAX must decide
- `accepted` — MAX approved
- `rework_requested` — MAX sent back to Builder
- `failed` — Terminal error

Storage key: `ai-company-delegation-reviews`  
Sync event: `ai-company-delegation-reviews-sync`

## How review is created

1. Owner delegates to Builder (112E → 112F).
2. On Builder profile: **Взять в работу** → `startEmployeeWorkItem`.
3. **Отправить результат** → `completeBuilderDelegatedWorkItem()`:
   - marks WorkItem `completed`
   - creates published `Report` (no Runtime)
   - creates `DelegationReview` with `awaiting_review`
   - posts `delegation_review` system card to MAX chat

## MAX review card

Shown in `/mobile/chat/ag-max` when `delegationReview.status === awaiting_review`.

Buttons:

| Action | Effect |
|--------|--------|
| Принять | `acceptDelegationReview` → status `accepted`, Owner notice in chat |
| Вернуть на доработку | `requestDelegationReviewRework` → status `rework_requested` |
| Открыть отчёт | Link to `/mobile/reports/{reportId}` |
| Открыть Builder | Link to Builder profile |

## Rework

`requestDelegationReviewRework(reviewId, notes?)`:

1. Review → `rework_requested`
2. New `WorkItem` in Builder queue (`source: delegation`, same `delegationPlanId`)
3. System message in MAX chat
4. Builder completes rework item → same review reopens to `awaiting_review` (linked via `reworkWorkItemId`)

## Conversation Memory

`conversationMemoryWorkingMemory.ts` syncs:

- MAX `promisedToDo`: pending review from chat messages
- MAX / Builder `awaitingConfirmation`: open reviews from domain store

## Constraints (respected)

- No Cursor / Tool Dispatcher
- No Runtime changes
- Builder completion is manual V1 (no Worker Loop)

## Manual QA

1. MAX chat → delegate UI task to Builder → Owner approve → Transfer
2. `/mobile/employees/ag-builder` → Start → Submit result
3. `/mobile/chat/ag-max` → review card → Accept → see «MAX проверил результат.»
4. Repeat flow → Rework → verify new item in Builder queue

## What remains

- [ ] Owner Decisions feed entry for accepted reviews (info-only today via MAX chat)
- [ ] Rework notes UI (prompt V1; no structured sheet)
- [ ] Timeline filter events for review lifecycle
- [ ] `awaiting_result` auto-transition when Builder starts work
- [ ] Builder daily journal entry on completion (journal projector still MAX/worker-loop oriented)
- [ ] Automated E2E (Playwright) for full delegation → review path

## Checks

```bash
npm --prefix apps/ai-company run build
```

Build: ✅
