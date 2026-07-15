/**
 * GitHub Evidence Bridge — runtime startup smoke test (AI-COMPANY-115A).
 * Ensures bridge modules resolve and HTTP server starts without ERR_MODULE_NOT_FOUND.
 */

import assert from 'node:assert/strict'
import net from 'node:net'
import { describe, it } from 'node:test'

import { getGitHubEvidenceBridgeConfig } from './src/config.ts'
import { GITHUB_EVIDENCE_BRIDGE_VERSION, startGitHubEvidenceBridgeServer } from './src/server.ts'

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close((error) => (error ? reject(error) : resolve(port)))
    })
    probe.on('error', reject)
  })
}

describe('github-evidence-bridge runtime smoke', () => {
  it('imports resolve and /v1/health responds', async () => {
    const port = await getFreePort()
    const config = {
      ...getGitHubEvidenceBridgeConfig(),
      host: '127.0.0.1',
      port,
    }

    const server = await startGitHubEvidenceBridgeServer(config)

    try {
      const response = await fetch(`http://${config.host}:${port}/v1/health`)
      assert.equal(response.status, 200)

      const body = (await response.json()) as { ok?: boolean; version?: string; mode?: string }
      assert.equal(body.ok, true)
      assert.equal(body.version, GITHUB_EVIDENCE_BRIDGE_VERSION)
      assert.equal(body.mode, config.mode)
    } finally {
      await server.close()
    }
  })
})
