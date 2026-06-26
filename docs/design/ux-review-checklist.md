# UX Review Checklist

> **Status:** Governance · Required before merge of user-facing changes  
> **Task:** AI-COMPANY-063  
> **Parent:** [Design Manifesto](./design-manifesto.md) · [Visual Language](./visual-language.md)

Use this checklist for **every** screen, panel, modal, or flow in `apps/ai-company/**`. A feature is not **done** until all applicable items pass or are registered as [UX debt](./ux-debt.md).

**Reviewer:** implementing agent self-check + Owner spot-check on primary flows.

---

## How to use

1. Open the target route in Mission Control (`/ops/...`).  
2. Walk the **Owner primary journey** (not developer debug path).  
3. Mark each row: ✅ Pass · ⚠️ Debt (link UX-DEBT id) · N/A · ❌ Blocker  
4. **Blockers** must be fixed before release.

---

## 1. Click economy

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 1.1 | Primary action reachable in ≤ 3 clicks from `/ops` | Owner reaches goal without hunting SideNav |
| 1.2 | No duplicate paths to same outcome | One canonical route per capability |
| 1.3 | Back / escape always obvious | Owner never feels trapped in a panel |
| 1.4 | Deep links work | URL reflects entity (`/ops/employees/:id`, etc.) |
| 1.5 | Quick Launch / cross-links on command surfaces | Command Center, Control Room link related engines |

---

## 2. Readability & hierarchy

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 2.1 | Page title states **what** and **why** | PageHeader title + description |
| 2.2 | One visual focal point per panel | No competing hero metrics |
| 2.3 | Labels use product language (Employee, Run, Report) | Not internal code names in UI |
| 2.4 | Monospace only for IDs, timestamps, code | `acMono` / token mono for data |
| 2.5 | Line length comfortable on 1280px | No full-width prose blocks |

---

## 3. Errors & recovery

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 3.1 | Errors explain **what failed** and **what to do** | Not raw stack traces |
| 3.2 | Destructive actions confirm | Cancel path visible |
| 3.3 | Permission denial is explicit | No silent empty screens |
| 3.4 | Form validation inline | Field-level messages |
| 3.5 | Failed runs / executions show retry or link to detail | Execution Queue pattern |

---

## 4. Loading & progress

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 4.1 | Loading state within 100ms of action | Skeleton, spinner, or disabled button |
| 4.2 | Long operations show progress | Pipeline steps, timeline, percent |
| 4.3 | Live surfaces indicate freshness | Presence, Runtime live badge |
| 4.4 | No layout shift on load | Reserve space for async content |
| 4.5 | Mock engines label themselves | “localStorage only” where applicable |

---

## 5. Empty states

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 5.1 | Every list has empty copy | What it is + how to populate |
| 5.2 | Empty suggests **next action** | Link or primary button |
| 5.3 | Empty distinct from error | Different tone and icon |
| 5.4 | Zero employees / zero runs still orient Owner | Link to hire or start run |

---

## 6. Consistency

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 6.1 | Uses design tokens / shared components | Card, Panel, Badge, PageHeader |
| 6.2 | Same entity same badge colors | Status semantics match Visual Language |
| 6.3 | SideNav label matches page title | i18n `pages.*` |
| 6.4 | Primary / secondary buttons match system | `mcBtnPrimary`, `acQuickActionBtn` |
| 6.5 | Spacing on 4px grid | See tokens `space.*` |

---

## 7. Accessibility (V1 bar)

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 7.1 | Interactive elements keyboard reachable | Tab order logical |
| 7.2 | Icon-only controls have `aria-label` | SideNav, icon buttons |
| 7.3 | Color not sole status indicator | Text + badge + dot |
| 7.4 | Focus visible | Ring token `focus.ring` |
| 7.5 | Motion respects reduced-motion where added | No infinite distraction loops |

---

## 8. Speed of understanding (5-second test)

Owner opening the screen cold must answer within **5 seconds**:

| Question | This screen must help answer |
|----------|------------------------------|
| Where am I? | Nav + title |
| What is happening? | Primary panel content |
| What needs me? | Approvals, alerts, blocked items |
| What can I do next? | Primary action visible |

**Fail** if Owner says: “Is this Jira? Is this settings? Is this chat?”

---

## Sign-off template

```markdown
## UX Review — [feature / route]
**Date:** YYYY-MM-DD  
**Reviewer:** [name]

| Section | Result | Notes |
|---------|--------|-------|
| Click economy | ✅ / ⚠️ / ❌ | |
| Readability | | |
| Errors | | |
| Loading | | |
| Empty states | | |
| Consistency | | |
| Accessibility | | |
| 5-second test | | |

**Verdict:** Ship / Ship with debt / Block  
**UX debt IDs:** UX-DEBT-…
```

---

## Related

- [UX Debt Registry](./ux-debt.md)  
- [Visual Language](./visual-language.md)  
- [Product Review Board](../product/product-review-board.md)

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial checklist (AI-COMPANY-063) |
