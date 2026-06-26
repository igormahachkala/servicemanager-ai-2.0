# UX Debt Registry

> **Status:** Governance · Living document  
> **Task:** AI-COMPANY-063  
> **Parent:** [UX Review Checklist](./ux-review-checklist.md) · [Visual Language](./visual-language.md)

**UX debt** is intentional or accumulated gap between our [Design Manifesto](./design-manifesto.md) and what ships. Every ⚠️ from UX review **must** have a registry ID here before merge.

**Owner** prioritizes paydown each roadmap phase. Agents **must not** add debt without registering it.

---

## Severity

| Level | Meaning | SLA |
|-------|---------|-----|
| **S1 Critical** | Blocks Owner understanding or causes wrong decisions | Current phase |
| **S2 Major** | Violates visual language or consistency at scale | Next phase |
| **S3 Minor** | Polish, edge case, secondary flow | Backlog |
| **S4 Accepted** | Known mock limitation until real engine | Documented exit criteria |

---

## Registry

| ID | Severity | Area | Description | Exit criteria | Status |
|----|----------|------|-------------|---------------|--------|
| UX-DEBT-001 | S2 | Navigation | SideNav item count high; no grouped IA | Command palette or grouped nav V2 | Open |
| UX-DEBT-002 | S2 | Visual | Legacy `ac*` and `mc*` class coexistence | Single prefix migration or documented dual-layer | Open |
| UX-DEBT-003 | S2 | i18n | Partial RU parity (659 identical keys noted in build-ru) | Full RU product copy pass | Open |
| UX-DEBT-004 | S3 | SideNav | Emoji icons inconsistent with visual language | Icon set from design system | Open |
| UX-DEBT-005 | S2 | Empty states | Not all secondary lists have next-action links | UX checklist 5.x pass all routes | Open |
| UX-DEBT-006 | S4 | Mock | localStorage engines labeled inconsistently | Standard footnote component | Open |
| UX-DEBT-007 | S2 | Mobile | Mission Control optimized for desktop ≥1280px | Responsive breakpoints per layout archetype | Open |
| UX-DEBT-008 | S3 | Accessibility | Focus ring not uniform on custom buttons | Token `focus.ring` on all interactives | Open |
| UX-DEBT-009 | S2 | Onboarding | No first-run Owner orientation on `/ops` | Command Center guided brief or tour | Open |
| UX-DEBT-010 | S3 | Visual Lab | Mock playback only; not linked to live Execution | Bind to active execution session | Open |
| UX-DEBT-011 | S2 | Runtime | Live Runtime Monitor WIP not in SideNav | Route + PRB when ready | Open |
| UX-DEBT-012 | S3 | Charts | Command Center charts are bar mock, not time-series | Analytics engine integration | Open |

---

## How to add an entry

```markdown
| UX-DEBT-0XX | S? | [Area] | [What is wrong] | [How we close it] | Open |
```

1. Assign next ID  
2. Link from PR / UX review sign-off  
3. If S1 → notify Owner before merge  

---

## How to close an entry

1. Verify exit criteria met  
2. UX checklist re-run on affected routes  
3. Set status **Closed YYYY-MM-DD** (keep row for history)  

---

## Paydown priorities (2026 H2)

1. S1 items (none open — keep at zero)  
2. UX-DEBT-002, UX-DEBT-005, UX-DEBT-009 — consistency & Owner orientation  
3. UX-DEBT-001 — navigation IA before marketplace phase  

---

## Metrics

Track quarterly:

| Metric | Target |
|--------|--------|
| Open S1 count | 0 |
| Open S2 count | Trend down |
| UX checklist blocker rate on primary flows | < 5% |
| New debt items per release | ≤ 2 |

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Initial registry (AI-COMPANY-063) |
