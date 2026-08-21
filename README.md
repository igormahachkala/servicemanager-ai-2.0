# ServiceManager.AI

ServiceManager.AI — сервисная SaaS-платформа для управления клиентами, подрядчиками, объектами, заявками, исполнителями, SLA и операционными процессами.

## Новому разработчику

Не начинайте с чтения случайных файлов в `docs/` и истории старых веток.

Канонический onboarding находится здесь:

1. [`docs/00_START_HERE.md`](docs/00_START_HERE.md)
2. [`docs/01_PROJECT_OVERVIEW.md`](docs/01_PROJECT_OVERVIEW.md)
3. [`docs/02_ARCHITECTURE.md`](docs/02_ARCHITECTURE.md)
4. [`docs/03_ACCESS_MODEL.md`](docs/03_ACCESS_MODEL.md)
5. [`docs/04_DEVELOPMENT_WORKFLOW.md`](docs/04_DEVELOPMENT_WORKFLOW.md)
6. [`docs/05_FIRST_TASK.md`](docs/05_FIRST_TASK.md)

После чтения документов 00–04 разработчик должен понимать архитектуру и правила безопасности. Документ 05 используется как практическая проверка перед первой рабочей задачей.

## Стек

- Backend: NestJS + TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Frontend: React + Vite + TypeScript
- Auth: JWT
- Runtime: Docker / Docker Compose
- API: REST

## Основной архитектурный принцип

Для provider-логики источник истины — `ServiceContract`.

```text
Service Contract
→ Role in Contract (PRIMARY / SECONDARY)
→ Contract Locations
→ Contract Specializations
→ Allowed Work Area
→ User Permissions
```

`PRIMARY` и `SECONDARY` — свойства договора, а не компании.

Роль пользователя определяет действия внутри уже разрешённой договором области, но не расширяет эту область.

## Ключевые правила

- Multi-tenant граница сохраняется через `companyId`.
- Provider-доступ определяется Contract Context.
- `ADMIN / MASTER / DISPATCHER` используют специализации договора.
- `TECHNICIAN` дополнительно ограничен своими специализациями и operational scope.
- `Candidate List = Assignment Authority`.
- `Completion != Acceptance`.
- Provider завершает работу; CLIENT принимает работу.
- Production изменяется только после Stage acceptance.

## Репозиторий

Основные каталоги:

```text
backend/      NestJS API, Prisma, migrations, backend tests
web/          React/Vite frontend and mobile/PWA code
docs/         canonical developer documentation
scripts/      operational/development scripts
test/         environment/e2e support
```

## Рабочий процесс

```text
Local development
→ commit
→ Stage deploy
→ runtime acceptance
→ Production release
```

Подробно: [`docs/04_DEVELOPMENT_WORKFLOW.md`](docs/04_DEVELOPMENT_WORKFLOW.md).

## Source of Truth

Документы `docs/00_...` — `docs/05_...` являются основной точкой входа для разработчиков.

Если старый документ, комментарий или историческая ветка противоречат каноническим документам или текущему runtime acceptance, не используйте старую модель без отдельного архитектурного решения.
