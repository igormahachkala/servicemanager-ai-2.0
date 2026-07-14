/**
 * GitHub Evidence Bridge — GitHub REST API transport (AI-COMPANY-114).
 */

import type { GitHubEvidenceBridgeConfig } from '../config.ts'
import { buildTransportSnapshot } from '../snapshotBuilder.ts'
import type {
  GitHubEvidenceTransport,
  GitHubEvidenceTransportBranch,
  GitHubEvidenceTransportCheckRun,
  GitHubEvidenceTransportPullRequest,
  GitHubEvidenceTransportRequest,
} from '../../../../src/domain/githubEvidenceReader/githubEvidenceReaderTypes.ts'

const API_BASE = 'https://api.github.com'

async function githubFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  })
  const body = await response.text()
  return { ok: response.ok, status: response.status, body }
}

export function createGithubApiTransport(config: GitHubEvidenceBridgeConfig): GitHubEvidenceTransport {
  return {
    fetchSnapshot: async (request: GitHubEvidenceTransportRequest) => {
      const token = config.githubToken
      if (!token) {
        return buildTransportSnapshot(request, {
          authAvailable: false,
          accessDenied: false,
          rateLimited: false,
          transportError: 'auth_unavailable',
          listBranches: async () => [],
          fetchFileAtRef: async () => null,
          fetchCommitOnBranch: async () => ({
            exists: false,
            onBranch: false,
            timestamp: null,
            changedFiles: [],
          }),
          fetchPullRequest: async () => null,
          fetchCheckRuns: async () => [],
        })
      }

      const owner = request.repository.owner
      const name = request.repository.name
      const base = `/repos/${owner}/${name}`

      return buildTransportSnapshot(request, {
        authAvailable: true,
        accessDenied: false,
        rateLimited: false,
        transportError: null,

        listBranches: async () => {
          const result = await githubFetch(token, `${base}/branches?per_page=100`)
          if (result.status === 401 || result.status === 403) {
            throw Object.assign(new Error('access_denied'), { code: result.status })
          }
          if (result.status === 429) {
            throw Object.assign(new Error('rate_limited'), { code: 429 })
          }
          if (!result.ok) return []
          try {
            const parsed = JSON.parse(result.body) as Array<{
              name: string
              commit?: { commit?: { committer?: { date?: string } } }
            }>
            return parsed.map(
              (item): GitHubEvidenceTransportBranch => ({
                name: item.name,
                updatedAt: item.commit?.commit?.committer?.date ?? null,
              }),
            )
          } catch {
            return []
          }
        },

        fetchFileAtRef: async (ref, path) => {
          const encodedPath = path
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/')
          const result = await githubFetch(token, `${base}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`)
          if (!result.ok) return null
          try {
            const parsed = JSON.parse(result.body) as { content?: string; encoding?: string }
            if (parsed.encoding !== 'base64' || !parsed.content) return null
            return Buffer.from(parsed.content.replace(/\n/g, ''), 'base64').toString('utf8')
          } catch {
            return null
          }
        },

        fetchCommitOnBranch: async (sha, branch) => {
          const commitResult = await githubFetch(token, `${base}/commits/${sha}`)
          if (!commitResult.ok) {
            return { exists: false, onBranch: false, timestamp: null, changedFiles: [] }
          }
          let commitJson: {
            commit?: { committer?: { date?: string } }
            files?: Array<{ filename?: string }>
          }
          try {
            commitJson = JSON.parse(commitResult.body)
          } catch {
            return { exists: false, onBranch: false, timestamp: null, changedFiles: [] }
          }

          const compare = await githubFetch(
            token,
            `${base}/compare/${encodeURIComponent(branch)}...${sha}`,
          )
          let onBranch = false
          if (compare.ok) {
            try {
              const compareJson = JSON.parse(compare.body) as { status?: string }
              onBranch = compareJson.status === 'behind' || compareJson.status === 'identical'
            } catch {
              onBranch = false
            }
          }

          const changedFiles = (commitJson.files ?? [])
            .map((file) => file.filename)
            .filter((file): file is string => typeof file === 'string')

          return {
            exists: true,
            onBranch,
            timestamp: commitJson.commit?.committer?.date ?? null,
            changedFiles,
          }
        },

        fetchPullRequest: async (prOwner, prName, number) => {
          const result = await githubFetch(token, `/repos/${prOwner}/${prName}/pulls/${number}`)
          if (!result.ok) return null
          try {
            const pr = JSON.parse(result.body) as {
              html_url?: string
              number?: number
              state?: string
              merged_at?: string | null
              draft?: boolean
              head?: { ref?: string }
              base?: { ref?: string }
            }
            if (!pr.html_url || typeof pr.number !== 'number') return null
            return {
              url: pr.html_url,
              number: pr.number,
              state: (pr.state ?? 'open').toUpperCase(),
              headBranch: pr.head?.ref ?? '',
              baseBranch: pr.base?.ref ?? '',
              merged: Boolean(pr.merged_at),
              draft: pr.draft === true,
            } satisfies GitHubEvidenceTransportPullRequest
          } catch {
            return null
          }
        },

        fetchCheckRuns: async (sha) => {
          const result = await githubFetch(token, `${base}/commits/${sha}/check-runs`)
          if (!result.ok) return []
          try {
            const parsed = JSON.parse(result.body) as {
              check_runs?: Array<{ name?: string; status?: string; conclusion?: string | null }>
            }
            return (parsed.check_runs ?? [])
              .filter((run): run is { name: string; status: string; conclusion: string | null } =>
                Boolean(run.name && run.status),
              )
              .map(
                (run): GitHubEvidenceTransportCheckRun => ({
                  name: run.name,
                  status: run.status,
                  conclusion: run.conclusion,
                }),
              )
          } catch {
            return []
          }
        },
      })
    },
  }
}
