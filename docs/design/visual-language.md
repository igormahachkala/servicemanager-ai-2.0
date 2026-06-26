# Visual Language

> **Status:** Governance · Binding for all UI in `apps/ai-company/**`  
> **Task:** AI-COMPANY-063  
> **Token source:** [design-system-v2/tokens.json](../ai-company/design-system-v2/tokens.json)  
> **Parent:** [Design Manifesto](./design-manifesto.md)

AI Company must feel like **one operating system** — calm, dense, authoritative. Not a collage of pages built in different weeks.

---

## Principles

1. **Token-first** — no magic numbers in CSS unless token is missing (then add token).  
2. **Semantic color** — color means status or accent, not decoration.  
3. **Elevation is rare** — most surfaces are flat bordered panels; shadow marks modals and overlays only.  
4. **Data is monospace** — IDs, timestamps, logs, code.  
5. **Motion is functional** — live pulse, progress, cursor in Visual Lab; not ornamental bounce.

---

## Forbidden (non-negotiable)

These are **automatic UX review failures** unless registered as debt with Owner approval:

| Forbidden | Use instead |
|-----------|-------------|
| Random hex colors (`#3b82f6` inline) | `accent.primary`, `status.*` tokens |
| Mixed border radii on same tier (6px + 10px + 12px ad hoc) | `radius.sm` · `md` · `lg` · `xl` only |
| Mixed shadows on cards (`box-shadow` one-off) | `elevation.sm` for dropdown; `none` for cards |
| One-off button styles per page | `mcBtn`, `mcBtnPrimary`, `mcBtnSecondary`, `acQuickActionBtn` |
| One-off card chrome | `Card`, `Panel`, shared grid classes |
| Light-gray-on-light-gray unreadable text | `text.primary` / `text.secondary` / `text.muted` |
| Emoji as primary nav iconography in new surfaces | SVG / unicode only where legacy SideNav already uses emoji |
| Full-bleed rainbow gradients on operational panels | Subtle accent wash on Command Center brief only |

---

## Color system

Reference: `color.dark` / `color.light` in tokens.

| Role | Token | Usage |
|------|-------|-------|
| Canvas | `bg.canvas` | App background |
| Surface | `surface.default`, `surface.raised` | Panels, cards |
| Border | `border.default`, `border.subtle` | Panel edges |
| Primary text | `text.primary` | Titles, body |
| Secondary | `text.secondary` | Descriptions |
| Muted | `text.muted` | Meta, timestamps |
| Accent | `accent.primary` | Primary actions, links |
| Success | `status.success` | Completed, healthy, up |
| Warning | `status.warning` | At risk, pending |
| Danger | `status.danger` | Failed, critical alert |
| Info | `status.info` | Informational badges |
| Live | `status.live` | Presence, streaming |

**Rule:** status colors never replace text labels (accessibility).

---

## Typography

| Element | Size token | Weight |
|---------|------------|--------|
| Page title | `fontSize.3xl` | semibold/bold |
| Panel title | `fontSize.xs` uppercase label | semibold |
| Body | `fontSize.md`–`lg` | regular |
| Meta / caption | `fontSize.xs`–`sm` | regular |
| Metric hero | `fontSize.3xl`–`4xl` | bold |
| Code / ID | `fontFamily.mono` | regular |

---

## Spacing & layout

| Token | Value | Use |
|-------|-------|-----|
| `space.2` | 8px | Tight gaps, button padding |
| `space.3` | 12px | Panel padding small |
| `space.4` | 16px | Grid gutter default |
| `space.6` | 24px | Section separation |

Layout widths from tokens:

- Company sidebar: `248px`  
- Inspector / preview column: `360px`  
- Content max: `1440px`  
- 12-column grid, `16px` gutter  

Command surfaces (Command Center, Control Room, Visual Lab) use **named grid classes** (`mcCommandCenterGrid`, `vlWorkspace`) — extend those patterns, do not invent third grid system.

---

## Radius

| Token | Value | Use |
|-------|-------|-----|
| `radius.sm` | 6px | Badges, small chips |
| `radius.md` | 8px | Inputs, buttons |
| `radius.lg` | 12px | Cards, panels |
| `radius.xl` | 16px | Modals, hero brief |
| `radius.full` | pill | Status dots, tags |

---

## Elevation

| Token | Use |
|-------|-----|
| `elevation.none` | Default panels |
| `elevation.sm` | Dropdowns, popovers |
| `elevation.md` | Floating inspector |
| `elevation.lg` | Modal |
| `elevation.xl` | Command palette (future) |

Cards in Mission Control **do not** use lg/xl shadow by default.

---

## Components (canonical)

| Pattern | Class / component | Notes |
|---------|-------------------|-------|
| Page shell | `PageHeader` | Title + description |
| Panel | `Panel`, `Card` | Bordered surface |
| Primary button | `mcBtn mcBtnPrimary` | One per panel max |
| Secondary | `mcBtn mcBtnSecondary` | Alternatives |
| Quick action | `acQuickActionBtn` | Command Center strip |
| Badge | `Badge` | Status, priority |
| Status dot | `StatusDot` | Health, presence |
| Data table | `DataTable` | Reports, lists |
| Mono meta | `acMono acMuted` | IDs, times |

New features **compose** these before adding CSS.

---

## Domain-specific visual grammar

| Surface | Visual cue |
|---------|------------|
| Living / live | Pulse, green live badge, animated timeline |
| Owner decision | Amber/warning + approval link |
| Execution | Lightning ⚡ metaphor, queue columns |
| Runtime | Pipeline steps, step order numbers |
| Employee | Codename prominent, role secondary |
| Project delivery | Control Room health badge |
| Mock / local | Muted footnote “localStorage only” |

---

## Dark mode

V1 default: **dark operational UI** (Mission Control). Light tokens exist for future; do not mix themes on same route.

---

## Figma & code parity

- Figma library: [figma-library.md](../ai-company/design-system-v2/figma-library.md)  
- Component spec: [components.md](../ai-company/design-system-v2/components.md)  
- Code drift → file [UX debt](./ux-debt.md) entry before shipping.

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial visual language (AI-COMPANY-063) |
