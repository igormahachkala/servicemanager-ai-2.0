/**
 * Cursor Local Bridge — localhost-only HTTP API (AI-COMPANY-113E).
 * Binds 127.0.0.1 — not exposed on LAN.
 */

import http from 'node:http'
import {
  CURSOR_LOCAL_INBOX_RELATIVE,
  CURSOR_LOCAL_OUTBOX_RELATIVE,
  type CursorBridgeConfig,
} from './config.ts'
import { detectCursorBinary } from './cursorDetect.ts'
import { processEnqueueRequest, processPendingDirectory } from './queueProcessor.ts'
import { listBridgeRuns } from './stateStore.ts'
import {
  CURSOR_BRIDGE_VERSION,
  type CursorBridgeEnqueueRequest,
  type CursorBridgeStatusSnapshot,
} from './types.ts'

export type BridgeServer = {
  close: () => Promise<void>
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function buildStatusSnapshot(config: CursorBridgeConfig, startedAt: string | null): CursorBridgeStatusSnapshot {
  const detection = detectCursorBinary()
  return {
    version: CURSOR_BRIDGE_VERSION,
    running: true,
    host: config.host,
    port: config.port,
    repositoryRoot: config.repositoryRoot,
    cursorBinary: detection.path,
    cursorDetected: Boolean(detection.path),
    inboxRelativePath: CURSOR_LOCAL_INBOX_RELATIVE,
    outboxRelativePath: CURSOR_LOCAL_OUTBOX_RELATIVE,
    pendingDirectory: config.pendingDir,
    runs: listBridgeRuns(config),
    startedAt,
  }
}

function isEnqueueRequest(value: unknown): value is CursorBridgeEnqueueRequest {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.runId === 'string' &&
    typeof record.title === 'string' &&
    typeof record.instructions === 'string'
  )
}

export function startBridgeServer(
  config: CursorBridgeConfig,
  startedAt: string,
): Promise<BridgeServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${config.host}:${config.port}`)
        const method = req.method ?? 'GET'

        if (method === 'GET' && url.pathname === '/v1/health') {
          sendJson(res, 200, { ok: true, version: CURSOR_BRIDGE_VERSION })
          return
        }

        if (method === 'GET' && url.pathname === '/v1/status') {
          sendJson(res, 200, buildStatusSnapshot(config, startedAt))
          return
        }

        if (method === 'GET' && url.pathname === '/v1/runs') {
          sendJson(res, 200, { runs: listBridgeRuns(config) })
          return
        }

        if (method === 'GET' && url.pathname.startsWith('/v1/runs/')) {
          const runId = decodeURIComponent(url.pathname.slice('/v1/runs/'.length))
          const run = listBridgeRuns(config).find((item) => item.runId === runId)
          if (!run) {
            sendJson(res, 404, { error: 'Run not found.' })
            return
          }
          sendJson(res, 200, { run })
          return
        }

        if (method === 'POST' && url.pathname === '/v1/runs') {
          const body = await readJsonBody(req)
          if (!isEnqueueRequest(body)) {
            sendJson(res, 400, {
              error: 'Invalid enqueue body — runId, title, instructions required.',
            })
            return
          }
          const run = await processEnqueueRequest(config, body)
          sendJson(res, 201, { run })
          return
        }

        if (method === 'POST' && url.pathname === '/v1/pending/process') {
          const processed = await processPendingDirectory(config)
          sendJson(res, 200, { processed })
          return
        }

        sendJson(res, 404, { error: 'Not found.' })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, 500, { error: message })
      }
    })

    server.on('error', reject)

    server.listen(config.port, config.host, () => {
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()))
          }),
      })
    })
  })
}

export function printBridgeStatus(config: CursorBridgeConfig): void {
  const snapshot = buildStatusSnapshot(config, null)
  console.log(JSON.stringify(snapshot, null, 2))
}
