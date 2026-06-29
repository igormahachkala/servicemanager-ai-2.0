# Runtime Cost & Performance Monitor

Owner-facing visibility into how much digital company work costs and where time is lost.

## Data sources (local only)

- `RuntimeRun` records in `localStorage` (`ai-company-runtime-runs`)
- `RuntimeResult.estimatedCost`, `estimatedTokens`, `executionDurationMs`
- Model/provider metadata from `runtimeStorage`
- Employee codenames from roster resolution

No external billing or telemetry APIs.

## Per-run metrics

| Field | Source |
|-------|--------|
| Model | `run.modelId` → model registry |
| Provider | `run.providerId` → provider registry |
| Duration | `startedAt` / `finishedAt` |
| CPU Time | `result.executionDurationMs` or duration fallback |
| Est. Tokens | `result.estimatedTokens` |
| Est. Cost | `result.estimatedCost` |
| Status | `run.status` |
| Timeout | warnings with "timeout" or failed/cancelled with timeout message |

## Dashboard aggregates

- **Fast Models** — avg duration ≤ 15s
- **Heavy Models** — avg cost ≥ $0.01 or total ≥ $0.05
- **Average Runtime** — mean CPU/duration of completed runs
- **Longest Run** — max CPU/duration among completed
- **Timeout Rate** — % of failed/cancelled runs that timed out
- **Completed Today** / **Cost Today** — calendar-day filter on `startedAt`
- **Top Employees** / **Top Models** — by run count

## Integration surfaces

- Command Center — compact `RuntimeCostMonitorPanel`
- Runtime Live — company summary + selected run metrics in stats bar
- Run History — full dashboard above catalog
- Runtime Settings — dashboard with recent runs
- Operating Day — runtime phase: completed today, cost today, timeout rate
- Employee Runtime — employee-scoped dashboard
- Runtime Run detail — full metrics row
- Runtime Run cards — compact duration/tokens/cost/cpu strip

## Module layout

```
domain/runtimeMonitor/
  runtimeMonitor.ts       — types
  runtimeMonitorEngine.ts — build + format helpers
hooks/useRuntimeMonitor.ts
components/runtime-monitor/
styles/runtime-monitor.css
```
