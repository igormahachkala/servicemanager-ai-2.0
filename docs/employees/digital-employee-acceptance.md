# Digital Employee Acceptance Criteria

> **Status:** Governance · Definition of Done for a **ready** employee  
> **Task:** AI-COMPANY-063  
> **Parent:** [Employee Lifecycle](../../apps/ai-company/docs/north-star/employee-lifecycle.md) · [Digital DNA](../../apps/ai-company/docs/north-star/digital-dna.md)

A Digital Employee is **not ready** when they have a chat box and a model ID.

A Digital Employee is **ready** when they can participate in the **living company** as a persistent colleague — observable, accountable, and developable.

This document defines **acceptance pillars**. All **must pass** before an employee is marked **Production Ready** in roster or shipped as **Employee Template**.

---

## Acceptance pillars (12)

| # | Pillar | Question |
|---|--------|----------|
| 1 | Identity | Who is this employee in the org chart? |
| 2 | Personality | How do they communicate and decide? |
| 3 | Memory | What do they remember across sessions? |
| 4 | Knowledge | What domain material can they use? |
| 5 | Competencies | What skills are certified? |
| 6 | Learning | How do they improve over time? |
| 7 | Workspace | Where do they work day-to-day? |
| 8 | Runtime | How do they think and execute? |
| 9 | Reports | What artifacts do they produce? |
| 10 | Presence | Are they visible when working? |
| 11 | Reputation | How is trust tracked? |
| 12 | Goals | What are they aiming toward? |

---

## 1. Identity

**Required artifacts**

- Unique `employeeId` stable across model changes  
- Codename + display role (e.g. Atlas — AI CTO)  
- Profile page `/ops/employees/:id`  
- Org placement (team / department / squad link)  
- Lifecycle state: active · planned · retired  

**Pass criteria**

- UI never identifies employee by model name alone  
- Events and audit reference `employeeId`  

**V1 reference:** Mission Control roster, `agents` + custom employees.

---

## 2. Personality

**Required artifacts**

- Operating style documented (tone, risk appetite, collaboration preference)  
- System prompt / persona config **stored in platform**, not only in chat  
- Consistent voice in Conversation and Reports  

**Pass criteria**

- New Conversation session loads persona from Employee record  
- Personality survives Runtime model swap  

---

## 3. Memory

**Required artifacts**

- Memory store scoped to employee  
- Memory page `/ops/employees/:id/memory`  
- Memory entries with title, summary, tags, timestamps  
- Memory included in Runtime context assembly (when Runtime GA)  

**Pass criteria**

- Owner can inspect what employee “knows” without opening chat history  
- Memory writes emit Events  

---

## 4. Knowledge

**Required artifacts**

- Knowledge assignments (collections / items)  
- Knowledge page accessible from employee or workspace  
- Citations in Reports when knowledge used  

**Pass criteria**

- Employee can be assigned required reading  
- Knowledge access respects permissions  

---

## 5. Competencies

**Required artifacts**

- Competency profile (skills + levels)  
- `/ops/employees/:id/competencies`  
- Link from assignments (“needs competency X for this project”)  

**Pass criteria**

- Competencies visible to Owner before assigning critical work  
- Updates from Learning and Experience (not manual-only forever)  

---

## 6. Learning

**Required artifacts**

- Learning plan / courses / certifications  
- `/ops/employees/:id/learning`  
- Progress states: assigned · in progress · completed  

**Pass criteria**

- Learning completion updates Competencies or Experience  
- Visible on Employee profile and Workday agenda  

---

## 7. Workspace

**Required artifacts**

- Employee Workspace `/ops/employees/:id/workspace`  
- Today view: tasks, runs, approvals, agenda  
- Assignment to ≥1 workspace when active on project  

**Pass criteria**

- Employee has a “desk” — not only global task queue  
- Workspace link from Presence and Command Center  

---

## 8. Runtime

**Required artifacts**

- Runtime profile (models, providers, policies)  
- `/ops/employees/:id/runtime`  
- Successful Run history linked to employee  

**Pass criteria**

- Meets [Runtime Acceptance](../runtime/runtime-acceptance.md) for employee-scoped runs  
- Model Router uses profile, not hard-coded model  

---

## 9. Reports

**Required artifacts**

- At least one Report type employee produces by default  
- Reports list filterable by `employeeId`  
- Report links from Runs and Timeline  

**Pass criteria**

- Important work leaves **reviewable artifact**  
- Reports-first principle satisfied  

---

## 10. Presence

**Required artifacts**

- Presence record: status, activity, current task/project  
- Visible on Presence page and Command Center  
- Presence sync from platform (route, execution, workday)  

**Pass criteria**

- Owner sees employee as **working / waiting / offline**  
- Living company principle supported  

---

## 11. Reputation

**Required artifacts**

- Reputation score or trust band derived from outcomes  
- History of reviews, approvals, quality signals  
- Visible on profile (even if V1 mock formula)  

**Pass criteria**

- Reputation persists across model changes  
- Not reset per chat session  

---

## 12. Goals

**Required artifacts**

- Active goals (quarterly / sprint / personal development)  
- Link goals to projects or learning items  
- Progress visible on profile or workspace  

**Pass criteria**

- Owner can answer “what is this employee trying to achieve?”  
- Goals connect to Career lifecycle stage  

---

## Readiness levels

| Level | Pillars required | Use case |
|-------|------------------|----------|
| **R0 Draft** | Identity only | Template authoring |
| **R1 Roster** | Identity + Personality + Workspace | Internal demo colleague |
| **R2 Operational** | R1 + Memory + Knowledge + Runtime + Reports + Presence | Project assignment |
| **R3 Production** | All 12 | Marketplace template / customer hire |
| **R4 Leader** | R3 + promotion history + multi-workspace lead | Squad lead templates |

---

## Acceptance checklist (copy per employee)

```markdown
## Employee Acceptance — [codename] ([id])
**Target level:** R1 / R2 / R3

| Pillar | Pass | Evidence (route / entity) |
|--------|------|---------------------------|
| Identity | ☐ | |
| Personality | ☐ | |
| Memory | ☐ | |
| Knowledge | ☐ | |
| Competencies | ☐ | |
| Learning | ☐ | |
| Workspace | ☐ | |
| Runtime | ☐ | |
| Reports | ☐ | |
| Presence | ☐ | |
| Reputation | ☐ | |
| Goals | ☐ | |

**Decision:** Accept / Defer pillar … / Reject
```

---

## Template vs company employee

| Type | Minimum level |
|------|---------------|
| Employee Template (marketplace) | **R3** at publish |
| Hired company employee from template | **R2** day one; **R3** within 90 days |
| Custom employee (Owner-created) | **R2** before production project assign |

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Digital employee acceptance (AI-COMPANY-063) |
