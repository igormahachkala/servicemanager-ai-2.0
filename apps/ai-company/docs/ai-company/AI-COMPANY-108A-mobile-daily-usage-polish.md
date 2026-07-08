# AI-COMPANY-108A — Mobile Daily Usage Polish

## Goal

Сделать mobile shell удобным для ежедневного использования Owner: один ритм экранов, короткие тексты, одинаковые карточки/списки/кнопки/safe area. **Правило:** экран понятен за 3 секунды. Без новых функций — только UX.

## Что сделано

### Design system (`mobile.css` — блок 108A)

- `.acMobilePageIntro` — единый intro (2 строки max) для всех экранов
- Section/card/sheet descriptions — line-clamp 1–2
- `.acMobileOwnerHomeNote { display: none }` — убран footnote на Today
- Единые gaps списков, empty states, full-width page buttons
- Unified card shell (decision, task center, roster, report, company status)
- Quick actions → 2-col grid (1-col на ≤380px)
- MAX ready/active banners — 2-line clamp
- Guide placeholders — компактнее

### Pages — `.acMobilePage` wrapper

| Route | Изменения |
|-------|-----------|
| `/mobile/today` | `acMobilePage`, убраны section descriptions |
| `/mobile/employees` | `acMobilePage` + intro clamp |
| `/mobile/employees/ag-max` | `acMobilePage acMobileMaxPage` |
| `/mobile/tasks` | `acMobilePage` + intro |
| `/mobile/tasks/new` | `acMobilePage`, intro clamp |
| `/mobile/runtime` | `acMobilePage` + intro clamp |
| `/mobile/decisions` | `acMobilePage` + intro |
| `/mobile/reports` | `acMobilePage` + intro (empty/filled) |
| `/mobile/reports/:id` | `acMobilePage` |
| `/mobile/more` | `acMobilePage`, Runtime + Demo links, guide без лишнего description |

### i18n (ru/en)

Сокращены intros, hints, banners, success copy, guide placeholders — без потери смысла для Owner.

## Viewports / themes

Ручная проверка: 375×667, 390×844, 430×932 · light/dark.

## Checks

```bash
npm --prefix apps/ai-company run build
```

## Expected result

Owner открывает любой mobile tab и сразу видит: **что это за экран**, **что делать дальше**, **одинаковый visual rhythm** — без длинных абзацев и «прыгающих» карточек.
