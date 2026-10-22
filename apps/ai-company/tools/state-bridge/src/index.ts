#!/usr/bin/env node
/**
 * State Bridge CLI — shared company state for every browser.
 *   run     start the server (default)
 *   status  print config
 */

import path from 'node:path'
import { startStateBridgeServer } from './server.ts'

const command = process.argv[2] ?? 'run'

const config = {
  host: process.env.STATE_BRIDGE_HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.STATE_BRIDGE_PORT ?? '17322', 10),
  dataDir: path.resolve(process.env.AI_COMPANY_STATE_DIR ?? path.join(process.cwd(), '.state')),
  // Files offered to analysis tasks (read-only). On the server: the clone.
  repoRoot: path.resolve(process.env.AI_COMPANY_FILES_ROOT ?? process.env.AI_COMPANY_REPO_ROOT ?? path.join(process.cwd(), '..', '..')),
}

async function main(): Promise<void> {
  if (command === 'status') {
    console.log(JSON.stringify(config, null, 2))
    return
  }
  const server = await startStateBridgeServer(config)
  console.log(`[state-bridge] listening on http://${config.host}:${server.port} data=${config.dataDir} files=${config.repoRoot} rev=${server.store.rev}`)
  const shutdown = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[state-bridge] failed:', error)
  process.exit(1)
})
