# Production Readiness

> **Status:** Release governance · **Gate:** First paying / pilot customer  
> **Parent:** [beta-readiness-checklist.md](./beta-readiness-checklist.md) · **Task:** AI-COMPANY-062  
> **Prerequisite:** Beta **Go** recorded in [platform-review-log.md](../reviews/platform-review-log.md)

---

## Purpose

Production means: **a customer company operates daily with accountability** — data durability, security baseline, support path, and rollback plan.

This checklist extends Beta. Items marked **Beta** must already be ☑ before Production review.

---

## Gate process

1. Beta checklist ☑ (or waived items documented).  
2. Complete Production checklist below.  
3. L3 Architecture Review + security / ops review.  
4. Log in [platform-review-log.md](../reviews/platform-review-log.md).  
5. Owner **Go / No Go** for first customer.  

---

## Platform & architecture

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| A1 | Backend persistence replaces localStorage for customer data | ☐ | Migration plan per entity |
| A2 | Multi-tenant `companyId` enforced server-side | ☐ | N/A local V1 |
| A3 | Authentication & session management for Owner | ☐ | |
| A4 | ADRs updated for production topology | ☐ | |
| A5 | Runtime provider relay (no browser CORS to raw Ollama) | ☐ | See TD-001 |
| A6 | Secrets not in frontend bundle or localStorage | ☐ | API keys server-side |
| A7 | Rate limits and cost caps on Runtime / tools | ☐ | Cost policy enforcement |

---

## Security & compliance

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| S1 | Permission model enforced server-side | ☐ | Policy layer |
| S2 | Audit trail immutable and exportable | ☐ | Events + audit page |
| S3 | Approval gates cannot be bypassed via API | ☐ | Human First |
| S4 | Tool execution sandbox and allowlist | ☐ | Tool registry |
| S5 | Data retention and deletion policy documented | ☐ | GDPR-ready path |
| S6 | Incident response runbook | ☐ | |

---

## Reliability & operations

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| O1 | Uptime target defined (e.g. 99.5% MVP) | ☐ | |
| O2 | Health checks for Runtime providers | ☑ | Health monitor V1 |
| O3 | Automated backups for customer company data | ☐ | |
| O4 | Restore procedure tested | ☐ | |
| O5 | Monitoring & alerting (errors, failed runs, SLA) | ☐ | |
| O6 | Rollback procedure for releases | ☐ | |
| O7 | Support channel for customer Owner | ☐ | |

---

## Product surfaces (Production bar)

All Beta areas at ☑, plus:

| Area | Production bar |
|------|----------------|
| **Runtime** | SLA on execute; streaming or progress for long runs |
| **Canvas** | Real-time or near-real-time updates |
| **Execution** | Queue persistence across refresh |
| **Sprint / Projects** | Multi-user visibility (future) |
| **Notifications** | Delivery guarantee (in-app + optional email) |
| **Knowledge** | Search performance at scale |
| **Handoffs** | Real external integration or explicit “manual export” |
| **Presence** | Accurate work state |
| **Reports** | Export PDF / share link |
| **i18n** | Full RU parity on customer-facing strings |

---

## QA & release

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| Q1 | Automated test suite (unit + critical E2E) | ☐ | Playwright when approved |
| Q2 | Staging environment mirrors production | ☐ | |
| Q3 | Release notes for every customer-visible version | ☐ | |
| Q4 | Feature flags for risky launches | ☐ | |
| Q5 | [technical-debt.md](../architecture/technical-debt.md) — no open P0 | ☐ | |

---

## Documentation & onboarding

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| D1 | Owner onboarding guide (first company setup) | ☐ | |
| D2 | Employee template hire flow documented | ☐ | |
| D3 | Runtime setup guide (Ollama / cloud providers) | ☐ | |
| D4 | Support FAQ and known limitations | ☐ | |
| D5 | Legal: terms, privacy, data processing | ☐ | Business |

---

## Customer success

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| CS1 | Pilot customer success criteria defined | ☐ | |
| CS2 | Feedback loop into [platform-review-log.md](../reviews/platform-review-log.md) | ☐ | |
| CS3 | Escalation path Owner → platform team | ☐ | |

---

## Production sign-off

| Role | Name | Date | Go / No Go |
|------|------|------|------------|
| Owner | | | |
| Engineering lead | | | |
| Security / ops (if applicable) | | | |

**Pilot customer ID / name (if Go):**

**Launch date:**

**Rollback owner:**

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Production readiness checklist (AI-COMPANY-062) |
