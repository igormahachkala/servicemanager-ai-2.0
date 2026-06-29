# AI-COMPANY-001 — Roadmap

> Status: foundation. AI Company is the internal "engineering org" of digital
> roles that build and operate ServiceManager.AI under human ownership.
> Today only **AI Developer** exists in code (`agent-runner`); the rest are
> planned roles described here so the org grows along a single, governed path.

## Roles & phasing

| Role | Phase | Today | Target |
|------|-------|-------|--------|
| **AI Developer** | Live (read-only) | `agent-runner` picks up `AgentTask` NEW → code-aware AUDIT/PLAN via local Ollama/Qwen → writes result | V2: open PRs (PR-only, no merge) |
| **AI QA** | Next | — | Run/extend tests, Playwright smoke, verify PRs before they reach a human |
| **AI Architect** | Next | — | Decompose tasks, design change plans, review AI Developer output for fit |
| **AI DevOps** | Later | manual (human runs stage deploy) | Prepare deploy plans, run smoke tests, never deploy without approval |
| **AI PM** | Later | — | Triage requests → AgentTasks, track status, prepare reports |
| **AI Designer** | Later | — | Figma ↔ code via Figma MCP, design-system upkeep |
| **AI Support** | Later | — | Answer ops/runbook questions from docs + read-only data |

## Phase plan

- **Phase 0 (done):** AI Developer MVP — owner-only `AgentTask` API, `EngineeringAgentGuard`, `agent-runner` (read-only, local model, no external API keys).
- **Phase 1 (done):** Code-aware context — project index, module profiles, file-summary cache, Fast Context Mode; AUDIT/PLAN mode detection.
- **Phase 2 (in progress):** Patch Preview — AI Developer proposes diffs (no apply), human reviews.
- **Phase 3:** AI QA + AI Architect — verification and planning loop around AI Developer.
- **Phase 4:** AI DevOps deploy plans; AI PM intake/reporting.
- **Phase 5:** AI Designer (Figma MCP) + AI Support.

## Invariants across all phases
- Human Owner approves every push, deploy, migration, and merge.
- No role touches Production without explicit, separate approval.
- AI roles are least-privilege; capabilities expand only with a documented role + governance entry.

See: [roles](AI-COMPANY-002-roles.md) · [org chart](AI-COMPANY-003-org-chart.md) · [infrastructure](AI-COMPANY-004-infrastructure.md) · [governance](AI-COMPANY-005-governance.md) · [design system](AI-COMPANY-006-design-system.md)
