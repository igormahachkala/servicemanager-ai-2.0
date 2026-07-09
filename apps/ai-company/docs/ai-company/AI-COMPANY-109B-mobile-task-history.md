# AI-COMPANY-109B — Mobile Task History by Task Type V1

## Goal

Owner видит историю работы компании **по типам задач**, а не общий поток отчётов.

## Routes

| Path | Description |
|------|-------------|
| `/mobile/tasks/history` | Основной экран истории |
| `/mobile/history` | Redirect → `tasks/history` |
| `/mobile/tasks/history?group=checks` | Детальный список группы |

## Entry points

- **Ещё → История** → `/mobile/tasks/history`
- **Задачи → История задач** → `/mobile/tasks/history`
- **Отчёты → История по типам** → `/mobile/tasks/history`

## Groups (7)

| ID | Label (RU) |
|----|------------|
| `checks` | Проверки |
| `audits` | Аудиты |
| `development` | Разработка |
| `errors_runtime` | Ошибки / Runtime |
| `reports` | Отчёты |
| `planning` | Планирование |
| `other` | Другое |

Классификация: шаблоны Run Task + keyword/heuristic по `title`, `taskText`, `summary`, `workStatus`, `reportType`.

## Data sources (real, no backend)

1. **Employee Work Queue** — `loadEmployeeWorkItems()`
2. **Daily Journal** — `listEmployeeDailyJournalEntries()`
3. **Operating Day Summary** — `loadEmployeeOperatingDaySummaries()`
4. **Reports** — `loadReports()` (dedupe via journal/work links)
5. **Runtime links** — `loadMaxWorkerLoopRecords()` + journal `runtimeRunId`

## Group card

- total count
- completed / errors
- last report link
- 3 recent items preview
- CTA → open group

## Item card

- status, employee, date, source
- result preview (journal/summary)
- report link (if any)
- Runtime link (if any)

## Manual check

1. Assign task to MAX → complete Worker Loop
2. Open `/mobile/tasks/history` — group counts update
3. Tap group → full item list with report/runtime links
4. Verify entry points from More, Tasks, Reports

## Files

```
src/mobile/history/mobileTaskHistoryTypes.ts
src/mobile/history/mobileTaskHistoryViewModel.ts
src/mobile/hooks/useMobileTaskHistory.ts
src/mobile/components/MobileTaskHistoryGroupCard.tsx
src/mobile/components/MobileTaskHistoryItemCard.tsx
src/mobile/pages/MobileTaskHistoryPage.tsx
```

## Out of scope (V1)

- Backend sync / cross-device history
- Full-text search and date filters
- Per-employee history tab
- ML-based classification
