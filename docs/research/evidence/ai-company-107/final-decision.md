# AI-COMPANY-107 — Final architectural decision

## Outcome summary

**First successful Automation webhook enqueue achieved** (HTTP 200, `success:true`, `backgroundComposerId`).

Prior blocker `Failed to start background composer: [unauthenticated] Error` **eliminated** after Cloud Environment + workspace fixes (user-confirmed manual Cloud Agent success).

**Incomplete for full Path A:** repository artifact and payload visibility **not confirmed** on configured test branch within 12-minute observation window.

## Decision: **Path C — Local Bridge primary, Cursor manual + webhook trigger secondary**

### Why not Path A (full)

| Path A criterion | 107 status |
|------------------|------------|
| Successful webhook-triggered run | **Yes** (enqueue + composer id) |
| testId accessible to agent | **No evidence** |
| Result discoverable | **No** on expected branch/file |
| Success/error of run completion | **Partial** (HTTP only) |
| No extra payment | **Yes** |

Path A requires all five — **not met**.

### Why not Path B (Cloud Agents API primary)

- Manual Cloud Agent already works on current subscription.
- Task forbids assuming paid Cloud Agents API as default path without cost proof.
- Webhook now returns `backgroundComposerId` — correlation may be possible without immediate API adoption.
- API v1 polling would be **supplemental**, not primary, until billing scope is documented for included usage.

### Path C composition

| Layer | Role |
|-------|------|
| **Local Cursor Bridge** | Machine-readable result envelope + Builder review (AI-COMPANY-113E/F) |
| **Manual Cloud Agent** | Operator-driven execution when full control needed |
| **Automation webhook** | Optional **trigger** surface; store `backgroundComposerId` as external correlation id; discover results via UI / future included-usage API / repo side effects |

### Research closure

Cursor Automations webhook **transport + enqueue contract** is **verified**.

Remaining gaps (payload in agent prompt, repo artifact path, run completion without API) are **operational/configuration/observability** concerns — not blockers to closing repeated smoke testing.

**No further smoke test iterations required** unless product changes or Automation instruction/branch binding is revised.

## Correlation note for future adapter design (research only)

```json
{"success":true,"backgroundComposerId":"bc-<uuid>"}
```

Field name confirmed live. Use as external run reference; do not assume commit lands on configured branch without verification.
