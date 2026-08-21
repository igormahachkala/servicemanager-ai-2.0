# Module Boundaries

> Source of Truth для **границ модулей** и зон ответственности агентов.
> Связанные документы: [Agent Development Workflow](./agent-development-workflow.md) ·
> [Deployment Workflow](../../process/deployment-workflow.md).

## Purpose

Зафиксировать, какие части репозитория к какому модулю относятся, чтобы каждая
задача меняла только свою зону. Это поддерживает правило *One Task = One Commit*
из [Agent Development Workflow](./agent-development-workflow.md).

## Ownership Zones

| Модуль | Зона ответственности (glob) |
| --- | --- |
| IT Company | `web/src/it-company/**` |
| Mobile | `web/src/mobile/**` |
| Backend | `backend/**` |
| Agent Runner | `agent-runner/**` |
| Docs | `docs/**` |

## Rule

> **Агент не должен изменять файлы вне своей зоны ответственности без отдельной
> задачи.**

- Задача объявляет свою зону; изменения ограничиваются ею.
- Кросс-модульное изменение оформляется как **отдельная задача** с отдельным
  approval (а не «заодно» в текущем коммите).
- Общие/корневые файлы (например, `web/src/router.tsx`, `web/src/lib/**`)
  трогаются только когда это явная часть задачи, и фиксируются в её scope.
- Scope Check перед коммитом (см.
  [Commit Gate](./agent-development-workflow.md#commit-gate)) проверяет
  соблюдение этих границ.

## Notes

- IT Company UI-доступ строго PLATFORM_ADMIN; backend guard — источник истины
  для API. UI-гейтинг не заменяет серверную проверку.
- Mobile-страницы не меняются задачами других модулей.
- Backend и Agent Runner не меняются фронтенд-задачами.
