import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Ollama dev relay for LAN mobile browsers (108C / 108E).
 *
 * iPhone opens same-origin `/runtime/ollama/*`; Vite proxies to `127.0.0.1:11434`.
 * Ollama whitelists loopback origins only (`OLLAMA_ORIGINS` defaults).
 *
 * Problem: browser POST `/api/generate` sends `Origin: http://<lan-ip>:5174`.
 * Vite forwarded that header unchanged → Ollama HTTP 403.
 * GET `/api/tags` in Safari address bar often has no Origin, so it appeared to work.
 *
 * Fix: strip `Origin` / `Referer` on the upstream proxy request. Ollama then treats
 * the call as a local relay. Port 11434 stays on 127.0.0.1 — no 0.0.0.0 bind.
 */
function createOllamaDevRelay(): Record<string, ProxyOptions> {
  return {
    '/runtime/ollama': {
      target: 'http://127.0.0.1:11434',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/runtime\/ollama/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.removeHeader('origin')
          proxyReq.removeHeader('referer')
        })
      },
    },
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: createOllamaDevRelay(),
  },
  preview: {
    port: 4174,
    host: true,
    proxy: createOllamaDevRelay(),
  },
})
