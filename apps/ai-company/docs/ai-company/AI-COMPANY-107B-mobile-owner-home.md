# AI-COMPANY-107B — Mobile Owner Home V1

## Цель

Главный мобильный экран Owner на `/mobile/today`. Owner за 30 секунд понимает состояние компании, результаты сотрудников, pending decisions и следующее действие.

## Route

`/mobile/today` → `MobileTodayPage` внутри `MobileAppShell`.

## Архитектура

```
MobileTodayPage
├── useMobileOwnerHome()        ← snapshot + next action + sync
├── MobileCompanyStatusCard     ← company status metrics
├── MobileNextActionCard        ← одно главное действие
├── Empty state (first launch)  ← MAX готов к первому запуску
├── Employee results (≤5)       ← MobileEmployeeResultCard
├── Decisions                   ← MobileOwnerDecisionCard
└── Quick actions (2×2 grid)
```

## Данные

Hook `useMobileOwnerHome` агрегирует те же домены, что desktop Owner Home (`buildOwnerHomeSnapshot`):

| Источник | Что даёт |
|----------|----------|
| Presence | active employees |
| Work Queue + Runtime | tasks in progress |
| Daily Journal | completed tasks (≤5) |
| Approvals | pending decisions |
| Cursor Automation | handoff / owner approval |
| Knowledge candidates | journal-derived |
| Blocked tasks | work queue |
| Operating Day Summary | next action «view results» |
| First Employee Flow | empty state / launch MAX |

Sync events: work-queue, journal, max-worker-loop, cursor-automation, workday, approvals, presence, runtime + `storage`.

## Next Action Logic

Приоритет:

1. **decision_required** — pending approvals / cursor owner approval
2. **view_results** — completed journal или operating day summary за сегодня
3. **continue_max** — MAX queue in_progress / queued
4. **launch_first** — нет prior activity → Run Task MAX

## Quick Actions

| Кнопка | Route |
|--------|-------|
| Поставить задачу MAX | `/ops/run-task?employee=ag-max` |
| MAX сегодня | `/ops/employees/ag-max/today` |
| Утренний отчёт | `/ops/morning-report` |
| Решения | `/mobile/decisions` |

Mobile-specific routes (`/mobile/tasks/new`, `/mobile/reports`) — в следующих задачах; сейчас fallback на `/ops`.

## Refresh

Кнопка «Обновить» в intro — ручной refresh через те же sync listeners (pull-to-refresh не добавлен — нет native hook).

## Empty State

Показывается когда:

- нет prior MAX activity
- нет completed tasks / decisions / in-progress tasks
- company idle

Copy: «MAX готов к первому запуску» → CTA «Запустить MAX».

## Theme

Все стили в `mobile.css` через `--theme-*`. Light/Dark через Theme System V1.

## Checks

```bash
npm --prefix apps/ai-company run build
```

Manual: `/mobile/today` — light/dark.

## Следующий шаг

- Mobile MAX Workspace
- Mobile Morning Report (`/mobile/reports`)
- Mobile task assign flow (`/mobile/tasks/new`)
- Pull-to-refresh (native gesture)
