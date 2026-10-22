# STATE — текущее состояние проекта

> **Обновлено:** 2026-07-23 · ветка `test/cursor-automation-webhook-contract` · HEAD `a4b6409`
> Только проверенные факты. Каждое утверждение — команда или ссылка на файл.

---

## 1. Что это

AI Company — операционная система для цифровой организации: сотрудники (MAX, Builder, Atlas,
Sentinel) как сущности платформы, а не чат-сессии. Локальная Ollama — «мозг» рассуждений;
внешние инструменты (Cursor, GitHub) — транспорт исполнения, не владельцы жизненного цикла.
Канонический источник правды по исполнению — `ToolExecutionRun` внутри AI Company.
Фронт: React 19 + Vite, домен в `apps/ai-company/src/domain/`, доверенные мосты — отдельные Node-процессы.

## 2. Инфраструктура

### Ollama

| Где | Endpoint | Модели | Проверка |
|---|---|---|---|
| Mac (dev) | `http://127.0.0.1:11434` | `qwen3.6:latest` (36B, Q4_K_M, ctx 262144), `qwen3.6:27b`, `qwen2.5-coder:7b`, `qwen2.5vl:7b` | `curl -s http://127.0.0.1:11434/api/tags` |
| Сервер (`SERVER_NEW_IP`) | `127.0.0.1:11434` — **только loopback**, снаружи `:11434` timeout (UFW) | + `nomic-embed-text:latest` (dim=768), всего 5, 32 GB | `docs/infra/AI-INFRA-003-migration-report.md` |

DNS cutover со старого сервера ещё не сделан (`AI-INFRA-003-migration-report.md`, раздел «План cutover»).
Фактические адреса и hostname — в приватном реестре инфраструктуры, в докaх только плейсхолдеры.

Браузер и iPhone ходят в Ollama **не напрямую**, а через same-origin прокси Vite `/runtime/ollama/*`
→ `127.0.0.1:11434`, со снятием заголовков `Origin`/`Referer` (`apps/ai-company/vite.config.ts:20-27`).
Без этого POST `/api/generate` с телефона получал 403.

`agent-runner` по умолчанию смотрит на `http://172.17.0.1:11434` (docker bridge) и модель
`qwen3.6:27b` — `agent-runner/src/config.ts:112-113`, переопределяется `OLLAMA_BASE_URL` / `OLLAMA_MODEL`.

### Мосты (все на 127.0.0.1, запускаются вручную)

| Мост | Порт | Прокси Vite | Команда |
|---|---|---|---|
| Cursor Local Bridge | 17319 | — | `npm --prefix apps/ai-company run cursor:bridge` |
| GitHub Evidence Bridge | 17320 | `/runtime/github-evidence` | `npm --prefix apps/ai-company run github:evidence` |
| Connections Bridge | 17321 | `/runtime/connections` | `npm --prefix apps/ai-company run connections:bridge` |

Порты: `tools/*/src/config.ts` (`CURSOR_BRIDGE_DEFAULT_PORT` и т.д.). Прокси: `vite.config.ts:37,47`.
У каждого моста есть `:status` (`cursor:bridge:status`, `github:evidence:status`, `connections:bridge:status`) — см. ловушку №3.

### Запуск

```bash
npm --prefix apps/ai-company run dev              # Vite
npm --prefix apps/ai-company run test:domain      # 187 тестов
npm --prefix apps/ai-company run build            # tsc -b && vite build
```

## 3. Что работает сегодня (по факту)

- **Доменные тесты: 187 pass / 0 fail**, 17 сюит, ~1.4 с. Прогон 2026-07-23.
- **Ручной Cursor-поток** (AI-COMPANY-112): создать задачу → route `MANUAL_CLOUD_AGENT` → approve →
  скопировать пакет → импорт результата → Builder Review → MAX Review. `/mobile/cursor-task`.
- **Автономный Builder через Cursor Automations** (113/114): webhook enqueue, pending envelope,
  реконсиляция через GitHub Evidence Reader (marker → branch/commit/PR), Builder → MAX → отчёт. DEV-only.
- **Route Policy + Cost Guard** (109): 3 маршрута, блокировка при `UNKNOWN_COST` / `ADDITIONAL_COST_REQUIRED`.
- **Unified Result Envelope** (110): transport / execution / review — три независимых измерения.
- **Employee Connections** (115): каталог, гранты, health-check для Ollama / Cursor / GitHub.
- **Ollama в приложении:** runtime-провайдер (`domain/runtime/providers/ollamaProvider.ts`),
  классификация интента чата, ответы MAX в мобильном чате — реальные вызовы `/api/generate`.
- **`agent-runner`** — отдельный Node-пакет: поллинг задач SMA → read-only анализ через Ollama →
  PATCH результата плоской строкой. В приложение не импортируется.

## 4. Что заблокировано и почему

| Блок | Причина |
|---|---|
| **Cursor Automations как основной маршрут (Path A)** | Из пяти критериев выполнены два. Enqueue проходит (HTTP 200, `success:true`, `backgroundComposerId`), но **видимость payload и repo-артефакт на тестовой ветке не подтверждены** за 12-минутное окно наблюдения. Решение — [`docs/research/evidence/ai-company-107/final-decision.md`](research/evidence/ai-company-107/final-decision.md) |
| `[unauthenticated] Error` при старте background composer | Историческая блокировка, **устранена** после починки Cloud Environment + workspace — см. тот же `final-decision.md`, раздел Outcome summary. Не путать с текущим ограничением Path A |
| Cloud Agents API как маршрут по умолчанию | Запрещено политикой стоимости: нет доказательства включённости в подписку (`final-decision.md`, «Why not Path B») |
| Stage и Production | Все Cursor-потоки DEV-only; `validateCreateManualCursorOwnerTaskInput` отклоняет не-`dev` |
| Маршрут исполнения через Ollama в Tool Dispatcher | Отсутствует: `TOOL_DISPATCHER_TOOL_IDS = ['cursor']`, `switch` по `toolId` знает только `cursor` (`domain/toolDispatcher/toolDispatcherTypes.ts`, `toolDispatcherDispatch.ts`) |
| OAuth для Google / GitHub / Figma | Не реализован, честный `AUTH_REQUIRED` (`docs/architecture/employee-connections-center-v1.md:170`) |

## 5. Решения, которые не пересматриваем

| Дата | Решение | Ссылка |
|---|---|---|
| 2026-07-14 | **Path C:** Local Bridge — основной автоматический, Manual Cloud Agent — фолбэк оператора, Automation Webhook — вторичный триггер | [`final-decision.md`](research/evidence/ai-company-107/final-decision.md), [`cursor-execution-path-c-v1.md`](architecture/cursor-execution-path-c-v1.md) |
| 2026-07-14 | **HTTP 200 ≠ успех.** Webhook 200 означает `DISPATCHED`, не более; `backgroundComposerId` хранится только как `externalCorrelationId` | `cursor-execution-path-c-v1.md` §5.3, §13.3 |
| 2026-07-14 | **ToolExecutionRun — единственный канонический источник правды**; Cursor-поверхности это транспорты | `cursor-execution-path-c-v1.md` §5.1 |
| 2026-07-14 | **Три ортогональных измерения** transport / execution / review; отклонённое ревью не переписывает успех исполнения | [`cursor-result-envelope-v1.md`](architecture/cursor-result-envelope-v1.md) §5, §8 |
| 2026-07-14 | **Cost Guard обязателен.** Никакой автопокупки кредитов, автопереключения на платное API, автовключения Max Mode | `cursor-execution-path-c-v1.md` §15 |
| 2026-07-?? (114) | **GitHub — источник правды для evidence.** Marker-файл сам по себе не доверяется никогда | [`github-evidence-reader-v1.md`](architecture/github-evidence-reader-v1.md) §2 |
| — | **Никакого фейкового успеха.** Синтетический envelope без доказательств запрещён | `cursor-execution-path-c-v1.md` §13.3 |

## 6. Что дальше

Result Envelope развязан от Cursor: нейтральный надтип, Cursor-маршруты как подмножество. Надтип, а не
четвёртое значение в enum, потому что оба `switch` в `cursorExecutionRoutePolicy.ts` (`:119`, `:140`)
имеют `default` и TypeScript его не поймал бы. Разбор — в
[`cursor-result-envelope-v1.md`](architecture/cursor-result-envelope-v1.md) §4.

**План закрыт: все семь коммитов выполнены** (тесты 187 → 224, зелёные). `087877a` нейтральные route id;
`0c36131` `ExecutionRoute` — алиас на подмножество, протечка надтипа падает в `defaultExpectedCostByRoute()`;
`5dd3fc5` `route` расширен, 22 потребителя без правок за счёт дженериков и сужающей обёртки;
`9cd036d` `createAnalysisResultEnvelope`; `1b44980` документация; `d84c997` `checksOutcome` из четырёх
состояний, «требовалось ли» из `run.checks`, миграция localStorage; `86ecf43` тег транспорта.

Решения: **`transportStatus` не расширяем** — у локального вызова транспорт настоящий (HTTP на `:11434`),
все три значения несут смысл, инвариант «SUCCEEDED требует не-`NOT_DISPATCHED`» не трогаем.
**`missing` не сворачиваем в `failed`** — это тихий провал, ради его отлова состояние и вводится.
**Транспорт помечается существующим `metadata.transport`** (`local_ollama_analysis`) по конвенции
Cursor-фабрик; отдельный `transportKind` отвергнут, чтобы не заводить второй ключ об одном и том же.
Локальность выводится из пары `DISPATCHED` + заполненный `finishedAt`, отдельного поля не нужно.

**Блок 1 сделан** (`bd6a018`): `ollama` в `TOOL_DISPATCHER_TOOL_IDS` + запись в реестре диспетчера +
ветка эндпоинта. Одного id не хватило: без записи в реестре `validateDispatchInput` роняет запрос как
`Unknown tool` ещё до `switch`, а `getToolDispatcherEndpointConfig` кидает на импорте модуля.
`registryToolId` стал нулевым — у Ollama нет записи в Mission Control реестре.

**Блок 2 сделан** (`49bb7fc`): `domain/ollamaAnalysis` — промпт → `/api/generate` → конверт.
Живёт рядом с `ToolExecutionRun`, а не внутри диспетчера: вызов асинхронный, а обе точки входа
диспатча синхронные — тот же раздел, что у Cursor (диспетчер планирует, `cursorAutomationRunner`
исполняет). Ветка диспетчера отдаёт `accepted` + `executionPending`. Порт из `agent-runner`, не через
`ollamaProvider`: у провайдера `window.setTimeout` и девятиполый `RuntimeExecutionRequest` — не
тестируется в node и не заполняется честно из задачи диспетчера. Модель — `payload.model` с дефолтом
`qwen3-coder:30b`. Неуспех конверта не порождает никогда: пять типизированных кодов и никакого
результата.

**Блок 2.5 сделан** (`2f77db1`, `7ed6f34`). Headless-эндпоинт: `process.env.OLLAMA_BASE_URL` даёт
абсолютную базу, когда Vite-переменной нет, читается через `globalThis` (в `tsconfig.app.json`
`types: ["vite/client"]`, без node — упоминание `process` по имени валит `tsc -b` на `TS2580`).
Важнее самого фолбэка: **префикс пути следует за базой** — `/runtime/ollama` существует только потому,
что его срезает vite-прокси, поэтому при явной абсолютной базе он снимается. Иначе Ollama получила бы
`/runtime/ollama/api/generate` и ответила 404 — латентный баг блока 1 для любого, кто задал бы
Vite-переменную с прямым хостом. Браузерный путь не тронут. Метрики: `eval_count`, `eval_duration`,
`prompt_eval_count`, `total_duration` из финального чанка едут в `metadata.analysisMetrics`; tok/s
считается по длительности генерации, а не общей, чтобы загрузка модели не занижала скорость.
**Отсутствующий счётчик — `null`, никогда не `0`:** неизвестная стоимость не должна читаться как
бесплатная.

**Живой прогон подтверждён** (2026-08-31, `scripts/ollama-live-run.ts`, untracked): `qwen3-coder:30b`,
7.0s, 220 промпт-токенов, 141 токен ответа, **87.65 tok/s**. Модель нашла подсунутый баг
(`sum(a,b){return a-b}`) и выдержала формат `Problem:/Risk:/Recommendation:/Effort:` с первого раза.
Конверт настоящий: `LOCAL_OLLAMA_ANALYSIS`, `DISPATCHED`, `SUCCEEDED`, `transport:
local_ollama_analysis`. Машинерия отдаёт результат, а не заглушку.

`test:domain`: **276 pass, 0 fail**.

**Блок 3 сделан** (`2ccdccf`): `metadata.sectionsValidated` больше не константа — `validateAnalysisSections`
проверяет наличие и непустоту `Problem/Risk/Recommendation/Effort`. Развилка «новая фабрика или развязка
`createTransportFailureEnvelope`» решена **новой фабрикой** `createAnalysisRejectedEnvelope`, и не ради
удобства типов: у последней инвариант принуждает к `TRANSPORT_FAILED`, а транспорт при кривом ответе
отработал (HTTP 200, поток дочитан, токены сгенерированы). Пометить его сломанным значило бы стереть
разницу между «Ollama лежит» и «Ollama ответила не по форме» — два состояния с разным ремонтом.
Отбракованный анализ получает `DISPATCHED` + `FAILED` (эту пару не запрещает ни один инвариант) и
`errors[].source: 'validation'`, а сырой ответ сохраняется в `summary` как улика. Хвост после `Effort`
допускается: любая размеченная строка закрывает предыдущую секцию, поэтому `Effort:` с одним лишь
хвостом всё равно пуст и падает. Регистр заголовков не важен, порядок не проверяется.
Развязка `createTransportFailureEnvelope` **остаётся в очереди** — для настоящего падения транспорта,
которое сегодня конверта не даёт вовсе.

**Блоки 4a и 4b сделаны** (`dae9664`, `840e8a1`). 4a: `requestToolExecution({ toolId? })` с дефолтом
`'cursor'`, а `requestBuilderCursorToolExecution` — обёртка в одну строку, поэтому оба её вызывающих не
тронуты и cursor-путь неизменен по построению. Не переименование: действие тоже пришлось привязать к
инструменту (`DEFAULT_ACTION_BY_TOOL`), иначе ollama-запрос с историческим `handoff` умирал бы в
`validateDispatchInput` до всякой ветки. 4b: `queueToolExecutionRunForOllamaAnalysis` ведёт run
`approved → queued → running → result_received → awaiting_employee_review`, вызывая между ними
`runOllamaAnalysis` и записывая конверт в `run.result`. Awaitable и **без** `window`-guard'а — маршрут
работает headless, а detached-промис дал бы скрипту завершиться на полпути. Провал контракта пишет
конверт-улику и **затем** валит run (`awaiting_employee_review` не терминальный — проверено), провал
транспорта конверта не даёт и просто валит run. `deliveryMode` получил `'local_analysis_v1'`, иначе
`recordToolExecutionResult` по умолчанию записал бы локальный анализ как cursor-доставку.
Попутно пришлось расширить до надтипа `mapEnvelopeToToolResultOutput` и `serializeCursorResultEnvelope` —
они были типизированы по сужённому `CursorResultEnvelope`, и конверт в run не проходил вовсе.

### ПЕРВЫЙ СКВОЗНОЙ ПРОГОН — состоялся

**2026-08-31**, `scripts/ollama-e2e-run.ts` (untracked). Run прошёл
`awaiting_owner → approved → queued → running → result_received → awaiting_employee_review`
за **8.2 с**. Модель `qwen3-coder:30b`, **85 tok/s**, 227 промпт-токенов и 227 токенов ответа;
`sectionsValidated: true`, `executionStatus: SUCCEEDED`, `deliveryMode: local_analysis_v1`,
`errors: []`. Баг в подсунутой `applyDiscount(total, percent) { return total - percent }` найден верно,
с исправлением `total * (1 - percent/100)`.

**Моков в домене нет.** Настоящие: диспетчер, реестр, мост, машина статусов, HTTP-вызов, валидатор
секций, фабрики конверта, сама модель. Шима два и оба named: **хранилище** — домен пишет в
`localStorage`, которого в node нет, поэтому подставлен тот же in-memory шим, что в юнит-тестах;
**одобрение** делает скрипт, а не Владелец в UI, но через тот же `approveToolExecutionRun`.

Деталь, подтвердившая капкан №10 на живом прогоне: `queued` и `running` легли в один миллисекундный
тик (`.332`) — это то самое синхронное окно до первого `await`, из-за которого detached-триггер из
`approve` не успевает влезть и уйти в сеть.

**Блоки 1, 2, 2.5, 3, 4a, 4b закрыты — сквозной путь замкнут.** `test:domain`: **293 pass, 0 fail**.

### СЛЕДУЮЩИЙ БЛОК — UI-путь для ollama

Разрыв: **домен headless готов, интерфейс заточен под Cursor.** Владелец сегодня не может ни создать
ollama-задачу, ни увидеть её статусы, ни прочитать ответ модели. Разведка 2026-08-31, только чтение.

**Порядок: 2 → 1 → 3 → 4.** Сначала снимается фильтр, иначе даже созданная задача невидима и
проверить пункт 1 нечем. **Пункт 2 закрыт** (2026-09-01), следующий — пункт 1.

1. **Форма создания.** В UI нет входа с выбором инструмента: `.tsx` не вызывает `requestToolExecution`
   ни разу, а два хука — `useManualCursorTaskFlow.ts:131` и `useBuilderAutomationTaskFlow.ts:104` —
   идут в cursor-специфичные создатели, где `toolId` захардкожен. Прокинуть `toolId` в хук или сделать
   отдельный экран ollama-анализа поверх нейтральной `requestToolExecution` (готова с `dae9664`).
2. **Зависимость от `builderToolDecisionId` снята — СДЕЛАНО** (`562c8c1`, `8c6d217`).
   **Фильтр был не тем замком.** В снапшоте строкой ниже стояло `if (!decision) continue`, а весь блок
   `builderTool` собирался из `BuilderToolDecision` — снять только `.filter` не дало бы ничего. Условие
   заменено на вопрос, ради которого оно стояло: `requiresBuilderToolDecision(toolId)` в новом
   `domain/toolExecution/builderToolVisibility.ts`, а decision-free прогон собирает ту же мету из самого
   run — `title`, `instructions`, `fileScope`, `checks` там уже лежат, их положил диспетчер, так что
   ничего не выдумывается. **Фиктивный decision отвергнут:** он лёг бы в cursor-owned store, и фасад
   `builderToolExecutionRun.ts` вместе с `formatBuilderToolDecisionConfidenceLabel` читали бы выдумку
   как настоящую запись. Cursor неизменен по построению — decision ему по-прежнему нужен, прогон со
   ссылкой на исчезнувший decision по-прежнему скрыт, и **скрыт cursor-прогон, созданный вообще без
   decision**: именно такие делают `manualCursorTaskFlowCreate` и `builderAutomationTaskFlowCreate`,
   поэтому слепое ослабление вытащило бы их в список с пустой мета-панелью. Закреплено тестом.
   Мест оказалось **три, а не два:** тот же фильтр стоял в `mobileChatTimelineBuilder.ts:681`, без него
   статусы не доехали бы до чата Max — отдельный коммит `8c6d217`. Ярлыки передаются в новый модуль
   аргументом, потому что ratchet `i18nGuard.test.ts` запрещает новые русские литералы вне `src/i18n`;
   побочная польза — увод строк в бандлы станет одной правкой. Карточка статусов берёт ярлык из
   capability (`'Cursor'` совпадает с копией байт-в-байт), а её заголовок больше не называет Cursor.
   `test:domain`: **305 pass, 0 fail** — десять новых кейсов, включая три cursor-регрессии и защиту от
   впуска инструмента, не объявленного decision-free.
3. **Рендер конверта.** У `run.result.output` **нет ни одного читателя в UI**: поиск по `.tsx` на
   `cursorResultEnvelopeV110` / `result.output` / `readEnvelopeFromToolResult` даёт ноль совпадений
   (`TaskResultDetailsPage.tsx:105` показывает `outputPreview` совсем другой сущности из
   `domain/taskResults`). Нужен компонент: секции ответа, `sectionsValidated`, `executionStatus`,
   метрики (`tokensPerSecond`, токены). Сейчас всё это пишется в run и никем не видно.
4. **Косметика:** `toolLabel: 'Cursor'` в cursor-ветке — теперь
   `mobileOwnerDecisionsBuilderTool.ts:100`, брать из capability, как это уже делает карточка статусов;
   `filterKind: 'cursor'` ставится жёстко (`mobileOwnerDecisionsSnapshot.ts:207`), из-за чего
   ollama-элемент лежит во вкладке «Cursor»; текст одобрения «Cursor разрешён Owner — ready for local
   adapter» (`:409`); русские ярлыки из `BUILDER_TOOL_LABELS_RU` (`:102`) пора увести в `src/i18n` —
   они собраны в один объект именно под это.

**`approveMobileOwnerDecision` не переписывать.** Она уже инструмент-нейтральна: зовёт
`approveToolExecutionRun(item.toolExecutionRunId, …)`, а значит ollama-ветка подхватит run сама, как
только он попадёт в список после пункта 2. Подтверждено на пункте 2: не тронута, ollama-run одобряется
через неё же.

**ДОЛГ, найденный на пункте 2: код игнорирует `requiresOwnerApproval` из capability.** У ollama флаг
стоит `false` (`toolDispatcherRegistry.ts:49`), но `createToolExecutionFromDispatcherRequest` ставит
`initialStatus: 'awaiting_owner'` (`toolExecutionRunBridge.ts:122`) **всем без разбора**, поэтому
ollama-run всё равно ждёт Владельца. Сейчас **оставлено сознательно:** одобрение через UI нужно для
демо, и на нём же держится проверка пункта 2. Решений ровно два, и они несимметричны по риску: либо
capability переводится в `true` — тогда флаг честно описывает поведение и ничего в жизненном цикле не
двигается; либо создание run начинает флаг учитывать — тогда ollama пойдёт сразу в `approved`, минуя
Владельца, и demo-путь придётся заводить иначе. **Второй вариант меняет жизненный цикл прогона, поэтому
не делать заодно с другой задачей.**

**ЗАКРЫТО (2026-10-21):** выбран второй вариант, но за переключателем. При
`AI_COMPANY_AUTO_APPROVE_SAFE_TOOLS=1` (в Vite — `VITE_AI_COMPANY_AUTO_APPROVE_SAFE_TOOLS`)
`createToolExecutionFromDispatcherRequest` учитывает `capability.requiresOwnerApproval`: run создаётся
в `awaiting_owner` и сразу проходит `approveToolExecutionRun` с пометкой «Auto-approved» в истории — тот же
путь, что клик Владельца, исполнитель запускается так же. Без переменной жизненный цикл прежний (демо и
`scripts/ollama-e2e-*.ts` не затронуты). Cursor (`requiresOwnerApproval: true`) ждёт Владельца всегда.
Ловушка: при включённом переключателе e2e-скрипт, который сам вызывает approve + queue, гоняется с
отсоединённым queue из approve — запускать скрипты с выключенной переменной.

Дальше, вне сквозного пути: перенос слоя контекста из `agent-runner` (`contextLoader`/`fileSelector`
требуют моста к `fs` — сейчас промпт честно пишет, что контекста нет; живой прогон это подтвердил:
модель угадывала пути к файлам неточно); персистентность `executionRoute` колонкой на `ToolExecutionRun`.

## 6c. Общее состояние и установка одной командой (2026-10-22)

**Общее состояние.** `tools/state-bridge` (служба `ai-company-state`, 127.0.0.1:17322, relay
`/runtime/state`) хранит все ключи `ai-company-*` в одном JSON-файле с глобальной ревизией
(атомарная запись, дневные копии ×14). Клиент `src/sync/serverStateSync.ts`: `main.tsx` ДО импорта
приложения тянет снапшот (сторы читают localStorage на импорте — порядок важен, поэтому приложение
вынесено в `bootstrapApp.tsx` и грузится динамически), патчит `Storage.prototype.setItem/removeItem`
для общих ключей → очередь → PUT; опрос `/v1/changes?since=` раз в 3 с + на фокус, применение
шлёт `storage`-событие (на него уже подписаны ~57 хуков). Пустой сервер + данные в браузере = первое
устройство, данные загружаются; иначе серверная копия главнее. Язык/тема/активная компания —
локальные. Конфликт V1: последняя запись по ключу. Включается `VITE_AI_COMPANY_SERVER_STATE=1`
(в серверной сборке по умолчанию), в деве выключено. Проверено: 9 тестов (два «браузера» + живой
сервер в процессе, рестарт с ресинком), и в браузере — задача с «офиса» видна на «телефоне», «Принять»
на телефоне без перезагрузки доезжает в офис.

**Установка одной командой.** `deploy/windows-server/bootstrap.ps1` (через `irm` с GitHub) →
`scripts/install.ps1` (01→02→03→04→05→healthcheck). `01` больше не зависит от winget: при его
отсутствии/сбое (SSH, Server) Git/Node/NSSM качаются напрямую с официальных источников. Прямые
загрузки проверены только парсером — из облака эти хосты недоступны.

## 6b. UI ollama-анализа — пункты 1 и 3 ЗАКРЫТЫ (2026-10-21)

Страница `/ops/analysis` (`pages/AnalysisTasksPage.tsx`, пункт меню «Анализ» в группе задач):
форма → `createOllamaAnalysisTask` (work item билдера + нейтральная `requestToolExecution`), список
прогонов, карточка с кнопками одобрить / отклонить / принять / запустить заново и рендер конверта:
блоки ответа по порядку (`parseAnalysisBlocks`), статус схемы, ошибки, модель, ток/с, токены, время.
Доменная часть — `domain/ollamaAnalysis/ollamaAnalysisTask.ts` + тест. Промпт теперь велит держать
ярлыки разделов на английском, а содержание писать на языке задачи — иначе русская задача давала
«Проблема:» и валидатор резал ответ. Проверено в браузере с фейковой Ollama: автоодобрение,
ручное одобрение → принято, Ollama выключена → «Ошибка» с текстом. Пункт 4 (косметика) остаётся.

## 6a. Офисный сервер (2026-10-21)

Комплект развёртывания — `apps/ai-company/deploy/windows-server/` (README на русском). Веб — `vite preview`
на `0.0.0.0:8080` как служба NSSM: тот же `/runtime/*`-релей, что в деве, включая срез `Origin` для Ollama,
поэтому Caddy не нужен. Мосты — службы на `127.0.0.1`. Ollama уже стоит на сервере; `04` докачивает только
`qwen3-coder:30b`, `qwen3.6:latest`, `nomic-embed-text`. Имя хоста для панели —
`AI_COMPANY_ALLOWED_HOSTS` (`preview.allowedHosts` в `vite.config.ts`), по IP открывается всегда.
Ограничение V1: состояние в браузере — вести с одного браузера.
Доступ снаружи (2026-10-22) — `apps/ai-company/deploy/vps-tunnel/`: тот же WireGuard, что у daily (VPS 10.77.0.1 ⇄
офисный Linux 10.77.0.2), nginx stream в офисе `10.77.0.2:18080 → 192.168.1.157:8080`, на VPS сайт с
basic auth + Let's Encrypt (скрипт отказывается публиковать без 401). Cloudflare-вариант удалён по решению
Владельца. Цепочка проверена локально целиком (браузер → nginx auth → stream → панель → Ollama).

## 7. Известные ловушки

1. **Резолвер evidence молча не находил маркер до `fef10e5`** (2026-07-22). `gh api` переключается на POST,
   как только передан `-f`, а contents API отвечает 404 на всё, кроме GET. `ref` уходил как `-f` → 404 →
   `MARKER_NOT_FOUND` на каждой ветке, что бы ни было закоммичено. Теперь `ref` в query string; покрыто
   тестом со стабом `gh` на PATH.
2. **Фильтр `dispatchedAt` пропускал всё до `a4b6409`** (2026-07-22). Список веток отдаёт только
   `commit.sha` и `commit.url`, поэтому `.commit.commit.committer.date` давал `null`, а `null` в
   `filterBranches` трактуется как «оставить». Маркер на ветке недельной давности принимался как evidence.
3. **`cursor:bridge:status` врёт.** `buildStatusSnapshot` хардкодит `running: true`
   (`tools/cursor-local-bridge/src/server.ts:58`) и печатает снапшот, не проверяя порт — команда
   отвечает «running» при полностью выключенном мосте. Проверять живость только запросом на `:17319`.
4. **Skills у сотрудников декоративны.** `EmployeeSkill[]` в `employeeRegistrySeed.ts` заполнены, но ни
   делегирование, ни выбор исполнителя, ни допуск к инструментам по ним не считаются: делегирование идёт
   по захардкоженным `targetEmployeeId` в `delegationEngineCatalog.ts`, допуск — по булевым флагам
   `capabilities`. В промпт модели skills не попадают. Не строить логику на них.
5. **Две несовместимые модели навыка** одновременно: `EmployeeSkill` (level — enum beginner…expert) и
   `Skill` из `domain/competencies/` (level — число 1–5, + `category`, `verified`). Не путать при чтении кода.
6. **Тесты не типизируются.** `tsconfig.app.json:24` — `"exclude": ["src/**/*.test.ts"]`, поэтому
   `tsc -b` и `npm run build` их не видят. Гарантия «сломается на компиляции» на тестовый код
   **не распространяется**: фикстура с аннотацией типа может разойтись с самим типом и молча пройти
   сборку — ровно это и случилось при добавлении `checksOutcome` в `d84c997`. Проверять тестовые
   файлы приходится отдельным прогоном `tsc` с `--allowImportingTsExtensions`.
   Замер (2026-07-23, временный конфиг без `exclude`): **55 ошибок в 12 файлах**. 49% —
   `Cannot find module 'node:test'`, лечится строкой `types: ["vite/client", "node"]`; 20% — механика
   (`assert.ok` не сужает тип, неиспользуемое, `as Window`); 31% — реальные расхождения фикстур,
   из них 9 в одном `cursorAutomationRunner.test.ts`. Рекомендация: **отдельный `tsconfig.test.json`
   + скрипт `typecheck:test`**, не снятие `exclude` — `npm run build` не должен падать из-за фикстур.
   Худшее: `cursorAutomationRunner.test.ts` читает `.envelope` без сужения по `status` (3 места) —
   в ветке `RESULT_PENDING` поля нет, тест молча сравнит `undefined` и всё равно пройдёт.
   **Конкретные известные расхождения** (найдены 2026-08-31 при точечном прогоне `tsc` по тестам):
   `cursorResultEnvelope.test.ts:334` — в `validateExecutionResultEnvelope({...analysisRaw, …})`
   у спреда `route` выводится как `string`, а не как литеральный union (`TS2345`);
   `cursorResultEnvelope.test.ts:384` — `parseCursorResultEnvelope` получает `ExecutionResultEnvelope`,
   в который `LOCAL_OLLAMA_ANALYSIS` не сужается. Blame: `5dd3fc5` и `9cd036d` от 2026-07-23, то есть
   наследие развязки надтипа, **не блока 3**. Тесты зелёные — `tsx` типы стирает, рантайму всё равно, —
   но оба всплывут в первый же день, когда появится `typecheck:test`. Чинить вместе с введением этого
   скрипта, а не вслепую по одному.
7. **Сохранить конфиг ≠ подключиться.** Статус «Подключено» ставится только после успешного health-check
   через мост; при выключенном connections-bridge секреты вообще не сохраняются.
8. **`tsc -b` красный и без твоих правок** (замер 2026-08-29). Две ошибки `TS1294`
   («This syntax is not allowed when `erasableSyntaxOnly` is enabled») в
   `src/domain/memory/contradictionJudge.ts:33` и `:41`, предсуществуют с `5c73cb3`. К Ollama-маршруту
   и к диспетчеру отношения не имеют. Не принимать их за поломку своей ветки: сравнивать вывод
   `tsc -b` с этими двумя строками, а не с пустым выводом. Чинить отдельно — здесь только зафиксировано.
9. **`readCursorBaseUrl` падает на LAN-происхождении.** При пустом
   `VITE_TOOL_DISPATCHER_CURSOR_BASE_URL` фолбэк — `window.location.origin`
   (`toolDispatcherConfig.ts`, `resolveRelativeBaseUrl`), а вызывающий прогоняет результат через
   `assertToolEndpointHasNoRawIp`. С телефона по LAN origin — это `http://192.168.x.x:5174`, что
   попадает под запрещённый паттерн → исключение. Оно летит из `createCursorCapability()` при
   инициализации `REGISTRY`, то есть **на импорте модуля**, а не в момент диспатча: сломается всё,
   что тянет `toolDispatcher`. Guard задуман против захардкоженного IP в конфиге, а бьёт по
   собственному origin. Ветка `ollama` капкан обошла — там `assertToolEndpointHasNoRawIp` стоит только
   на значении из env, не на same-origin фолбэке (`bd6a018`); у Cursor по-прежнему на обоих.
   **ЗАКРЫТО (2026-10-21):** guard снят с same-origin фолбэка у Cursor, как у ollama. Без этого панель на
   офисном сервере по `http://192.168.1.157:8080` давала белый экран (проверено в браузере до/после).
   Регрессия: `toolDispatcherLanOrigin.test.ts`.
10. **Cursor-ветка в `approveToolExecutionRun:268` не тест-безопасна.** Под моканым `window`
    (а его мокает весь харнесс тестов, см. `manualCursorTaskFlow.test.ts`) условие
    `typeof window !== 'undefined'` истинно, ветка динамически импортирует `cursorLocalBridgeSync`
    и лезет в **реальный** мост. Прогон падает асинхронным `TypeError: Cannot read properties of
    undefined (reading 'trim')` уже **после** конца теста — node сообщает это как
    `unhandledRejection`, и виноватым выглядит следующий тест. Налетит любой будущий тест,
    одобряющий cursor-run под моком `window`; обходится тем, чтобы cursor-run в тестах не одобрять.
    **У ollama-ветки этого нет, но причина не та, что кажется:** `window`-guard'а у неё нет вовсе,
    а безопасна она потому, что `queueToolExecutionRunForOllamaAnalysis` никогда не бросает —
    любой провал возвращается типизированным исходом. Плюс её detached-вызов из `approve` не
    доходит до сети: прямой вызов успевает синхронно перевести run `approved → queued → running`
    до первого `await`, а динамический импорт резолвится тиком позже и находит run уже не в
    `approved`. **Если в `queueToolExecutionRunForOllamaAnalysis` появится `await` до этих
    переходов — тесты начнут ходить в живую модель** через dev-сервер на `:5174`. Подстраховка:
    `ollamaAnalysisSync.test.ts` выставляет `OLLAMA_BASE_URL` на закрытый порт.
11. **Каст `as Window` в харнессе мока storage даёт `TS2352`.** Пришёл из
    `manualCursorTaskFlow.test.ts` и копируется вместе с харнессом. В новых файлах
    (`toolExecutionRunBridge.test.ts`, `ollamaAnalysisSync.test.ts`) исправлено на
    `as unknown as Window`; в исходном осталось как есть — это та же «механика» из капкана №6,
    чинить вместе с `typecheck:test`. Копируя харнесс, сразу пиши `as unknown as Window`.
12. **`2f77db1` в сообщении указывает `275 pass`, фактически было 274** — цифра взята из прогона
    до удаления задвоившегося теста, а на самом коммите дубль уже убран. История не переписана
    осознанно: коммит лежит глубоко в запушенной ветке, и force-push всего маршрута ради косметики
    в сообщении не оправдан. Сверяться с числами в сообщениях коммитов вокруг этого места не стоит —
    источник правды по тестам это прогон, а не текст коммита.
13. **`OLLAMA_STREAM_ERROR` склеивает два разных случая.** Код выдаётся и когда Ollama не отдала
    body или чтение потока оборвалось (настоящий транспорт), и когда в NDJSON-чанке пришло поле
    `error` («model not found») — а это значит, что Ollama **ответила**, транспорт отработал.
    После развязки `createTransportFailureEnvelope` оба варианта получают `TRANSPORT_FAILED`,
    то есть второй помечается неточно — тот же класс огрубления, от которого мы ушли с
    `OLLAMA_EMPTY_RESPONSE` (он отправлен в `DISPATCHED` + `FAILED`, потому что HTTP 200 с
    дочитанным потоком транспортом не сломан). Расщепление требует двух кодов в
    `ollamaAnalysisClient.ts` — `consume()` знает, откуда пришла ошибка. Делать вместе со
    следующей правкой клиента, не отдельным заходом.
14. **Зелёный `test:domain` ничего не говорит о сборке.** `node --test` через `tsx` типы не проверяет —
    он их стирает, — поэтому ветка спокойно жила с красным `tsc -b`: `contradictionJudge.ts` объявлял
    поля через parameter properties конструктора, что запрещено включённым `erasableSyntaxOnly`
    (`TS1294`), и `npm run build` падал начиная с `5c73cb3`, пока тесты оставались зелёными. Починено
    механически в `aed9dc3`. **Гонять `npm run build` вместе с `test:domain`, а не вместо;** один
    другого не заменяет и не перекрывает.
