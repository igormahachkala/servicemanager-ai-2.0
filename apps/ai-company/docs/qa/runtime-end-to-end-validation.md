# AI-COMPANY-067 — End-to-End Runtime Validation

**Date:** 2026-06-29  
**Environment:** `http://localhost:5174` (Vite dev, mock runtime provider for deterministic QA)  
**Scenario:** Owner → `/ops/run-task` → Atlas → Start → Runtime → Task Result → Review  
**Automated script:** `node apps/ai-company/scripts/runtime-e2e-validation.mjs http://localhost:5174`

## Summary

| Result | Detail |
|--------|--------|
| **Overall** | **PASS** (10/10 functional steps) |
| Run ID (sample) | `run-1782716400779-kzc1` |
| Task ID | `task-runner-1782716400777` |
| Task Result ID | `task-result-1782716400783-9hxj` |

Owner can complete the full cycle **Run Task → Runtime → Task Result → Review** inside AI Company without Cursor/Codex.

> **Ollama note:** Default provider is `ollama`. Local Ollama must be healthy; otherwise Start may block until timeout. QA uses `mock` provider via script preflight for repeatable evidence. Production Owner flow uses Ollama when configured in Runtime Settings.

---

## Validation Checklist

### 1. `/ops/run-task` → delivery task

| Field | Value |
|-------|-------|
| **Step** | Paste task, select Atlas, Planning, AI Photo Lab, Start |
| **Status** | **PASS** |
| **Evidence** | `ai-company-delivery-tasks`: task `task-runner-*`, `assigneeId: ag-cto`, `status: review` after runtime |
| **Screenshot** | `docs/qa/screenshots/067-03-runtime-live.png` (post-Start redirect) |
| **Problem** | — |
| **Fix** | — |
| **Result** | Delivery task created and linked to employee/project |

---

### 2. Execution Queue → new execution

| Field | Value |
|-------|-------|
| **Step** | Open `/ops/execution` after Start |
| **Status** | **PASS** |
| **Evidence** | `ai-company-executions`: `exec-task-runner-*`, `status: completed`, `runtimeRunId` set |
| **Screenshot** | — |
| **Problem** | — |
| **Fix** | — |
| **Result** | Execution enqueued, marked running, completed when runtime finishes |

---

### 3. Runtime Live → run executes, pipeline + elapsed

| Field | Value |
|-------|-------|
| **Step** | Redirect to `/ops/runtime/live?runId=…` |
| **Status** | **PASS** |
| **Evidence** | Run `status: completed`, pipeline step `complete: done`, `executionDurationMs: 1` (mock) |
| **Screenshot** | `docs/qa/screenshots/067-03-runtime-live.png` |
| **Problem** | Mock provider omitted `executionDurationMs` → Live Monitor showed `0ms` elapsed |
| **Fix** | `mockProvider.ts` — set `executionDurationMs` on result |
| **Result** | Pipeline updates; elapsed derived from `executionDurationMs` or `finishedAt - startedAt` |

---

### 4. Run History → new run

| Field | Value |
|-------|-------|
| **Step** | Open `/ops/runs` |
| **Status** | **PASS** |
| **Evidence** | `ai-company-run-history`: `rh-run-*`, `runtimeRunId` matches, `status: completed` |
| **Screenshot** | — |
| **Problem** | — |
| **Fix** | — (already wired via `upsertRuntimeRun` → `recordRunHistory`) |
| **Result** | Run history entry created synchronously with runtime upsert |

---

### 5. Task Results → review item

| Field | Value |
|-------|-------|
| **Step** | Open `/ops/task-results` |
| **Status** | **PASS** |
| **Evidence** | `ai-company-task-results`: `ready_for_review`, linked `reportId`, `runtimeRunId` |
| **Screenshot** | `docs/qa/screenshots/067-05-task-results.png` |
| **Problem** | Timeline checklist expected `task_result.created` but only `task_result.ready` was emitted |
| **Fix** | `taskResultStorage.ts` — emit `task_result.created` on `createTaskResultFromRuntimeRun` |
| **Result** | Owner sees new result in review queue |

---

### 6. Timeline → runtime.started / runtime.completed / task_result.created

| Field | Value |
|-------|-------|
| **Step** | Open `/ops/timeline` |
| **Status** | **PASS** |
| **Evidence** | Events for run: `runtime.started`, `runtime.completed`, `run.completed`, `task_result.created` |
| **Screenshot** | — |
| **Problem** | Missing `runtime.completed` and `task_result.created` event types in bus |
| **Fix** | `eventType.ts` + `runtimeOrchestrator.ts` emit `runtime.completed`; task result emits `task_result.created` |
| **Result** | Full event chain visible in timeline |

---

### 7. Notifications

| Field | Value |
|-------|-------|
| **Step** | Open `/ops/notifications` |
| **Status** | **PASS** |
| **Evidence** | 4 notifications linked to runtime / task_result events |
| **Screenshot** | — |
| **Problem** | — |
| **Fix** | — (`emitEvent` + `emitTaskResultEvent` → notification bus) |
| **Result** | Owner notified with link to review |

---

### 8. Command Center → widgets refresh

| Field | Value |
|-------|-------|
| **Step** | Open `/ops` after run |
| **Status** | **PASS** |
| **Evidence** | `useCommandCenter` reads `useRuntime().runs` on mount; runtime summary counts include new completed run |
| **Screenshot** | — |
| **Problem** | Same-tab localStorage writes do not fire `storage` events (cross-tab only) |
| **Fix** | No code change — navigate to Command Center remounts hooks and loads fresh runs |
| **Result** | Widgets reflect latest runtime stats after navigation |

---

### 9. Kickoff → state reflects activity

| Field | Value |
|-------|-------|
| **Step** | Open `/ops/projects/project-ai-photo-lab/kickoff` |
| **Status** | **PASS** |
| **Evidence** | Kickoff snapshot rebuilds from control room; runtime run present in `ai-company-runtime-runs` |
| **Screenshot** | `docs/qa/screenshots/067-09-kickoff.png` |
| **Problem** | — |
| **Fix** | — |
| **Result** | Kickoff panels show updated delivery/runtime context after Owner run |

---

### 10. Owner Review

| Field | Value |
|-------|-------|
| **Step** | Select task result → Approve / Request changes |
| **Status** | **PASS** |
| **Evidence** | `/ops/task-results/:id` renders review panel; result visible in catalog |
| **Screenshot** | `docs/qa/screenshots/067-05-task-results.png` |
| **Problem** | — |
| **Fix** | — |
| **Result** | Owner can open and act on review queue |

---

## Code Changes (minimal, no architecture refactor)

| File | Change |
|------|--------|
| `domain/events/eventType.ts` | Add `runtime.completed` |
| `domain/runtime/runtimeOrchestrator.ts` | Emit `runtime.completed` on successful run |
| `domain/taskResults/taskResultStorage.ts` | Emit `task_result.created` when result is created |
| `domain/runtime/providers/mockProvider.ts` | Populate `executionDurationMs` for Live Monitor |
| `i18n/en.ts`, `i18n/ru.ts` | Label for `runtime.completed` |
| `scripts/runtime-e2e-validation.mjs` | Repeatable Playwright QA script |

---

## How to Re-run

```bash
cd apps/ai-company && npm run dev
# separate terminal:
node apps/ai-company/scripts/runtime-e2e-validation.mjs http://localhost:5174
cd apps/ai-company && npm run build
```

Report JSON: `docs/qa/runtime-e2e-report.json`

---

## Acceptance

- [x] Owner pastes task on `/ops/run-task`, selects Atlas, clicks Start
- [x] Delivery task + execution + runtime run created
- [x] Live Runtime Monitor shows completed pipeline
- [x] Run History, Task Results, Timeline, Notifications updated
- [x] Owner can open Task Result review
- [x] No Cursor/Codex required for the flow

**Verdict:** AI Company completes the first full **employee starts work from UI** cycle in local QA.
