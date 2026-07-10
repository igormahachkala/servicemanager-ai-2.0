# AI-COMPANY-113C — Cursor Local Integration Decision

**Date:** 2026-07-10  
**Branch:** `ai-company-flow`  
**Scope:** Local discovery on macOS (darwin arm64) — Igor's machine.  
**Constraint:** No Cursor Cloud API, no hardcoded IP, no unverified automation claims.

---

## Research summary (confirmed locally)

| Check | Result |
|-------|--------|
| Cursor.app installed | **Yes** — `/Applications/Cursor.app` |
| IDE version | **3.9.16** (`042b3c1a4c53f2c3808067f519fbfc67b72cad80`, arm64) |
| `cursor` in default PATH | **No** — `which cursor` → not found |
| Bundled IDE CLI | **Yes** — `/Applications/Cursor.app/Contents/Resources/app/bin/cursor` |
| `cursor --help` subcommands | **`tunnel`**, **`agent`** (delegates to cursor-agent installer) |
| `cursor agent --help` | **Yes** — full Cursor Agent CLI (after auto-install) |
| `cursor-agent` version | **2026.07.09-a3815c0** |
| `cursor-agent status` | **Not logged in** (no session token used in this doc) |
| `automation` CLI subcommand | **Not found** |
| Open file via CLI | **Confirmed** — `cursor -g <file>:<line>` exit 0 |
| Cursor Automations / Background Agents (UI) | Product feature; **no local programmatic interface confirmed** beyond Agent CLI (cloud-auth) |
| Active Cursor session | **Required** for IDE open / chat / manual agent work |
| Browser app (AI Company) spawn CLI | **Not available** — Vite SPA cannot exec local binaries |

**Tokens / credentials:** Not read, not logged, not stored.

---

## Option comparison (confirmed only)

### 1. Local IDE CLI (`cursor` binary)

| Aspect | Finding |
|--------|---------|
| Available | Bundled binary exists; not on PATH by default |
| Submit task | Open repo / file / `--chat` window — **no task queue API** |
| Get result | **No stdout/JSON result channel** — changes live in git workspace |
| Manual action | **Yes** — user runs Agent/Composer in opened window |
| Security | Local only; must sanitize opened paths (no secrets in task files) |
| Limits | Cannot headless-complete without Agent CLI + auth |

**Verdict:** Assist-only (open workspace + task file). **Not** full auto cycle.

---

### 2. Cursor Agent CLI (`cursor-agent` / `cursor agent`)

| Aspect | Finding |
|--------|---------|
| Available | Installed on research machine |
| Submit task | `cursor-agent agent --print --trust "<prompt>"` (headless) |
| Get result | `--output-format json` when `--print` — **requires authenticated session** |
| Manual action | Login required (`cursor-agent login` or `CURSOR_API_KEY`) |
| Security | Uses **Cursor cloud Agent API** — **out of scope** for 113C V1 (project rule: no Cursor API) |
| Limits | Not logged in at research time; sandbox install hit network 403 without full permissions |

**Verdict:** **Blocked for V1** under «no Cursor API». Revisit only if product policy changes.

---

### 3. Cursor Automation / Background Agents (UI)

| Aspect | Finding |
|--------|---------|
| Available | Cursor product feature (UI) |
| Submit task | Owner configures automation in Cursor app |
| Get result | PR / workspace changes — **no local callback to AI Company confirmed** |
| Manual action | **Yes** — UI setup + monitoring |
| Security | Repo access scoped in Cursor settings |
| Limits | No CLI `automation` command found in Cursor 3.9.16 |

**Verdict:** Manual external executor; document handoff text only (see 110C). **Not** adapter auto-submit V1.

---

### 4. Filesystem inbox / outbox (project-local)

| Aspect | Finding |
|--------|---------|
| Available | **Always** — plain files under repo-relative paths |
| Submit task | Write envelope: `task.md`, `metadata.json`, `expected-result.md`, `checks.md` |
| Get result | Owner or script writes `outbox/<id>/result.md` + `metadata.json` |
| Manual action | **Yes** for V1 — Owner copies to Cursor or opens exported bundle |
| Security | Strict sanitizer — no `.env`, keys, tokens, IP |
| Limits | Browser SPA cannot write disk — envelope stored in localStorage + export/copy |

**Verdict:** **Recommended V1** — honest prepare + manual bridge; poll/ingest from localStorage outbox when Owner records result.

---

### 5. Clipboard handoff (110C — already shipped)

| Aspect | Finding |
|--------|---------|
| Available | **Yes** — `cursorHandoffFromChat` |
| Submit | Copy markdown → Owner pastes in Cursor |
| Result | Owner marks sent / creates MAX task — **manual** |
| Verdict | Complementary to filesystem envelope; same manual tier |

---

### 6. Unsupported / blocked

| Variant | Why blocked |
|---------|-------------|
| Cursor Cloud API | Explicit project constraint |
| Hardcoded IP / tunnel to remote host | Explicit project constraint |
| `cursor-agent` headless without policy change | Cloud API + auth |
| Fake `submit → success` | Forbidden in 113C adapter contract |
| Auto-return to MAX without outbox/Owner | No confirmed machine-readable result channel |

---

## V1 recommendation

**Primary adapter mode:** `filesystem_inbox` (localStorage-backed envelope + export paths)

**Assist (optional, Node/desktop only):** resolve bundled `cursor` path and `cursor -g <inbox>/task.md` — **not invoked from browser V1**.

**Submit default:** `status: unsupported` with reason until a **non-API** submit path is confirmed in target runtime (e.g. desktop helper).

**Result return to MAX:** **Manual / semi-automatic** — Owner (or future watcher) calls `ingestCursorLocalResult()` after placing outbox files or entering result in UI. **No** confirmed fully automatic loop.

---

## Integration sequence (113C — contract only)

```
ToolExecutionRun approved
  → planCursorLocalExecutionFromToolRun()   // prepare envelope, no submit
  → (future) submitCursorLocalTask()      // blocked in browser V1
  → pollCursorLocalTask()                   // localStorage outbox
  → ingestCursorLocalResult()               // MAX review path (113D+)
```

---

## Follow-up tickets

| ID | Topic |
|----|-------|
| 113D | Owner UI: export envelope, record outbox result |
| 113E | Optional macOS helper: spawn bundled `cursor -g` (non-browser) |
| 113F | Policy review: cursor-agent with Owner-owned API key (if allowed) |

---

## Research commands (reproducible)

```bash
# IDE CLI
/Applications/Cursor.app/Contents/Resources/app/bin/cursor --version

# Agent CLI (installs on first `cursor agent` if missing)
cursor-agent --version
cursor-agent status

# Open task file (confirmed — opens GUI)
/Applications/Cursor.app/Contents/Resources/app/bin/cursor -g path/to/task.md:1
```

Do **not** commit output of `cursor-agent login` or env vars containing keys.
