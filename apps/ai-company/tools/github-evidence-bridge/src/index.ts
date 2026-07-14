#!/usr/bin/env node
/**
 * GitHub Evidence Bridge CLI (AI-COMPANY-114).
 */

import { getGitHubEvidenceBridgeConfig } from './config.ts'
import { startGitHubEvidenceBridgeServer } from './server.ts'

const command = process.argv[2] ?? 'run'

async function main(): Promise<void> {
  const config = getGitHubEvidenceBridgeConfig()

  if (command === 'status') {
    console.log(
      JSON.stringify(
        {
          host: config.host,
          port: config.port,
          mode: config.mode,
          repositoryRoot: config.repositoryRoot,
          allowlist: config.repositoryAllowlist,
          maxBranches: config.maxBranches,
          branchPrefix: config.branchPrefix,
          hasToken: Boolean(config.githubToken),
        },
        null,
        2,
      ),
    )
    return
  }

  const server = await startGitHubEvidenceBridgeServer(config)
  console.log(
    `[github-evidence-bridge] listening on http://${config.host}:${config.port} mode=${config.mode}`,
  )

  const shutdown = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[github-evidence-bridge] fatal:', error instanceof Error ? error.message : error)
  process.exit(1)
})
