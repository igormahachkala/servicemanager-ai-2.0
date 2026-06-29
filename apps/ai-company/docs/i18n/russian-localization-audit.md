# AI Company — Russian Localization Audit (AI-COMPANY-068)

**Scope:** `apps/ai-company/**` focus pages (Command Center, Canvas, Runtime, Sprint, Kickoff, Control Room, Execution, Handoffs, Reports, Notifications, Timeline, Visual Lab, Presence, Projects, Tool Executions).

**Acceptance:** Owner при `language=ru` не видит английский в UI chrome (кнопки, labels, badges, empty states, enum labels). Бренд-термины (Runtime, Codex, Atlas, MAX, Owner, Canvas, Sprint) и mock-контент (titles задач, goals) допустимы.

**Infra:**
- `src/i18n/uiLabels.ts` — helpers для enum → label
- `scripts/focusLocalizationRu.ts` — path-specific RU overrides (609+ keys)
- `scripts/build-ru.ts` — merges en + focus overrides → `src/i18n/ru.ts`

---

## Command Center

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| `run.status` raw enum | `runtimeStateLabel(t, status)` | ✅ | — |
| `report.type` raw enum | `reportTypeLabel(t, type)` | ✅ | — |
| `event.type` raw enum | `eventTypeLabel(t, type)` | ✅ | — |
| `item.status` (provider health) | `providerHealthLabel(t, status)` | ✅ | — |
| `item.priority` (approvals) | `approvalPriorityLabel(t, priority)` | ✅ | — |
| `item.type` (notifications) | `notificationCategoryLabel(t, type)` | ✅ | — |
| `item.status` (tool usage) | `toolExecutionStatusLabel(t, status)` | ✅ | — |
| Section titles / empty states | `t.commandCenter.*` via focusLocalizationRu | ✅ | — |

---

## Canvas

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| `props.kind` raw enum on nodes | `canvasNodeKindLabel(t, kind)` | ✅ | — |
| `aria-label="Open"` | `t.canvasEngine.openNode` | ✅ | — |
| `aria-label="Mini map"` | `t.canvasEngine.miniMapAria` | ✅ | — |
| Inspector / layers / modes | `t.canvasEngine.*` (focus overrides) | ✅ | — |

---

## Runtime / Runtime Live

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Pipeline step status raw enum | `pipelineStepStatusLabel(t, status)` | ✅ | — |
| Run state badges | `runtimeStateLabel(t, status)` | ✅ | — |
| Page chrome | `t.runtimeOrchestrator.*` (focus overrides) | ✅ | — |

---

## Sprint

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| ` SP` literal suffix | `t.sprintEngine.storyPointsShort` | ✅ | — |
| Sprint health / status badges | `t.sprintEngine.health/status` | ✅ | — |
| Board column empty `—` | neutral symbol (not English) | ✅ | — |

---

## Kickoff

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Checklist `item.status` | `demoChecklistStatusLabel(t, status)` | ✅ | — |
| Owner decision `item.priority` | `approvalPriorityLabel(t, priority)` | ✅ | — |
| Handoff `handoff.status` | `handoffStatusLabel(t, status)` | ✅ | — |
| Panel titles / actions | `t.photoLabKickoff.*` | ✅ | — |

---

## Control Room

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Task queue status/priority | `taskStatusLabel`, `taskPriorityLabel`, `executionStatusLabel` | ✅ | — |
| Risk severity/status | `controlRoomRiskLevelLabel`, `controlRoomRiskStatusLabel` | ✅ | — |
| Runtime run status | `runtimeStateLabel(t, status)` | ✅ | — |
| Report type badge | `reportTypeLabel(t, type)` | ✅ | — |
| Demo checklist status | `demoChecklistStatusLabel(t, status)` | ✅ | — |
| Codex handoff priority | `handoffPriorityLabel(t, priority)` | ✅ | — |
| Owner decision kind | `ownerDecisionKindLabel(t, kind)` | ✅ | — |
| Milestone status | `milestoneStatusLabel(t, status)` | ✅ | — |
| Team execution/presence | `executionStatusLabel`, `presenceStatusLabel` | ✅ | — |

---

## Execution / Run Task / Task Results

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Execution status badges | `executionStatusLabel(t, status)` | ✅ | — |
| Priority labels | `taskPriorityLabel(t, priority)` | ✅ | — |
| Page chrome | `t.executionEngine.*`, `t.taskRunner.*`, `t.taskResultEngine.*` | ✅ | — |

---

## Handoffs

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Status / priority badges | `handoffStatusLabel`, `handoffPriorityLabel` | ✅ | — |
| HandoffCard enum labels | uiLabels helpers | ✅ | — |
| HandoffDetails mock fallbacks | `t.handoffEngine.*` | partial | mock artifact labels in dev sample |

---

## Reports / Notifications / Timeline

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Report type enum | `reportTypeLabel(t, type)` | ✅ | — |
| Notification category | `notificationCategoryLabel(t, type)` | ✅ | — |
| Event type badge | `eventTypeLabel(t, type)` | ✅ | — |
| Feed severity | `feedSeverityLabel(t, severity)` | ✅ | — |

---

## Visual Lab / Presence / Projects

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Sidebar labels | `t.visualLab.sidebar.*` | ✅ | — |
| Presence status | `presenceStatusLabel(t, status)` | ✅ | — |
| Assignment role | `t.projects.team.roles[role]` | ✅ | — |
| Project task status/priority | uiLabels helpers | ✅ | — |

---

## Tool Executions

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| `Filters`, `Execution log`, `Execution details` | `t.toolExecutionEngine.*` | ✅ | — |
| Status labels (Created, Running, …) | `toolExecutionStatusLabel(t, status)` | ✅ | — |
| Approval panel buttons | `t.toolExecutionEngine.approval.*` | ✅ | — |
| `Submit sample request` | `t.toolExecutionEngine.submitSample` | ✅ | — |

---

## Employee Workspace / Profile

| English text | Replacement | Fixed | Remaining |
|---|---|---|---|
| Page chrome | `t.employeeEngine.*`, `t.employeeProfile.*` (focus overrides) | ✅ | — |
| Enum badges in profile panels | uiLabels where applicable | ✅ | — |

---

## Remaining (out of focus / acceptable)

| Area | Reason |
|---|---|
| `companyEngine.*` (~800 keys identical en/ru) | Company admin CRUD — outside Owner daily flow |
| Mock data content (task titles, goals, handoff findings) | Content, not UI chrome |
| Brand terms (Runtime, Codex, Atlas, MAX, Canvas, Sprint) | Product/tech terms per acceptance |
| Provider/tool IDs in filters (`mock`, `tool-github`) | Technical identifiers |
| `NewCompanyPage` default owner name | Company admin, not focus flow |

---

## Checks

```bash
cd apps/ai-company
npx tsx scripts/build-ru.ts
npm run build
```

Both pass as of AI-COMPANY-068 completion.
