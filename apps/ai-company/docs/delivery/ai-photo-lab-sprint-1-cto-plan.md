# AI Photo Lab Sprint 1 CTO Plan

**Author:** Atlas (AI CTO)  
**Project:** AI Photo Lab / ИИ Контроль витрин  
**Sprint:** Sprint 1 — Working MVP (`sprint-apl-1`)  
**Date:** 2026-06-25  
**Status:** Kickoff — pending Owner review  
**Links:** [Control Room](/ops/projects/project-ai-photo-lab/control-room) · [Sprint 1](/ops/sprint/sprint-apl-1) · [Delivery Plan report](/ops/reports/report-apl-delivery-plan) · [#ai-photo-lab-delivery](/ops/chats/conv%3Achat-apl-delivery)

---

## Executive summary

Owner поставил цель: **рабочий MVP контроля витрин к концу недели** на `https://vitrina.sma-assistants.ru`.  
Как CTO проекта я подтверждаю: **функциональный каркас MVP уже в standalone-репо** (`~/projects/ai-photo-lab`), но **delivery gate не пройден** — 13 audit/checklist задач в Sprint 1, 0 завершённых, progress проекта **28%**.

Sprint 1 — не «писать с нуля», а **стабилизировать, проверить, зафиксировать риски и отдать Codex только то, что требует кода**.  
До первого merge в production — **Owner approval** на Codex backlog и deployment checklist.

---

## 1. Project context (прочитано)

| Поле | Значение |
|------|----------|
| **Product** | AI Photo Lab / ИИ Контроль витрин |
| **Goal** | Рабочий MVP: upload → vision analysis → zones → chat → report/history → demo |
| **Deadline** | Конец следующей недели (seed: `deadlineEndOfNextWeek()`) |
| **Production** | `https://vitrina.sma-assistants.ru` · health `/health` · PM2 · `/opt/ai-photo-lab` @ 194.67.92.12 |
| **Local repo** | `~/projects/ai-photo-lab` |
| **Vision model** | Ollama `qwen2.5vl:7b` |
| **Delivery model** | Digital team audits/plans in AI Company; **Codex implements code** per Owner directive |
| **Progress** | 28% · milestone «MVP audit & stabilization» — in progress (35%) |

**Уже реализовано в продукте (knowledge `kn-apl-features`):** AI analysis, visual zones, chat, training examples, manual zone editing, mobile nav, onboarding, zoom/pan, settings, HTTPS, PM2, production domain.

**Knowledge pack (5 items):** overview, paths/infra, vision model, features, delivery process — Owner и команда могут опираться на них без повторного сбора контекста.

---

## 2. Sprint 1 review

| Metric | Value |
|--------|-------|
| Sprint ID | `sprint-apl-1` |
| Name | Sprint 1 — Working MVP |
| Status | **Planned** (kickoff — старт по календарю sprint engine: следующий понедельник) |
| Sprint goal | Working MVP — audits, QA checklist, deployment plan, Codex handoff ready for demo |
| Tasks in sprint | **13** delivery tasks (all `task-apl-*`) |
| Commitment | **~60 SP** (по приоритетам задач) |
| Team capacity | **72 SP** (8 ролей) |
| Completed | **0** |
| In sprint / active | **5** in_progress + **1** review |
| Backlog in sprint | **7** |
| Blocked | **0** (пока) |
| Sprint health (computed) | **on_track** (нет blocked, capacity > commitment) |
| DoR / DoD | Задокументированы в sprint — audit output + QA sign-off + Codex routing |

**Sprint board snapshot (по статусам задач):**

| Column | Tasks |
|--------|-------|
| In Sprint (in_progress) | `001` MVP plan (Apex), `002` prod health (Helm), `005` vision audit (Daedalus), `010` QA checklist (Sentinel), `011` deploy checklist (Helm) |
| Review | `013` Codex backlog (Atlas) |
| Ready (backlog) | `003`–`004`, `006`–`009`, `012` |
| Done | — |

**Вывод Atlas:** Sprint 1 корректно scoped под audit-first. Риск не в planning, а в **параллельном execution без Owner gate на Codex** — sprint review notes явно запрещают Codex implementation до approval backlog.

---

## 3. Control Room review

**Health:** on_track (при текущих open risks — medium/high, не critical)  
**Risk level:** high (deadline risk open)  
**Demo checklist (10 gates):** все **pending / in_progress**, ни один **done**

| Demo gate | Owner task | Status |
|-----------|------------|--------|
| Local run | `task-apl-003` | backlog |
| Production health | `task-apl-002` | in_progress |
| Photo upload | `task-apl-004` | backlog |
| AI analysis | `task-apl-005` | in_progress |
| Visual zones | `task-apl-006` | backlog |
| Manual zone edit | `task-apl-007` | backlog |
| Inspection chat | `task-apl-008` | backlog |
| Report/history | `task-apl-009` | backlog |
| Mobile view | (no linked task) | pending |
| Deployment checklist | `task-apl-011` | in_progress |

**Codex handoff categories (6) в Control Room:** complex code, bug fixes, production deploy, PDF/report, Ollama tuning, UI implementation — все привязаны к audit tasks.

**Owner decisions queue (Control Room):**

1. **Approve Codex task backlog** — `task-apl-013` in review (Atlas)  
2. **Review MVP stabilization plan** — `task-apl-001` in progress (Apex) → report `report-apl-delivery-plan`  
3. **Approve deployment checklist** — when Helm completes `task-apl-011`  
4. **Pending approvals** — production deploy / github push (if triggered during week)

**Runtime (mock seeds):** Atlas completed arch review run → `report-apl-delivery-plan`; MAX audit run still **running**; QA and DevOps runs **completed** → readiness & risk reports.

---

## 4. Цель недели

**К пятнице (deadline):** Owner может пройти **end-to-end demo** на vitrina:

1. Login → upload photo → AI analysis (qwen2.5vl:7b) → zones (auto + manual) → inspection chat → report/history.  
2. **QA checklist signed** (Sentinel).  
3. **Deployment checklist approved** (Helm) — Codex deploy только после Owner sign-off.  
4. **Codex backlog approved and handed off** — fixes scoped, не scope creep.

**Definition of Done для Sprint 1:** все 10 demo gates ≥ `in_progress` с written output; gates 1–8 имеют audit notes; gate 9 (mobile) — explicit pass/fail; gate 10 — checklist ready for Owner.

---

## 5. Риски

| # | Risk | Severity | Mitigation (Atlas) |
|---|------|----------|-------------------|
| R1 | **Deadline** — 13 parallel audits, 0 done | High | Daily Control Room sync; freeze scope; Codex only post-approval |
| R2 | **Vision latency** on mobile (`qwen2.5vl:7b`) | Medium | Daedalus measures; client resize + async jobs → Codex if needed |
| R3 | **PDF/report flow** not audited | High | Sentinel priority `task-apl-009` Wed; Codex handoff for engine |
| R4 | **Codex before Owner gate** | High | No handoff.send until `task-apl-013` approved |
| R5 | **Scope creep → ServiceManager** | High (mitigated) | Repo isolation `~/projects/ai-photo-lab`; reject SMA coupling |
| R6 | **Production deploy without checklist** | Critical | Helm checklist → Owner → Codex deploy only |
| R7 | **Mock-only runtime** in AI Company | Medium | Audits use real product env; AI Company tracks, не substitutes QA on prod |

---

## 6. Приоритеты (P0 → P2)

### P0 — до среды

1. **Production health** (`task-apl-002`) — Helm  
2. **Local startup** (`task-apl-003`) — MAX  
3. **Codex backlog finalize** (`task-apl-013`) — Atlas → **Owner approval**  
4. **Upload + vision pipeline audit** (`task-apl-004`, `task-apl-005`) — MAX + Daedalus  

### P1 — среда–четверг

5. **Zone audits** (`task-apl-006`, `task-apl-007`) — Daedalus + MAX  
6. **Chat + report/history** (`task-apl-008`, `task-apl-009`) — Sentinel  
7. **QA checklist** (`task-apl-010`) — Sentinel  
8. **Deploy checklist** (`task-apl-011`) — Helm  

### P2 — пятница

9. **Demo script** (`task-apl-012`) — Ops  
10. **Mobile view pass** — Sentinel + Nova (design notes)  
11. **Sprint review + Owner demo dry-run**

---

## 7. Кто что делает

| Person | Role | Sprint 1 focus | Tasks |
|--------|------|----------------|-------|
| **Atlas** | AI CTO / Tech Lead | Architecture, Codex routing, sprint tech gate | `013` (review), oversight all, update delivery plan |
| **MAX** | Senior Developer | Local env, upload, manual zones, UI audit findings | `003`, `004`, `007` |
| **Sentinel** | AI QA | Checklist, chat audit, PDF/report audit, mobile sign-off | `008`, `009`, `010` |
| **Helm** | AI DevOps | Prod health, deploy checklist, deploy readiness | `002`, `011` |
| **Daedalus** | AI Architect | Vision pipeline, zone detection accuracy | `005`, `006` |
| **Apex** | AI CEO | Stabilization plan, executive sync | `001` |
| **Ops** | Product Analyst | Demo script, Owner walkthrough | `012` |
| **Nova** | Designer | Mobile/layout gaps from audits | support `004`, `007`, mobile gate |
| **Codex** | Coding Agent | **Implementation only after Owner approval** | see §8 |
| **Igor** | Owner | Approvals, demo, scope decisions | see §9 |

**Atlas daily:** Control Room → `#ai-photo-lab-delivery` → unblock assignees → update timeline.

---

## 8. Что проверить первым (Day 1–2)

1. **`GET https://vitrina.sma-assistants.ru/health`** — Helm (`task-apl-002`).  
2. **Local `~/projects/ai-photo-lab` startup** — MAX (`task-apl-003`): deps, env, Ollama reachability.  
3. **Upload happy path (desktop + mobile)** — MAX (`task-apl-004`).  
4. **Single photo → qwen2.5vl:7b analysis → zones rendered** — Daedalus (`task-apl-005`).  
5. **Review draft reports** in AI Company: readiness, risk, delivery plan — baseline before new findings.

Если P0 #1–#4 fail → **stop Codex planning** until root cause documented in Control Room blocked bucket.

---

## 9. Задачи для Codex (после Owner approval)

> **Policy:** Digital employees audit and plan; Codex implements in `~/projects/ai-photo-lab`.  
> **Gate:** Owner approves `task-apl-013` backlog before any `handoff.sent`.

| Handoff category | Trigger tasks | Codex scope |
|------------------|---------------|-------------|
| **Ollama / vision tuning** | `task-apl-005` findings | Prompt hardening, routing, latency fixes for `qwen2.5vl:7b` |
| **UI implementation** | `task-apl-004`, `007` | Upload UX, zone editor, mobile layout from audit list |
| **Bug fixes** | `task-apl-008`, `010` QA runs | Regressions from Sentinel checklist |
| **PDF / report engine** | `task-apl-009` | Report generation, history retention, export |
| **Complex code** | `task-apl-005`, `006`, `013` | Cross-module refactors from architecture audit |
| **Production deploy** | `task-apl-002`, `011` | Deploy to `/opt/ai-photo-lab` **only after Owner approves checklist** |

**Not for Codex (digital team only):** checklists, reports, QA matrices, deployment documentation, demo script.

**Explicitly out of scope this week:** ServiceManager integration, new features beyond MVP demo path.

---

## 10. Что должен утвердить Owner

| # | Decision | When | Blocker if skipped |
|---|----------|------|-------------------|
| 1 | **Codex task backlog** (`task-apl-013`) | Day 1–2 | No code handoffs |
| 2 | **MVP stabilization plan** (`task-apl-001` / `report-apl-delivery-plan`) | Day 2 | Team misaligned on scope |
| 3 | **Deployment checklist** (`task-apl-011`) | Before any prod deploy | Codex deploy blocked by policy |
| 4 | **Production deploy approval** (approval workflow) | End of week if demo-ready | No vitrina update |
| 5 | **Demo sign-off** (QA checklist `task-apl-010`) | Friday | No «MVP ready» declaration |
| 6 | **Scope freeze** — no SMA / no new features | Now | Deadline slip |

---

## 11. Недельный план (Atlas)

| Day | Focus | Outcomes |
|-----|-------|----------|
| **Mon** | Kickoff + P0 health/local/upload | Health report, local startup checklist, upload audit started |
| **Tue** | Vision + Codex backlog review | `task-apl-013` → Owner approval; vision audit draft |
| **Wed** | Zones + chat audits | Zone accuracy notes; chat edge cases |
| **Thu** | Report/history + QA checklist | PDF audit matrix; checklist v1 for Owner |
| **Fri** | Deploy checklist + demo dry-run | Owner demo; sprint review; handoffs to Codex for approved items only |

**Sync points:** Control Room daily · `#ai-photo-lab-delivery` · `/ops/timeline` for audit events.

---

## 12. Atlas actions (immediate)

- [x] Read project context (knowledge pack + project seed)  
- [x] Review Sprint 1 board and capacity  
- [x] Review Control Room health, demo checklist, Codex categories  
- [x] Publish this CTO Plan  
- [ ] Request Owner approval on Codex backlog (`/ops/approvals` + Control Room decision queue)  
- [ ] Move `task-apl-013` → done after approval; emit `handoff.sent` for P0 Codex items only  
- [ ] Start Sprint 1 (`sprint.started`) after Owner acknowledges kickoff  

---

## 13. Success criteria (Friday)

- [ ] ≥ 8/10 demo checklist gates **done** or **in_progress with written audit**  
- [ ] QA checklist draft **approved by Owner**  
- [ ] Deployment checklist **approved by Owner**  
- [ ] Codex backlog **approved**; ≥ 1 handoff **accepted** by Codex with clear scope  
- [ ] Owner completes **15-min demo script** on vitrina without critical blockers  
- [ ] Project progress **≥ 60%**; sprint burndown reflects audit completion  

---

*Atlas — AI CTO, AI Photo Lab · Sprint 1 Kickoff · AI Company local delivery engine*
