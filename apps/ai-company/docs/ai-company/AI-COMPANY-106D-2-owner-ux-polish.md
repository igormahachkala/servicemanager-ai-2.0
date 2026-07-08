# AI-COMPANY-106D-2 — Owner UX Polish

## Scope

Desktop Owner UX polish for `/ops` — no domain/runtime/server changes beyond Owner Home snapshot status labels.

## Fixed in this pass

1. **Full RU sidebar** — `src/i18n/ownerNav/ru.ts` fully russified; removed EN labels (Task backlog, Execution queue, Runtime reports, etc.).
2. **First 5 Minutes on /ops** — merged into unified `FirstFiveMinutesGuide` (“Начните здесь”, 6 steps) on `OwnerHomeView`.
3. **CTA deduplication** — removed 4-card Next Actions grid + First Employee CTA block; kept one primary action + secondary text links.
4. **Status logic** — new `ready` operating status when company has no journal, queue, active employees, or started workday.
5. **Tab title** — `useDocumentTitle()` in `PlatformShell` → `AI Company — Обзор компании` on `/ops`.
6. **Owner-facing labels** — de-jargonized empty states and next-action copy in `ownerHome` i18n.
7. **Sidebar first-run** — technical group remains collapsed unless user opens it or navigates to a technical route.

## First-run flow

1. Open `/ops` → see “Начните здесь” guide (6 steps).
2. Status badge: **Готов к первому запуску** when data is empty.
3. Primary next action: **Поставить задачу MAX**.
4. Secondary links: **Открыть MAX**, **Начать рабочий день**.
5. Sidebar: Owner-first groups in RU; technical collapsed by default.

## Manual check

```bash
npm --prefix apps/ai-company run build
```

1. `/ops` in RU + light theme
2. Sidebar labels all Russian
3. Single guide block, no duplicate CTA rows
4. Empty company → status “Готов к первому запуску”
5. Tab title `AI Company — Обзор компании`
6. Switch dark theme — no regressions

## Remaining

- Deeper RU pass on non-sidebar pages (morning report sections still mix EN terms)
- Mobile Owner Home parity review
- Executive Command Center panels still available on other routes; `/ops` is Owner Home only

## First 5 Minutes UX readiness

**Ready for first-run Owner on `/ops`.** Remaining work is copy polish on secondary screens, not the core 5-minute path.
