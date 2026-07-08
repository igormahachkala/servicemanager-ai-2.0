# AI-COMPANY-104B — Operating Day Workspace (Employee «Сегодня»)

**Статус:** implemented  
**Scope:** `apps/ai-company`  
**Route:** `/ops/employees/:id/today`

## Цель

Отдельный экран рабочего дня **сотрудника** (не MAX Workspace, не company Operating Day `/ops/day`).

## Показывает

- начался ли рабочий день
- задачи выполнены / осталось
- текущая задача (из Work Queue)
- часы работы (Workday + Daily Journal)
- консультации, решения, отчёты (Daily Journal)
- итог дня (Workday summary или journal entries)

## Действия

| UI | Domain |
|----|--------|
| Начать рабочий день | `startWorkday` |
| Продолжить | navigate → `continueHref` или `advanceWorkdayPhase` |
| Завершить | `finishWorkday` |
| Приостановить | `upsertPresence({ status: 'break' })` |
| Возобновить | `upsertPresence({ status: 'working' \| 'available' })` |

## Статусы

`not_started` → `active` → `paused` → `active` → `finished`

Pause/resume через Presence (`break`), без новых фаз Workday.

## Domain

| Модуль | Назначение |
|--------|------------|
| `employeeOperatingDay.ts` | типы snapshot |
| `employeeOperatingDaySnapshot.ts` | сборка из Workday + Journal + Queue + Presence |
| `employeeOperatingDayEngine.ts` | actions + sync event |

Sync event: `ai-company-employee-operating-day-sync`

## UI

- `EmployeeOperatingDayPage` — страница
- `EmployeeOperatingDayWorkspace` — панель метрик и actions
- `useEmployeeOperatingDay` — hook с refresh по workday/journal/queue events
- Ссылка «Сегодня» в `EmployeeHeader`

## Источники данных

- `domain/workday` — start/finish/phase, startedAt/finishedAt
- `domain/employeeDailyJournal` — consultations, decisions, reports, work time
- `domain/employeeWorkQueue` — current task, completed/remaining counts
- `domain/presence` — paused (`break`) vs active
