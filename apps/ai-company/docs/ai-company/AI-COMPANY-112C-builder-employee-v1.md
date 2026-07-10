# AI-COMPANY-112C — Builder Employee V1

## Goal

Builder (`ag-builder`) becomes a full mobile digital employee reusing MAX architecture via generic abstractions — no code duplication.

## Routes

| Route | Employee |
|-------|----------|
| `/mobile/employees/ag-builder` | Profile (canonical) |
| `/mobile/chat/ag-builder` | Chat (canonical) |
| `/mobile/employees/builder` | Profile alias |
| `/mobile/chat/builder` | Chat alias |

Aliases: `builder` → `ag-builder` via `employeeIdResolver` + `mobileEmployeeRegistry`.

## Generic layer

| Module | Role |
|--------|------|
| `domain/mobileEmployee/mobileEmployeeRegistry.ts` | Capabilities per employee, route aliases, path helpers |
| `domain/employeeWorkQueue/employeeWorkQueueViewModel.ts` | Generic queue view by `employeeId` |
| `mobile/hooks/useMobileEmployeeProfile.ts` | Profile snapshot (registry, queue, journal, operating day) |
| `mobile/hooks/useMobileMaxChat.ts` → `useMobileEmployeeChat` | Chat + conversation memory by `employeeId` |
| `mobile/mobileEmployeeCopy.ts` | i18n copy resolver by `employeeId` |
| `mobile/runTask/mobileRunTaskConfig.ts` | Run Task roster from mobile registry |
| `mobile/pages/MobileEmployeePage.tsx` | Generic profile shell |
| `mobile/pages/MobileMaxChatPage.tsx` | Generic chat shell |

## Builder capabilities (V1)

| Capability | Enabled |
|------------|---------|
| profile, chat, work_queue | ✅ |
| operating_day, daily_journal, reports | ✅ |
| conversation_memory | ✅ |
| runtime_live, worker_loop | ❌ |
| cursor_handoff, standard_task_quick_start | ❌ |

## Storage (unchanged keys, per employee)

- Chat: `ai-company-mobile-employee-chat` → `sessions[ag-builder]`
- Memory: `ai-company-employee-conversation-memory` → `employees[ag-builder]`
- Work Queue / Journal / Operating Day: keyed by `employeeId`

## Remaining MAX-specific (intentional V1)

- Worker Loop runner (`runMaxEmployeeWorkQueueNextItem`, `useMobileRunNextSheet`)
- Cursor handoff from chat
- Runtime Live banner / loop status
- `MobileRunNextConfirmationSheet` copy from `maxControl`
- CSS class names `acMobileMax*`, `data-mobile-guide="max-*"`
- Demo seed / golden path defaults to MAX

## Checks

```bash
npm --prefix apps/ai-company run build
```

## Manual QA

1. `/mobile/employees` — Builder in roster
2. `/mobile/employees/ag-builder` — profile opens
3. `/mobile/chat/ag-builder` — chat opens
4. Chat message stored under `ag-builder` session (not MAX)
5. Task from chat / Run Task lands in Builder queue
6. MAX queue and Builder queue isolated
7. Reload preserves chat, queue, journal
