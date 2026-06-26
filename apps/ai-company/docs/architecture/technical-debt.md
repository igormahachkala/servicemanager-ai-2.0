# Technical Debt Register

> **Status:** Engineering governance · **Living register**  
> **Parent:** [architecture-review-process.md](../reviews/architecture-review-process.md) · **Task:** AI-COMPANY-062

---

## Purpose

Single **registry of technical and UX debt** for AI Company.

Debt is created openly — not hidden in code comments. Every Architecture Review updates this file.

**UX debt** items use prefix `UX-`. Technical items use prefix `TD-`.

---

## Field definitions

| Field | Description |
|-------|-------------|
| **ID** | TD-NNN or UX-NNN |
| **Description** | What is wrong or missing |
| **Cause** | Why debt was accepted |
| **Impact** | What breaks or degrades if unfixed |
| **Fix cost** | S / M / L / XL (effort estimate) |
| **Priority** | P0 blocker · P1 high · P2 medium · P3 low |
| **Status** | Open · In progress · Closed · Waiver |

---

## Summary

| Priority | Open | In progress | Closed |
|----------|------|-------------|--------|
| P0 | 0 | 0 | 0 |
| P1 | 3 | 0 | 1 |
| P2 | 5 | 0 | 0 |
| P3 | 2 | 0 | 0 |

*Update counts when status changes.*

---

## Register

### TD-001 — Browser CORS to remote Ollama

| Field | Value |
|-------|-------|
| **Description** | Frontend calls Ollama directly; browser CORS blocks remote hosts in production |
| **Cause** | V1 local-first adapter without backend relay |
| **Impact** | Real execution fails for Owners not on same network as Ollama |
| **Fix cost** | M — Vite dev proxy + production API relay |
| **Priority** | P1 |
| **Status** | Open |

---

### TD-002 — localStorage as sole persistence

| Field | Value |
|-------|-------|
| **Description** | All company state in browser localStorage; no sync, backup, or multi-device |
| **Cause** | V1 scope — no backend |
| **Impact** | Data loss on clear storage; no Production multi-user |
| **Fix cost** | XL — backend + migration per entity |
| **Priority** | P1 |
| **Status** | Open |

---

### TD-003 — Ollama streaming not implemented

| Field | Value |
|-------|-------|
| **Description** | `stream: false` only; no token-by-token UI |
| **Cause** | V1 execute path prioritized completion over streaming |
| **Impact** | Long runs feel frozen; poor Live Monitor experience |
| **Fix cost** | M |
| **Priority** | P2 |
| **Status** | Open |

---

### TD-004 — Bundle size / code splitting

| Field | Value |
|-------|-------|
| **Description** | Single large JS chunk; Vite warns >500kb |
| **Cause** | Rapid feature growth in one entry |
| **Impact** | Slow first load on weak networks |
| **Fix cost** | M — route-based lazy load |
| **Priority** | P2 |
| **Status** | Open |

---

### TD-005 — Manual “every 10 tasks” AR trigger

| Field | Value |
|-------|-------|
| **Description** | No tooling counts completed tasks for Architecture Review cadence |
| **Cause** | Governance pack V1 is docs-only |
| **Impact** | AR may be skipped accidentally |
| **Fix cost** | S — backlog label or CI counter |
| **Priority** | P3 |
| **Status** | Open |

---

### TD-006 — Execute timeout partial log (closed)

| Field | Value |
|-------|-------|
| **Description** | Failed runs could exit without partial logs |
| **Cause** | Sync error path before 054 |
| **Impact** | Owner blind on failure |
| **Fix cost** | S |
| **Priority** | P1 |
| **Status** | **Closed** (AI-COMPANY-054) |

---

### UX-001 — RU locale parity gaps

| Field | Value |
|-------|-------|
| **Description** | Some Mission Control strings remain English in `ru.ts` |
| **Cause** | Incremental i18n during fast delivery |
| **Impact** | RU Owners see mixed language |
| **Fix cost** | M — i18n audit pass |
| **Priority** | P2 |
| **Status** | Open |

---

### UX-002 — Canvas / Mission Control visual unification

| Field | Value |
|-------|-------|
| **Description** | Design System V2 not applied uniformly across all pages |
| **Cause** | Canvas V2 and MC evolved in parallel |
| **Impact** | Product feels less cohesive |
| **Fix cost** | L |
| **Priority** | P2 |
| **Status** | Open |

---

### UX-003 — Empty states on secondary routes

| Field | Value |
|-------|-------|
| **Description** | Some list pages lack “what to do next” empty copy |
| **Cause** | Feature-first delivery |
| **Impact** | Owner confusion on first use |
| **Fix cost** | S |
| **Priority** | P3 |
| **Status** | Open |

---

## Adding debt (template)

```markdown
### TD-NNN — [Short title]

| Field | Value |
|-------|-------|
| **Description** | |
| **Cause** | |
| **Impact** | |
| **Fix cost** | S / M / L / XL |
| **Priority** | P0–P3 |
| **Status** | Open |
```

Log creation in next [platform-review-log.md](../reviews/platform-review-log.md) entry.

---

## Closing debt

1. Fix merged with reference `Closes TD-NNN` in commit.  
2. Update **Status** → Closed with date.  
3. Mention in AR log under “Technical debt closed”.  

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Technical debt register (AI-COMPANY-062) |
