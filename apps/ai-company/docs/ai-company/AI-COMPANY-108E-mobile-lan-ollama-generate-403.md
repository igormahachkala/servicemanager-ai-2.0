# AI-COMPANY-108E — Fix Mobile LAN Ollama Generate 403

## Problem

After 108C LAN relay, iPhone could load:

```
GET http://192.168.x.x:5174/runtime/ollama/api/tags
```

but Runtime failed on generate:

```
POST /runtime/ollama/api/generate → HTTP 403
errorMessage: Ollama /api/generate failed with HTTP 403
effectiveEndpoint: /runtime/ollama
```

108D diagnostics surfaced the failure; root cause was proxy headers, not missing diagnostics.

## Root cause

Ollama checks the `Origin` header against `OLLAMA_ORIGINS` (defaults: loopback only).

Vite proxy forwarded the browser header:

```
Origin: http://192.168.50.150:5174
```

Ollama rejected POST `/api/generate` with **403**.

Why `/api/tags` looked fine:

- Direct Safari navigation to the relay URL often sends **no** `Origin`.
- In-app POST from `fetch()` always includes `Origin` for same-origin JSON requests.

Verified locally:

```bash
# 403
curl -X POST http://127.0.0.1:11434/api/generate \
  -H "Origin: http://192.168.50.150:5174" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b","prompt":"hi","stream":false}'

# 200
curl -X POST http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b","prompt":"hi","stream":false}'
```

## Solution

Sanitize headers in `vite.config.ts` proxy `configure` hook:

- `target`: `http://127.0.0.1:11434`
- `rewrite`: `/runtime/ollama` → `` (empty)
- `changeOrigin`: `true` (Host header for upstream)
- **`proxyReq.removeHeader('origin')`** and **`referer`** before forward

No `OLLAMA_HOST=0.0.0.0`. No public `:11434`. Desktop `localhost:5174` unchanged.

## Files

| File | Change |
|------|--------|
| `vite.config.ts` | `sanitizeOllamaProxyHeaders` on `/runtime/ollama` proxy |

## Manual QA (iPhone)

1. Restart dev server:
   ```bash
   npm --prefix apps/ai-company run dev -- --host 0.0.0.0
   ```
2. Safari: `http://<mac-lan-ip>:5174/runtime/ollama/api/tags` → JSON models
3. `http://<mac-lan-ip>:5174/mobile/demo` → Prepare → Run now
4. Expected: POST `/runtime/ollama/api/generate` **200**, Runtime completes, report appears
5. On failure, 108D diagnostics should **not** show HTTP 403 for this cause

## Local proxy smoke test

```bash
npm --prefix apps/ai-company run dev -- --host 0.0.0.0

curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://127.0.0.1:5174/runtime/ollama/api/generate \
  -H "Origin: http://192.168.50.150:5174" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b","prompt":"hi","stream":false}'
```

Expected: `200` (not `403`).

## Checks

```bash
npm --prefix apps/ai-company run build
```

## What remains

- **Production** remote host: needs nginx (or similar) with the same Origin sanitization — Vite proxy is dev/preview only.
- **OLLAMA_ORIGINS** on server: alternative fix, but rejected here to avoid changing Ollama deployment; header sanitization at relay is sufficient.

## Related

- **108C** — LAN relay path `/runtime/ollama`
- **108D** — failure diagnostics (used to identify HTTP 403)

## Commit

`AI-COMPANY-108E: Sanitize Origin on Vite Ollama proxy for mobile LAN generate`
