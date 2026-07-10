/**
 * Cursor Local Bridge — configuration (AI-COMPANY-113E).
 * Same-machine only: 127.0.0.1, relative paths, env overrides.
 */

import fs from 'node:fs'
import path from 'node:path'

export const CURSOR_BRIDGE_DEFAULT_HOST = '127.0.0.1'

export const CURSOR_BRIDGE_DEFAULT_PORT = 17319

export const CURSOR_LOCAL_INBOX_RELATIVE = '.ai-company/cursor-inbox'

export const CURSOR_LOCAL_OUTBOX_RELATIVE = '.ai-company/cursor-outbox'

export const CURSOR_BRIDGE_STATE_RELATIVE = '.ai-company/cursor-bridge'

export type CursorBridgeConfig = {
  host: string
  port: number
  repositoryRoot: string
  inboxDir: string
  outboxDir: string
  bridgeDir: string
  pendingDir: string
  stateFile: string
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

export function getCursorBridgeConfig(overrides: Partial<{ repositoryRoot: string }> = {}): CursorBridgeConfig {
  const repositoryRoot = path.resolve(
    overrides.repositoryRoot ??
      process.env.AI_COMPANY_REPO_ROOT ??
      resolveRepositoryRoot(),
  )
  const bridgeDir = path.join(repositoryRoot, CURSOR_BRIDGE_STATE_RELATIVE)
  const port = Number.parseInt(
    process.env.AI_COMPANY_CURSOR_BRIDGE_PORT ?? String(CURSOR_BRIDGE_DEFAULT_PORT),
    10,
  )

  return {
    host: process.env.AI_COMPANY_CURSOR_BRIDGE_HOST ?? CURSOR_BRIDGE_DEFAULT_HOST,
    port: Number.isFinite(port) ? port : CURSOR_BRIDGE_DEFAULT_PORT,
    repositoryRoot,
    inboxDir: path.join(repositoryRoot, CURSOR_LOCAL_INBOX_RELATIVE),
    outboxDir: path.join(repositoryRoot, CURSOR_LOCAL_OUTBOX_RELATIVE),
    bridgeDir,
    pendingDir: path.join(bridgeDir, 'pending'),
    stateFile: path.join(bridgeDir, 'state.json'),
  }
}
