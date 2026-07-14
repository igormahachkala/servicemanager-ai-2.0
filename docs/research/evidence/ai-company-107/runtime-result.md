# AI-COMPANY-107 — Runtime result

> **Green POST (UTC):** 2026-07-14T10:08:08Z  
> **Duplicate POST (UTC):** 2026-07-14T10:20:41Z

## HTTP enqueue — Case A (success at transport/runtime gate)

| Field | Green POST | Duplicate POST |
|-------|------------|----------------|
| HTTP status | **200** | **200** |
| `success` | **true** | **true** |
| `backgroundComposerId` | **present** (`bc-***REDACTED***`) | **present** (`bc-***REDACTED***`) |
| Latency | ~1.98 s | ~1.80 s |
| Billing prompt | **None** | **None** |

**Conclusion:** unauthenticated composer error **resolved** after Cloud Environment configuration. Webhook now enqueues Background Composer and returns execution identifier field.

## Repository artifact (12 min poll)

| Check | Result |
|-------|--------|
| `tmp/cursor-automation-smoke-result.json` on `origin/test/cursor-automation-webhook-contract` | **Not found** (36 × 20s poll) |
| New commits on test branch | **None** after `eedc8c5` |
| Other `origin/cursor/*` branches | Exist (`cursor/create-test-txt-5ec3`, etc.) — **no smoke-result file** |

## Payload visibility

| Item | Status |
|------|--------|
| `testId` in agent output file | **Not observed** (no artifact) |
| `receivedPayload` / `payloadAccessible` | **Not confirmed** |

## Run UI / logs

| Item | Status |
|------|--------|
| Automation run in Cursor UI | **Not captured by agent** — user may verify via Automations → Runs |
| Background Composer visible | Inferred from HTTP `backgroundComposerId` |
| Run terminal status (FINISHED/ERROR) | **Not polled** (no Cloud Agents API calls per cost constraint) |

## Duplicate behavior (one duplicate POST)

- Same `testId` sent twice.
- Both returned **HTTP 200** + `success:true` + `backgroundComposerId`.
- **No HTTP-level deduplication** observed.
- **Idempotency key** — not supported in request contract.

## Billing observation

No UI or HTTP message requesting additional credits, Max Mode purchase, or plan upgrade during 107 tests.
