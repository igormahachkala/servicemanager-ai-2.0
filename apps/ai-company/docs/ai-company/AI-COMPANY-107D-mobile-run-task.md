# AI-COMPANY-107D — Mobile Run Task V1

## Цель

Нативная мобильная постановка задачи цифровому сотруднику без перехода на desktop `/ops/run-task`.

## Route

`/mobile/tasks/new` — `MobileRunTaskPage`

Query: `?employee=ag-max` — предвыбор сотрудника (только enabled).

## Flow

```
MobileRunTaskPage
├── MobileEmployeePicker     MAX | Atlas (disabled) | Sentinel (disabled)
├── MobileTaskTemplateCard×5 шаблоны → заполняют composer
├── MobileTaskComposer       title, taskText, priority, expectedOutput
└── Success state            queue item created — без auto Runtime
```

## Submit

Hook `useMobileRunTask.submit()` вызывает:

```ts
createEmployeeWorkItem({
  employeeId,
  title,
  taskText,
  summary: expectedOutput,
  priority,
})
```

- **Не** вызывает `runMaxWorkerLoopV1`
- **Не** вызывает `startNextEmployeeWorkItem`
- Эмитит `EMPLOYEE_WORK_QUEUE_SYNC_EVENT` через storage layer

## Employee roster (V1)

| ID | Codename | Enabled |
|----|----------|---------|
| ag-max | MAX | ✓ |
| ag-cto | Atlas | ✗ (placeholder) |
| ag-qa | Sentinel | ✗ (placeholder) |

Конфиг: `mobile/runTask/mobileRunTaskConfig.ts` — extensible, не MAX-only.

## Templates

1. Проверить интерфейс
2. Проверить архитектуру
3. Найти ошибки
4. Подготовить задачу для Cursor
5. Сформировать отчёт

## Success actions

- Открыть сотрудника → `/mobile/employees/:id`
- Открыть очередь → same (Work Queue card on MAX page)
- Добавить ещё задачу → reset form

Для MAX дополнительно:
- Открыть MAX
- Начать рабочий день → `startEmployeeOperatingDay()` (Operating Day only)
- Запустить следующую задачу → navigate to employee page (manual run)

## FAB integration

`MobileAppShell` FAB → bottom sheet → «Поставить задачу» → `/mobile/tasks/new`

На `/mobile/tasks/new` FAB скрыт.

## Validation

Пустой `taskText` → `t.mobile.runTask.validation.emptyTaskText`

## Checks

```bash
npm --prefix apps/ai-company run build
```

Manual:
1. `/mobile/tasks/new`
2. Выбрать MAX, шаблон, создать задачу
3. `/mobile/employees/ag-max` — задача в Work Queue

## Следующий шаг

- Mobile task list `/mobile/tasks`
- Atlas / Sentinel enablement
- Optional project/workspace picker on mobile
