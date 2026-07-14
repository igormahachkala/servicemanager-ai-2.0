/**
 * GitHub Evidence Bridge — configuration (AI-COMPANY-114).
 * Server-side only — GITHUB_TOKEN never exposed to browser.
 */

import fs from 'node:fs'
import path from 'node:path'

export const GITHUB_EVIDENCE_BRIDGE_DEFAULT_HOST = '127.0.0.1'
export const GITHUB_EVIDENCE_BRIDGE_DEFAULT_PORT = 17320

export type GitHubEvidenceBridgeConfig = {
  host: string
  port: number
  mode: 'gh_cli' | 'git' | 'github_api'
  repositoryAllowlist: string[]
  maxBranches: number
  branchPrefix: string
  clockSkewMs: number
  githubToken: string | null
  repositoryRoot: string
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

function readAllowlist(): string[] {
  const raw = process.env.GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST ?? ''
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getGitHubEvidenceBridgeConfig(
  overrides: Partial<{ repositoryRoot: string }> = {},
): GitHubEvidenceBridgeConfig {
  const modeRaw = (process.env.GITHUB_EVIDENCE_READER_MODE ?? 'gh_cli').toLowerCase()
  const mode =
    modeRaw === 'git' || modeRaw === 'github_api' || modeRaw === 'gh_cli' ? modeRaw : 'gh_cli'

  const maxBranches = Number.parseInt(process.env.GITHUB_EVIDENCE_MAX_BRANCHES ?? '20', 10)
  const port = Number.parseInt(
    process.env.GITHUB_EVIDENCE_BRIDGE_PORT ?? String(GITHUB_EVIDENCE_BRIDGE_DEFAULT_PORT),
    10,
  )

  return {
    host: process.env.GITHUB_EVIDENCE_BRIDGE_HOST ?? GITHUB_EVIDENCE_BRIDGE_DEFAULT_HOST,
    port: Number.isFinite(port) ? port : GITHUB_EVIDENCE_BRIDGE_DEFAULT_PORT,
    mode,
    repositoryAllowlist: readAllowlist(),
    maxBranches: Number.isFinite(maxBranches) ? maxBranches : 20,
    branchPrefix: process.env.GITHUB_EVIDENCE_BRANCH_PREFIX ?? 'cursor/',
    clockSkewMs: 5 * 60 * 1000,
    githubToken: process.env.GITHUB_TOKEN?.trim() || null,
    repositoryRoot: path.resolve(
      overrides.repositoryRoot ?? process.env.AI_COMPANY_REPO_ROOT ?? resolveRepositoryRoot(),
    ),
  }
}
