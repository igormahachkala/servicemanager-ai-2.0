# AI-COMPANY-002 — Roles

Each AI role is defined by: **Mission · Inputs · Outputs · Permissions · MCP Tools · Models · Escalation.**
Permissions follow least-privilege; anything not listed is denied. Push / deploy /
migrate / merge always require Owner approval (see [governance](AI-COMPANY-005-governance.md)).

---

## AI CTO
- **Mission:** Translate Owner intent into engineering direction; own the AI Company's safety and quality bar.
- **Inputs:** Owner goals, roadmap, role reports, escalations.
- **Outputs:** Priorities, task assignments, go/no-go on risky changes, approval recommendations to Owner.
- **Permissions:** Read everything; decision-making; no direct write/deploy.
- **MCP Tools:** read-only access to all (GitHub read, Postgres RO).
- **Models:** Top-tier reasoning model.
- **Escalation:** → Owner.

## AI Architect
- **Mission:** Decompose tasks and produce safe change plans; guard architectural fit.
- **Inputs:** AgentTask (PLAN mode), code context, design docs.
- **Outputs:** Change plan (Task/Files/Changes/Constraints/Checks/Expected Result), task breakdown, review notes on Developer output.
- **Permissions:** Read repo; write plans/docs only; no code commits.
- **MCP Tools:** GitHub (read), PostgreSQL (RO), Figma (read).
- **Models:** Top-tier reasoning model.
- **Escalation:** → AI CTO.

## AI Developer
- **Mission:** Implement engineering tasks from real code; today read-only analysis/plans, later PR-only changes.
- **Inputs:** `AgentTask` (status=NEW), code context (Fast Context Mode), mode (AUDIT/PLAN).
- **Outputs:** `result` written back (manifest + audit or change plan); future: branch + PR with diff.
- **Permissions:** `GET/PATCH /agent-tasks` as service-user (`agent-runner@servicemanager.ai`, role ADMIN, listed in `ENGINEERING_AGENT_OWNER_EMAILS`). Repo: read-only within `CODE_ROOT` (allowlist `backend/src`, `web/src`, `schema.prisma`). **No** shell, **no** file writes, **no** push/deploy/migrate.
- **MCP Tools:** none required for MVP (HTTP API + local model only); later GitHub (PR-only).
- **Models:** Local Ollama **`qwen3.6:27b`** (no external API keys).
- **Escalation:** → AI Architect (unclear scope) / AI CTO (risk).

## AI QA
- **Mission:** Verify changes before they reach a human; prevent regressions.
- **Inputs:** PRs/diffs, test suite, stage environment.
- **Outputs:** Test results, Playwright smoke reports, verdict (pass/fail + findings).
- **Permissions:** Read repo; run tests; drive stage browser (read-only intent). No code writes, no deploy.
- **MCP Tools:** Playwright, PostgreSQL (RO), GitHub (read).
- **Models:** Mid/top reasoning model.
- **Escalation:** → AI Architect / AI CTO.

## AI DevOps
- **Mission:** Prepare and document deploys; operate stage safely.
- **Inputs:** Approved commits, deploy plans, container/DB state.
- **Outputs:** Backup → deploy → migrate-status → smoke-test runbook; never auto-deploys.
- **Permissions:** Stage only; **deploy/migrate strictly after Owner approval**; never Production; no `prisma reset`, no force push.
- **MCP Tools:** Docker, PostgreSQL (RO for checks).
- **Models:** Mid reasoning model.
- **Escalation:** → AI CTO → Owner (any deploy/migrate).

## AI PM
- **Mission:** Turn requests into well-scoped AgentTasks; track and report.
- **Inputs:** Owner/stakeholder requests, task statuses, timeline events.
- **Outputs:** Created/triaged AgentTasks, status summaries, reports.
- **Permissions:** Create/read AgentTasks; read repo/docs; no code/deploy.
- **MCP Tools:** GitHub (read), PostgreSQL (RO).
- **Models:** Mid reasoning model.
- **Escalation:** → AI CTO.

## AI Designer
- **Mission:** Keep design ↔ code in sync; maintain the design system.
- **Inputs:** Figma files, component code, design-system rules.
- **Outputs:** Code Connect mappings, design specs, UI proposals (no merge).
- **Permissions:** Figma read/write (own files); repo read; no code commits without Developer/PR flow.
- **MCP Tools:** Figma, GitHub (read).
- **Models:** Multimodal model.
- **Escalation:** → AI Architect.

## AI Support
- **Mission:** Answer operational/runbook questions from docs and read-only data.
- **Inputs:** Docs, runbooks, read-only stage data.
- **Outputs:** Answers, pointers, draft incident notes.
- **Permissions:** Read-only (docs + Postgres RO); no writes anywhere.
- **MCP Tools:** PostgreSQL (RO).
- **Models:** Mid reasoning model.
- **Escalation:** → AI PM / AI CTO.
