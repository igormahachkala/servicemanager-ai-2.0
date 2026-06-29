# AI-COMPANY-005 — Governance

Defines **who may do what**. The default for any AI role is read-only; every
outward or irreversible action is gated by the human Owner.

## Capability matrix

| Capability | AI Developer | AI QA | AI Architect | AI DevOps | AI PM | AI Designer | Owner |
|------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Read code | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Write code (working tree / branch) | ✅* | — | — | — | — | PR-only | ✅ |
| Open PR | V2 only | — | — | — | — | ✅ | ✅ |
| Merge PR | — | — | — | — | — | — | ✅ |
| `git push` | — | — | — | — | — | — | ✅ (approval) |
| Deploy (stage) | — | — | — | prepares; runs **after approval** | — | — | ✅ |
| Deploy (Production) | — | — | — | — | — | — | ✅ only |
| DB read (stage, RO) | — | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| DB write / migrate | — | — | — | proposes; **after approval** | — | — | ✅ |
| `prisma reset` / destructive | — | — | — | — | — | — | ✅ only (manual) |

\* AI Developer write is **read-only today** (analysis/plans). Code writes arrive
in V2 as **PR-only** (branch + PR, never direct push/merge).

## Who may…

### …write code
- **AI Developer** — produces diffs/PRs (V2); today only proposes plans. AI Designer may propose UI changes via PR.
- Nobody commits to the default branch directly except via the Owner-approved flow.

### …open a PR
- AI Developer (V2) and AI Designer, on dedicated branches (`agent/<taskId>`). **Merging is Owner-only.**

### …deploy
- **AI DevOps prepares** the deploy (backup → build → migrate-status → smoke test) but **executes only after a separate Owner approval**, and **only on Stage**. **Production is Owner-only.**

### …work with the database
- **Read:** any role via the **read-only** PostgreSQL MCP against **stage** (`STAGE_RO_DATABASE_URL`).
- **Write / migrate:** proposed by AI DevOps, **applied only after Owner approval**; `migrate deploy` only when `prisma migrate status` requires it; **never** `prisma reset`; Production DB never wired to AI.

## Hard rules (apply to all AI roles)
1. No push, deploy, migrate, or merge without explicit Owner approval.
2. Never touch Production.
3. No force push; no history rewrite on shared branches.
4. Never deploy uncommitted changes; build deploys from clean checkouts.
5. No secrets in code, logs, results, or model context (redaction enforced).
6. Stop-and-report when scope is unclear, the working tree is dirty beyond the task, or an action is irreversible.

## Identity & gating
- Owner: `servicemanager.ai@gmail.com`.
- AI Developer service-user: `agent-runner@servicemanager.ai` (role ADMIN), authorized only because its email is in `ENGINEERING_AGENT_OWNER_EMAILS`; gated by `EngineeringAgentGuard` on the backend.
- IT Company UI is **PLATFORM_ADMIN-only** (`canViewITCompany`), independent of the Engineering-Agent owner flag.
