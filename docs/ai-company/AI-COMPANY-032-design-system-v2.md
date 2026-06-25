# AI-COMPANY-032 — Design System V2 & World-Class Product UX

**Status:** Design specification only  
**Scope:** Visual language, IA, layouts, components, themes, Figma handoff  
**Out of scope:** Business logic, Runtime, domain model, storage, routes, API, frontend code

---

## 1. Product vision

AI Company is the **operating system of a digital organization**.

It is not a CRM, chatbot, dashboard, or project tracker. The owner opens the product and immediately feels:

> *I am managing a living digital company.*

Digital employees work, discuss, progress, and produce artifacts. The interface must communicate **motion, presence, and outcomes** — not static admin pages.

### Living Company principle

The UI never feels idle. On every primary surface show evidence of ongoing work:

| Signal | Example copy |
|--------|----------------|
| Runtime started | Atlas started Runtime on *Architecture Review* |
| Work completed | MAX completed implementation · *TSK-042* |
| Report published | QA published report · *Sprint QA Summary* |
| Knowledge updated | Architect updated ADR · *Runtime Routing* |
| Approval waiting | DevOps waiting approval · *Production deploy* |
| Discussion active | 3 participants in *Sprint Planning* |
| Timeline event | New event in company timeline · 30s ago |

**Design rule:** Dashboard, sidebar footer, and timeline always surface ≥3 live signals without requiring refresh.

---

## 2. Design inspiration (principles, not copies)

| Product | Principle borrowed |
|---------|-------------------|
| **Linear** | Keyboard-first nav, compact issue density, sidebar speed, clear status |
| **Notion** | Hierarchical context, calm whitespace, nested object clarity |
| **Slack** | Messenger channels, presence, mentions, threaded collaboration |
| **GitHub** | Professional tables, diffs, audit trail, sticky headers |
| **Stripe Dashboard** | Executive metrics, trustworthy finance-grade polish |
| **Vercel** | Deployment/runtime monitoring aesthetic, dark UI precision |
| **Cursor** | Agent context panels, inspector rails, tool output blocks |
| **Figma** | Panel-based layout, canvas + sidebars, spatial consistency |

**Identity constraint:** Combine principles into a unique **Company OS** voice — operational, premium, alive.

---

## 3. General style

| Attribute | Direction |
|-----------|-----------|
| Mood | Minimal, modern, premium |
| Density | High information density with **large intentional whitespace** between zones |
| Typography | Excellent hierarchy; Inter + mono for telemetry |
| Navigation | Fast — L1 always visible, L2/L3 contextual |
| Platform | Desktop-first → tablet → mobile |
| Themes | Dark (default) + Light (full parity) |

---

## 4. Visual language & tokens

Full token export: [`design-system-v2/tokens.json`](./design-system-v2/tokens.json)

### 4.1 Color semantics

Use **semantic tokens** only in UI specs — never hardcode hex in component docs.

| Role | Dark | Light | Use |
|------|------|-------|-----|
| Canvas | `#09090b` | `#fafafa` | App background |
| Surface | `#111113` | `#ffffff` | Cards, panels |
| Border | `#27272a` | `#e4e4e7` | Separators |
| Text primary | `#fafafa` | `#18181b` | Headings, body |
| Text muted | `#71717a` | `#71717a` | Secondary meta |
| Accent | `#6366f1` | `#4f46e5` | Links, focus, selection |
| Success | `#22c55e` | `#16a34a` | Online, done |
| Warning | `#f59e0b` | `#d97706` | Waiting, SLA |
| Danger | `#ef4444` | `#dc2626` | Error, blocked |

### 4.2 Typography scale

| Token | Size | Weight | Line | Use |
|-------|------|--------|------|-----|
| display/l | 30px | 700 | 1.2 | Dashboard hero |
| heading/xl | 24px | 650 | 1.2 | Page title |
| heading/l | 20px | 650 | 1.25 | Section |
| heading/m | 16px | 600 | 1.35 | Card title |
| body/m | 13px | 400 | 1.45 | Default UI |
| body/s | 12px | 400 | 1.45 | Tables |
| label/m | 11px | 600 | 1.35 | Form labels |
| label/s | 10px | 600 | 1.2 | Uppercase meta |
| mono/m | 12px | 400 | 1.45 | IDs, logs |

### 4.3 Spacing (4px grid)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

- Page padding: **24px** (32px dashboard)
- Card padding: **16px**
- Section gap: **24px**
- Inline gap: **8px**

### 4.4 Radius & elevation

- Controls: `6px` · Cards: `12px` · Modals: `16px`
- Elevation: sm (cards hover) → lg (dropdowns) → xl (modals)

### 4.5 Icons

- 16px inline · 18px nav · 20px toolbar · 24px empty states
- Stroke 1.5px, rounded caps — Lucide-style consistency
- Status never icon-only without color dot or label

---

## 5. Application layout

### 5.1 Shell anatomy

```
┌──────────┬─────────────────────────────────────────────────────────┐
│          │ Topbar: breadcrumbs · workspace switcher · search · actions│
│  L1 Nav  ├─────────────────────────────────────────────────────────┤
│  248px   │ Optional L2 context nav (project/workspace)              │
│          ├──────────────────────────────┬──────────────────────────┤
│          │ Main content                 │ Inspector (optional)     │
│          │                              │ 360px                    │
├──────────┴──────────────────────────────┴──────────────────────────┤
│ Status bar: live pulse · env · UTC · platform health                 │
└──────────────────────────────────────────────────────────────────────┘
```

| Zone | Width | Behavior |
|------|-------|----------|
| L1 Company sidebar | 248px | Collapsible to icons-only (64px) on user preference |
| L2 Context nav | 220px | Visible on project/workspace/object scopes |
| Inspector | 360px | Collapsible; chat thread details, runtime context |
| Content max | 1440px | Centered on ultra-wide |

### 5.2 Layout modes

| Mode | When |
|------|------|
| **Company** | Dashboard, directory pages (employees, reports list) |
| **Project** | Workspace/project operational center (3-column) |
| **Object** | Employee, report, approval, knowledge detail |
| **Messenger** | Chats — channel list + thread + optional inspector |
| **Runtime** | Pipeline center + context inspector |
| **Document** | Reports — reading column + metadata rail |

---

## 6. Navigation (3 levels)

### Level 1 — Company

Primary sidebar. Maps to **existing routes** (design labels → current paths):

| L1 item | Design intent | Current route (unchanged) |
|---------|---------------|---------------------------|
| Dashboard | Command center | `/ops` |
| Projects | Operational centers | `/ops/workspaces` *(design label "Projects")* |
| Employees | Digital workforce | `/ops/employees` |
| Workspaces | Workspace registry | `/ops/workspaces` |
| Chats | Company messenger | `/ops/chats` |
| Knowledge | Company memory | `/ops/knowledge` |
| Reports | Executive outputs | `/ops/reports` |
| Timeline | Company activity | `/ops/timeline` |
| Approvals | Decision inbox | `/ops/approvals` |
| Runtime | Execution engine | `/ops/runtime` |
| Settings | Platform config | `/ops/runtime` *(until dedicated settings route)* |

**Note for implementers:** "Projects" in V2 design language = **Workspace** in current domain. Do not merge nav items in code without a dedicated route task.

Secondary routes remain reachable via search, links, and timeline (organization, audit, runs, tools, activity).

### Level 2 — Workspace / Project

When inside a workspace/project:

- Overview
- Tasks
- Runs
- Chats
- Knowledge
- Timeline
- Team
- Settings

Rendered as second rail or horizontal sub-nav under project header.

### Level 3 — Object

Tab bar under object header:

| Object | Tabs |
|--------|------|
| **Employee** | Overview · Conversation · Memory · Knowledge · Competencies · Assignments · Runtime · Reports · Run History · Activity · Relationships |
| **Workspace** | Overview · Tasks · Discussions · Knowledge · Documents · Assignments |
| **Task** | Detail · Activity · Related runs |
| **Run** | Pipeline · Context · Artifacts · Timeline |
| **Report** | Summary · Findings · Evidence · Related |
| **Knowledge** | Content · Links · History |
| **Conversation** | Messages · Pins · Participants · Promoted artifacts |
| **Approval** | Request · Policy · Actions · History |

---

## 7. Dashboard — Company Command Center

**Question answered:** *What is happening now?*

### 7.1 Layout (1440×900)

```
┌─ Live activity strip (auto-scroll, dismissible) ─────────────────────┐
├─ Page header: Executive Dashboard + workspace switcher + ⌘K ─────────┤
├─ Metric row (4–6 tiles) ─────────────────────────────────────────────┤
├─ Main grid 12 col ───────────────────────────────────────────────────┤
│ [Company Health 8col]     [Projects snapshot 4col]                     │
│ [Employees 4] [Runtime 4] [Approvals 4]                                │
│ [Timeline feed 6]         [Critical alerts 6]                          │
│ [Recent discussions 6]    [Recent reports 6]                           │
│ [Workspace overview 4]  [Delivery progress 4]  [Deadlines 4]         │
│ [Quick actions full width bar]                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Widgets

| Widget | Content | Data source (existing) |
|--------|---------|------------------------|
| Company Health | Orchestrator, memory, tools UP/DEGRADED | mock health |
| Projects | Active workspaces, status, lead | workspaces |
| Employees | Count online/busy, spotlight row | employees |
| Current Runtime | Active runs, waiting approval | runtime runs |
| Approvals | Pending count + top 3 | approvals |
| Reports | Recent published | reports |
| Timeline | Last 5 events (sentence form) | events |
| Critical Alerts | Severity ≥ warn | alerts + approvals |
| Recent Discussions | Active chats | chats |
| Recent Reports | Last artifacts | reports |
| Workspace Overview | Active workspace meta | active workspace |
| Delivery Progress | Tasks done/running/blocked | tasks |
| Upcoming Deadlines | SLA due list | tasks |
| Quick Actions | New chat, employee, task, flow | links only |

### 7.3 Live activity strip

Persistent top strip under topbar on dashboard only:

- Rotates every 8s through latest events
- Pauses on hover
- Click navigates to object
- Shows pulsing dot when runtime active

---

## 8. Projects (Workspace operational center)

Three-column layout — the **floor** where work happens.

```
┌ L2 ─┬─────────────── Center ───────────────┬── Inspector ──┐
│ Nav │ Tabs: Tasks | Runs | Chats | Progress│ Team          │
│     │ ┌─────────────────────────────────┐  │ Knowledge     │
│     │ │ Primary work surface            │  │ Recent activity│
│     │ │ (table / board / thread)        │  │ AI insights   │
│     │ └─────────────────────────────────┘  │ Risks         │
│     │ Milestones strip (horizontal)          │ Approvals     │
└─────┴──────────────────────────────────────┴───────────────┘
```

| Zone | Content |
|------|---------|
| Left L2 | Project sections |
| Center | Primary operational surface per tab |
| Milestones | Horizontal timeline chips |
| Right | Team roster, linked knowledge, AI insight cards (mock), risk flags, pending approvals |

---

## 9. Employee profile

Must read as a **real employee record**, not a bot config card.

### Header fields

Avatar · Name · Role · Status (live) · Department · Current project · Manager · Reputation · Availability · Last active

### Primary actions

Message · Assign task · Open runtime · Overflow (edit, duplicate, archive)

### Alive indicators

- Status dot with label (Online / Busy / In runtime / Idle / Offline)
- "Currently working on" line with link
- Last activity sentence in header meta
- Activity tab preview count badge

---

## 10. Chats — Messenger

Slack structure + Cursor AI blocks.

### Channel types (design)

Direct · Group · Workspace · Project · System

### Features

- @mentions with highlight
- Pinned messages bar
- Promote message → Task · Report · ADR · Knowledge
- Code/tool output in mono blocks
- Thread inspector: participants, pins, promoted artifacts

### Layout

```
┌ L1 ─┬ Channels 280px ─┬──── Thread ────┬ Inspector 320px ─┐
│     │ Sections        │ Header         │ Participants      │
│     │ Unread badges   │ Messages       │ Pins              │
│     │                 │ Composer       │ Promoted          │
└─────┴─────────────────┴────────────────┴───────────────────┘
```

---

## 11. Runtime — Execution monitoring

Vercel deployment meets Stripe clarity.

### Page sections

1. **Pipeline** — horizontal steps, current highlighted, durations
2. **Context** — knowledge loaded, memory scope, model selected
3. **Current step** — input/output preview
4. **Approvals gate** — if waiting
5. **Warnings** — amber expandable list
6. **Artifacts** — output cards
7. **Timeline** — step-level event mini-feed

States: pending · running · waiting_approval · completed · failed

---

## 12. Reports — Executive documents

Professional, board-ready layout.

| Block | Purpose |
|-------|---------|
| Header | Title, type badge, author employee, date, status |
| Summary | Executive abstract — callout surface |
| Findings | Numbered, severity tagged |
| Risks | Warning cards |
| Recommendations | Action list |
| Evidence | Collapsible proofs, links, logs |
| Related | Runs + employees entity row |

Reading width: **680–800px**; metadata rail optional on xl screens.

---

## 13. Timeline — Living company activity

Grouped by day (sticky headers). Filters:

- Employee · Workspace · Project · Severity · Event type

Event card = **sentence**, not raw JSON:

> QA published **Report** · *Weekly Quality* · 14:32

Keyboard: `j/k` navigate, `Enter` open source object.

Live: new events slide in from top with subtle highlight fade (180ms).

---

## 14. Responsive behavior

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Desktop XL | ≥1440 | Full shell + inspector |
| Desktop | 1024–1439 | Inspector collapsible |
| Tablet | 768–1023 | L1 drawer overlay; L2 sheet |
| Mobile | <768 | Bottom nav (5 icons); pages stack; tables → cards |

Desktop-first: design all flows at 1440×900, then adapt.

---

## 15. Themes

### Dark (default)

Canvas `#09090b`, rich contrast, accent indigo-violet, subtle glow on live elements.

### Light

Canvas `#fafafa`, borders `#e4e4e7`, accent `#4f46e5`, no glow — use border emphasis instead.

**Parity rule:** every component documented in [`components.md`](./design-system-v2/components.md) requires both modes before Figma sign-off.

---

## 16. Interaction states

| State | Visual |
|-------|--------|
| Default | Base surface |
| Hover | surface.hover + border.strong |
| Active/Pressed | surface.active, scale 0.99 on buttons |
| Focus | 2px focus ring, offset 2px |
| Selected | accent muted bg + accent border |
| Disabled | 50% opacity, no pointer |
| Loading | skeleton or inline spinner |
| Error | danger border + message below |

---

## 17. Accessibility (WCAG AA)

- Body text contrast ≥ 4.5:1 both themes
- Focus always visible — never `outline: none` without replacement
- Full keyboard path: nav, tables, dialogs, command palette
- Screen reader: landmarks (`nav`, `main`, `complementary`), live regions on timeline
- `prefers-reduced-motion`: disable pulse, shimmer, strip rotation

---

## 18. Deliverables index

| Artifact | Path |
|----------|------|
| **This spec** | `docs/ai-company/AI-COMPANY-032-design-system-v2.md` |
| **Design tokens** | `docs/ai-company/design-system-v2/tokens.json` |
| **Component catalog** | `docs/ai-company/design-system-v2/components.md` |
| **Figma library blueprint** | `docs/ai-company/design-system-v2/figma-library.md` |

### Figma library (to be built from blueprint)

- Foundations: variables, text styles, effects
- Components: full UI kit per catalog
- Layouts: shell frames
- Screens: Dark + Light reference frames
- Prototypes: 5 flows documented in figma-library.md

---

## 19. Implementation boundary

This task **does not** include:

- React/CSS changes
- Route changes
- Domain or storage changes
- Runtime behavior changes

Future implementation tasks should reference this spec and `tokens.json` incrementally (shell → dashboard → object pages).

---

## 20. Success criteria

After future implementation against this spec, a stakeholder opening AI Company should:

1. Feel they entered a **company**, not a tool list
2. See **live work** within 3 seconds on dashboard
3. Navigate any object in ≤2 clicks from L1
4. Read reports and timeline with **executive clarity**
5. Experience **dark and light** with equal polish
6. Recognize **one visual language** across all surfaces

---

## Related

- [V1 Platform Shell (implemented)](../apps/ai-company/src/layout/PlatformShell.tsx) — baseline to evolve
- [Mission Control design (legacy)](./mission-control.md)
- [Product contour](./AI-COMPANY-006-design-system.md)
- [Roadmap](./AI-COMPANY-001-roadmap.md)
