# AI-COMPANY-112C — Builder Employee V1

## Goal

Builder (`ag-builder`) is a full mobile digital employee on the generic employee layer — no MAX page copy.

## Routes

| Route | Employee |
|-------|----------|
| `/mobile/employees/ag-builder` | Profile (canonical) |
| `/mobile/chat/ag-builder` | Chat (canonical) |
| `/mobile/employees/builder` | Profile alias |
| `/mobile/chat/builder` | Chat alias |

## Generic layer

| Module | Role |
|--------|------|
| `domain/mobileEmployee/mobileEmployeeRegistry.ts` | Capabilities, route aliases, path helpers |
| `domain/employeeWorkQueue/employeeWorkQueueViewModel.ts` | Queue view by `employeeId` |
| `mobile/hooks/useMobileEmployeeProfile.ts` | Profile + Registry V2 + queue/journal/operating day |
| `mobile/hooks/useMobileEmployeeConversationMemory.ts` | Working memory + summary snapshot |
| `mobile/hooks/useMobileMaxChat.ts` → `useMobileEmployeeChat` | Chat, memory sync, task proposals |
| `mobile/components/MobileEmployeeRegistryProfileCard.tsx` | Registry V2 profile block |
| `mobile/components/MobileEmployeeExecutionNotice.tsx` | No Worker Loop notice |
| `mobile/components/MobileEmployeeScopedReportsCard.tsx` | Employee-scoped reports empty/list |
| `mobile/components/MobileEmployeeConversationMemoryCard.tsx` | Memory UI on profile |
| `mobile/mobileEmployeeCopy.ts` | i18n by `employeeId` |
| `mobile/runTask/mobileRunTaskConfig.ts` | Run Task roster from registry |

## Builder capabilities (V1)

| Capability | Enabled |
|------------|---------|
| profile (Registry V2) | ✅ |
| chat + conversation memory | ✅ |
| work_queue | ✅ |
| operating_day (start/continue/finish) | ✅ |
| daily_journal + scoped reports | ✅ |
| runtime_live, worker_loop | ❌ |
| cursor_handoff, standard_task_quick_start | ❌ |

## Storage isolation

- Chat: `sessions[ag-builder]` ≠ `sessions[ag-max]`
- Memory: `employees[ag-builder]`
- Queue / Journal / Operating Day: keyed by `employeeId`

## Operating Day (Builder)

Start/pause/resume/finish work via generic Operating Day engine.  
Banner: **«Выполнение задач Builder будет подключено следующим этапом»** — no fake Worker Loop execution.

## Checks

```bash
npm --prefix apps/ai-company run build
```

## Manual QA

1. `/mobile/employees` — Builder active
2. `/mobile/employees/ag-builder` — Registry profile + queue + memory + reports sections
3. `/mobile/chat/ag-builder` — chat opens, memory hint in status bar
4. Message → reload → persists under Builder session only
5. Create task → Builder queue only; MAX queue unchanged
