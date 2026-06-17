# AI-COMPANY-004 — Infrastructure

MCP servers are the AI Company's "hands". Each is granted to roles on a
least-privilege basis. Status reflects the current local/stage setup
(`claude mcp list`).

| MCP | Purpose | Status | Granted to (intent) |
|-----|---------|--------|---------------------|
| **GitHub MCP** | Repo read; later PR-only writes (branch + PR, never direct push/merge) | ⏳ planned / pending auth | Architect, PM, QA (read); Developer (PR-only, V2) |
| **Figma MCP** | Read designs, Code Connect, design-system sync | ⚠️ needs authentication (`mcp.figma.com`) | AI Designer (rw own files); Architect (read) |
| **Docker MCP** | Inspect/operate stage containers (build/recreate/logs) | ✅ connected | AI DevOps (stage only) |
| **PostgreSQL MCP** | Read-only queries against stage DB | ✗ not connected — needs `STAGE_RO_DATABASE_URL` | All roles (RO); never Production |
| **Playwright MCP** | Headless browser smoke tests | ✅ connected | AI QA |

## Access principles
- **Read-only by default.** Write/exec capabilities are explicit per role.
- **No external AI APIs for the Developer runtime** — `agent-runner` uses a local Ollama model (`qwen3.6:27b`). No API keys leave the host.
- **PostgreSQL MCP is read-only** and points at **stage** (`sma_stage_db`, port `55433`) via `STAGE_RO_DATABASE_URL`. Production DB is never wired into any MCP. Prefer a dedicated RO database user.
- **GitHub MCP** is PR-only when it lands: AI roles may open branches/PRs; **merge and direct push remain human (Owner)**.
- **Docker MCP** is scoped to the **stage** stack (`sma_stage_backend` / `sma_stage_web` / `sma_stage_postgres`); it must not touch Production hosts.

## Current gaps / setup TODO
- `postgres-stage` MCP fails until `STAGE_RO_DATABASE_URL` is set (read-only creds recommended).
- Figma MCP requires OAuth (`authenticate` / `complete_authentication`).
- GitHub MCP not yet configured; required before AI Developer V2 (PR-only).
- New MCP tools become available **after a session restart**.

## Environments
- **Local dev** and **Stage** run via Docker Compose (`docker-compose.stage.yml`, project `sma-service`).
- AI roles operate on **Stage and below only**. Production is out of scope for all AI roles; only the Owner acts on Production.
