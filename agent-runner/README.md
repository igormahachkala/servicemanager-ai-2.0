# agent-runner (Engineering Agent v0.1 — MVP executor)

Read-only worker that picks up `AgentTask`s with status `NEW` from the
ServiceManager.AI Engineering Agent, runs a **read-only** analysis via a
**local Ollama model** (e.g. Qwen — no external AI API or keys), writes the
result back, and marks the task `DONE` (or `FAILED`).

It talks to ServiceManager **only over the public HTTP API** — never the
database, the filesystem, the repository, or a shell.

## Safety model

- **Dry-run by default.** Without `--live`, the runner performs **no network
  calls and no task mutations** — it only validates config and prints the plan.
  Live execution requires the explicit `--live` flag.
- **Host allowlist.** `SMA_API_BASE_URL` must resolve to an allowed host
  (`localhost`, `127.0.0.1`, `194.67.101.37` by default). Production hosts are
  on a hard denylist and always refused.
- **Read-only execution.** No shell commands, no filesystem writes, no repo
  access, no push/deploy/migrate.
- **Env-only config.** Reads `process.env` exclusively; never reads a `.env`
  file (its own or the project's).
- **Local AI only.** Analysis runs against a local Ollama endpoint
  (`OLLAMA_BASE_URL`); no external AI provider and no API keys.
- **Secret redaction.** All text is passed through `redact()` before being
  written to `result` or logged; the agent password is masked, plus
  JWT/Bearer/API-key/secret patterns.

## Install & build

```bash
cd agent-runner
npm install
npm run build
```

## Configuration

Export the variables from `.env.example` (in your shell or secret manager).
Required for live mode: `SMA_API_BASE_URL`, `SMA_AGENT_EMAIL`,
`SMA_AGENT_PASSWORD`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`.

The backend must list `SMA_AGENT_EMAIL` in `ENGINEERING_AGENT_OWNER_EMAILS`
(or the user must be `PLATFORM_ADMIN`) so the runner passes the owner-only guard.

## Run

```bash
# Safe: validate config + print plan, no network, no mutations
npm run dry-run

# Live (requires approval + all env set). One cycle:
node dist/index.js --live --once

# Live continuous polling:
npm run live
```

## Flow (live)

1. `POST /auth/login` → cache JWT (re-login once on 401).
2. `GET /agent-tasks` → pick the oldest `status=NEW`.
3. `PATCH /agent-tasks/:id/status` → `IN_PROGRESS`.
4. Read-only Ollama (local model) analysis of `task.prompt`.
5. `PATCH /agent-tasks/:id/result` → redacted analysis text.
6. `PATCH /agent-tasks/:id/status` → `DONE` (or `FAILED` with the error).

## MVP limitations (by design)

- Single-worker assumption: claim is a plain status PATCH (no server-side
  atomic claim yet) — run **one** instance. Atomic claim / stuck-task reaper
  are planned for V1.
- No repository access and no code changes — analysis text only.
- `GET /agent-tasks` returns all tasks; the runner filters `NEW` client-side.

## Not started in live mode

This package is built and verified but **must not be run with `--live`** until
explicitly approved.
