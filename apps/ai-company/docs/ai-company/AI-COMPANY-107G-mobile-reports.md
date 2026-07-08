# AI-COMPANY-107G — Mobile Reports V1

## Goal

Mobile Owner screen for reports — closes the mobile MVP loop:

```
/mobile/today → assign task → MAX executes → Owner opens report on phone
```

## Routes

| Route | Screen |
|-------|--------|
| `/mobile/reports` | Reports list + Morning Report hero |
| `/mobile/reports/:id` | Report detail |

### Report IDs

| ID pattern | Kind |
|------------|------|
| `morning-report` | Owner Morning Report snapshot |
| `runtime:{reportId}` | Runtime Report from local storage |
| `ods:{summaryId}` | Operating Day Summary |
| `journal:{entryId}` | Daily Journal entry (deduped vs runtime) |

## Navigation

- **More** tab → Reports card → `/mobile/reports`
- **Owner Home** quick action «Утренний отчёт» → `/mobile/reports`
- **FAB sheet** «Утренний отчёт» → `/mobile/reports`

## Data sources (real, no fake progress)

| Source | Domain module | Used for |
|--------|---------------|----------|
| Owner Morning Report | `domain/morningReport` | Hero card + `morning-report` detail |
| Runtime Reports | `domain/reports/reportStorage` | `runtime:*` list + detail |
| Operating Day Summary | `domain/operatingDaySummary` | `ods:*` list + detail |
| Daily Journal | `domain/employeeDailyJournal` | `journal:*` when not deduped with runtime |
| MAX Worker Loop | `domain/maxWorkerLoop` | Detail links only |

Sync events: journal, work queue, operating day summary, workday, runtime, worker loop.

## UI

### List (`MobileReportsPage`)

- Morning Report hero (`MobileReportSummaryCard`) when snapshot has content
- Cards for runtime, ODS, journal (`MobileReportCard`)
- Empty state: «Отчётов пока нет» → CTA `/mobile/tasks/new?employee=ag-max`

### Detail (`MobileReportDetailPage`)

- Meta: employee, task, summary, status
- Sections: findings, risks, recommendations, models, tools, consultations
- Related links: Worker Loop, Runtime Run, desktop report hrefs

## Files

```
src/mobile/reports/mobileReportsSnapshot.ts
src/mobile/hooks/useMobileReports.ts
src/mobile/hooks/useMobileReportDetail.ts
src/mobile/components/MobileReportCard.tsx
src/mobile/components/MobileReportSummaryCard.tsx
src/mobile/pages/MobileReportsPage.tsx
src/mobile/pages/MobileReportDetailPage.tsx
src/mobile/MobileRoutes.tsx
src/i18n/mobile/{ru,en}.ts
src/styles/mobile.css
```

## Constraints respected

- No Runtime / Worker Loop / Employee Brain / backend / desktop changes
- Mobile Design System V1 tokens
- Light / dark via existing theme tokens

## Manual check

1. `/mobile/reports` — empty state when no data
2. Complete MAX task → report appears in list
3. Open detail → sections populated from real data
4. Toggle light/dark theme
5. More → Open reports

## Mobile Owner Console MVP status

After 107G the mobile MVP includes:

- Today ✓
- Employees ✓
- MAX Control ✓
- Run Task ✓
- Decisions ✓
- **Reports ✓**

**Mobile Owner Console MVP can be considered ready** for V1 demo loop.

## Remaining (post-V1)

- Push reports into bottom nav (currently under More)
- Deep-link from Today results cards directly to report detail
- Offline refresh indicator
- Desktop report viewer in mobile webview (optional)
