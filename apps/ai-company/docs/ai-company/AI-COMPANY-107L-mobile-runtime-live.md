# AI-COMPANY-107L — Mobile Runtime Live

## Goal

Owner видит выполнение MAX в реальном времени на телефоне — фазы существующего Max Worker Loop без нового Runtime engine.

## Routes

| Route | Screen |
|-------|--------|
| `/mobile/runtime` | Active or latest Worker Loop |
| `/mobile/runtime?loop={id}` | Specific loop |
| `/mobile/runtime/{runtimeRunId}` | Loop by Runtime run id |

## UI

- Current task title + text
- Loop status badge + model label
- Progress bar (% completed Owner-visible steps)
- 7 phases: Owner Task · Decision Plan · Consult Peer · Reasonning · Runtime · Journal · Report
- Phase status: pending / running / completed / failed
- Model, time, detail, error per phase
- CTA «Открыть отчёт» when `reportId` exists

## Entry from MAX

When Worker Loop status is `running`, `queued`, or `waiting_approval`:

- Banner on `/mobile/employees/ag-max`
- Button **«Смотреть выполнение»** → `/mobile/runtime?loop=…`

## Data

Read-only from `MaxWorkerLoopRecord` in localStorage via:

- `loadMaxWorkerLoopRecords()`
- `useMaxWorkerLoop()` — polls every 500ms while running
- `buildMobileRuntimeLiveView()` — maps domain phases → mobile steps

No backend. No new Runtime orchestrator.

## Files

```
src/mobile/runtime/mobileRuntimeLiveViewModel.ts
src/mobile/hooks/useMobileRuntimeLive.ts
src/mobile/components/MobileRuntimePhaseCard.tsx
src/mobile/components/MobileRuntimeLiveBanner.tsx
src/mobile/pages/MobileRuntimeLivePage.tsx
src/mobile/MobileRoutes.tsx
src/i18n/mobile/{ru,en}.ts — mobile.runtimeLive
src/styles/mobile.css — .acMobileRuntime*
```

## Manual check

1. `/mobile/employees/ag-max` → Run Next → banner appears
2. «Смотреть выполнение» → `/mobile/runtime`
3. Phases update while loop runs
4. After complete → «Открыть отчёт» or back to MAX
5. Light/dark theme

## Remaining (post-V1)

- Live token stream / reasoning preview
- Desktop Runtime Live parity (full event log)
- Push notification when loop completes
