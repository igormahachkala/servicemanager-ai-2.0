# AI-COMPANY-107E — Mobile Employees Roster V1

## Scope

Mobile roster screen at `/mobile/employees` — company staff view, not MAX-only app framing.

## Delivered

- Route `/mobile/employees` (bottom nav **Сотрудники**)
- Roster cards: MAX (active) + Atlas / Sentinel / Builder (placeholders)
- Per-card metrics: status, workday, queue, pending decisions, last result
- MAX actions: **Открыть**, **Поставить задачу**, **Сегодня**
- Placeholder actions: disabled **Будет доступен позже**
- Hire teaser: **Нанять сотрудника** (disabled, coming soon)

## Data sources

- MAX: Presence, Operating Day snapshot, Work Queue, Daily Journal, Approvals (read-only)
- Placeholders: static roster config with explicit `availability: placeholder`

## Files

- `src/mobile/pages/MobileEmployeesPage.tsx`
- `src/mobile/components/MobileEmployeeRosterCard.tsx`
- `src/mobile/components/MobileHireEmployeeCard.tsx`
- `src/mobile/hooks/useMobileEmployeesRoster.ts`
- `src/i18n/mobile/ru.ts`, `en.ts` — `employeesRoster`
- `src/styles/mobile.css` — roster + hire styles

## Manual check

```bash
npm --prefix apps/ai-company run build
```

Open `/mobile/employees` — verify roster, MAX link to `/mobile/employees/ag-max`, bottom nav.

## Next steps

- Enable Atlas/Sentinel/Builder when lifecycle domain activates them
- Mobile hire flow when Employee Lifecycle UI ships
- Per-employee mobile control pages beyond MAX
