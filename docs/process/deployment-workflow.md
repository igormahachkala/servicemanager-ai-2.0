# Deployment Workflow

> Source of Truth для процесса деплоя на **Stage** и в **Production**.
> Связанные документы: [Agent Development Workflow](./agent-development-workflow.md) ·
> [Module Boundaries](./module-boundaries.md).

## Purpose

Зафиксировать безопасный, повторяемый процесс доставки изменений. Деплой
выполняется только из чистого коммита в репозитории (без локальных hotfix'ов на
сервере) и только после approval, согласно
[Agent Development Workflow](./agent-development-workflow.md).

## Stage Workflow

Порядок шагов на Stage:

1. **Backup** — сделать бэкап перед изменениями.
2. **Pull** — подтянуть нужный коммит из репозитория.
3. **Build** — собрать приложение.
4. **Smoke Test** — проверить ключевые сценарии после сборки.

## Production Workflow

Production требует выполнения всех условий:

- **Stage Validation Required** — изменение предварительно проверено на Stage.
- **Backup Required** — бэкап перед деплоем обязателен.
- **Smoke Test Required** — smoke test после деплоя обязателен.

Деплой в Production выполняется только после явного approval. Агент никогда не
деплоит в Production автономно.

## Checklist

### Stage

- [ ] Backup сделан
- [ ] Pull нужного коммита выполнен
- [ ] Build прошёл без ошибок
- [ ] Smoke test пройден
- [ ] Нет локальных правок на сервере вне репозитория

### Production

- [ ] Изменение провалидировано на Stage (Stage Validation)
- [ ] Backup сделан (Backup Required)
- [ ] Deploy выполнен из чистого коммита
- [ ] Smoke test пройден (Smoke Test Required)
- [ ] Получен явный approval на Production-деплой
