# AI-COMPANY-107H-5 — Mobile Polish Pass: FAB Sheet + CTA Dedup

## Goal

Убрать UX-шероховатости mobile MVP после smoke-test 107H-4: clipped FAB sheet, дубли «Поставить задачу» на MAX page, неясная иерархия CTA.

## Changes

### 1. FAB / Bottom Sheet — scroll-safe on small viewports

- `acMobileSheetPanel`: `max-height: min(92dvh, …)`, `min-height: 0`, `overflow: hidden`, flex column
- `acMobileSheetBody`: `flex: 1 1 auto`, `min-height: 0`, `overflow-y: auto`, `overscroll-behavior: contain`
- Handle/header/footer: `flex-shrink: 0`
- Safe-area padding preserved on panel bottom
- `MobileBottomSheetHost`: scroll body to top on open

### 2. MAX page CTA dedup (`/mobile/employees/ag-max`)

| Zone | Before | After |
|------|--------|-------|
| Hero | Primary «Поставить задачу» + reports | Secondary «Открыть отчёты» + tertiary «Сегодня» |
| Work queue (empty) | Assign CTA | Assign CTA (единственный primary на странице) |
| Work queue (has tasks) | Assign link + Run next | Primary «Запустить следующую» + FAB hint |
| Quick task section | Duplicate assign block | **Removed** |
| FAB | Assign task sheet | **Single global primary** for new tasks |

### 3. CTA hierarchy

- **Primary**: one obvious next action per section (run next / start workday / empty-queue assign)
- **Secondary**: `acMobileSecondaryBtn` — reports, report detail
- **Tertiary**: `acMobileTertiaryLinkBtn` — today, all reports (no accent fill)

### 4. Copy

- Hints reference FAB «+» instead of repeating assign CTAs
- RU/EN i18n: `hero.openToday`, `workQueue.fabHint`, `lastResult.openReports`

## Files

- `src/mobile/patterns/MobileBottomSheetHost.tsx`
- `src/mobile/patterns/MobileActionSheet.tsx` (wrapper class via CSS)
- `src/mobile/layout/MobileAppShell.tsx`
- `src/mobile/pages/MobileEmployeePage.tsx`
- `src/mobile/components/MobileEmployeeHeroCard.tsx`
- `src/mobile/components/MobileWorkQueueCard.tsx`
- `src/mobile/components/MobileLastResultCard.tsx`
- `src/styles/mobile.css`
- `src/i18n/mobile/ru.ts`, `en.ts`

## Constraints

- No Runtime / Worker Loop / backend changes
- Light/dark preserved

## Manual checks

1. `/mobile/employees/ag-max` — one primary assign path (FAB or empty queue only)
2. `/mobile/today` — FAB sheet opens, all items visible
3. Small viewport (375×667 or iPhone SE): FAB sheet scrolls, actions not clipped

## Expected result

- Bottom sheet never cuts off actions
- MAX page has one obvious next action
- Secondary links no longer compete with primary CTAs
