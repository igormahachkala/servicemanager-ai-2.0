# AI-COMPANY-112E — MAX Chat Delegation Proposal V1

## Goal

Подключить MAX Delegation Engine к мобильному чату MAX. Owner подтверждает делегирование до любой передачи. Исполнение (WorkItem, Worker Loop, Cursor) — следующий тикет.

## Flow

1. Owner пишет задачу в `/mobile/chat/ag-max`.
2. Intent → `task_request` / `complex_task_request`.
3. `evaluateChatDelegationPlan()` → `evaluateDelegation({ task, conversationContext, workingMemory })`.
4. Если `recommendedEmployeeId === ag-max` → обычная Task Proposal.
5. Иначе → **Delegation Proposal Card** + `DelegationPlanRecord` (112D storage).

## Owner actions

| Action | Chat | Persistence | Work queue |
|--------|------|-------------|------------|
| Согласовать | `awaiting_execution` + system events | `approveDelegationPlan` | без изменений |
| Изменить исполнителя | override + system event | `upsertDelegationPlan` assignee | без изменений |
| Оставить MAX | → Task Proposal MAX | `cancelDelegationPlan` | без изменений |
| Отменить | cancelled | `cancelDelegationPlan` | без изменений |

## Conversation Memory

- `awaitingConfirmation`: «Owner должен подтвердить передачу задачи {employee}.»
- `promisedToDo`: pending delegation / awaiting execution
- Sync через `recordConversationExchange` после каждого решения Owner

## Files

- `src/mobile/chat/mobileChatDelegation.ts` — bridge к Delegation Engine + 112D persistence
- `src/mobile/chat/mobileMaxChatResponder.ts` — delegation vs task proposal
- `src/mobile/hooks/useMobileMaxChat.ts` — handlers + timeline sync
- `src/mobile/components/MobileChatDelegationProposalCard.tsx`
- `src/mobile/components/MobileChatDelegationEmployeeSheet.tsx`
- `src/domain/conversationMemory/conversationMemoryWorkingMemory.ts`

## Manual QA

1. `/mobile/chat/ag-max`
2. «Нужно переработать мобильный интерфейс и исправить код»
3. Delegation card → Builder
4. «Оставить MAX» → MAX Task Proposal
5. Повтор → «Согласовать» → awaiting execution, Builder queue пуст
