# AI-COMPANY-107M — Mobile UX Polish V1

## Goal

Довести mobile shell до ощущения готового приложения: единые отступы, радиусы, кнопки, overflow-safe текст, mobile-only ссылки, safe areas.

## Что исправлено

### Design system (`mobile.css`)

- `.acMobilePage` — единый vertical rhythm для экранов
- Section/card headers: `min-width: 0`, line-clamp для длинных заголовков
- Status badges: ellipsis, max-width — карточки не «прыгают»
- Empty states: full width, контраст `--theme-text-secondary`
- Runtime live / roster / task center: overflow-wrap для длинных title
- Roster cards: стабильный footer actions (`margin-top: auto`)
- Narrow viewports (≤380px): компактнее bottom nav labels и icons
- ≤430px: task center actions stack full-width

### Navigation & hrefs

- `mobileHrefResolver`: `runtime`, `mobileMaxHref`, `mobileRuntimeRunHref`, `mobileRuntimeLoopHref`, `mobileReportHref`
- Desktop `/ops/runtime/*`, `/ops/reports/*`, workspace → mobile equivalents
- More page: ссылка **Runtime Live** → `/mobile/runtime`
- Runtime routes в `MobileRoutes` + title/hide FAB в shell

### Runtime Live (107L completion)

- `mobileRuntimeLiveViewModel.ts`, `useMobileRuntimeLive`, `MobileRuntimeLivePage`
- Phase cards, live banner на MAX page
- Report CTA через `mobileReportHref('runtime:…')`

### Reports snapshot

- Worker Loop / Runtime Run links → mobile paths (не `/ops/…`)

## Экраны

| Route | Улучшения |
|-------|-----------|
| `/mobile/today` | наследует page rhythm через owner home stack |
| `/mobile/employees` | roster overflow, card stability |
| `/mobile/employees/ag-max` | live banner, `.acMobilePage` wrapper |
| `/mobile/tasks` | task center actions на узких экранах |
| `/mobile/tasks/new` | без FAB (как было) |
| `/mobile/runtime` | новый live screen + empty state |
| `/mobile/decisions` | section/card overflow rules |
| `/mobile/reports` | mobile links в detail snapshot |
| `/mobile/more` | Runtime link, desktop только как escape hatch |

## Viewports / themes

Ручная проверка: 375×667, 390×844, 430×932 · light/dark.

## Checks

```bash
npm --prefix apps/ai-company run build
```

## Остаётся (post-V1)

- Playwright smoke для всех mobile routes × themes
- Unified icon set audit (22px nav vs 24px FAB)
- Task center retry action (disabled placeholder)
- Push / haptic на завершение Worker Loop
- Desktop header overflow menu → `/ops` (намеренный escape hatch)
