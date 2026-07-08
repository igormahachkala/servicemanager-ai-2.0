# AI-COMPANY-107F — Mobile Decisions V1

## Goal

Owner видит на телефоне все решения, которые ждут его внимания, без поиска по desktop-разделам.

## Route

- `/mobile/decisions` — список решений с фильтрами
- Bottom nav «Решения» → `/mobile/decisions`

## Data sources (localStorage, no fake approve)

| Тип | Источник | Approve/Reject |
|-----|----------|----------------|
| `approval` | `approvalStorage` pending | ✅ `applyApprovalAction` |
| `cursor_owner_gate` | `cursorAutomationOwnerApproval` pending | ✅ `approveCursorAutomationOwnerGate` / `reject` |
| `cursor_handoff` | `cursorAutomationStorage` attention statuses | ❌ Open details → runtime/handoffs |
| `knowledge_candidate` | Daily Journal → `buildJournalMemoryAndKnowledge` | ❌ Open details → `/ops/task-results` |
| `blocked_task` | Employee Work Queue `blocked` | ❌ Open details → employee workspace |
| `worker_loop_failed` | Max Worker Loop `failed` | ❌ Open details → employee workspace |

Waiting-approval loops без pending gate показываются как `cursor_owner_gate` только с «Открыть детали».

## Filters

- Все / Согласования / Cursor / Knowledge / Blocked

## Files

- `src/domain/mobileOwnerDecisions/` — snapshot + actions
- `src/mobile/hooks/useMobileOwnerDecisions.ts`
- `src/mobile/components/MobileDecisionCard.tsx`
- `src/mobile/components/MobileDecisionFilters.tsx`
- `src/mobile/pages/MobileDecisionsPage.tsx`
- `src/i18n/mobile/ru.ts` — `mobile.decisions`
- `src/styles/mobile.css` — `.acMobileDecisions*`

## Manual check

1. `/mobile/decisions` — empty state + CTA «Вернуться сегодня»
2. С pending approval — карточка с Согласовать/Отклонить
3. Фильтры и счётчики
4. Light/dark theme

## Out of scope (V1)

- Inline reject reason
- Knowledge approve from mobile
- Retry Worker Loop from mobile (desktop workspace only)
