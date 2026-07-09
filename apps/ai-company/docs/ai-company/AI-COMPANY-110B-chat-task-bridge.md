# AI-COMPANY-110B — Chat → Task Detection & Work Queue Bridge

## Goal

Связать mobile MAX Chat с постановкой задач в Work Queue без автозапуска.

Owner пишет свободным текстом → система определяет intent → MAX показывает **proposal** → Owner подтверждает → `createEmployeeWorkItem({ employeeId: 'ag-max', … })`.

## Intent detection V1

Domain: `src/domain/mobileChatIntent/`

| Intent | Поведение |
|--------|-----------|
| `casual_question` | Приветствие / короткая реплика → уточняющий ответ без задачи |
| `simple_question` | Вопрос без глагола действия → Ollama Q&A или fallback |
| `task_request` | Императив / короткая задача → **task proposal** |
| `complex_task_request` | Длинный текст / complex markers → proposal + `structuredPayload.mode: complex` |
| `cursor_handoff_request` | Cursor markers → proposal (см. также 110C handoff flow) |
| `report_request` | «утренний отчёт» и т.п. → proposal или ссылка на report |
| `unclear` | Слишком коротко / нет сигнала → fallback «уточните» |

### Как определяется intent

1. **Heuristic** (`mobileChatIntentHeuristic.ts`) — regex по greeting, question start, task verbs, complex/cursor/report markers.
2. **Optional Ollama** (`mobileChatIntentOllama.ts`) — если heuristic confidence &lt; 0.85 или `unclear`, same-origin `/runtime/ollama/api/generate` с JSON `{"intent":"…"}`.
3. **Proposal gate** — `shouldProposeTaskFromIntent()`: только `task_request`, `complex_task_request`, `cursor_handoff_request`, `report_request`.

## Chat → task proposal

`buildMobileChatTaskProposal(message, intent)` собирает:

- `title` — первая строка или шаблон (report / cursor)
- `taskText` — исходный текст или prefix + «Сообщение Owner»
- `priority` — heuristic: critical / high / low / medium
- `expectedResult` — по intent
- `structuredPayload` — `quick` или `complex` (≥120 символов или complex intent)

Responder: `mobileMaxChatResponder.ts` — **не** вызывает Runtime / Worker Loop.

## Chat proposal UI

Route: `/mobile/chat` → `/mobile/chat/ag-max`

В bubble `task_proposal`:

- «MAX предлагает задачу» + поля priority / expectedResult / taskText
- Кнопки: **Создать задачу** | **Создать и запустить** | **Изменить** | **Отмена**
- Hint: задача не создаётся до нажатия кнопки

Hook: `useMobileMaxChat.ts`

| Action | Effect |
|--------|--------|
| Создать задачу | `createWorkItemFromChatProposal()` → queue only |
| Создать и запустить | create + `openRunNextFlow({ workItem, goldenPath: true })` (107Q) |
| Изменить | `stashMobileChatTaskPrefill()` → `/mobile/tasks/new/max` |
| Отмена | снять proposal, system message |

Bridge: `mobileChatTaskBridge.ts` → `createEmployeeWorkItem({ employeeId: MAX_WORKER_EMPLOYEE_ID, … })`.

## Golden Path (Create and run)

1. Owner: **Создать и запустить**
2. Work item в localStorage queue
3. `useMobileRunNextSheet.openRunNextFlow` — Run Next Confirmation (107I)
4. Owner подтверждает → существующий Worker Loop / Runtime Live (107L)
5. Report → Owner decision flow (107Q)

Без явного confirm Worker Loop **не** стартует.

## Entry points

| Entry | Path |
|-------|------|
| MAX Chat | `/mobile/chat/ag-max` |
| Owner Home quick action | «Написать MAX» |
| MAX employee page | «Чат с MAX» |
| Hero card | link to chat |

## Files

- `src/domain/mobileChatIntent/*`
- `src/mobile/chat/mobileEmployeeChat.ts`, `mobileEmployeeChatStorage.ts`
- `src/mobile/chat/mobileMaxChatResponder.ts`, `mobileChatTaskBridge.ts`, `mobileChatTaskPrefill.ts`
- `src/mobile/hooks/useMobileMaxChat.ts`, `useMobileRunTask.ts` (prefill consume)
- `src/mobile/components/MobileChat*.tsx`, `MobileMaxChatPage.tsx`
- `src/i18n/mobile/ru.ts`, `en.ts` — `maxChat`
- `src/styles/mobile.css` — `acMobileChat*`

## Manual check

```bash
npm --prefix apps/ai-company run build
```

1. `/mobile/chat/ag-max` — «проверь mobile UX» → proposal card
2. **Создать задачу** → work item id в чате, очередь MAX
3. **Создать и запустить** → Run Next sheet → confirm → Runtime Live
4. **Изменить** → форма new task с prefill
5. Вопрос «что в очереди?» → Ollama или fallback, без proposal

## Constraints

- Runtime / Worker Loop / backend — без изменений
- Без IP / LAN tricks для intent
- Без fake progress
- Cursor handoff — отдельный flow (110C), но intent пересекается

## Related

- **110C** — Cursor handoff card + desktop chat integration
- **107I** — Run Next Confirmation
- **107Q** — Golden Path
