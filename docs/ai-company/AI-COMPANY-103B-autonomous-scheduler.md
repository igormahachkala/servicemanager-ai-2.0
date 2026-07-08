# AI-COMPANY-103B — Autonomous Scheduler V1

**Статус:** domain integrated  
**Ветка:** `ai-company-flow`  
**Scope:** `apps/ai-company/src/domain/autonomousScheduler`

## Цель

Scheduler цифрового сотрудника управляет **порядком работы**, но **не выполняет задачи**.

```text
Очередь задач
  ↓
Scheduler выбирает следующую (priority_fifo)
  ↓
Запуск Worker Loop (MAX → runMaxWorkerLoopV1)
  ↓
После завершения — следующая задача
  ↓
Пока очередь не закончится
```

## Ограничения V1

- Без cron, backend, n8n, Telegram, MAX Messenger
- Только domain + localStorage
- Worker Loop: только `ag-max` (MAX Worker Loop V1)
- Scheduler не вызывает Ollama напрямую

## Модель

| Сущность | Описание |
|----------|----------|
| `AutonomousSchedulerQueueItem` | Задача в очереди сотрудника |
| `AutonomousSchedulerSession` | Один прогон «обработать очередь до конца» |
| `priority_fifo` | Policy: critical → high → medium → low, затем FIFO |

## API

| Функция | Назначение |
|---------|------------|
| `enqueueAutonomousSchedulerTasks` | Добавить задачи в очередь |
| `enqueueAutonomousSchedulerFromDeliveryTasks` | Очередь из Delivery Task backlog |
| `getAutonomousSchedulerQueue` | Прочитать очередь сотрудника |
| `selectNextAutonomousSchedulerItem` | Выбрать следующую (pure) |
| `runAutonomousSchedulerSession` | Главный цикл: pick → Worker Loop → repeat |

## Storage

- `ai-company-autonomous-scheduler-queue`
- `ai-company-autonomous-scheduler-sessions`
- Sync event: `ai-company-autonomous-scheduler-sync`

## Следующий шаг

- **103C / UI:** панель Scheduler на MAX Workspace + кнопка «Run queue»
- Cron / operating day integration (отдельный тикет)
- Worker Loop adapter для других сотрудников
