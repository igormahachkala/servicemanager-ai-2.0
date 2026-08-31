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

**ОСТАЛОСЬ до сквозного пути — два пункта.**

1. **Блок 3 — валидатор секций.** Сегодня секции запрашиваются `ollamaAnalysisPrompt.ts`, но не
   разбираются, и в конверте вечно стоит `metadata.sectionsValidated: false` — результат валидатора
   должен занять это поле вместо константы. Требование, добытое живым прогоном: **допускать хвост
   после `Effort`** — модель дописала свободный блок `Files needed for certainty:`, и это следствие
   нашего же промпта, который просит назвать недостающие файлы; строгая проверка «ровно четыре
   секции» забракует корректный ответ. При непрохождении секций `executionStatus` **не** `SUCCEEDED` —
   значит, понадобится либо новая фабрика, либо развязка `createTransportFailureEnvelope` (он всё ещё
   типизирован по `CursorResultEnvelope['route']`, `LOCAL_OLLAMA_ANALYSIS` туда не проходит).
2. **Развязка `toolId: 'cursor'`** в `requestBuilderCursorToolExecution`
   (`toolExecutionRunBridge.ts:123`) — единственная точка входа, создающая `ToolExecutionRun`. Ниже по
   стеку `createToolExecutionFromDispatcherRequest` уже нейтрален (берёт `input.request.toolId`), так
   что чинится вход в мост, а не сам run. Пока разрыв не закрыт, `runOllamaAnalysis` вызывается только
   из тестов и скрипта, и сквозного пути «задача → анализ → конверт» в проде не существует.

Дальше, вне сквозного пути: перенос слоя контекста из `agent-runner` (`contextLoader`/`fileSelector`
требуют моста к `fs` — сейчас промпт честно пишет, что контекста нет); персистентность
`executionRoute` колонкой на `ToolExecutionRun`.

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
