# AI Company — Technical Acceptance Report

> **Task:** AI-COMPANY-057A  
> **Scope:** Technical Acceptance only  
> **Repo:** `apps/ai-company`  
> **Date:** 2026-06-26  
> **Status:** Pass with risks

## Executive summary

AI Company is technically coherent as a standalone local V1 operating system shell:

- the build passes;
- the primary `/ops` surfaces are wired;
- runtime execution paths include timeout, cancel, partial failure, run history, and logs;
- storage keys are explicit and namespaced;
- docs point back to North Star, operating rules, and ADRs.

The main technical risks are not blockers for technical acceptance, but they are real:

- the Ollama default base URL is hardcoded to a production IP;
- runtime state is split across multiple localStorage stores that must stay synchronized;
- the production bundle is large and emits a chunk-size warning;
- there is no dedicated lint script in this repo, so static quality is build- and code-review-based.

No code was changed for this audit.

## Method

This audit used:

- mandatory documentation review from `docs/north-star/`, `docs/operating-rules/`, `docs/AGENTS.md`, `README.md`, and ADR-001/002;
- static inspection of route definitions and runtime/storage code paths;
- local build verification.

No external services were called.

## Build result

Command:

```bash
cd apps/ai-company
npm run build
```

Result:

- **Pass**
- Vite build completed successfully.
- Output emitted one bundle-size warning:
  - `dist/assets/index-BUlYqs2k.js` is `1,270.15 kB` before gzip.

Interpretation:

- TypeScript is clean enough for production build.
- There is no build failure caused by dead imports or broken exports in the currently reviewed surfaces.
- The bundle-size warning is a performance risk, not a functional blocker.

## Route audit

Route coverage is present for the requested operating surfaces. Some are explicit routes; some are covered by dynamic routes plus query parameters.

| Surface | Status | Evidence / note |
|---|---|---|
| `/ops` | OK | Root Mission Control route in `src/App.tsx` → `MissionControlRoutes()` index page |
| `/ops/canvas` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/canvas?projectId=project-ai-photo-lab` | OK | `CompanyCanvasPage.tsx` reads `projectId` via `useSearchParams()` |
| `/ops/projects` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/projects/project-ai-photo-lab` | OK | Covered by dynamic route `/ops/projects/:id` |
| `/ops/projects/project-ai-photo-lab/control-room` | OK | Explicit route plus project-specific route in `src/mission-control/router.tsx` |
| `/ops/sprint/sprint-apl-1` | OK | Covered by dynamic route `/ops/sprint/:id` |
| `/ops/runtime` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/runtime/live` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/employees/ag-cto/runtime` | OK | Covered by dynamic route `/ops/employees/:id/runtime` |
| `/ops/execution` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/visual-lab` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/workday` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/handoffs` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/tool-executions` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/collaboration` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/chats` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/reports` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/timeline` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/notifications` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/employees` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/employees/ag-max/workspace` | OK | Covered by dynamic route `/ops/employees/:id/workspace` |
| `/ops/knowledge` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/approvals` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/organization` | OK | Explicit route in `src/mission-control/router.tsx` |
| `/ops/companies` | OK | Explicit route in `src/mission-control/router.tsx` |

Additional route observations:

- `/ops/projects/:id/control-room` is present for non-photo-lab projects as well.
- `/ops/employees/:id/conversation` and `/ops/discussions/:id` are redirected safely to chats.
- `/ops/feed` is redirected to `/ops/timeline`, which is coherent with the current V1 map.

## Runtime technical smoke review

### Ollama provider URL

File: `src/domain/runtime/providers/runtimeCapabilities.ts`

- default Ollama base URL is `http://194.67.92.12:11434`
- default model tag is `qwen3.6:27b`
- this is configurable at runtime via persisted Ollama settings

Assessment:

- technically functional, but the default host is a risk if a local override is not present.
- this is a default-value risk, not a code defect in the provider itself.

### Timeout and fast-test mode

Files:

- `src/domain/runtime/providers/runtimeCapabilities.ts`
- `src/domain/runtime/providers/ollamaProvider.ts`

Observed behavior:

- execution timeout is `300_000` ms (`300s`)
- fast-test models are explicitly recognized (`qwen2.5-coder:7b`, `deepseek-r1:8b`)
- fast-test mode trims the prompt to `1,500` chars and lowers generation settings

Assessment:

- good technical separation between fast-test and standard execution.
- timeout is long enough for real runs and visible in logs/UI.

### Partial failure and cancel behavior

File: `src/domain/runtime/runtimeOrchestrator.ts`

Observed behavior:

- runtime failures are not dropped silently;
- `buildPartialFailureResult(...)` preserves partial output when provider execution fails;
- `RuntimeExecutionError` differentiates:
  - `timeout`
  - `cancelled`
  - `http`
  - `network`
  - `unknown`
- cancel path is explicit:
  - `ollamaProvider.cancel(runId)` uses `AbortController.abort()`
  - cancel is logged with a warning rather than hidden

Assessment:

- good failure model for demo/production readiness;
- partial failure result is the right shape for Owner visibility.

### Runtime logs and run history persistence

Files:

- `src/domain/runtime/providers/runtimeHealth.ts`
- `src/domain/runtime/runtimeOrchestrator.ts`
- `src/domain/run/runStorage.ts`

Observed behavior:

- runtime logs are persisted to `localStorage` under `ai-company-runtime-logs`
- runtime health snapshot persists to `ai-company-runtime-health-snapshot`
- runtime runs persist to `ai-company-runtime-runs`
- run history persists to `ai-company-run-history`
- `recordRunHistory(mapRuntimeRunToRunHistory(run))` is called on successful upsert path

Assessment:

- persistence is coherent and auditable;
- runtime state and run-history state are separate on purpose, but they must remain synchronized.

## Integration consistency

The current code links the major mission-control surfaces logically:

- **Runtime → Run History**
  - `src/domain/runtime/runtimeOrchestrator.ts` records run history via `src/domain/run/runStorage.ts`
- **Runtime → Reports**
  - completed runs emit reports and `run.completed` events
- **Timeline / Notifications**
  - `src/domain/notifications/notificationFromEvent.ts` routes events to reports, approvals, handoffs, chats, timeline, employees, knowledge, projects, audit
- **Execution**
  - execution queue, runtime runs, and approval gates are integrated through the same domain graph
- **Handoff**
  - handoff routes and links are present and used in runtime/project pages
- **Visual Lab**
  - visual-lab session links into execution/runtime/handoffs/reports/canvas paths
- **Control Room**
  - AI Photo Lab control room links to canvas, sprint, timeline, notifications, knowledge, handoffs, tool executions, and execution
- **Canvas**
  - `src/domain/canvas/canvasEngine.ts` links nodes to projects, workspaces, runtime, employees, execution, runs, approvals, reports, knowledge, and tools

Assessment:

- the module graph is coherent;
- there is some overlap by design, but it is still traceable and linked from platform-owned events and entities.

## Storage / localStorage risks

Stable keys are explicit and namespaced with the `ai-company-` prefix. Current important keys include:

- `ai-company-ollama-settings`
- `ai-company-runtime-logs`
- `ai-company-runtime-health-snapshot`
- `ai-company-runtime-active-provider`
- `ai-company-runtime-runs`
- `ai-company-run-history`
- `ai-company-projects`
- `ai-company-workspaces`
- `ai-company-knowledge`
- `ai-company-chats`
- `ai-company-notifications`
- `ai-company-approvals`
- `ai-company-reports`
- `ai-company-executions`
- `ai-company-tools`-related storage paths in the domain layer

Risk assessment:

- the keys themselves are stable and readable;
- there is no central migration layer for localStorage schemas;
- future key renames would need an explicit migration strategy;
- route context is written to `sessionStorage` under `ai-company-presence-route-context` and expires after 5 minutes, which is acceptable for presence hints but not for durable state.

No accidental key rename was detected in the reviewed code paths.

## Documentation consistency

The documentation set is internally consistent:

- `docs/north-star/north-star.md` defines the platform constitution;
- `docs/operating-rules/*` operationalize the constitution;
- `docs/AGENTS.md` is the effective agent entrypoint in this repo;
- `README.md` links North Star, operating rules, ADRs, release gates, and domain model;
- ADR-001 and ADR-002 are aligned with the current implementation shape.

One small documentation mismatch exists:

- the task text referenced `apps/ai-company/AGENTS.md`, but the real entrypoint in this repository is `apps/ai-company/docs/AGENTS.md`.

That is a documentation reference issue, not a runtime blocker.

## Critical issues

None found in the audited surfaces.

## High issues

1. **Ollama default base URL is hardcoded to a production IP**
   - File: `src/domain/runtime/providers/runtimeCapabilities.ts`
   - Risk: if a local override is missing, runtime health/execution will target the wrong endpoint.

2. **No dedicated lint / dead-import script**
   - Current repo only provides `dev`, `build`, and `preview`.
   - Risk: static hygiene relies on TypeScript build and manual review.

## Medium issues

1. **Large client bundle**
   - Build emits a chunk-size warning.
   - Risk: slower first-load performance and harder cache behavior.

2. **Dual execution persistence model**
   - `ai-company-runtime-runs` and `ai-company-run-history` are both necessary.
   - Risk: if the synchronization path ever drifts, runtime and history views could disagree.

3. **Presence route context is ephemeral**
   - `ai-company-presence-route-context` expires after 5 minutes.
   - Risk: presence may lag behind actual navigation in edge cases.

## Low issues

1. **Several requested routes are implemented via dynamic segments**
   - Example: `/ops/projects/project-ai-photo-lab` is covered by `/ops/projects/:id`.
   - Not a bug, but worth remembering during future nav reviews.

2. **Bundle-size warning is not blocking**
   - The build is green, but the warning should be monitored over time.

## Recommended next actions

1. Keep the current runtime failure/cancel behavior intact.
2. Add an explicit note in runtime docs or a future ADR about the dual store model:
   - runtime snapshot store
   - platform run-history store
3. Decide whether the Ollama default base URL should remain a production IP or move to a neutral local-first default with environment override.
4. If performance becomes an issue, start bundle-splitting the largest `/ops` surfaces.
5. Proceed to **AI-COMPANY-057B** for product / UX acceptance now that the technical gate is clear.

