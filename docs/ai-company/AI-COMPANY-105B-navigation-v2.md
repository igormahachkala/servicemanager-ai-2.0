# AI-COMPANY-105B — Navigation V2 (Owner-first)

**Статус:** implemented  
**Scope:** `apps/ai-company`  
**Branch:** `ai-company-flow`

## Цель

Упростить навигацию для нового Owner: шесть понятных групп вместо плоского списка технических разделов. Глубокие экраны не удалены — спрятаны во второй уровень «Техническое».

## Группы sidebar

| Группа | Зачем | Примеры пунктов |
|--------|-------|-----------------|
| **Компания** | Утренний старт, пульс компании | Command Center, Morning Report, Operating Day |
| **Сотрудники** | Кто работает и где | Список, MAX Today, MAX Workspace, Presence, Chats |
| **Задачи** | Поставить и отследить работу | Run Task, backlog, Execution queue, Task results |
| **Решения Owner** | То, что ждёт решения | Approvals, Cursor handoffs, Knowledge candidates |
| **Отчёты** | Артефакты и аудит | Runtime reports, Employee journal, Run history |
| **Управление** | Настройки и governance | Runtime, Tools, Knowledge, Memory, Notifications, Audit |
| **Техническое** *(collapsed)* | Экспертные экраны | Workday engine, Projects, Workspaces, Sprint, Live runtime |

Каждый пункт меню показывает **label + why** в sidebar и полный hint `what · why · action` в `title`.

## Файлы

| Файл | Назначение |
|------|------------|
| `src/navigation/ownerNavConfig.ts` | Группы, маршруты, иконки |
| `src/navigation/ownerNavPath.ts` | path → group, hints для breadcrumbs/tooltips |
| `src/layout/OwnerNavigation.tsx` | Группированный sidebar + collapsible Technical |
| `src/i18n/ownerNav/en.ts`, `ru.ts` | what / why / action для всех пунктов |

## Обновлённые точки входа

- **Sidebar** (`Navigation` → `OwnerNavigation`)
- **Top nav** (`QuickActions`: Run Task, Morning Report, Approvals, MAX Today)
- **Breadcrumbs** (Home → group label → page segments)
- **Command Center** (`QuickLaunchBar`: owner-first row + project row)
- **Employee Profile** (`EmployeeHeader`: hints + Run Task для MAX)
- **Legacy SideNav** (`mission-control/layout/SideNav.tsx`)

## Сохранённые маршруты

Все существующие `/ops/*` routes без изменений. Старые deep links работают; изменилась только группировка в UI.

Help Center остаётся в TopBar (modal, без отдельного route).

## Checks

```bash
npm --prefix apps/ai-company run build
```

Ручная проверка: `/ops`, sidebar groups, breadcrumbs, QuickActions, QuickLaunchBar, переходы Run Task / Morning Report / MAX Today / MAX Workspace.
