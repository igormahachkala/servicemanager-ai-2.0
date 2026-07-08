# AI-COMPANY-107A — Mobile Design System V1 Foundation

## Цель

Отдельный mobile layer для Owner-интерфейса AI Company. Это **не** адаптация desktop sidebar/layout. Все будущие мобильные экраны (Owner Home, MAX Workspace, Morning Report, Approvals, Today, Run Task) строятся на этом слое.

## Архитектура Mobile Shell

```
┌─────────────────────────────┐
│ Safe Area (top)             │
├─────────────────────────────┤
│ MobileHeader                │
│  title · search · 🔔 · 👤 · theme │
├─────────────────────────────┤
│ MobileContent (scroll)      │
│  sections · cards · states  │
├─────────────────────────────┤
│ FAB Host («Поставить задачу»)│
├─────────────────────────────┤
│ MobileBottomNavigation      │
│ Safe Area (bottom)          │
└─────────────────────────────┘
         ▲
         └── MobileBottomSheetHost (portal, z-index 100)
```

**Точка входа:** `/mobile/today` (и sibling routes).

**Компонент:** `MobileAppShell` — единственная оболочка для mobile routes. Содержит:

- `MobileBottomSheetHost` — глобальный host для sheet (не modal)
- `MobileHeader` — sticky header
- `MobileContent` — scrollable main
- `MobileFab` — primary action
- `MobileBottomNavigation` — 5-tab nav

Desktop `PlatformShell` / sidebar **не используются** на mobile routes.

## Структура каталога

```
src/mobile/
├── layout/          Shell, Header, Content
├── navigation/      Bottom nav + config
├── components/      Card, Section, FAB, Empty, Skeleton
├── patterns/        Bottom Sheet, Action Sheet
├── hooks/           useMobileBottomSheet
├── tokens/          mobileTokens.ts
├── pages/           Placeholder tab pages (foundation)
└── index.ts         Public API
```

## Bottom Navigation

Ровно **5 разделов** — без sidebar:

| ID | RU label | Route |
|----|----------|-------|
| today | Сегодня | `/mobile/today` |
| employees | Сотрудники | `/mobile/employees` |
| tasks | Задачи | `/mobile/tasks` |
| decisions | Решения | `/mobile/decisions` |
| more | Еще | `/mobile/more` |

Конфиг: `mobileNavigationConfig.ts` → `MOBILE_NAV_ITEMS`.

Правила:

- Активный tab определяется по pathname prefix
- Touch target ≥ 44px (`mobileTokens.touchTarget`)
- Только bottom nav — никакого desktop sidebar на mobile routes

## Bottom Sheet

**Основной паттерн взаимодействия.** Modal windows на mobile **не используются**.

| Компонент | Назначение |
|-----------|------------|
| `MobileBottomSheetHost` | Provider + portal panel |
| `useMobileBottomSheet()` | `openSheet(content, { title })` / `closeSheet()` |
| `MobileActionSheet` | Список действий внутри sheet |

Используется для:

- FAB «Поставить задачу» → action sheet (Run Task, quick assign, morning report)
- Уведомления (inbox preview)
- Profile / quick links
- Любые future forms и pickers

Правила:

- Backdrop click и Escape закрывают sheet
- `body overflow: hidden` пока sheet открыт
- Стили только через `--theme-*` tokens

## Mobile Header

`MobileHeader` поддерживает:

- **Title** — из prop или auto из nav config
- **Search slot** — optional `searchSlot` + `showSearch`
- **Notifications** — opens sheet with `NotificationInbox`
- **Profile** — opens action sheet
- **Theme Switch** — `ThemeSwitch` (Theme System V1)

## Mobile Cards

`MobileCard` — базовая карточка списка/feed:

- `title`, `description`
- `status` — tone: default | success | warning | error | info
- `secondaryText`
- `actions` — slot (links/buttons)
- `onClick` — optional interactive mode

`MobileSection` — группировка с заголовком и optional action.

## Empty States

`MobileEmptyState` — единый визуальный паттерн. Variants:

| variant | Use case |
|---------|----------|
| `noEmployees` | Пустой реестр сотрудников |
| `noTasks` | Нет задач |
| `workdayNotStarted` | День не начат |
| `noReports` | Нет отчётов |

Copy — `i18n/mobile/{ru,en}.ts`.

## Loading Skeleton

`MobileLoadingSkeleton` variants:

- `card` — stack карточек (default)
- `list` — avatar + lines
- `page` — hero + grid

## Mobile Tokens

`mobileTokens.ts` + CSS vars в `styles/mobile.css`:

| Token | Value (px) |
|-------|------------|
| spacing | 4–24, page 16, section 20 |
| radius | 8–20, pill 999 |
| headerHeight | 56 |
| bottomNavHeight | 64 |
| fabSize | 56 |
| touchTarget | 44 |
| sheet padding | 16 |

## Theme System V1

Все компоненты используют semantic tokens:

- `--theme-bg`, `--theme-surface`, `--theme-text`, `--theme-accent`, …
- Status colors: `--theme-success`, `--theme-warning`, etc.

**Hardcoded colors запрещены** в mobile CSS.

Light / Dark — через существующий `ThemeProvider` + `data-theme` на `:root`.

## Mobile UX Principles

1. **Thumb-first** — primary actions в bottom nav и FAB
2. **Sheets over modals** — любое overlay → bottom sheet
3. **Single column** — max-width 480px, no desktop grid
4. **Touch targets** — minimum 44px
5. **Safe areas** — `env(safe-area-inset-*)` для notch/home indicator
6. **Progressive disclosure** — cards + sections, не плотные таблицы
7. **Separate layer** — `/mobile/*` routes без desktop shell
8. **i18n ready** — все labels через `t.mobile.*`

## Public API

```ts
import {
  MobileAppShell,
  MobileCard,
  MobileEmptyState,
  useMobileBottomSheet,
  mobileTokens,
} from '@/mobile' // path: src/mobile
```

## Checks

```bash
npm --prefix apps/ai-company run build
```

Открыть: `http://localhost:5174/mobile/today` (Vite dev port — см. `vite.config.ts`).

**Launch & QA:** [AI-COMPANY-107J — Mobile MVP Launch Notes](./AI-COMPANY-107J-mobile-mvp-launch-notes.md)

## Следующий шаг

**AI-COMPANY-107B** — Mobile Owner Home V1: заменить placeholder `MobileTodayPage` на полноценный Owner Home на mobile shell.

## Constraints (не затронуто)

- Runtime, Worker Loop, Employee Brain, Scheduler, backend
- Существующие desktop pages (`/ops/*`)
