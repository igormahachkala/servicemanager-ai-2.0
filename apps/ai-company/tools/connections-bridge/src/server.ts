/**
 * Connections Bridge — localhost-only HTTP API (AI-COMPANY-115).
 */

import http from 'node:http'
import { getConnectionsBridgeConfig, type ConnectionsBridgeConfig } from './config.ts'
import { detectOllamaEndpoint, runConnectionHealthCheck } from './healthChecks.ts'
import { connectionSecretStore } from './secretStore.ts'

export const CONNECTIONS_BRIDGE_VERSION = 'v1'

export type ConnectionsBridgeServer = {
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

export function startConnectionsBridgeServer(
  config: ConnectionsBridgeConfig = getConnectionsBridgeConfig(),
): Promise<ConnectionsBridgeServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${config.host}:${config.port}`)
        const method = req.method ?? 'GET'

        if (method === 'GET' && url.pathname === '/v1/health') {
          sendJson(res, 200, {
            ok: true,
            version: CONNECTIONS_BRIDGE_VERSION,
            ephemeralSecrets: config.ephemeralSecrets,
          })
          return
        }

        if (method === 'GET' && url.pathname === '/v1/detect/ollama') {
          sendJson(res, 200, await detectOllamaEndpoint())
          return
        }

        if (method === 'GET' && url.pathname.startsWith('/v1/secrets/')) {
          const connectionId = decodeURIComponent(url.pathname.slice('/v1/secrets/'.length))
          sendJson(res, 200, { hasSecret: connectionSecretStore.hasSecret(connectionId) })
          return
        }

        if (method === 'DELETE' && url.pathname.startsWith('/v1/secrets/')) {
          const connectionId = decodeURIComponent(url.pathname.slice('/v1/secrets/'.length))
          connectionSecretStore.deleteSecret(connectionId)
          sendJson(res, 200, { ok: true })
          return
        }

        if (method === 'POST' && url.pathname === '/v1/secrets') {
          const body = (await readJsonBody(req)) as {
            connectionId?: string
            payload?: { type?: string; value?: string }
            action?: string
          }
          if (!body.connectionId || !body.payload?.value) {
            sendJson(res, 400, { error: 'connectionId and payload.value required.' })
            return
          }
          const payload = {
            type: (body.payload.type ?? 'API_KEY') as never,
            value: body.payload.value,
            metadata: {},
          }
          if (body.action === 'rotate') {
            connectionSecretStore.rotateSecret(body.connectionId, payload)
          } else {
            connectionSecretStore.setSecret(body.connectionId, payload)
          }
          sendJson(res, 200, { ok: true })
          return
        }

        if (method === 'POST' && url.pathname === '/v1/test-connection') {
          const body = (await readJsonBody(req)) as {
            connectionId?: string
            providerId?: string
            configuration?: Record<string, unknown>
          }
          if (!body.connectionId || !body.providerId) {
            sendJson(res, 400, { error: 'connectionId and providerId required.' })
            return
          }
          const result = await runConnectionHealthCheck({
            connectionId: body.connectionId,
            providerId: body.providerId,
            configuration: body.configuration ?? {},
            config,
          })
          sendJson(res, 200, result)
          return
        }

        if (method === 'POST' && url.pathname === '/v1/runtime/cursor-automation/dispatch') {
          const body = (await readJsonBody(req)) as {
            connectionId?: string
            webhookUrl?: string
            requestBody?: unknown
          }
          if (!body.connectionId || !body.webhookUrl) {
            sendJson(res, 400, { error: 'connectionId and webhookUrl required.' })
            return
          }
          const secret = connectionSecretStore.getSecretForRuntime(body.connectionId)
          if (!secret?.value) {
            sendJson(res, 503, { error: 'Secret unavailable in trusted runtime.' })
            return
          }
          const response = await fetch(body.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${secret.value}`,
            },
            body: JSON.stringify(body.requestBody ?? {}),
          })
          const text = await response.text()
          sendJson(res, 200, { httpStatus: response.status, body: text })
          return
        }

        sendJson(res, 404, { error: 'Not found.' })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, 500, { error: message.replace(/Bearer\s+\S+/gi, 'Bearer ***REDACTED***') })
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
