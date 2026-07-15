/**
 * Connections Bridge — configuration (AI-COMPANY-115).
 */

import fs from 'node:fs'
import path from 'node:path'

export const CONNECTIONS_BRIDGE_DEFAULT_HOST = '127.0.0.1'
export const CONNECTIONS_BRIDGE_DEFAULT_PORT = 17321

export type ConnectionsBridgeConfig = {
  host: string
  port: number
  repositoryRoot: string
  ephemeralSecrets: boolean
}

function isRepositoryRoot(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'apps', 'ai-company', 'package.json')) ||
    fs.existsSync(path.join(dir, '.git'))
  )
}

export function resolveRepositoryRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir)
  for (let depth = 0; depth < 12; depth += 1) {
    if (isRepositoryRoot(current)) return current
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return path.resolve(startDir)
}

export function getConnectionsBridgeConfig(): ConnectionsBridgeConfig {
  const port = Number.parseInt(
    process.env.CONNECTIONS_BRIDGE_PORT ?? String(CONNECTIONS_BRIDGE_DEFAULT_PORT),
    10,
  )
  return {
    host: process.env.CONNECTIONS_BRIDGE_HOST ?? CONNECTIONS_BRIDGE_DEFAULT_HOST,
    port: Number.isFinite(port) ? port : CONNECTIONS_BRIDGE_DEFAULT_PORT,
    repositoryRoot: path.resolve(process.env.AI_COMPANY_REPO_ROOT ?? resolveRepositoryRoot()),
    ephemeralSecrets: true,
  }
}
