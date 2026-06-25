# AI Company — Figma Library Structure (V2)

Design-only artifact for AI-COMPANY-032. Use this as the blueprint when building the Figma file.

---

## File naming

```
AI Company / Design System V2
├── 📘 Cover
├── 🎨 Foundations
├── 🧩 Components
├── 📐 Layouts
├── 🖥️ Screens — Dark
├── 🖥️ Screens — Light
└── 🔄 Prototypes
```

---

## Foundations page

### Variables (Collections)

| Collection | Modes | Source |
|------------|-------|--------|
| `color/semantic` | Dark, Light | `tokens.json` → `color.dark` / `color.light` |
| `color/primitive` | — | Neutral scale 50–950, Indigo/Violet accents |
| `space` | — | 4px base grid |
| `radius` | — | sm → full |
| `typography` | — | Text styles bound to variables |
| `elevation` | Dark, Light | Shadow tokens per mode |

### Text styles

| Style | Size | Weight | Use |
|-------|------|--------|-----|
| `Display/L` | 30px | 700 | Dashboard hero metrics |
| `Heading/XL` | 24px | 650 | Page titles |
| `Heading/L` | 20px | 650 | Section titles |
| `Heading/M` | 16px | 600 | Card titles |
| `Heading/S` | 14px | 600 | Panel headers |
| `Body/M` | 13px | 400 | Default UI |
| `Body/S` | 12px | 400 | Dense tables |
| `Label/M` | 11px | 600 | Form labels, table headers |
| `Label/S` | 10px | 600 | Uppercase meta |
| `Mono/M` | 12px | 400 | IDs, timestamps |
| `Mono/S` | 11px | 400 | Telemetry |

### Effect styles

- `Elevation/SM`, `MD`, `LG`, `XL`
- `Focus/Ring` — 2px accent + 2px offset
- `Live/Pulse` — optional glow for activity indicators (subtle)

---

## Components page (Auto Layout + Variants)

### Atoms

- `Button` — primary, secondary, ghost, danger; sm/md/lg; icon-only
- `IconButton` — sm/md
- `Badge` — default, success, warning, danger, info, accent, live
- `StatusDot` — green, amber, red, gray, live-pulse
- `Avatar` — employee (initials + role ring), workspace, system
- `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`
- `Tag`, `Chip`, `Kbd`
- `Divider`, `Skeleton`, `Spinner`, `ProgressBar`

### Molecules

- `MetricTile` — sm / md / lg
- `Card` — sm / md / lg / metric / entity / activity / info
- `PageHeader` — title + description + actions + breadcrumbs slot
- `EmptyState` — illustration slot + title + body + primary CTA
- `ListRow` — avatar + title + meta + trailing badge
- `ActivityRow` — actor + verb + object + time (Living Company)
- `NavItem` — L1 / L2 / L3; default / hover / active
- `Breadcrumb`
- `WorkspaceSwitcher`
- `CommandPalette` (frame)
- `Toast`, `Tooltip`, `Popover`, `ContextMenu`

### Organisms

- `DataTable` — toolbar + sticky header + rows + bulk bar + pagination
- `TimelineGroup` — date header + event cards
- `ChatComposer` — input + attachments + promote menu
- `ChatMessage` — direct / group / system
- `RuntimePipeline` — steps + current + warnings
- `InspectorPanel` — right rail sections
- `ReportSection` — executive block types
- `EmployeeHeader` — profile hero
- `ProjectBoard` — 3-column operational layout

---

## Layouts page

Frame presets (1440×900 primary):

| Frame | Structure |
|-------|-----------|
| `Shell/Company` | L1 sidebar + topbar + content + status bar |
| `Shell/Project` | L1 + L2 context nav + center + inspector |
| `Shell/Object` | L1 + object header + tabs + content + optional inspector |
| `Shell/Messenger` | L1 + channel list + thread + thread inspector |
| `Shell/Runtime` | L1 + pipeline center + context inspector |

Grid: 12 columns, 16px gutter, 24px page padding (32px on dashboard).

---

## Screens — reference frames

Build **Dark first**, duplicate with Light mode swap.

### Priority 1 (MVP visual target)

1. Dashboard — Command Center
2. Employee Profile — Overview tab
3. Project (Workspace) — Operational center
4. Chats — Messenger layout
5. Runtime Run — Pipeline monitoring
6. Report — Executive view
7. Timeline — Grouped activity
8. Employees — GitHub-style table
9. Empty state set (6 variants)

### Priority 2

10. Approvals inbox + detail
11. Knowledge item + collections
12. Settings / Runtime settings
13. Command palette overlay
14. Mobile / tablet breakpoints

---

## Component properties (Figma)

Use **Component Properties** consistently:

- `State`: default | hover | active | focus | disabled | loading
- `Theme`: dark | light (bound to variable mode)
- `Size`: sm | md | lg
- `Density`: compact | comfortable

---

## Prototype flows

Link these for stakeholder review (no code):

1. **Morning check-in** — Dashboard → see live activity → open Runtime run
2. **Employee review** — Employees table → Profile → Runtime tab
3. **Project ops** — Workspace → Tasks → Run detail
4. **Approval loop** — Alert on dashboard → Approval → back to Timeline
5. **Chat to artifact** — Chat → Promote to Report → Report page

---

## Handoff to engineering

When implementing (future tasks, not 032):

- Export variables via Figma Tokens plugin → `tokens.json`
- Code Connect map: Figma component → React component path
- Do **not** change routes; map L1 labels to existing paths documented in main spec

---

## Related

- [Main spec](../AI-COMPANY-032-design-system-v2.md)
- [Component catalog](./components.md)
- [Token JSON](./tokens.json)
