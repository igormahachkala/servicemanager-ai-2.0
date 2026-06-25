# AI Company — Component Catalog (Design System V2)

Design-only reference for AI-COMPANY-032. Implementation is out of scope for this task.

---

## Card system

All cards share: `radius.lg`, `border.default`, `surface.default`, optional `elevation.sm` on hover for entity cards.

| Variant | Size | Purpose | Anatomy |
|---------|------|---------|---------|
| **Card/SM** | min-h 72px | Compact list item, sidebar widget | Title + 1 meta line + optional badge |
| **Card/MD** | auto | Default panel | Header (title + action) + body + optional footer |
| **Card/LG** | auto | Dashboard feature block | Header + rich body + footer links |
| **Card/Metric** | 96–120px | KPI tile | Label (uppercase xs) + value (2xl) + delta/sub |
| **Card/Entity** | auto | Employee, workspace, report row | Avatar/icon + title + subtitle + status + trailing |
| **Card/Activity** | auto | Timeline, feed | Actor + action + object link + relative time + severity |
| **Card/Info** | auto | Help, onboarding | Icon + title + body + single CTA |

### Card states

- Default, hover (border.strong + surface.hover), selected (accent border + accent muted bg), loading (skeleton), empty (inline empty state)

---

## Badge system

Pill shape (`radius.full`), `Label/S` typography, 2px semantic border.

| Token | Use |
|-------|-----|
| default | Neutral meta (type, category) |
| success | Completed, online, approved |
| warning | Waiting, degraded, due soon |
| danger | Failed, blocked, breach |
| info | Informational, draft |
| accent | Active selection, brand highlight |
| live | Pulsing dot + "Live" — runtime in progress |

**Living Company:** prefer `live` badge on any in-flight runtime, active discussion, or pending approval visible to owner.

---

## Table system (GitHub-quality)

### Anatomy

```
┌─ Toolbar ─────────────────────────────────────────────┐
│ Filter chips · Search · Column config · Bulk actions  │
├─ Header (sticky) ─────────────────────────────────────┤
│ ☐ · Column A ↕ · Column B ↕ · Column C              │
├─ Row ─────────────────────────────────────────────────┤
│ ☐ · …                                                 │
└─ Footer: pagination · selection count ────────────────┘
```

### Spec

| Feature | Behavior |
|---------|----------|
| Sorting | Click header; shift+click multi-sort (optional v2.1) |
| Filtering | Inline chips + advanced filter popover |
| Columns | Show/hide/reorder via dropdown |
| Keyboard | ↑↓ navigate rows, ␣ select, ⌘A select page, Enter open |
| Sticky header | Yes, with shadow on scroll |
| Bulk actions | Appear when ≥1 row selected |
| Density | Compact (40px row) default; Comfortable (48px) optional |
| Empty | Full empty state component, not blank table |

### Row states

Default, hover, selected, active (opened detail), disabled

---

## Form controls

| Control | Height | Notes |
|---------|--------|-------|
| Input sm | 32px | Filters, inline edit |
| Input md | 36px | Default forms |
| Input lg | 40px | Hero search, command palette |
| Textarea | min 80px | Resizable vertical |
| Select | md | Custom chevron, not native on desktop |

States: default, hover, focus (ring), error, disabled, read-only

---

## Dialog & overlay

| Type | Width | Use |
|------|-------|-----|
| Dialog/SM | 400px | Confirm, single field |
| Dialog/MD | 560px | Forms, promote-from-chat |
| Dialog/LG | 720px | Multi-step create |
| Sheet/Right | 480px | Inspector on tablet |
| Command palette | 640px | ⌘K global navigation |

Scrim: `overlay.scrim`. Focus trap. Esc closes. Primary action right.

---

## Navigation components

### NavItem L1 (Company)

Height 36px, icon 18px + label, active = accent muted + inset border

### NavItem L2 (Context)

Height 32px, smaller icon, indent 12px, used in project/workspace rail

### NavItem L3 (Object tabs)

Underline or pill tab bar under object header; sticky on scroll

### Breadcrumbs

Max 4 visible + collapse middle; last segment = current (non-link)

---

## Employee header (organism)

```
┌──────────────────────────────────────────────────────────────┐
│ [Avatar 64]  Name · Role badge · Status live dot             │
│              Department · Manager · Current project link      │
│              Reputation score · Availability · Last active    │
│              [Message] [Assign task] [Runtime] [···]          │
├──────────────────────────────────────────────────────────────┤
│ Overview | Conversation | Memory | … (L3 tabs)               │
└──────────────────────────────────────────────────────────────┘
```

Avatar: initials or generated glyph; **role ring color** by department; **status dot** bottom-right (online/busy/idle/offline).

---

## Chat components

| Component | Spec |
|-----------|------|
| ChannelList | Sections: Direct, Groups, Workspaces, Projects, System |
| ThreadHeader | Title + participants + pinned + search |
| MessageBubble | Own vs others; compact vs full; code block mono |
| Composer | Multi-line, @mention, attach, send; promote ▾ menu |
| PromoteMenu | Task · Report · ADR · Knowledge |
| PinnedBar | Collapsed strip above thread |
| MentionChip | Accent muted background |

Messenger density: Slack spacing; AI context: Cursor-style monospace blocks for tool output.

---

## Runtime components

| Component | Spec |
|-----------|------|
| Pipeline | Horizontal steps; current = accent + pulse; failed = danger |
| ContextPanel | Loaded knowledge list, memory scope, model route |
| StepDetail | Input/output preview, duration, tokens (mock in design) |
| WarningList | Amber cards, expandable |
| ArtifactGrid | File cards with type icon |
| ApprovalGate | Inline banner when step blocked |

Feel: **Vercel deployment log + Stripe status clarity**, not a generic spinner.

---

## Report components

Executive document layout — max-width 800px reading column inside wider shell.

| Section | Typography |
|---------|------------|
| Title block | Display/L + status badge + date |
| Summary | Body/M, highlighted callout box |
| Findings | Numbered list, severity icons |
| Risks | Warning-tinted cards |
| Recommendations | Success-tinted action list |
| Evidence | Collapsible mono blocks / links |
| Related | Entity cards row (runs, employees) |

---

## Timeline components

| Component | Spec |
|-----------|------|
| DateGroup | Sticky date header ("Today", "Yesterday") |
| EventCard | Icon by type + actor + sentence + object link + time |
| FilterBar | Employee, Workspace, Project, Severity, Type |
| LiveIndicator | "N new events" soft toast at top when stream updates |

Event sentence pattern (Living Company):

> **Atlas** started **Runtime** on *Employee Roster V1* · 2m ago

---

## Empty states

Every empty view includes:

1. **Illustration** — lightweight SVG (256×160), duotone, not cartoonish
2. **Title** — Heading/M ("No approvals yet")
3. **Body** — Body/M, max 2 lines, explains why
4. **Primary CTA** — one button
5. **Secondary link** — optional docs/learn

Examples:

| Surface | CTA |
|---------|-----|
| No chats | Start conversation |
| No reports | Generate from runtime |
| No approvals | Review runtime settings |
| No timeline events | Run employee task |

---

## Loading states

| Pattern | Use |
|---------|-----|
| Skeleton block | Cards, tables, profile header |
| Skeleton row | Table (5 rows) |
| Inline spinner | Button loading |
| Progress bar | Runtime pipeline step |
| Shimmer | 1.2s, subtle, horizontal |

Never: blank white/black content area without skeleton.

---

## Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Hover color | 80ms | standard |
| Panel open | 180ms | enter |
| Modal | 180ms | enter/exit |
| Toast | 120ms | enter |
| Live pulse | 2s loop | subtle opacity |

No parallax, no bounce, no decorative page transitions.

---

## Accessibility checklist (per component)

- Focus visible on all interactive elements
- Color contrast ≥ 4.5:1 body, ≥ 3:1 large text/UI (WCAG AA)
- Icon buttons require `aria-label`
- Tables: proper `th` scope, sort announced
- Live regions for timeline updates (`aria-live="polite"`)
- Reduced motion: disable pulse/shimmer via `prefers-reduced-motion`

---

## Related

- [Main spec](../AI-COMPANY-032-design-system-v2.md)
- [Figma library](./figma-library.md)
- [Tokens](./tokens.json)
