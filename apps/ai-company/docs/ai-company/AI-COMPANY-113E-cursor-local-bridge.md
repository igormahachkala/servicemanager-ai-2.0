# AI-COMPANY-113E — Cursor Local Bridge Service V1

**Date:** 2026-07-10  
**Branch:** `ai-company-flow`  
**Scope:** Local Node.js bridge between AI Company (browser SPA) and installed Cursor on macOS.

---

## Why a separate bridge?

Browser SPA **cannot** spawn Cursor CLI. Cursor Local Bridge is a **same-machine Node process** that:

1. Writes task packages to disk (inbox)
2. Optionally opens `task.md` / workspace via bundled `cursor` binary
3. Watches outbox for `result.json`
4. Exposes **localhost-only** API for AI Company sync

**Not used:** Cursor Cloud API, public HTTP, LAN ports, hardcoded IP, fake autonomous execution.

---

## Quick start

From repository root:

```bash
npm --prefix apps/ai-company install
npm --prefix apps/ai-company run cursor:bridge
```

Status (no daemon):

```bash
npm --prefix apps/ai-company run cursor:bridge:status
```

Default listen address: `http://127.0.0.1:17319`  
Override: `AI_COMPANY_CURSOR_BRIDGE_PORT`, `AI_COMPANY_CURSOR_BRIDGE_HOST`, `AI_COMPANY_REPO_ROOT`, `CURSOR_CLI_PATH`.

---

## Flow

```
ToolExecutionRun approved (Owner)
  → AI Company POST /v1/runs (localhost)
  → Bridge writes .ai-company/cursor-inbox/<runId>/
  → Bridge opens task.md (+ workspace if CLI found)
  → ToolExecutionRun → queued (via SPA sync)
  → Owner/Builder works in Cursor manually
  → result.json placed in .ai-company/cursor-outbox/<runId>/
  → Bridge ingests → ToolExecutionRun → result_received
```

---

## Inbox layout

`.ai-company/cursor-inbox/<runId>/`

| File | Purpose |
|------|---------|
| `task.md` | Instructions for Cursor session |
| `metadata.json` | runId, workItemId, fileScope, paths |
| `expected-result.md` | Observable outcome |
| `checks.md` | Validation checklist |
| `README.md` | What is / is not automated |

---

## Outbox schema

`.ai-company/cursor-outbox/<runId>/result.json`

```json
{
  "runId": "terun-…",
  "status": "completed",
  "summary": "…",
  "changedFiles": ["apps/ai-company/src/…"],
  "checks": ["npm --prefix apps/ai-company run build"],
  "commit": null,
  "pullRequest": null,
  "warnings": [],
  "errors": [],
  "completedAt": "2026-07-10T…"
}
```

Security sanitizer blocks tokens, passwords, `.env`, private keys, credential patterns, IPv4 URLs.

---

## Cursor CLI detection

Order:

1. `CURSOR_CLI_PATH` env
2. `/Applications/Cursor.app/Contents/Resources/app/bin/cursor`
3. `~/Applications/Cursor.app/.../cursor`
4. `which cursor`

V1 action: `cursor -g <inbox>/task.md:1` and open repository root.  
Returns real exit code — **does not** claim autonomous agent execution.

---

## Bridge states (filesystem)

Stored in `.ai-company/cursor-bridge/state.json`:

| Status | Meaning |
|--------|---------|
| `pending` | Accepted, not yet written |
| `queued` | Inbox written |
| `opened` | Cursor CLI open attempted successfully |
| `result_received` | Outbox ingested |
| `failed` | Error |

History example after open:

> Task package opened in Cursor; execution requires active Cursor session.

---

## Localhost API (127.0.0.1 only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/health` | Liveness |
| GET | `/v1/status` | Bridge + Cursor detection snapshot |
| GET | `/v1/runs` | All bridge runs |
| GET | `/v1/runs/:runId` | Single run (+ ingested result) |
| POST | `/v1/runs` | Enqueue approved run |
| POST | `/v1/pending/process` | Process `pending/*.json` files |

Manual QA without SPA: drop JSON into `.ai-company/cursor-bridge/pending/<runId>.json` and restart bridge or POST `/v1/pending/process`.

---

## AI Company integration

- `domain/cursorLocalBridge/` — browser client + sync
- `approveToolExecutionRun()` — auto-enqueues when bridge online
- Builder chat polls `syncCursorLocalBridgeToDomain()` every 5s

---

## Manual QA checklist

1. Create + approve `ToolExecutionRun` (Builder Cursor request)
2. `npm --prefix apps/ai-company run cursor:bridge`
3. Inbox appears under `.ai-company/cursor-inbox/<runId>/`
4. Cursor opens `task.md` (if CLI detected)
5. Run status → `queued` in AI Company
6. Write valid `result.json` to outbox
7. Bridge logs ingest
8. Run status → `result_received` after SPA sync

---

## What blocks fully autonomous submit

| Blocker | Reason |
|---------|--------|
| No Cursor Cloud API (policy) | No headless task queue |
| `cursor-agent` requires auth | Cloud Agent API |
| Browser cannot exec CLI | Needs local bridge |
| No machine-readable Cursor stdout | Results via outbox files only |
| Active Cursor session required | IDE open ≠ autonomous run |

---

## Checks

```bash
npm --prefix apps/ai-company run build
```
