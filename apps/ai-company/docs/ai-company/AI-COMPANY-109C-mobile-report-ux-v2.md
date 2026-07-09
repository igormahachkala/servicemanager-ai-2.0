# AI-COMPANY-109C — Mobile Report UX V2 for Owner

## Goal

На `/mobile/reports/:id` показывать бизнес-отчёт для Owner, а не технический Runtime Report.

## Что изменено

### Presentation layer

- `mobileReportOwnerView.ts` — маппинг `MobileReportDetail` → `MobileReportOwnerView` без изменения data model
- `MobileReportOwnerDetail.tsx` — owner-friendly UI
- `MobileReportDetailPage.tsx` — использует новый view

### Структура экрана

1. **Заголовок** — название задачи, сотрудник, owner-статус, дата
2. **Краткий итог** — 2–4 строки (line-clamp)
3. **Что сделано** — из `runtimeBody.checked` / morning `whatMaxDid` / ODS tasks
4. **Что найдено** — findings
5. **Риски** — без `[critical]` / severity prefixes
6. **Рекомендации**
7. **Требуется решение Owner** — callout, если есть
8. **Следующий шаг** — primary CTA (nextStep / decisions / MAX / Today)
9. **Технические детали** — `<details>` collapsed by default

### i18n

- `reports.ownerDetail` — секции, owner statuses, technical labels (ru/en)

### CSS

- Блок 109C в `mobile.css` — header, summary card, sections, decision callout, technical drawer

## Как теперь устроен отчёт

```
MobileReportDetail (snapshot)
  → buildMobileReportOwnerView()
  → MobileReportOwnerDetail
```

Owner status mapping: `draft` → «На проверке», `published` → «Готов», и т.д. — без «Draft» / «Runtime Report» в основном виде.

## Какие технические поля скрыты

Из основного вида убраны:

- Badge «Runtime Report» / «Journal»
- «Draft» / «Published» (system status)
- `modelsUsed`, `toolsUsed`, `consultations` как отдельные секции
- `[critical]` / severity prefixes в рисках
- Worker Loop / Runtime Run links
- `runtimeRunId`, `workerLoopId`, raw markdown

Всё это — только в **Технические детали**.

## Что осталось

- Owner-friendly labels в списке отчётов (`MobileReportCard`) — отдельная задача
- Playwright smoke для report detail × report kinds
- Сворачиваемый raw report с copy-to-clipboard

## Checks

```bash
npm --prefix apps/ai-company run build
```
