# AI-COMPANY-006 — Design System

## Principle: AI Company is a separate product contour

AI Company (the org of digital roles) is a **distinct product contour**, not a
feature of the ServiceManager.AI service product. It has its own surface, its
own access model, and its own lifecycle, even though it lives in the same
repository and operates the same codebase.

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  ServiceManager.AI (service)  │     │  AI Company (engineering org) │
│  - tickets, inspections,      │     │  - IT Company UI (/it)        │
│    analytics, mobile, ...     │     │  - AI Developer (agent-runner)│
│  - tenant roles (ADMIN,       │     │  - AgentTask API (owner-only) │
│    DISPATCHER, TECHNICIAN...)  │     │  - PLATFORM_ADMIN / Owner only │
└──────────────────────────────┘     └──────────────────────────────┘
           product users                      operators of the product
```

### What this means
- **Separate access plane.** The AI Company surface is **PLATFORM_ADMIN / Owner-only**, gated independently (`canViewITCompany`, `EngineeringAgentGuard`, `ENGINEERING_AGENT_OWNER_EMAILS`). It is invisible to ordinary tenant roles.
- **Separate module boundary.** Frontend lives in its own module `web/src/it-company/` (extracted in IT-003) with its own `access.ts`, `routes.ts`, `pages/`, `components/`. AI Developer runtime lives in its own package `agent-runner/`.
- **Separate lifecycle.** AI Company features ship behind owner-only gates and do not affect tenant-facing UX or permissions.
- **Shared substrate, isolated authority.** Same repo, same DB, same infra — but AI Company never gains tenant data authority beyond what governance grants, and never escalates the service product's permission model.

## Boundaries (fixed)
1. AI Company UI and APIs are **never** exposed to tenant roles (CLIENT/TECHNICIAN/DISPATCHER/etc.).
2. AI Company modules (`web/src/it-company/`, `agent-runner/`) stay self-contained; service code must not import from them.
3. AI Company changes follow AI Company governance (owner-gated push/deploy/merge), not the tenant feature flow.
4. Visual/UX identity may diverge from the tenant product; the contour is labeled "IT Company" in the UI for PLATFORM_ADMIN.

## Naming & ownership
- **Product contour:** "AI Company" (internal), surfaced as **IT Company** in the UI.
- **Owner:** human Owner (`servicemanager.ai@gmail.com`) — sole authority for irreversible actions.
- **Docs home:** `docs/ai-company/` (this package).

See: [roadmap](AI-COMPANY-001-roadmap.md) · [roles](AI-COMPANY-002-roles.md) · [org chart](AI-COMPANY-003-org-chart.md) · [infrastructure](AI-COMPANY-004-infrastructure.md) · [governance](AI-COMPANY-005-governance.md)
