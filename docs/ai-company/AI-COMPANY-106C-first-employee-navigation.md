# AI-COMPANY-106C — First Employee Navigation Flow

**Статус:** implemented  
**Scope:** `apps/ai-company`  
**Route:** `/ops` (Owner Home)

## Цель

Постоянный компактный guide «Запустить первого сотрудника» — не wizard, а always-on путь для нового Owner.

## UX

Блок показывает 6 шагов:

1. MAX уже нанят
2. Открыть workspace
3. Добавить задачу в очередь
4. Начать рабочий день
5. Запустить задачу
6. Посмотреть отчёт

CTA:

| Кнопка | Route |
|--------|-------|
| Открыть MAX | `/ops/employees/ag-max/workspace` |
| Поставить задачу MAX | `/ops/run-task?employee=ag-max` |
| Начать рабочий день | `/ops/employees/ag-max/today` |
| Утренний отчёт | `/ops/morning-report` |

## Статус MAX

- **Нет данных** (Journal / completed queue / Operating Day Summary) → «MAX готов к первому запуску»
- **Есть данные** → «MAX уже выполнял задачи. Можно открыть отчёт»

## Файлы

| Файл | Назначение |
|------|------------|
| `domain/firstEmployeeFlow/firstEmployeeFlowStatus.ts` | Read-only signal из localStorage |
| `hooks/useFirstEmployeeFlowStatus.ts` | Reactive hook |
| `components/guided/FirstEmployeeNavigationGuide.tsx` | UI блок |
| `components/owner-home/OwnerHomeView.tsx` | Mount на `/ops` |

## Checks

```bash
npm --prefix apps/ai-company run build
```

Ручной путь: `/ops` → MAX Workspace → Today → Run Task → Morning Report
