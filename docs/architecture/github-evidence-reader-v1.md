# GitHub Evidence Reader V1

> **Task:** AI-COMPANY-114  
> **Status:** implemented (DEV-only)  
> **Module:** `apps/ai-company/src/domain/githubEvidenceReader/`

---

## 1. Purpose

Autonomous Builder reconciliation discovers Cursor Automation results through **official GitHub repository state** — not Cursor API, not browser scraping, not manual import.

The reader:

1. Finds the result marker `tmp/ai-company-results/{toolExecutionRunId}.json` in remote branches.
2. Verifies branch, commit, optional/required PR, changed files, and checks.
3. Returns a normalized `GitHubExecutionEvidenceResult`.
4. Reconciliation maps verified evidence → `CursorResultEnvelope` → Builder Review.

---

## 2. Trust boundary

| Layer | Responsibility |
|-------|----------------|
| Cursor Automation | Creates branch, commit, draft PR, result marker |
| GitHub (SoT) | Authoritative branch/commit/PR/diff state |
| Result marker | Hint only — never trusted without GitHub verification |
| GitHub Evidence Reader | Discovery + strict verification |
| Reconciliation | Timeout, idempotency, envelope + review bootstrap |

HTTP 200 webhook and `backgroundComposerId` are **transport correlation only** — not execution evidence.

---

## 3. Selected transport (DEV)

Priority order:

1. **`gh_cli`** (default) — `gh api` via local bridge when `gh auth status` succeeds.
2. **`git`** — local repository commands when remote matches requested repo.
3. **`github_api`** — REST API with server-side `GITHUB_TOKEN`.

Runtime: trusted local Node bridge `127.0.0.1:17320`, proxied by Vite as `/runtime/github-evidence`.

Secrets (`GITHUB_TOKEN`) stay **server-side only** — never in browser bundle, never `VITE_*`.

---

## 4. Marker discovery

- Search branches with prefix `cursor/` (configurable).
- Prefer `expectedBranch` when known.
- Filter branches updated after `dispatchedAt`.
- Cap scan at `GITHUB_EVIDENCE_MAX_BRANCHES` (default 20).
- Repository must match structured `{ owner, name }` and optional allowlist.

---

## 5. Verification rules

### Branch

- Exists in remote evidence snapshot.
- Matches allowed prefix.
- Not protected (`main`, `master`, `production`, `prod`, `release/*`).
- Marker file present on branch.

### Commit

- Valid SHA format.
- Exists and reachable from branch.
- Not older than `dispatchedAt` (with clock skew).

### Pull request

- Optional unless `requiresPullRequest` / `requiresCommitOrPullRequest`.
- GitHub URL must match repository.
- Head branch must match marker branch.
- V1 accepts OPEN or DRAFT; merged PR rejected.

### Changed files

- Normalized paths (no absolute, no `../`).
- Compared against commit/PR diff — marker alone is insufficient.
- Result marker path excluded from business file comparison.

### Checks

- **Reported checks** — from marker (unverified).
- **Verified checks** — from GitHub check runs when available.
- Never promote reported → verified.

---

## 6. Security

- Read-only GitHub access sufficient.
- Token redaction in logs and error messages.
- No interactive `gh auth login` from application.
- `GITHUB_AUTH_UNAVAILABLE` when credentials missing.
- Repository allowlist optional but recommended for DEV.

---

## 7. Configuration

Browser (`.env.local`):

```
VITE_GITHUB_EVIDENCE_READER_MODE=gh_cli
VITE_GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST=owner/repo
VITE_GITHUB_EVIDENCE_MAX_BRANCHES=20
VITE_GITHUB_EVIDENCE_BRANCH_PREFIX=cursor/
```

Bridge (server-side, see `.env.github-evidence.example`):

```
GITHUB_EVIDENCE_READER_MODE=gh_cli
GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST=owner/repo
GITHUB_TOKEN=...   # only for github_api mode
```

---

## 8. Reconciliation integration

`cursorAutomationReconciliation.ts` calls `resolveGitHubEvidence` on each tick:

| Evidence status | Run outcome |
|-----------------|-------------|
| `NOT_FOUND` / `PENDING` | Stay `RESULT_PENDING` |
| `FOUND` + verified success | `SUCCEEDED`, `awaiting_employee_review`, Builder Review |
| `FAILED` marker | `FAILED` terminal |
| `INVALID` | Errors saved, stay pending (no fake success) |
| Timeout (orchestrator) | `TIMED_OUT` |

Default deps wire `resolveGitHubExecutionEvidenceViaBridge` — stub removed.

---

## 9. Timeout & idempotency

- Timeout policy unchanged from AI-COMPANY-113 (30 min default).
- Reader returns evidence state only; orchestrator applies timeout.
- Repeated ticks: existing review prevents duplicate Builder Review.
- Terminal runs with non-pending envelope return idempotent outcome.

---

## 10. Observability

Structured events:

- `github_evidence_check_started`
- `github_evidence_marker_not_found`
- `github_evidence_marker_found`
- `github_evidence_verified`
- `github_evidence_invalid`
- `github_evidence_auth_failed`
- `github_evidence_transport_failed`
- `github_evidence_reconciliation_completed`

---

## 11. Known gaps

| Gap | Notes |
|-----|-------|
| Production / Stage | Blocked — DEV only |
| Full CI check verification | V1 verifies available GitHub check runs; marker checks remain reported-only |
| Cross-repo markers | Rejected by repository allowlist + PR URL validation |
| Automatic merge / deploy | Out of scope |

---

## 12. Local acceptance procedure

```bash
# Terminal 1 — GitHub Evidence Bridge
npm --prefix apps/ai-company run github:evidence

# Terminal 2 — AI Company dev server
npm --prefix apps/ai-company run dev

# Configure .env.local from .env.github-evidence.example + webhook env
# Ensure: gh auth status (for gh_cli mode)

# Browser: /mobile/builder-automation
# Create task tmp/autonomous-builder-test.txt
# Tap «Разрешить и запустить через Cursor Automations»
# Do NOT open Cursor manually
# Wait for: branch → commit → draft PR → marker → evidence → Builder → MAX → report
```

---

## 13. Related docs

- [autonomous-builder-cursor-automation-flow-v1.md](../product/autonomous-builder-cursor-automation-flow-v1.md)
- [cursor-result-envelope-v1.md](./cursor-result-envelope-v1.md)
- [cursor-execution-path-c-v1.md](./cursor-execution-path-c-v1.md)
