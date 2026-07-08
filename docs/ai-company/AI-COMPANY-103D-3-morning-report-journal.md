# AI-COMPANY-103D-3 — Morning Report ← Daily Journal

**Статус:** integrated  
**Ветка:** `ai-company-flow`  
**Scope:** `apps/ai-company/src/domain/morningReport`

## Цель

Owner Morning Report использует **Employee Daily Journal** как primary source. Runtime / Worker Loop — fallback.

## Поток

```text
listEmployeeDailyJournalEntries (MAX, report window)
  ↓
entries.length > 0 ?
  ├─ yes → buildJournalPrimarySnapshot
  └─ no  → buildRuntimeFallbackSnapshot + fallback note
```

## Fallback note

> Журнал сотрудника пока пуст. Отчёт построен по Runtime-данным.

## Journal → Morning Report mapping

| Journal field | Morning Report section |
|---------------|------------------------|
| workSummary | whatMaxDid |
| taskTitle / resultSummary | completedTasks |
| startedAt / finishedAt | stats.workDurationMinutes |
| modelsUsed | modelsUsed |
| toolsUsed | toolsUsed |
| consultations | consultations |
| decisions | decisions / whatDiscovered |
| reportLinks | reportsCreated |
| owner_approval decisions | needsOwnerApproval |
| maxWorkerLoopId → snapshot | memoryDrafts / knowledgeCandidates |
| Employee Work Queue | remainingQueue |

## Файлы

- `ownerMorningReportJournalSections.ts` — journal builders
- `ownerMorningReportSnapshot.ts` — orchestrator + runtime fallback
- `OwnerMorningReportView.tsx` — UI sections + fallback banner
- `useOwnerMorningReport.ts` — sync on journal / work queue events

## Следующий шаг

- Journal UI на MAX Workspace
- Multi-employee Morning Report (не только MAX)
