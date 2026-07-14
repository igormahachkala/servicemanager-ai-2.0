/**
 * GitHub Evidence Reader — repository parsing (AI-COMPANY-114).
 */

import type { GitHubRepositoryRef } from './githubEvidenceReaderTypes'

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export function parseGitHubRepositoryRef(
  raw: string | GitHubRepositoryRef,
): { ok: true; repository: GitHubRepositoryRef } | { ok: false; message: string } {
  if (typeof raw === 'object' && raw !== null && typeof raw.owner === 'string' && typeof raw.name === 'string') {
    const owner = raw.owner.trim()
    const name = raw.name.trim()
    if (!owner || !name) return { ok: false, message: 'Repository owner and name are required.' }
    return { ok: true, repository: { owner, name } }
  }

  const value = String(raw).trim()
  if (!REPOSITORY_PATTERN.test(value)) {
    return { ok: false, message: `Invalid repository format: ${value}` }
  }

  const [owner, name] = value.split('/')
  return { ok: true, repository: { owner, name } }
}

export function formatGitHubRepositoryRef(repository: GitHubRepositoryRef): string {
  return `${repository.owner}/${repository.name}`
}

export function isRepositoryAllowlisted(
  repository: GitHubRepositoryRef,
  allowlist: string[],
): boolean {
  if (allowlist.length === 0) return true
  const key = formatGitHubRepositoryRef(repository).toLowerCase()
  return allowlist.some((item) => item.trim().toLowerCase() === key)
}

export function parsePullRequestRef(
  url: string,
  repository: GitHubRepositoryRef,
): { ok: true; number: number } | { ok: false } {
  const pattern = new RegExp(
    `^https://github\\.com/${repository.owner}/${repository.name}/pull/(\\d+)$`,
    'i',
  )
  const match = url.trim().match(pattern)
  if (!match) return { ok: false }
  return { ok: true, number: Number.parseInt(match[1], 10) }
}
