/**
 * GitHub Evidence Bridge — runtime startup smoke test (AI-COMPANY-115A).
 * Ensures bridge modules resolve and HTTP server starts without ERR_MODULE_NOT_FOUND.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { getGitHubEvidenceBridgeConfig } from './src/config.ts'
import { GITHUB_EVIDENCE_BRIDGE_VERSION, startGitHubEvidenceBridgeServer } from './src/server.ts'
import { createGhCliTransport } from './src/transports/ghCliTransport.ts'

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

const MARKER_BRANCH = 'cursor/probe-001'

const MARKER_JSON = JSON.stringify({
  toolExecutionRunId: 'probe-001',
  status: 'SUCCEEDED',
  summary: 'probe',
  branch: MARKER_BRANCH,
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  finishedAt: '2026-07-22T09:51:30Z',
  changedFiles: ['tmp/probe.md'],
  checks: [],
  errors: [],
})

/**
 * Fake `gh` that emulates the contents API method rule: anything but a plain GET
 * answers 404. `gh api` switches to POST as soon as a `-f` field is passed, so a
 * transport that sends `ref` as a field never reads the marker.
 */
function writeGhStub(dir: string, logFile: string): void {
  const script = `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(logFile)}

[ "$1" = "auth" ] && exit 0

url="$2"
method=GET
prev=""
for arg in "$@"; do
  case "$arg" in
    -f|--field|-F|--raw-field) method=POST ;;
  esac
  case "$prev" in
    -X|--method) method="$arg" ;;
  esac
  prev="$arg"
done

case "$url" in
  */branches)
    printf '%s\\n' '{"name":"${MARKER_BRANCH}","updatedAt":null}'
    exit 0
    ;;
  */contents/*)
    if [ "$method" != "GET" ]; then
      echo 'gh: Not Found (HTTP 404)' >&2
      exit 1
    fi
    case "$url" in
      *ref=*) printf '%s\\n' ${JSON.stringify(Buffer.from(MARKER_JSON, 'utf8').toString('base64'))} ; exit 0 ;;
      *) echo 'gh: Not Found (HTTP 404)' >&2 ; exit 1 ;;
    esac
    ;;
esac

exit 1
`
  const target = path.join(dir, 'gh')
  fs.writeFileSync(target, script, { mode: 0o755 })
}

describe('gh cli transport fetchFileAtRef', () => {
  it('reads the marker at a ref over GET (a -f field would make it POST → 404)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-evidence-stub-'))
    const logFile = path.join(dir, 'calls.log')
    writeGhStub(dir, logFile)

    const originalPath = process.env.PATH
    process.env.PATH = `${dir}${path.delimiter}${originalPath ?? ''}`

    try {
      const transport = createGhCliTransport({
        ...getGitHubEvidenceBridgeConfig(),
        mode: 'gh_cli',
      })

      const snapshot = await transport.fetchSnapshot({
        repository: { owner: 'acme', name: 'demo' },
        branchPrefix: 'cursor/',
        resultMarkerPath: 'tmp/ai-company-results/probe-001.json',
        maxBranches: 20,
        dispatchedAt: '2026-07-22T00:00:00Z',
        expectedBranch: null,
        expectedCommitSha: null,
        pullRequestUrl: null,
      })

      assert.equal(snapshot.markerBranch, MARKER_BRANCH)
      assert.ok(snapshot.markerContent, 'marker content must be read, not null')
      assert.equal(
        JSON.parse(snapshot.markerContent ?? '{}').commitSha,
        '0123456789abcdef0123456789abcdef01234567',
      )

      const contentsCall = fs
        .readFileSync(logFile, 'utf8')
        .split('\n')
        .find((line) => line.includes('/contents/'))
      assert.ok(contentsCall, 'contents API must be called')
      assert.ok(
        decodeURIComponent(contentsCall).includes(`ref=${MARKER_BRANCH}`),
        `ref must travel with the request: ${contentsCall}`,
      )
    } finally {
      process.env.PATH = originalPath
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
