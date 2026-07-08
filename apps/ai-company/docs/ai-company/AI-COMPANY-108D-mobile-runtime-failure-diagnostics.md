# AI-COMPANY-108D — Mobile Runtime Failure Diagnostics

## Problem

On iPhone, Runtime Live showed only:

> Runtime завершился со статусом: failed

Vite terminal stayed empty. The real error lived in `RuntimeRun.pipeline` (`complete` step `detail`) and `result.warnings`, but was dropped when the Worker Loop marked itself failed.

## Root cause

`maxWorkerLoopEngine.ts` — on `run.status !== 'completed'`:

```ts
`Runtime завершился со статусом: ${run.status}`
```

No propagation of `pipeline.detail`, provider HTTP status, model, or endpoint into the loop snapshot or mobile UI.

## Solution

Additive diagnostics only — no Runtime architecture changes.

1. **`RuntimeFailureDiagnostics`** object saved on:
   - `MaxWorkerLoopRecord.failureDiagnostics`
   - `RuntimeRun.failureDiagnostics` (failed / cancelled)

2. **Extraction** from `RuntimeRun.pipeline`, warnings, `RuntimeExecutionError`, Ollama settings.

3. **Mobile UI** — collapsed block **«Технические детали ошибки»** on Runtime Live.

4. **Dev helper** — `window.__AI_COMPANY_DEBUG_LAST_RUNTIME_FAILURE__` + `console.warn`.

## Diagnostics shape

```ts
{
  runtimeRunId: string | null
  workerLoopId: string | null
  phase: string | null          // failed pipeline step id or loop phase
  model: string | null
  endpoint: string | null       // configured Ollama base
  effectiveEndpoint: string | null  // LAN relay /runtime/ollama when applicable
  provider: string | null
  httpStatus: number | null
  errorMessage: string | null
  errorName: string | null
  errorStack: string | null
  rawError: string | null       // JSON preview, truncated
  createdAt: string
}
```

## UI hints

| Pattern in error | Hint |
|------------------|------|
| network / fetch / ECONNREFUSED / `/runtime/ollama` | Проверьте `/runtime/ollama/api/tags` с телефона |
| model not found / pull / missing | Модель не установлена в Ollama |

## Files

| File | Change |
|------|--------|
| `runtimeFailureDiagnostics.ts` | Type, builders, hints, debug publish |
| `maxWorkerLoopEngine.ts` | `markFailed()` + `buildRuntimeFailureDiagnosticsFromRun()` |
| `maxWorkerLoop.ts` / `maxWorkerLoopStorage.ts` | `failureDiagnostics` field + parse |
| `runtimeRun.ts` / `runtimeOrchestrator.ts` | `failureDiagnostics` on terminal runs |
| `mobileRuntimeLiveViewModel.ts` | `failureDiagnostics`, `failureHint`, better `loopError` |
| `MobileRuntimeFailureDiagnostics.tsx` | Collapsed `<details>` block |
| `MobileRuntimeLivePage.tsx` | Render diagnostics on failed loop |
| `i18n/mobile/{ru,en}.ts` | `runtimeLive.failureDiagnostics` |
| `styles/mobile.css` | `.acMobileRuntimeFailure*` |

## How to read error on mobile

1. Open **Runtime Live** after a failed run (`/mobile/runtime` or from MAX banner).
2. Expand **«Технические детали ошибки»** (collapsed by default).
3. Copy `errorMessage` or `rawError` preview.
4. Optional — Safari Web Inspector → Console:
   ```js
   window.__AI_COMPANY_DEBUG_LAST_RUNTIME_FAILURE__
   ```

## Manual QA (iPhone)

1. Mac: `npm --prefix apps/ai-company run dev -- --host 0.0.0.0`
2. iPhone (same Wi‑Fi): `http://<mac-lan-ip>:5174/mobile/demo`
3. Run demo → trigger `failed` (e.g. stop Ollama or use missing model)
4. Runtime Live → expand technical details
5. Verify: `runtimeRunId`, `phase`, `model`, `endpoint`, real `errorMessage`
6. Network hint or model-missing hint appears when applicable

## Checks

```bash
npm --prefix apps/ai-company run build
```

## Related

- **108C** — LAN Ollama relay (`/runtime/ollama`); failures often surface as network errors in diagnostics `effectiveEndpoint`.
- **107L** — Mobile Runtime Live shell.

## Commit

`AI-COMPANY-108D: Mobile Runtime failure diagnostics on Worker Loop and Runtime Run`
