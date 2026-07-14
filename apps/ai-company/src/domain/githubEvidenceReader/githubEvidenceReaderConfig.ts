/**
 * GitHub Evidence Reader — browser-safe config (AI-COMPANY-114).
 * Secrets (GITHUB_TOKEN) are server-side only — never read here.
 */

import type { GitHubEvidenceReaderConfig } from './githubEvidenceReaderTypes'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readAllowlist(): string[] {
  const raw = readEnv('VITE_GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST')
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function resolveGitHubEvidenceReaderConfig(
  partial?: Partial<GitHubEvidenceReaderConfig>,
): GitHubEvidenceReaderConfig {
  const modeRaw = readEnv('VITE_GITHUB_EVIDENCE_READER_MODE')?.toLowerCase()
  const mode =
    modeRaw === 'git' || modeRaw === 'github_api' || modeRaw === 'gh_cli' ? modeRaw : 'gh_cli'

  const maxBranchesRaw = Number.parseInt(readEnv('VITE_GITHUB_EVIDENCE_MAX_BRANCHES') ?? '20', 10)

  return {
    mode: partial?.mode ?? mode,
    repositoryAllowlist: partial?.repositoryAllowlist ?? readAllowlist(),
    maxBranches: partial?.maxBranches ?? (Number.isFinite(maxBranchesRaw) ? maxBranchesRaw : 20),
    branchPrefix: partial?.branchPrefix ?? readEnv('VITE_GITHUB_EVIDENCE_BRANCH_PREFIX') ?? 'cursor/',
    clockSkewMs: partial?.clockSkewMs ?? 5 * 60 * 1000,
  }
}

export const GITHUB_EVIDENCE_BRIDGE_DEFAULT_HOST = '127.0.0.1'
export const GITHUB_EVIDENCE_BRIDGE_DEFAULT_PORT = 17320

export function resolveGitHubEvidenceBridgeBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/runtime/github-evidence`
  }
  const host = readEnv('VITE_GITHUB_EVIDENCE_BRIDGE_HOST') ?? GITHUB_EVIDENCE_BRIDGE_DEFAULT_HOST
  const port = readEnv('VITE_GITHUB_EVIDENCE_BRIDGE_PORT') ?? String(GITHUB_EVIDENCE_BRIDGE_DEFAULT_PORT)
  return `http://${host}:${port}`
}
