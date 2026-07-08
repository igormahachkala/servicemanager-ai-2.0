# AI-COMPANY-107C — Mobile MAX Control V1

**Статус:** implemented  
**Scope:** `apps/ai-company`  
**Route:** `/mobile/employees/ag-max`

## Цель

Мобильный экран управления первым цифровым сотрудником MAX — Owner с телефона видит статус, очередь, рабочий день и последний результат.

## Route

| Path | Компонент |
|------|-----------|
| `/mobile/employees/ag-max` | `MobileEmployeePage` |
| `/mobile/employees` | Список с карточкой MAX → deep link |

## Блоки экрана

| Блок | Данные | Actions |
|------|--------|---------|
| Hero | resolveEmployee, Presence, Runtime profile, Brain summary | Link → desktop workspace |
| Workday | Employee Operating Day snapshot | Start / Continue / Finish (domain) |
| Work Queue | MaxWorkspaceWorkQueueView | Add test task, Run next, Open full queue |
| Last Result | Daily Journal + Operating Day Summary | Report / Morning Report |
| Quick Task | Bottom Sheet | Run Task desktop, test template, /mobile/tasks |

## Domain (read-only + existing actions)

- `employeeOperatingDay` — start/finish/continue
- `maxWorkspaceWorkQueueRunner` — seed test, run next
- `employeeDailyJournal` / `operatingDaySummary` — last result
- `firstEmployeeFlow` — hasPriorActivity banner

**Не менялись:** Runtime, Worker Loop logic, Employee Brain, backend, desktop pages.

## Checks

```bash
npm --prefix apps/ai-company run build
```

Ручная проверка: `/mobile/employees/ag-max`, Light/Dark theme.
