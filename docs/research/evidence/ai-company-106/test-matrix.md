# AI-COMPANY-106 — Test Matrix

> **Run date (UTC):** 2026-07-10  
> **Evidence dir:** `docs/research/evidence/ai-company-106/`  
> **Secrets:** redacted in all committed files

| TC | Name | Auth | Body / headers | HTTP status | Run created | Execution ID in response | Evidence |
|----|------|------|----------------|-------------|-------------|------------------------|----------|
| TC-01 | Empty POST | None | empty | **401** | No | No | `tc-01-*` |
| TC-02 | Empty JSON | Bearer valid | `{}` | **400** | No | No | `tc-02-*` |
| TC-03 | Structured JSON | Bearer valid | nested JSON + testId | **400** | No | No | `tc-03-*` |
| TC-04 | Invalid JSON | Bearer valid | `{invalid` | **500** | No | No | `tc-04-*` |
| TC-05 | text/plain | Bearer valid | plain text | **400** | No | No | `tc-05-*` |
| TC-06a | Duplicate #1 | Bearer valid | same testId | **400** | No | No | `tc-06a-*` |
| TC-06b | Duplicate #2 | Bearer valid | same testId | **400** | No | No | `tc-06b-*` |
| TC-07 | Long-run timing | Bearer valid | JSON w/ sleep hint | **400** | No | No | `tc-07-*` |
| TC-08a | No auth | None | `{}` | **401** | No | No | `tc-08a-*` |
| TC-08b | Wrong key | Bearer invalid | `{}` | **401** | No | No | `tc-08b-*` |
| TC-08c | Correct key | Bearer valid | minimal JSON | **400** | No | No | `tc-08c-*` |
| TC-09 | Query + headers | Bearer valid | query + X-AI-Company-* | **400** | No | No | `tc-09-*` |
| TC-10 | Result discovery | — | post-run inspection | — | **No runs observed** | — | Report §11 |

## Workspace states observed during session

| Phase | Authenticated POST result |
|-------|---------------------------|
| Early runs | `400` — `Automation *** is disabled` |
| After enable | `400` — `Failed to start background composer: [unauthenticated] Error` |

## Confirmation levels

| Level | Meaning |
|-------|---------|
| **L1 HTTP** | Request/response captured via curl |
| **L2 Run** | Cloud Agent run visible in Cursor UI |
| **L3 Repo** | Commit/artifact in repository |
| **L4 Payload** | Agent received webhook body (observed in run output/file) |

All TCs reached **L1** only. **L2–L4 not reached** in this session.
