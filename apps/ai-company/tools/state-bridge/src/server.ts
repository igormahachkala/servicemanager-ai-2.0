/**
 * State Bridge — localhost-only HTTP API. The SPA reaches it same-origin via
 * /runtime/state (vite preview relay), never directly.
 *
 *   GET  /v1/health
 *   GET  /v1/snapshot              -> { rev, keys: { key: value } }
 *   GET  /v1/changes?since=<rev>   -> { rev, changes: [{ key, value|null, rev }], reset }
 *   PUT  /v1/keys  { changes: [{ key, value|null }] } -> { rev, applied }
 */

import http from 'node:http'
import { createStateStore, type StateStore } from './stateStore.ts'

export const STATE_BRIDGE_VERSION = 'v1'
const MAX_BODY_BYTES = 32 * 1024 * 1024

export type StateBridgeConfig = { host: string; port: number; dataDir: string }
export type StateBridgeServer = { close: () => Promise<void>; store: StateStore; port: number }

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

export function startStateBridgeServer(config: StateBridgeConfig): Promise<StateBridgeServer> {
  const store = createStateStore({ dir: config.dataDir })

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${config.host}:${config.port}`)
        const method = req.method ?? 'GET'

        if (method === 'GET' && url.pathname === '/v1/health') {
          sendJson(res, 200, { ok: true, version: STATE_BRIDGE_VERSION, rev: store.rev })
          return
        }
        if (method === 'GET' && url.pathname === '/v1/snapshot') {
          sendJson(res, 200, store.snapshot())
          return
        }
        if (method === 'GET' && url.pathname === '/v1/changes') {
          const since = Number.parseInt(url.searchParams.get('since') ?? '0', 10)
          sendJson(res, 200, store.changesSince(Number.isFinite(since) ? since : 0))
          return
        }
        if (method === 'PUT' && url.pathname === '/v1/keys') {
          const body = JSON.parse((await readBody(req)) || '{}') as {
            changes?: Array<{ key: string; value: string | null }>
          }
          if (!Array.isArray(body.changes)) {
            sendJson(res, 400, { error: 'changes[] required' })
            return
          }
          sendJson(res, 200, store.apply(body.changes))
          return
        }
        sendJson(res, 404, { error: 'not found' })
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    })

    server.on('error', reject)
    server.listen(config.port, config.host, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : config.port
      resolve({
        store,
        port,
        close: () =>
          new Promise((done) => {
            store.flush()
            server.close(() => done())
          }),
      })
    })
  })
}
