# AI-COMPANY-106A — Prerequisites checklist

> **Date (UTC):** 2026-07-13  
> **Status:** partial — repository branch fixed; composer start still blocked

## Repository prerequisites

| Check | Result | Evidence |
|-------|--------|----------|
| Repository exists on GitHub | **Yes** — `igormahachkala/servicemanager-ai-2.0` | `git push` succeeded |
| Test branch on remote | **Yes** — `test/cursor-automation-webhook-contract` | pushed 2026-07-13 |
| Local branch tracks remote | **Yes** | `git branch -vv` |
| `tmp/` scaffold present on branch | **Yes** | `tmp/README.md`, `.gitkeep` |
| Smoke result file after run | **No** — not created after 6 min poll | 36 polls × 10s |

## Webhook key rotation

| Check | Result |
|-------|--------|
| Old key (`crsr_f8db…`) | **Retired** — not used in 106A |
| New key | Stored only in `.ai-company/cursor-automation-webhook.env` (gitignored) |
| New key in git/docs/evidence | **No** |

## Cursor workspace (requires Dashboard verification — not auto-probed)

| Check | Agent-observable | User action needed |
|-------|------------------|-------------------|
| GitHub connection for Cloud Agents | **Unknown** | Dashboard → Integrations → Cursor GitHub app on org/repo |
| Cloud Agents read/write repo | **Unknown** | Authorize `igormahachkala/servicemanager-ai-2.0` |
| Automation repo + branch binding | **Unknown** | Automations UI → repo `igormahachkala/servicemanager-ai-2.0`, branch `test/cursor-automation-webhook-contract` |
| Privacy Mode (not Legacy) | **Unknown** | Dashboard → Cloud Agents |
| Billing / credits | **Unknown** | Usage dashboard |
| Background agents enabled | **Blocked** | Error: `[unauthenticated] Error` on composer start |
| Webhook key scope | **Valid for HTTP** — 401 only without/wrong key | Composer auth separate failure |

## Likely root cause (hypothesis — not confirmed by Cursor logs)

`Failed to start background composer: [unauthenticated] Error` after valid webhook Bearer suggests **Cloud Agent / GitHub OAuth or GitHub App installation** is not authenticated for the identity running the automation — not webhook key invalidity.

## Actions completed in 106A

1. Regenerated webhook key (user) → local env updated.
2. Pushed test branch to `origin`.
3. Re-opened Automations editor with 106A instruction draft.
4. Green POST executed — still HTTP 400 composer error.
5. Polled remote branch 6 minutes — no commit.

## Remaining blockers before green run

1. Fix Cloud Agent GitHub integration auth in Cursor Dashboard.
2. Confirm automation binds correct repo + remote branch (not local-only branch name).
3. Re-run green POST after Dashboard fix.
