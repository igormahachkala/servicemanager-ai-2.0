# agent-runner (Engineering Agent v0.1 — MVP executor)

Read-only worker that picks up `AgentTask`s with status `NEW` from the
ServiceManager.AI Engineering Agent, **selects relevant project source files**
(V1 code-aware context), runs a **read-only** analysis via a **local Ollama
model** (e.g. Qwen — no external AI API or keys), writes the result back (with a
context manifest), and marks the task `DONE` (or `FAILED`).

## V1 code context

When `CODE_ROOT` is set, each task is enriched with real source files:

- **FileSelector** maps the task text to files via a keyword map
  (`tickets → backend/src/tickets|workflow, web mobile/views`, `auth → backend/src/auth`,
  `permissions → backend/src/common|policy`, `analytics → backend/src/analytics|web views`,
  `mobile → web/src/mobile`) with a path/token fallback.
- **ContextLoader** reads only from the allowlist (`backend/src/**`, `web/src/**`,
  `backend/prisma/schema.prisma`); denies `.env*`, `*.pem`, `*.key`, `id_rsa*`,
  `*secret*`, `*credential*`, `node_modules`, `dist`, `.git`, binaries; enforces
  path-traversal protection and per-file / total byte budgets; redacts secrets.
- **PromptBuilder** assembles system + PROJECT CONTEXT + task; a manifest of the
  exact files used (and skipped) is prepended to the result.

If `CODE_ROOT` is unset, the runner falls back to prompt-only (MVP) behaviour.

## Task modes (AUDIT / PLAN)

`taskModeDetector.ts` infers the task mode from its text:

- **AUDIT** (review/analysis) → result format: `Problem / Risk / Recommendation / Effort`.
- **PLAN** (change request) → result format: `Task / Files / Changes / Constraints / Checks / Expected Result`.

Cyrillic stems match as substrings; Latin keywords match on word boundaries
(so "preview" never triggers "review"). Low confidence defaults to **PLAN**.
The chosen mode is shown in dry-run and prepended to the result as
`Task Type: AUDIT|PLAN`.

## Project Intelligence (Fast Context Mode)

So the agent doesn't re-discover the codebase every task, it keeps caches under
`agent-runner/.cache/` (the only place it writes):

- **Project index** (`projectIndex.ts`) — per file: module, type
  (controller/service/module/dto/util/policy/test), size, and resolved relative
  imports. Cached as `.cache/project-index.json` (`PROJECT_INDEX_PATH`).
- **Module profiles** (`moduleProfiles.ts`) — tickets / auth / permissions /
  mobile / analytics / inspections, each with anchor files loaded first.
- **File summary cache** (`fileSummaryCache.ts`) — a deterministic per-file
  summary (role, key symbols, risk flags) keyed by content hash; unchanged files
  reuse the cached summary. `.cache/file-summaries.json` (`FILE_SUMMARY_CACHE_PATH`).
- **Context planner** (`contextPlanner.ts`) — detects the module, picks files via
  the profile + index (no reads), loads the top files FULLY within the byte
  budget and represents the rest as compact SUMMARIES (full read only when needed).

Toggles: `ENABLE_SUMMARY_CACHE`, `ENABLE_MODULE_PROFILES`. `dry-run` prints the
chosen profile, files read fully, files served from summary (cache vs computed),
skipped files, and the context-planning time — with no model call.

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
# Safe: validate config + print plan. With CODE_ROOT set it ALSO previews the
# context selection (files + sizes + skipped) for a sample task — no model call,
# no AgentTask access. Override the sample with --task "..." or DRY_RUN_TASK.
CODE_ROOT=/path/to/checkout npm run dry-run
node dist/index.js --dry-run --task "Проверить логику tickets"

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
