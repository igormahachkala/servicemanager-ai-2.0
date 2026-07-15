#!/usr/bin/env node
/**
 * Connections Bridge CLI (AI-COMPANY-115).
 */

import { getConnectionsBridgeConfig } from './config.ts'
import { startConnectionsBridgeServer } from './server.ts'

const command = process.argv[2] ?? 'run'

async function main(): Promise<void> {
  const config = getConnectionsBridgeConfig()

  if (command === 'status') {
    console.log(
      JSON.stringify(
        {
          host: config.host,
          port: config.port,
          repositoryRoot: config.repositoryRoot,
          ephemeralSecrets: config.ephemeralSecrets,
        },
        null,
        2,
      ),
    )
    return
  }

  const server = await startConnectionsBridgeServer(config)
  console.log(
    `[connections-bridge] listening on http://${config.host}:${config.port} ephemeralSecrets=${config.ephemeralSecrets}`,
  )

  const shutdown = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[connections-bridge] fatal:', error instanceof Error ? error.message : error)
  process.exit(1)
})
