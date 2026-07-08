# AI-COMPANY-108B — Mobile AI Company Demo Scenario

## Goal

Готовая 5-минутная демонстрация Mobile Owner Console на **реальных** localStorage данных — без fake progress.

## Scenario (7 steps)

| # | Step | Real completion signal |
|---|------|------------------------|
| 1 | Сегодня | Route visit `/mobile/today` |
| 2 | Дать задачу MAX | `WorkItem` for MAX with `createdAt >= session.startedAt` |
| 3 | MAX выполняет | `MaxWorkerLoopRecord` running/queued/waiting/completed |
| 4 | Runtime Live | Visit `/mobile/runtime` while loop active |
| 5 | Отчёт | Report or journal entry after session start |
| 6 | Решение Owner | Approval/decision after session or decisions visit post-report |
| 7 | Компания обновилась | Journal / completed task on Today snapshot |

## Entry

- **Ещё → Demo сценарий** → `/mobile/demo`
- **Prepare demo** — reset + seed + navigate to Today

## Demo Mode

- Toggle on `/mobile/demo`
- When on: floating **Demo helper** above bottom nav (current step CTA)
- Checklist on `/mobile/demo` updates from domain data (poll via sync events)

## Reset keys

See `MOBILE_DEMO_RESET_STORAGE_KEYS` in `mobileDemoReset.ts`.

Preserves: company, runtime profiles/models, employee brains, theme.

## Manual check (~5 min)

1. `/mobile/demo` → Enable Demo Mode → **Подготовить demo**
2. Today opens → checklist step 1–2 green
3. MAX → Run Next → Runtime Live banner → watch phases
4. Open report → decisions if any → back to Today
5. Checklist 7/7 → **Demo reset** → repeat

## Files

```
src/mobile/demo/mobileDemoScenario.ts
src/mobile/demo/mobileDemoStorage.ts
src/mobile/demo/mobileDemoReset.ts
src/mobile/demo/mobileDemoSeed.ts
src/mobile/demo/mobileDemoViewModel.ts
src/mobile/hooks/useMobileDemo.ts
src/mobile/components/MobileDemoChecklist.tsx
src/mobile/components/MobileDemoHelper.tsx
src/mobile/components/MobileDemoHelperHost.tsx
src/mobile/pages/MobileDemoPage.tsx
```

## Requirements

- Ollama healthy for steps 3–5 (real Worker Loop)
- Without Ollama: steps 1–2 and reset/checklist UI still work
