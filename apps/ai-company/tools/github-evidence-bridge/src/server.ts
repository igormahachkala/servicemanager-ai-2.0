/**
 * GitHub Evidence Bridge — localhost-only HTTP API (AI-COMPANY-114).
 */

import http from 'node:http'
import { resolveGitHubExecutionEvidence } from '../../../src/domain/githubEvidenceReader/resolveGitHubExecutionEvidence.ts'
import type { ResolveGitHubExecutionEvidenceInput } from '../../../src/domain/githubEvidenceReader/githubEvidenceReaderTypes.ts'
import { formatGitHubEvidenceReaderEvent } from '../../../src/domain/githubEvidenceReader/githubEvidenceReaderObservability.ts'
import { getGitHubEvidenceBridgeConfig, type GitHubEvidenceBridgeConfig } from './config.ts'
import { createGitHubEvidenceTransport } from './transports/createTransport.ts'

export const GITHUB_EVIDENCE_BRIDGE_VERSION = 'v1'

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

function isResolveRequest(value: unknown): value is ResolveGitHubExecutionEvidenceInput {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.toolExecutionRunId === 'string' &&
    (typeof record.repository === 'string' ||
      (typeof record.repository === 'object' && record.repository !== null)) &&
    typeof record.baseBranch === 'string' &&
    typeof record.resultMarkerPath === 'string' &&
    typeof record.dispatchedAt === 'string'
  )
}

export function startGitHubEvidenceBridgeServer(
  config: GitHubEvidenceBridgeConfig = getGitHubEvidenceBridgeConfig(),
): Promise<BridgeServer> {
  const transport = createGitHubEvidenceTransport(config)

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://${config.host}:${config.port}`)
        const method = req.method ?? 'GET'

        if (method === 'GET' && url.pathname === '/v1/health') {
          sendJson(res, 200, { ok: true, version: GITHUB_EVIDENCE_BRIDGE_VERSION, mode: config.mode })
          return
        }

        if (method === 'POST' && url.pathname === '/v1/resolve') {
          const body = await readJsonBody(req)
          if (!isResolveRequest(body)) {
            sendJson(res, 400, { error: 'Invalid resolve body.' })
            return
          }

          const result = await resolveGitHubExecutionEvidence(body, {
            transport,
            config: {
              mode: config.mode,
              repositoryAllowlist: config.repositoryAllowlist,
              maxBranches: config.maxBranches,
              branchPrefix: config.branchPrefix,
              clockSkewMs: config.clockSkewMs,
            },
            logEvent: (event) => {
              console.info(formatGitHubEvidenceReaderEvent(event))
            },
          })

          if (result.reasonCode === 'GITHUB_AUTH_UNAVAILABLE') {
            sendJson(res, 503, result)
            return
          }
          if (result.reasonCode === 'GITHUB_ACCESS_DENIED') {
            sendJson(res, 403, result)
            return
          }
          if (result.reasonCode === 'GITHUB_RATE_LIMITED') {
            sendJson(res, 429, result)
            return
          }

          sendJson(res, 200, result)
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
