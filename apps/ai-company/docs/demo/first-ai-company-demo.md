# First AI Company Demo — сценарий 15 минут

> **Task:** AI-COMPANY-078  
> **Audience:** Owner, инвестор, product/engineering stakeholder  
> **App:** `apps/ai-company` → Mission Control (`/ops`)  
> **Duration:** ~15 минут (10 блоков × ~1–2 мин)

---

## Суть демо одной фразой

**AI Company — не чат с моделью, а операционная система цифровой компании:** сотрудники с идентичностью, задачи в контексте проекта, прозрачный runtime, контроль Owner, память и следующий шаг работы.

---

## Подготовка (до встречи)

| Проверка | Действие |
|----------|----------|
| Сборка | `cd apps/ai-company && npm run build` — green |
| Runtime | Ollama доступен (`/ops/runtime`) или mock-провайдер для offline-demo |
| Данные | Локальный seed: AI Photo Lab project, Atlas (`ag-cto`), sprint/control room |
| Браузер | Один таб, zoom 100%, язык RU или EN — заранее выбрать |
| Fallback | Если Ollama медленный: показать **уже завершённый** run из `/ops/runs` + task result из `/ops/task-results` |

**Рекомендуемый demo-task (Atlas, planning):**

```text
Atlas, проанализируй текущее состояние AI Photo Lab sprint:
перечисли 3 риска, 3 следующих шага для Owner и предложи один follow-up task для MAX.
```

**Маршруты (шпаргалка):**

| Экран | URL |
|-------|-----|
| Command Center | `/ops` |
| Run Task | `/ops/run-task` |
| Live Runtime | `/ops/runtime/live` |
| Runtime Cost (полный) | `/ops/runs` или `/ops/runtime` |
| Task Results | `/ops/task-results` |
| Approvals | `/ops/approvals` |
| Employee Memory | `/ops/employees/ag-cto/memory` |
| Operating Day | `/ops/day` |

---

## Тайминг

| # | Блок | Мин |
|---|------|-----|
| 1 | Command Center | 2 |
| 2 | Запуск задачи | 1.5 |
| 3 | Live Runtime | 2 |
| 4 | Prompt Preview | 1.5 |
| 5 | Runtime Cost | 1 |
| 6 | Task Result | 1.5 |
| 7 | Approve | 1.5 |
| 8 | Memory Evolution | 1.5 |
| 9 | Suggested Actions | 1.5 |
| 10 | Operating Day | 1 |
| | **Итого** | **~15** |

---

## 1. Command Center

**URL:** `/ops`

### Что показать

- **Morning Brief** — приветствие, health score, ссылка на Operating Day.
- **Quick Launch** — Atlas, Run Task, Control Room, Sprint.
- **Company Health** + графики активности.
- **Employees Working / Waiting** — «живая» компания, не один бот.
- **Pending Approvals** + **Next Suggested Actions** (превью).
- **Runtime panel** + **Runtime Cost Monitor** (completed today, cost today, timeout rate).
- **Live Timeline** — события компании (`runtime.*`, `memory.evolved`, approvals).

### Что рассказать

> «Это не чат. Это пульт Owner: видно, кто работает, что ждёт решения, сколько стоит runtime сегодня и что произошло в компании. Все цифровые сотрудники — персистентные роли в организации, а не disposable sessions.»

### На что обратить внимание

- Подчеркнуть **Owner in control**: approvals и suggested actions не исполняются сами.
- Не уходить в детали Canvas/Photo Lab — только как пример реального проекта.
- Если аудитория technical — одной фразой: данные localStorage, multi-tenant через companyId в архитектуре продукта.

---

## 2. Запуск задачи

**URL:** `/ops/run-task` (или Quick Launch → **Run Task**)

### Что показать

1. **Task input** — вставить demo-task (см. выше).
2. **Employee** — Atlas (`ag-cto`), mode **planning**.
3. **Project & workspace** — AI Photo Lab (если выбран).
4. **Runtime model mode** + routing panel (resolved Ollama tag).
5. **Preview** — auto title, expected output.
6. Кнопка **Start** → автопереход на Live Runtime.

### Что рассказать

> «Owner не пишет промпт в вакууме. Задача привязана к сотруднику, проекту, workspace и mode. Start создаёт delivery task, execution, runtime run, report draft, timeline event и notification — полный рабочий контур, не один API call.»

### На что обратить внимание

- Flow из intro на странице: *paste → pick employee → Start → Live*.
- Если Ollama недоступен — переключить на mock и честно сказать: «execution simulated, UI и audit trail реальные».
- Не менять сотрудника mid-demo — держать Atlas для связности narrative.

---

## 3. Live Runtime

**URL:** `/ops/runtime/live?runId=…`

### Что показать

- **Stats bar** — employee, resolved Ollama model, elapsed, timeout, state badge.
- **Living banner** — «doing now» (если run active).
- **Pipeline** — шаги: context → approval (если есть) → model router → execution → report.
- **Live execution stream** — merged pipeline + logs + timeline.
- **Side panel** — context layers, result preview, integrations (run page, report, workspace).

### Что рассказать

> «Runtime — observable process. Owner видит pipeline, провайдера, таймаут и результат в реальном времени. Это NOC для цифровых сотрудников, а не чёрный ящик LLM.»

### На что обратить внимание

- Дождаться `completed` или заранее открыть finished run.
- Если `waiting_approval` — показать как gate (связь с шагом 7).
- Не застревать на logs — 20 секунд stream достаточно.

---

## 4. Prompt Preview

**URL:** тот же `/ops/runtime/live` → вкладка **Prompt Preview**

### Что показать

Секции в порядке сборки:

1. **System Prompt**
2. **Employee Identity**
3. **Task**
4. **Context** (loaded layers)
5. **Instructions**
6. **Final Prompt** (highlight)

Кнопки **Copy Prompt** и **Export Prompt** (`.md`).

### Что рассказать

> «Owner видит точно то, что уходит в модель. Prompt Builder собирает runtime одинаково для всех запусков: Task → Employee → Project → Workspace → Context → Final Prompt. Никаких скрытых system messages.»

### На что обратить внимание

- Explicit prompt mode: если task text = final prompt, показать note про `explicitOverride`.
- Сравнить **Final Prompt** с тем, что ввели на Run Task — связность narrative.
- Export — артеfact для audit/compliance demo.

---

## 5. Runtime Cost

**URL:** stats на Live Runtime **или** `/ops/runs` / `/ops/runtime` / Command Center panel

### Что показать

- **Completed Today**, **Cost Today**, **Timeout Rate**.
- На выбранном run: tokens, cost, CPU time, duration.
- На `/ops/runs`: dashboard — fast/heavy models, top employees, longest run.

### Что рассказать

> «Цифровая компания имеет unit economics. Owner видит estimated cost и performance до масштабирования — без внешнего billing API в V1, но с тем же UX, что нужен в production.»

### На что обратить внимание

- Цифры **estimated** — не invoice, а operational visibility.
- Operating Day (шаг 10) reuse те же метрики — foreshadow.
- 60 секунд максимум — не превращать в финансовый отчёт.

---

## 6. Task Result

**URL:** `/ops/task-results` → последний result **или** link с Live Runtime / Run Task result panel

### Что показать

- Список results: employee, status, title, links.
- **Task Result detail**: review panel, summary, links to run / report / project.
- **Timeline** событий по result.
- Compact **Memory Evolution** (если run completed).

### Что рассказать

> «Результат работы — артеfact компании, не сообщение в чате. Task Result связан с runtime run, report, project и audit trail. Owner review — отдельный шаг governance.»

### На что обратить внимание

- Status badge: `pending_review` → мост к Approve.
- Показать cross-links (Open Run, Open Report) — integration story.
- Если result пуст — вернуться к pre-seeded run из подготовки.

---

## 7. Approve

**URL:** Task Result detail → **Approve** **или** `/ops/approvals` **или** runtime run `waiting_approval`

### Что показать

**Primary path (рекомендуется):**

- На **Task Result detail** — `TaskResultReviewPanel`: Approve with comment / Request changes.
- Status → approved; timeline event.

**Alternative paths (если спросят):**

- `/ops/approvals` — queue runtime / tool / policy approvals.
- Runtime run page — approve execution before model runs (`waiting_approval`).

### Что рассказать

> «Irreversible и significant actions проходят через Owner. Сотрудник готовит — Owner решает. Это reports-first governance, не auto-agent loop.»

### На что обратить внимание

- Явно contrast с «AI сделал и сам пошёл дальше».
- Policy badges на `/ops/approvals` — capability + scope (архитектурный инвариант).
- После approve — notification / timeline update (если видно).

---

## 8. Memory Evolution

**URL:** `/ops/runtime/runs/:id` **или** Task Result / `/ops/employees/ag-cto/memory`

### Что показать

- **Memory Evolution panel** после completed run:
  - Today learned
  - Experience gained
  - Knowledge added
  - Memory added
  - Lessons by category (finding / mistake / improvement / knowledge)
- Timeline event `memory.evolved`.
- На **Employee Memory** — today summary.

### Что рассказать

> «Компания учится. После runtime + report система извлекает уроки в employee memory и project knowledge — без ручного copy-paste из чата. Один run → один evolution record (idempotent).»

### На что обратить внимание

- Flow: Runtime → Report → Memory + Knowledge + Experience (см. `docs/ux/memory-evolution.md`).
- Не LLM-hallucination: extraction из report findings/risks/recommendations.
- Связь с Knowledge catalog (`/ops/knowledge`) — optional 10 сек peek.

---

## 9. Suggested Actions

**URL:** Task Result detail **или** Command Center → **Next Suggested Actions** **или** `/ops/employees/ag-cto/workspace`

### Что показать

- **Next Suggested Actions** panel:
  - kind (next_task, send_qa, send_max, …)
  - priority, rationale
  - **Approve** / **Dismiss**
  - **Open Run Task** (pre-filled href)
- Command Center compact panel — pending count.

### Что рассказать

> «Сотрудник предлагает следующий шаг работы — Owner утверждает. Work Scheduler не запускает цепочку autonomously. Это managed autonomy: analyze → suggest → approve → execute.»

### На что обратить внимание

- Отличие от n8n auto-trigger: **human gate обязателен**.
- Approve suggestion → можно показать pre-filled Run Task (optional, если осталось время).
- `ownerApprovalNote` на UI — прочитать вслух.

---

## 10. Operating Day

**URL:** `/ops/day`

### Что показать

Фазы дня (scroll через board):

| Phase | Содержание |
|-------|------------|
| Morning | Brief, priorities, health |
| Employees | Who started workday |
| Current work | Sprint, deliveries |
| Meetings | Collaboration sessions |
| Approvals | Pending queue |
| **Runtime** | completed today, cost, timeout rate |
| Reports | Today reports |
| End of day | Summary metrics |

**Operating Day Links Bar** — быстрые переходы обратно в Command Center, Runtime, Task Results, Timeline.

### Что рассказать

> «Operating Day — narrative wrapper вокруг всего, что мы только что показали по частям. Owner начинает утро с brief, проходит через work/runtime/approvals и закрывает день summary. Одна компания — один день — один экран.»

### На что обратить в attention

- Runtime phase должен совпадать с цифрами из шага 5 — consistency check.
- Закрыть demo здесь: «мы прошли полный цикл Owner за один рабочий день».
- Link из Morning Brief на Command Center — circular story.

---

## Почему это отличается

### ChatGPT

| ChatGPT | AI Company |
|---------|------------|
| Сессия без org context | Employee + project + workspace + company tenant |
| Скрытый system prompt | **Prompt Preview** — full transparency |
| Нет audit trail работы | Runs, reports, timeline, task results |
| Нет Owner approval gates | Approvals + suggested actions require Owner |
| Память = chat memory product feature | **Memory Evolution** → employee memory + knowledge |

### Cursor

| Cursor | AI Company |
|--------|------------|
| IDE pair-programmer для одного dev | **Operating system** для whole digital org |
| Фокус на код в repo | Tasks, reports, handoffs, sprint, control room |
| Agent в editor context | Runtime pipeline observable by Owner |
| Individual workflow | Multi-employee collaboration + presence |

### Claude Code

| Claude Code | AI Company |
|-------------|------------|
| CLI/agent для codebase tasks | Web Mission Control для company operations |
| Developer-centric | Owner-centric governance |
| Session-based execution | Persistent runs, results, evolution |
| Tool use in terminal | Tool registry + executions + approvals |

### n8n

| n8n | AI Company |
|-----|------------|
| Workflow automation graph | **Digital employees** with identity and memory |
| Triggers fire automatically | **Suggested Actions** — suggest, not auto-run |
| Nodes без org model | Departments, projects, workspaces, employees |
| Cost opaque per workflow | **Runtime Cost Monitor** per run/employee/model |
| Integration-first | Reports-first + human control + audit |

**Общий тезис:**

> ChatGPT/Cursor/Claude Code/n8n решают **инструментальный** слой (чат, код, CLI, automation).  
> AI Company решает **организационный** слой: кто работает, над чем, с каким prompt, за сколько, с чьего approval, что компания запомнила и что делать дальше.

---

## Closing (30 секунд)

1. «Мы не показали модель — мы показали **компанию**.»
2. «Owner всегда видит prompt, cost, result и next step.»
3. «Следующий шаг после demo: ваш project + ваши employees + ваш runtime provider.»

---

## Troubleshooting

| Проблема | Workaround |
|----------|------------|
| Ollama timeout | Mock provider; показать completed run из history |
| Пустой Task Result | Запустить Run Task заранее; открыть pre-seeded result |
| Нет Suggested Actions | Нужен completed run → work scheduler генерирует plan |
| Нет Memory Evolution | Нужен completed run + report; открыть `/ops/runtime/runs/:id` |
| RU/EN mix | `localStorage ai-company-language` → `ru` или `en` |

---

## Связанные документы

- [AI Company Vision](../vision/ai-company-vision.md)
- [Platform vs Company](../north-star/platform-vs-company.md)
- [Runtime Cost Monitor](../ux/runtime-cost-monitor.md)
- [Memory Evolution](../ux/memory-evolution.md)
- [Runtime domain](../domain/runtime.md)
