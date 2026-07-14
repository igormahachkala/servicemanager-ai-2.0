/**
 * GitHub Evidence Bridge — shared snapshot builder (AI-COMPANY-114).
 */

import type {
  GitHubEvidenceTransportBranch,
  GitHubEvidenceTransportCheckRun,
  GitHubEvidenceTransportPullRequest,
  GitHubEvidenceTransportRequest,
  GitHubEvidenceTransportSnapshot,
} from '../../../src/domain/githubEvidenceReader/githubEvidenceReaderTypes.ts'

export type SnapshotFetcherDeps = {
  authAvailable: boolean
  accessDenied: boolean
  rateLimited: boolean
  transportError: string | null
  listBranches: (request: GitHubEvidenceTransportRequest) => Promise<GitHubEvidenceTransportBranch[]>
  fetchFileAtRef: (ref: string, path: string) => Promise<string | null>
  fetchCommitOnBranch: (
    sha: string,
    branch: string,
  ) => Promise<{
    exists: boolean
    onBranch: boolean
    timestamp: string | null
    changedFiles: string[]
  }>
  fetchPullRequest: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<GitHubEvidenceTransportPullRequest | null>
  fetchCheckRuns: (sha: string) => Promise<GitHubEvidenceTransportCheckRun[]>
}

function filterBranches(
  branches: GitHubEvidenceTransportBranch[],
  request: GitHubEvidenceTransportRequest,
): GitHubEvidenceTransportBranch[] {
  const dispatchedAt = Date.parse(request.dispatchedAt)
  const prefixed = branches.filter((branch) => branch.name.startsWith(request.branchPrefix))

  const afterDispatch = prefixed.filter((branch) => {
    if (!branch.updatedAt) return true
    const updated = Date.parse(branch.updatedAt)
    if (!Number.isFinite(dispatchedAt) || !Number.isFinite(updated)) return true
    return updated >= dispatchedAt
  })

  const ordered = [...afterDispatch]
  if (request.expectedBranch) {
    const idx = ordered.findIndex((branch) => branch.name === request.expectedBranch)
    if (idx > 0) {
      const [item] = ordered.splice(idx, 1)
      ordered.unshift(item)
    } else if (idx < 0 && request.expectedBranch.startsWith(request.branchPrefix)) {
      ordered.unshift({ name: request.expectedBranch, updatedAt: null })
    }
  }

  return ordered.slice(0, request.maxBranches)
}

function parseMarkerFields(content: string): {
  commitSha: string | null
  branch: string | null
  pullRequestUrl: string | null
} {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    return {
      commitSha: typeof parsed.commitSha === 'string' ? parsed.commitSha : null,
      branch: typeof parsed.branch === 'string' ? parsed.branch : null,
      pullRequestUrl:
        typeof parsed.pullRequestUrl === 'string' ? parsed.pullRequestUrl : null,
    }
  } catch {
    return { commitSha: null, branch: null, pullRequestUrl: null }
  }
}

function parsePullRequestNumber(url: string, owner: string, repo: string): number | null {
  const pattern = new RegExp(`^https://github\\.com/${owner}/${repo}/pull/(\\d+)$`, 'i')
  const match = url.trim().match(pattern)
  if (!match) return null
  return Number.parseInt(match[1], 10)
}

export async function buildTransportSnapshot(
  request: GitHubEvidenceTransportRequest,
  deps: SnapshotFetcherDeps,
): Promise<GitHubEvidenceTransportSnapshot> {
  const base: GitHubEvidenceTransportSnapshot = {
    authAvailable: deps.authAvailable,
    accessDenied: deps.accessDenied,
    rateLimited: deps.rateLimited,
    transportError: deps.transportError,
    branches: [],
    markerBranch: null,
    markerContent: null,
    commitExists: false,
    commitOnBranch: false,
    commitTimestamp: null,
    commitChangedFiles: [],
    pullRequest: null,
    checkRuns: [],
  }

  if (!deps.authAvailable || deps.accessDenied || deps.rateLimited) {
    return base
  }

  const branches = filterBranches(await deps.listBranches(request), request)
  base.branches = branches

  for (const branch of branches) {
    const content = await deps.fetchFileAtRef(branch.name, request.resultMarkerPath)
    if (content) {
      base.markerBranch = branch.name
      base.markerContent = content
      break
    }
  }

  if (!base.markerContent) {
    return base
  }

  const markerFields = parseMarkerFields(base.markerContent)
  const commitSha = markerFields.commitSha ?? request.expectedCommitSha
  const branchName = markerFields.branch ?? base.markerBranch

  if (!commitSha || !branchName) {
    return base
  }

  const commit = await deps.fetchCommitOnBranch(commitSha, branchName)
  base.commitExists = commit.exists
  base.commitOnBranch = commit.onBranch
  base.commitTimestamp = commit.timestamp
  base.commitChangedFiles = commit.changedFiles

  if (markerFields.pullRequestUrl) {
    const number = parsePullRequestNumber(
      markerFields.pullRequestUrl,
      request.repository.owner,
      request.repository.name,
    )
    if (number !== null) {
      base.pullRequest = await deps.fetchPullRequest(
        request.repository.owner,
        request.repository.name,
        number,
      )
    }
  } else if (request.pullRequestUrl) {
    const number = parsePullRequestNumber(
      request.pullRequestUrl,
      request.repository.owner,
      request.repository.name,
    )
    if (number !== null) {
      base.pullRequest = await deps.fetchPullRequest(
        request.repository.owner,
        request.repository.name,
        number,
      )
    }
  }

  if (commitSha && commit.exists) {
    base.checkRuns = await deps.fetchCheckRuns(commitSha)
  }

  return base
}
