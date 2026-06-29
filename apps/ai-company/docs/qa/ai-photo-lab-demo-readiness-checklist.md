# AI Photo Lab Demo Readiness Checklist

> **Task:** AI-PHOTO-LAB-003  
> **Author:** Sentinel (AI QA)  
> **Date:** 2026-06-29  
> **Target:** `https://vitrina.sma-assistants.ru`  
> **Product repo:** `~/projects/ai-photo-lab`  
> **Automation:** `.qa-tmp/ai-photo-lab-demo-readiness.mjs` (API smoke)

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Overall demo readiness** | **Needs Fix** |
| **Ready** | 7 / 10 |
| **Needs Fix** | 3 / 10 |
| **Blocked** | 0 / 10 |

Платформа **готова к guided demo** на существующих проверках (история, ручные зоны, чат, технический отчёт, mobile).  
**Не готова к live demo «с нуля»** на новом фото: vision pipeline через Ollama на production сейчас нестабилен (HTTP 500, пустые зоны).

**Рекомендация для демо:** использовать проверку с сохранёнными зонами (`d27030bb-…`) или заранее загруженное фото; не полагаться на fresh upload в live-сессии до фикса Ollama.

---

## Checklist

| # | Gate | Status | Evidence | Notes |
|---|------|--------|----------|-------|
| 1 | **Сайт открывается** | **Ready** | `GET /` → HTTP 200; SPA `ИИ Контроль Витрин`; viewport meta present | Desktop + mobile UI render |
| 2 | **Health работает** | **Ready** | `GET /health` → HTTP 200, `{"status":"ok","app":"ai-photo-lab",…}` | Endpoint стабилен (~90 ms). В body `nodeEnv: development`, `ollamaBaseUrl: http://localhost:11434` — observability gap, не блокер |
| 3 | **Фото загружается** | **Ready** | `POST /api/photo-checks` multipart → HTTP 200; файл в `uploads/photo-checks/`; запись в SQLite | Upload path не блокирует demo |
| 4 | **AI анализ запускается** | **Needs Fix** | Upload возвращает 200, но `errorMessage`: Ollama HTTP 500 (`zlib: invalid header`); `fillRate: null` на новых QA-прогонах | Из 9 проверок на prod: 4 с `fillRate`, 2 с `errorMessage`. Анализ **иногда** работает, но **не детерминирован** |
| 5 | **Зоны отображаются** | **Needs Fix** | UI: `AnnotatedPhoto`, legend, problem list. На prod: **1/9** проверок с зонами (2 auto + 2 corrected). Новые upload без зон при ошибке Ollama | Для demo: открыть check `d27030bb-3e35-43ca-8f62-4876a1357d98` или после ручной разметки |
| 6 | **Зоны можно редактировать** | **Ready** | `PATCH /api/photo-checks/:id/zones` → 200; `zonesHumanCorrected: true`; UI кнопка «Исправить зоны» → `ZoneEditor` (rect/circle, zoom/pan, mobile @900px) | Координаты **нормализованные 0–1**; pixel coords silently dropped |
| 7 | **Чат работает** | **Ready** | `POST …/chat` → 200, answer ~163 chars, 2 messages persisted; UI quick questions + «Отправка…» flow | Fallback-ответы работают даже при слабом vision result |
| 8 | **История сохраняется** | **Ready** | `GET /api/photo-checks` → 9+ items; новая QA-проверка видна сразу; mobile tab «История» + settings accordion «Проверки фото» | Reload сохраняет выбор |
| 9 | **Отчёт открывается** | **Ready** | Settings → «Технические детали» → toggle «Показать технический ответ ИИ» (prompt, raw response, JSON `parsedResult`, debug context) | **PDF export отсутствует** (backlog `task-apl-009` / Codex). Для demo «отчёт» = in-app technical report |
| 10 | **Mobile layout usable** | **Ready** | Viewport 390×844: bottom nav (Проверка / Чат / История / Обучение / Настройки), onboarding card, tab isolation, accordion settings | Manual UI pass PASS |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Ready** | Gate проходит на production; можно показывать в demo без workaround |
| **Needs Fix** | Функция есть, но flaky / частично / требует pre-seeded data |
| **Blocked** | Gate не проходит; demo path недоступен |

---

## Test runs

### Production API smoke (2026-06-29)

```bash
node .qa-tmp/ai-photo-lab-demo-readiness.mjs https://vitrina.sma-assistants.ru
```

| Step | Result |
|------|--------|
| Site | 200, SPA |
| Health | 200, ok |
| Upload | 200, id created |
| Analysis | `critical`, Ollama 500, no fillRate |
| Zones (auto) | 0 |
| Zone PATCH | 200 (with normalized coords) |
| Chat | 200, 2 messages |
| History | 9 checks, new persisted |
| Report data | parsedResult + rawResponse + prompt |

Raw output: `.qa-tmp/apl-prod-qa.json`

### Local API smoke (`http://127.0.0.1:3002`)

Same script — upload/chat/history PASS; Ollama 500 on tiny PNG (same root cause if local Ollama not serving valid vision input).

Raw output: `.qa-tmp/apl-local-qa.json`

### Manual UI (mobile 390×844)

- Onboarding skippable  
- Tabs switch correctly  
- Selected check shows manual zone «QA» in problem list  
- Chat sends quick question (button → «Отправка…»)  
- Settings sections «Проверки фото», «Технические детали» reachable via nav  

---

## Findings & risks

### P0 — Vision analysis instability

- **Symptom:** `Ollama unavailable: HTTP 500` / `zlib: invalid header` on new photo checks.  
- **Impact:** empty auto-zones, no fillRate, weak demo on fresh upload.  
- **Owner:** Codex + Daedalus (`task-apl-005`, Ollama tuning handoff).  
- **Workaround:** demo on existing check with zones or after manual zone edit.

### P1 — Sparse auto-zones in history

- **Symptom:** 8/9 checks without AI zones; only 1 with 2 zones (+ manual corrections).  
- **Impact:** «зоны отображаются» gate **Needs Fix** for typical new upload.  
- **Owner:** `task-apl-006` zone accuracy audit.

### P2 — Report = in-app only

- PDF / export pipeline not in MVP UI. Technical report accordion is the demo «report».  
- Align stakeholder expectation before demo.

### P3 — Health metadata

- Production `/health` reports `nodeEnv: development` and localhost Ollama URL. Misleading for ops; not user-facing.

---

## Demo script (recommended, ≤5 min)

1. Open `https://vitrina.sma-assistants.ru` — skip onboarding.  
2. **История** → выбрать проверку с зонами (`d27030bb-…`) или последнюю с ручной зоной «QA».  
3. **Проверка** — показать фото с разметкой, статус, рекомендацию, «Исправить зоны».  
4. **Чат** — quick question «Почему такой статус?».  
5. **Настройки** → «Технические детали» → показать JSON / prompt (отчёт).  
6. Resize / mobile — bottom nav tour.

**Avoid in live demo:** upload нового фото без pre-check Ollama.

---

## Mapping to Control Room gates

| Control Room key | This checklist | Status |
|------------------|----------------|--------|
| `production_health` | Health | Ready |
| `photo_upload` | Photo upload | Ready |
| `ai_analysis` | AI analysis | Needs Fix |
| `visual_zones` | Zones display | Needs Fix |
| `manual_zone_edit` | Zone edit | Ready |
| `inspection_chat` | Chat | Ready |
| `report_history` | History + report | Ready |
| `mobile_view` | Mobile layout | Ready |
| `local_run` | Local server starts (`npm run dev:server`) | Ready (separate from prod gate) |

---

## Sign-off

| Role | Decision | Date |
|------|----------|------|
| Sentinel (QA) | **Needs Fix** — conditional demo OK | 2026-06-29 |
| Owner | _pending_ | |
| Atlas (CTO) | _pending_ | |

**Next actions**

1. Fix Ollama vision 500 on production before «fresh photo» demo.  
2. Re-run `.qa-tmp/ai-photo-lab-demo-readiness.mjs` → target ≥9/10 Ready.  
3. Owner sign-off after gates 4–5 green on **new** upload.

---

## References

- [Sprint 1 CTO plan](../delivery/ai-photo-lab-sprint-1-cto-plan.md)  
- Control Room: `/ops/projects/project-ai-photo-lab/control-room`  
- Product: `~/projects/ai-photo-lab`  
- Deploy: `docs/deploy.md` in product repo
