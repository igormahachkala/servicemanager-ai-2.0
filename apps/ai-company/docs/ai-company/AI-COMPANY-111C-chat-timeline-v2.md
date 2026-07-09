# AI-COMPANY-111C — Chat Timeline V2

## Goal

Превратить mobile MAX Chat в рабочую ленту событий: сообщения Owner / MAX + системные события из реальных localStorage stores.

## Timeline events

| Event | Source |
|-------|--------|
| Task Created | `employeeWorkQueue` — `WorkItem.createdAt` |
| Task Started | `WorkItem.startedAt` |
| Runtime Started | `maxWorkerLoop` (non-draft) + standalone `runtimeRun` |
| Runtime Completed | loop `finishedAt` / run `finishedAt` success |
| Runtime Failed | loop/run failed |
| Report Ready | `employeeDailyJournal` — `finishedAt` |
| Cursor Handoff Created | handoff `history.kind === created` |
| Cursor Handoff Sent | `history.kind === marked_sent` |
| Cursor Result Received | `history.kind === result_pending` |
| Owner Approval | approval actions + loop `waiting_approval` |

Dedup: task created / handoff created пропускаются, если уже есть chat message с тем же `workItemId` / `cursorHandoffId`.

## Filters

| Filter | Shows |
|--------|-------|
| Все | everything |
| Сообщения | Owner + MAX conversational bubbles |
| Работа | task + runtime events |
| Отчёты | report_link + report_ready |
| Cursor | cursor_handoff messages + handoff events |
| System | system role + approvals |

## UI

- Chips above message list (`MobileChatTimelineFilter`)
- Events render as **System** bubbles with event title badge + body
- Owner / MAX bubbles unchanged (proposal card, handoff card, report links)
- Links: Report / Runtime Live on relevant events

Route: `/mobile/chat/ag-max`

## Files

- `src/mobile/chat/mobileChatTimelineTypes.ts`
- `src/mobile/chat/mobileChatTimelineBuilder.ts`
- `src/mobile/chat/mobileChatTimeline.ts`
- `src/mobile/hooks/useMobileMaxChat.ts` — merge + filter + sync listeners
- `src/mobile/components/MobileChatTimelineFilter.tsx`
- `src/mobile/components/MobileChatMessageList.tsx` — timeline bubbles
- `src/mobile/pages/MobileMaxChatPage.tsx`
- `src/i18n/mobile/ru.ts`, `en.ts` — `maxChat.timeline`
- `src/styles/mobile.css` — timeline + bubble alignment

## Manual check

```bash
npm --prefix apps/ai-company run build
```

1. Send chat message → filter **Сообщения**
2. Create task → **Работа** shows Task Created
3. Run Worker Loop → Runtime Started / Completed
4. Cursor handoff → **Cursor** filter
5. Journal entry → **Отчёты**

## Constraints

- No Runtime / Worker Loop changes
- No fake / seeded timeline data
- Events derived at read time from existing stores
