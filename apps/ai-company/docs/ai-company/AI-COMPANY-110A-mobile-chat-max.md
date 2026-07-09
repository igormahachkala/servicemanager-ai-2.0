# AI-COMPANY-110A — Mobile Chat with MAX V1

## Goal

Мобильный чат Owner ↔ MAX (`ag-max`) на route `/mobile/chat/ag-max`.

Owner пишет как в обычном мессенджере: вопрос, анализ, постановка задачи. MAX отвечает через local Ollama или предлагает task proposal с CTA «Запустить задачу».

**V1 constraints:** без backend, без fake progress, relative routes only (`/mobile/...`, `/runtime/ollama`).

## Route

| Path | Component |
|------|-----------|
| `/mobile/chat` | redirect → `/mobile/chat/ag-max` |
| `/mobile/chat/:employeeId` | `MobileMaxChatPage` (non-MAX → redirect to `ag-max`) |

## Navigation entry points

| Screen | Entry |
|--------|-------|
| `/mobile/today` | Quick action «Написать MAX» |
| `/mobile/employees/ag-max` | Section «Чат с MAX» |
| `/mobile/more` | Link «Чат с MAX» |
| MAX hero card | «Чат с MAX» button |

## UI

- `MobileMaxChatPage` — shell
- `MobileChatMessageList` — messages, roles (Owner / MAX / System), timestamps
- `MobileChatComposer` — input + send
- `MobileChatQuickHints` — quick prompts
- `MobileChatStatusBar` — MAX status (ready / live / waiting)
- `MobileChatTaskProposalCard` — task proposal CTA
- `MobileChatCursorHandoffCard` — Cursor handoff (110C extension)

## Message types

| Kind | Role | Description |
|------|------|-------------|
| `question` | owner / max | Обычный вопрос-ответ |
| `task_request` | owner | Запрос на задачу |
| `clarification` | max | Уточнение |
| `task_proposal` | max | «Я могу оформить это как задачу. Запустить?» |
| `report_link` | max / system | Ссылка на отчёт |
| `system_status` | system | Системные статусы |
| `cursor_handoff` | max | Handoff в Cursor (110C) |

## Storage

**Key:** `ai-company-mobile-employee-chat` (localStorage)

**Structure:**

```json
{
  "version": "v1",
  "sessions": {
    "ag-max": {
      "version": "v1",
      "employeeId": "ag-max",
      "messages": [ /* MobileEmployeeChatMessage[] */ ],
      "updatedAt": "ISO8601"
    }
  }
}
```

**Sync:** `ai-company-mobile-employee-chat-sync` window event.

**Files:** `mobileEmployeeChat.ts`, `mobileEmployeeChatStorage.ts`

## MAX response V1

`mobileMaxChatResponder.ts`:

1. **Cursor handoff** (110C) — фразы «передай в Cursor» → handoff card
2. **Task intent** — `detectMobileChatIntent` (heuristic + optional Ollama) → `task_proposal`
3. **Simple question** — Ollama `/api/generate` via `/runtime/ollama` relay → text answer

Без fake progress bars.

## CTA

| Action | Flow |
|--------|------|
| Создать задачу | `createWorkItemFromChatProposal` → Work Queue |
| Запустить сейчас | create + `openRunNextFlow` |
| Открыть Runtime | `/mobile/runtime/:runId` |
| Открыть отчёт | `/mobile/reports/:id` |

## Related commits

- **110A** — this doc + scope definition
- **110C** (`e45660c`) — core chat UI, storage, responder, routes
- **110B** (`b610236`) — navigation entry points, task bridge doc

## Manual QA

1. Open `/mobile/chat/ag-max`
2. Ask «что в очереди MAX?» → Ollama answer (if runtime up)
3. Say «проверь mobile UX и подготовь отчёт» → task proposal card
4. Tap «Создать задачу» / «Запустить сейчас»
5. Verify entry points from Today / MAX profile / More

## Out of scope (V1)

- Backend persistence / multi-device sync
- Streaming tokens in chat UI
- Cursor API automation (110C = manual paste)
