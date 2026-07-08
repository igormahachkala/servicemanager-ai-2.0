# AI-COMPANY-107J — Mobile MVP QA Checklist & Launch Notes

**Status:** Internal MVP (Mobile Owner Console V1)  
**Branch:** `ai-company-flow`  
**Last verified:** after AI-COMPANY-107H-4 smoke-test pass  
**Audience:** Owner, QA, internal demo

---

## 1. Mobile entry points

### How to open

```bash
cd apps/ai-company
npm run dev
```

Open in browser (phone viewport or DevTools device mode):

| URL | Screen |
|-----|--------|
| `http://localhost:5174/mobile/today` | Owner Home — default landing |
| `http://localhost:5174/mobile/employees` | Digital employee roster |
| `http://localhost:5174/mobile/employees/ag-max` | MAX mobile control (workday + queue) |
| `http://localhost:5174/mobile/tasks/new` | Assign task (Run Task mobile) |
| `http://localhost:5174/mobile/tasks/new?employee=ag-max` | Assign task — MAX preselected |
| `http://localhost:5174/mobile/decisions` | Owner decisions inbox |
| `http://localhost:5174/mobile/more` | More — links, theme, desktop escape hatch |
| `http://localhost:5174/mobile/reports` | Reports list |
| `http://localhost:5174/mobile/reports/morning-report` | Owner Morning Report detail |

**Shortcuts**

- Root `/mobile` redirects → `/mobile/today`
- FAB «Поставить задачу» (all tabs except `/mobile/tasks/new`) → action sheet → Run Task
- Bottom nav: Сегодня · Сотрудники · Задачи · Решения · Еще

**Related docs**

| Ticket | Topic |
|--------|-------|
| [107A](./AI-COMPANY-107A-mobile-design-system.md) | Design System V1 |
| [107B](./AI-COMPANY-107B-mobile-owner-home.md) | Owner Home |
| [107C](./AI-COMPANY-107C-mobile-max-control.md) | MAX Control |
| [107D](./AI-COMPANY-107D-mobile-run-task.md) | Run Task |
| [107E](./AI-COMPANY-107E-mobile-employees-roster.md) | Employees roster |
| [107F](./AI-COMPANY-107F-mobile-decisions.md) | Decisions |
| [107G](./AI-COMPANY-107G-mobile-reports.md) | Reports |

---

## 2. Internal demo flow (recommended loop)

Полный Owner loop на телефоне без desktop sidebar:

```
/mobile/today
  └─ FAB или quick action «Поставить задачу»
       └─ /mobile/tasks/new
            └─ MAX · шаблон или текст · Submit
                 └─ createEmployeeWorkItem() → localStorage
                      └─ «Открыть MAX»
                           └─ /mobile/employees/ag-max
                                ├─ «Начать рабочий день» (Operating Day)
                                └─ «Выполнить следующую» (Worker Loop — Owner action)
                                     └─ дождаться завершения / journal entry
                                          └─ /mobile/reports
                                               └─ открыть runtime / journal / morning report
                                                    └─ /mobile/decisions
                                                         └─ approve / reject или «Открыть детали»
```

**Timing:** 10–15 минут для полного цикла с реальным Ollama run.

**Demo tips**

- Начните с пустого localStorage или знайте текущее состояние — empty states осмысленные, не fake.
- Для быстрого smoke без LLM: создайте задачу → проверьте queue → не запускайте Run Next.
- Для полного demo: Ollama healthy + модели установлены (см. §3).

---

## 3. Environment requirements

### Dev server

| Item | Value |
|------|-------|
| Command | `npm --prefix apps/ai-company run dev` |
| Dev URL | `http://localhost:5174` |
| Preview build | `npm run build && npm run preview` → `http://localhost:4174` |
| Build check | `npm --prefix apps/ai-company run build` |

### Ollama (для Worker Loop / Runtime demo)

Mobile UI **не требует** Ollama для навигации и постановки задач. Ollama нужен только если demo включает **Run Next** на MAX.

| Requirement | Notes |
|-------------|-------|
| Ollama running | `http://127.0.0.1:11434` (default) |
| `qwen2.5-coder:7b` | Fast / coder route — `OLLAMA_FAST_TEST_MODEL_TAGS` |
| `qwen3.6:27b` | Default primary — `OLLAMA_DEFAULT_MODEL_TAG` |
| Runtime provider | Ollama selected in Runtime Settings (desktop `/ops/runtime`) |

Pull if missing:

```bash
ollama pull qwen2.5-coder:7b
ollama pull qwen3.6:27b
```

### Data persistence

| Store | Scope |
|-------|-------|
| `localStorage` | Work Queue, Approvals, Journal, Operating Day, Runtime runs, Worker Loop |
| No backend | Multi-tenant / sync — V1 local only |
| Same origin | Mobile and desktop share one browser profile → one localStorage |

**Phone testing:** use same host (`host: true` in Vite) — e.g. `http://<LAN-IP>:5174/mobile/today`.

---

## 4. What works now (V1)

| Area | Route(s) | Real data source |
|------|----------|------------------|
| Mobile Owner Home | `/mobile/today` | Presence, Work Queue, Journal, Approvals snapshot |
| Employee roster | `/mobile/employees` | MAX active; Atlas/Sentinel placeholders |
| MAX control | `/mobile/employees/ag-max` | Workday, Work Queue, Last Result, quick assign |
| Task creation | `/mobile/tasks/new` | `createEmployeeWorkItem()` — no auto Runtime |
| Decisions inbox | `/mobile/decisions` | Approvals, Cursor gates, knowledge, blocked, failed loops |
| Reports | `/mobile/reports`, `/mobile/reports/:id` | Morning report, runtime, ODS, journal |
| Theme | Header + More | Light / dark via Theme System V1 |
| Mobile href resolver | Cards / links | MAX workspace, run-task, reports → mobile paths |

**Explicitly does NOT auto-start on mobile submit**

- Runtime
- Worker Loop
- `startNextEmployeeWorkItem`

Run Next on MAX page — отдельное Owner действие.

---

## 5. Known limitations

| Limitation | Impact |
|------------|--------|
| **Only MAX active** | `ag-max` — единственный enabled employee для Run Task и mobile control |
| **Atlas / Sentinel / Builder placeholders** | Roster visible; picker disabled; «Скоро» |
| **Desktop fallbacks remain** | Non-MAX employees, deep runtime viewer, some report tools → `/ops/*` |
| **No mobile runtime viewer** | Run progress / live trace — desktop only |
| **No mobile hire flow** | Hire card — placeholder |
| **localStorage only** | No cross-device sync; clear storage = reset demo |
| **Reports not in bottom nav** | Under **Еще** → Отчёты |
| **Tasks tab** | List placeholder; create via FAB or `/mobile/tasks/new` |
| **No push / offline** | Refresh manual; focus/storage events only |

---

## 6. QA checklist (route-by-route)

Use viewport ≤480px. Toggle light/dark once per session.

### Global shell

- [ ] `/mobile` → redirects to `/mobile/today`
- [ ] Bottom nav highlights correct tab
- [ ] FAB hidden on `/mobile/tasks/new`
- [ ] FAB opens assign sheet with Run Task + Morning Report
- [ ] Theme switch works (header)
- [ ] Unknown route → `/mobile/today`

### `/mobile/today` — Owner Home

- [ ] Hero metrics load (may be zero)
- [ ] Company status card
- [ ] Employee results section (or empty)
- [ ] Decisions preview → link `/mobile/decisions`
- [ ] Quick actions navigate correctly
- [ ] Refresh does not fabricate data

### `/mobile/employees` — Roster

- [ ] MAX card opens `/mobile/employees/ag-max`
- [ ] Placeholder employees show «Скоро»
- [ ] Hire section visible (non-functional)

### `/mobile/employees/ag-max` — MAX Control

- [ ] Ready / active banner matches prior activity
- [ ] Workday card — start / continue / finish
- [ ] Work Queue shows items after task creation
- [ ] «Поставить задачу» → `/mobile/tasks/new?employee=ag-max`
- [ ] Run Next disabled when queue empty or item in progress
- [ ] After creating task elsewhere — queue updates on navigate / focus
- [ ] Reload — queue persists

### `/mobile/tasks/new` — Run Task

- [ ] MAX selected by default
- [ ] Template fills composer
- [ ] Submit disabled when task text empty
- [ ] Validation message visible when invalid
- [ ] Submit creates item in Work Queue
- [ ] Success: «Открыть MAX» + «Добавить ещё»
- [ ] No Runtime start on submit alone

### `/mobile/tasks` — Tasks tab

- [ ] CTA → `/mobile/tasks/new`
- [ ] Empty state shown (no task list V1)

### `/mobile/decisions` — Decisions

- [ ] Filters: Все / Согласования / Cursor / Knowledge / Blocked
- [ ] Empty state + «Вернуться сегодня»
- [ ] Approval cards: Approve / Reject (if pending in localStorage)
- [ ] Non-actionable items: «Открыть детали» (mobile or desktop href)

### `/mobile/reports` — Reports

- [ ] Morning Report hero when data exists
- [ ] Runtime / ODS / journal cards
- [ ] Empty state → assign task CTA
- [ ] Card opens `/mobile/reports/:id`

### `/mobile/reports/morning-report`

- [ ] Sections from real morning report snapshot
- [ ] Back navigation works

### `/mobile/more` — More

- [ ] Links: Reports, Morning Report, MAX, Desktop
- [ ] Theme card + ThemeSwitch
- [ ] Desktop link opens `/ops` (intentional escape hatch)

### End-to-end (critical path)

- [ ] Today → assign → MAX queue → (optional Run Next) → report appears → decisions checked
- [ ] `npm --prefix apps/ai-company run build` green

---

## 7. Launch verdict

### Mobile Owner Console V1 — Internal MVP

## ✅ READY

**Rationale**

- All MVP routes implemented and wired in `MobileRoutes.tsx`
- Smoke-test passed after 107H-4 (task create → queue → persist)
- Owner loop completable on mobile: Today → Task → MAX → Reports → Decisions
- Design System V1 + theme + bottom nav stable
- Build green; no backend dependency

**Not a public / production launch**

- localStorage-only, single active employee, desktop fallbacks for advanced ops
- Suitable for **internal demos**, **Owner dogfooding**, **QA regression** on `ai-company-flow`

**Sign-off checklist before external demo**

1. Ollama healthy if showing live execution
2. Fresh or known localStorage state explained to audience
3. Phone/LAN URL tested once
4. §6 critical path executed same day

---

## 8. Known issues (non-blocking)

| Issue | Workaround |
|-------|------------|
| Reports only under More | Bookmark `/mobile/reports` or use Today quick action |
| Tasks tab has no list | Use FAB or MAX queue as source of truth |
| Some decision types open desktop | Expected V1 — full action only for approvals + Cursor gate |
| 107A doc port typo (5177) | Use **5174** — see §3 |

No blocking bugs open at 107J cut line.

---

## 9. Next recommended tasks

| Priority | Task | Why |
|----------|------|-----|
| P1 | **107K — Mobile Tasks list** | `/mobile/tasks` shows real queue, not placeholder |
| P1 | **Enable Atlas/Sentinel** | Roster → Run Task for second employee |
| P2 | Reports in bottom nav or Today deep links | Reduce More-tab friction |
| P2 | Mobile runtime run status (read-only) | Close loop without desktop |
| P3 | Mobile hire flow stub → real create | Company growth narrative |
| P3 | Cross-tab storage sync indicator | Clarify local-only model |

---

## 10. Quick reference commands

```bash
# Dev
npm --prefix apps/ai-company run dev

# Build (CI / pre-demo)
npm --prefix apps/ai-company run build

# Ollama health
curl -s http://127.0.0.1:11434/api/tags | head

# Open mobile (macOS)
open http://localhost:5174/mobile/today
```
