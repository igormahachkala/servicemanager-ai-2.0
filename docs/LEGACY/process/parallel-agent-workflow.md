# Parallel AI Agent Development Workflow

> Source of Truth для параллельной работы Claude Code, Codex и ChatGPT в этом
> репозитории.
> Связанные документы: [Agent Development Workflow](./agent-development-workflow.md) ·
> [Deployment Workflow](../../process/deployment-workflow.md) ·
> [Module Boundaries](./module-boundaries.md).

## Цель

Несколько AI-агентов используются одновременно, потому что проект включает
несколько крупных направлений: mobile, desktop, backend, архитектуру, QA,
планирование и deploy. Параллельная работа ускоряет разработку, но требует
жесткого процесса, чтобы ветки не расходились и сервер не переключался между
несовместимыми состояниями.

Агенты работают в разных feature-ветках, чтобы изолировать изменения по зонам
ответственности и не смешивать независимые задачи в одном рабочем дереве. При
этом все изменения должны сходиться в одну integration-ветку, потому что deploy
может выполняться только из согласованного состояния проекта, где mobile,
management, backend и настройки проверены вместе.

Основная integration-ветка проекта:

```bash
integration/permissions+acceptance
```

## Роли

### Claude Code

Ответственность:

- Mobile
- Backend
- Основная реализация
- Git
- Merge
- Deploy
- Build
- Исправление конфликтов

### Codex

Ответственность:

- Desktop
- Dashboard
- QA
- Архитектурный аудит
- Исследования
- Диагностика
- Независимые feature-задачи

### ChatGPT

Ответственность:

- Архитектура
- Product Owner
- Планирование
- UX
- AI Company
- Ревью решений
- Подготовка технических заданий

ChatGPT НЕ выполняет git merge, deploy, reset или переключение серверных веток.

## Ветки

Основная рабочая ветка проекта:

```bash
integration/permissions+acceptance
```

Все новые feature-ветки создаются ТОЛЬКО от нее.

После merge commit:

```bash
6c79174
```

ветка:

```bash
feature/management-console-v2-clean
```

считается исторической и больше не используется как база для новой разработки.

## Правила

1. Запрещено вести новую разработку от устаревших feature-веток.

2. Перед созданием новой ветки обязательно выполнить:

   ```bash
   git fetch origin
   git checkout integration/permissions+acceptance
   git pull
   ```

3. Все feature-ветки создаются только от актуальной
   `integration/permissions+acceptance`.

4. Feature-ветки напрямую не деплоятся.

5. Перед merge нескольких потоков обязательно выполняется `merge-tree` либо
   эквивалентная проверка конфликтов.

6. Перед любым deploy обязательно выполнить:

   ```bash
   git branch --show-current
   git log --oneline origin/main..HEAD
   git status --short
   git fetch origin
   ```

   Затем проверить, нет ли активных параллельных веток, выполнить build и
   тесты.

7. Если одновременно активны mobile и management потоки, deploy запрещен до
   сведения изменений в отдельную integration-ветку и успешной общей проверки.

8. Нельзя переключать сервер между ветками ради просмотра или быстрой проверки.
   Сервер должен получать только проверенное integration-состояние.

## Integration Gate

Перед каждым deploy необходимо убедиться:

- [ ] integration содержит mobile
- [ ] integration содержит management
- [ ] build успешен
- [ ] тесты пройдены
- [ ] нет конфликтов
- [ ] нет незакоммиченных изменений
- [ ] нет активной параллельной ветки, которая должна попасть в тот же deploy

## История

После merge commit:

```bash
6c79174
```

mobile и management были успешно сведены в одну
`integration/permissions+acceptance` ветку без конфликтов.

Этот процесс становится официальным способом дальнейшей совместной разработки
Claude Code, Codex и ChatGPT. Новая работа начинается от актуальной
`integration/permissions+acceptance`, проверяется отдельно, затем сводится в
integration и только после этого может рассматриваться для deploy.
