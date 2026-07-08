# AI-COMPANY-108C — Mobile LAN Ollama Dev Relay

## Problem

On Mac, MAX tasks complete because the browser can reach `http://127.0.0.1:11434`.

On iPhone over LAN (`http://192.168.x.x:5174/mobile/...`), `127.0.0.1` points to the **phone**, not the Mac. Ollama requests fail without exposing port 11434 on the network.

## Solution

Same-origin dev relay through Vite:

```
Browser (iPhone)  →  GET /runtime/ollama/api/tags
                         ↓ Vite proxy (Mac)
                    http://127.0.0.1:11434/api/tags
```

Ollama stays on `127.0.0.1:11434`. No `OLLAMA_HOST=0.0.0.0`.

## Auto-detection

When **all** are true:

- `endpointMode === 'localhost'` (default)
- `window.location.hostname` is not `localhost` / `127.0.0.1`

Runtime provider uses `/runtime/ollama` instead of `http://127.0.0.1:11434`.

Mac desktop browser on `localhost:5174` keeps direct localhost.

## Files

| File | Change |
|------|--------|
| `vite.config.ts` | Proxy `/runtime/ollama` → `127.0.0.1:11434` (dev + preview) |
| `ollamaSourceMode.ts` | Relay path, `shouldUseOllamaSameOriginRelay`, `resolveEffectiveOllamaBaseUrl` |
| `ollamaProvider.ts` | Fetch via effective base URL |
| `runtimeHealth.ts` | Export `getEffectiveOllamaBaseUrl` |
| `RuntimeHealth.tsx` | UI explains localhost / LAN relay / production |
| `i18n/{ru,en}.ts` | Runtime settings copy |

## Manual QA (iPhone)

1. On Mac: `ollama serve` (default bind 127.0.0.1)
2. Start dev server:
   ```bash
   npm --prefix apps/ai-company run dev -- --host 0.0.0.0
   ```
3. On iPhone (same Wi‑Fi): `http://<mac-lan-ip>:5174/mobile/demo`
4. Create MAX task → Run now → Runtime Live
5. DevTools Network on Mac should show `/runtime/ollama/api/generate` proxied to Ollama
6. Task completes; report appears

## What remains

- Production remote UI (83.166.245.27) needs nginx (or similar) relay if accessed from browsers not on the server — out of Vite dev scope.
- Preview/build without proxy: relay path only works when Vite/preview proxy is active.
