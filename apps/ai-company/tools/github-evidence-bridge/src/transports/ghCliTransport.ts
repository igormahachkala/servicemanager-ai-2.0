/**
 * GitHub Evidence Bridge — gh CLI transport (AI-COMPANY-114).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitHubEvidenceBridgeConfig } from '../config.ts'
import { buildTransportSnapshot } from '../snapshotBuilder.ts'
import type {
  GitHubEvidenceTransport,
  GitHubEvidenceTransportBranch,
  GitHubEvidenceTransportCheckRun,
  GitHubEvidenceTransportPullRequest,
  GitHubEvidenceTransportRequest,
} from '../../../../src/domain/githubEvidenceReader/githubEvidenceReaderTypes.ts'

const execFileAsync = promisify(execFile)

async function runGh(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('gh', args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    })
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString(), code: 0 }
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; code?: number }
    return {
      ok: false,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      code: typeof err.code === 'number' ? err.code : 1,
    }
  }
}

async function checkGhAuth(): Promise<{ available: boolean; denied: boolean }> {
  const status = await runGh(['auth', 'status'])
  if (status.ok) return { available: true, denied: false }
  const text = `${status.stdout} ${status.stderr}`.toLowerCase()
  if (text.includes('not logged') || text.includes('no auth')) {
    return { available: false, denied: false }
  }
  if (text.includes('denied') || text.includes('forbidden') || status.code === 403) {
    return { available: false, denied: true }
  }
  return { available: false, denied: false }
}

function repoPath(owner: string, name: string): string {
  return `/repos/${owner}/${name}`
}

export function createGhCliTransport(config: GitHubEvidenceBridgeConfig): GitHubEvidenceTransport {
  return {
    fetchSnapshot: async (request: GitHubEvidenceTransportRequest) => {
      const auth = await checkGhAuth()
      if (!auth.available) {
        return buildTransportSnapshot(request, {
          authAvailable: false,
          accessDenied: auth.denied,
          rateLimited: false,
          transportError: auth.denied ? 'access_denied' : 'auth_unavailable',
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
      const base = repoPath(owner, name)

      return buildTransportSnapshot(request, {
        authAvailable: true,
        accessDenied: false,
        rateLimited: false,
        transportError: null,

        listBranches: async () => {
          const result = await runGh([
            'api',
            `${base}/branches`,
            '--paginate',
            '-q',
            '.[] | {name: .name, updatedAt: .commit.commit.committer.date}',
          ])
          if (!result.ok) {
            if (result.code === 403) throw Object.assign(new Error('access_denied'), { code: 403 })
            if (result.code === 429) throw Object.assign(new Error('rate_limited'), { code: 429 })
            return []
          }
          const branches: GitHubEvidenceTransportBranch[] = []
          for (const line of result.stdout.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const parsed = JSON.parse(trimmed) as { name?: string; updatedAt?: string }
              if (parsed.name) {
                branches.push({
                  name: parsed.name,
                  updatedAt: parsed.updatedAt ?? null,
                })
              }
            } catch {
              // gh -q may output single JSON array in some versions — try full parse
            }
          }
          if (branches.length === 0 && result.stdout.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(result.stdout) as Array<{
                name: string
                commit?: { commit?: { committer?: { date?: string } } }
              }>
              for (const item of parsed) {
                branches.push({
                  name: item.name,
                  updatedAt: item.commit?.commit?.committer?.date ?? null,
                })
              }
            } catch {
              // ignore
            }
          }
          return branches
        },

        fetchFileAtRef: async (ref, path) => {
          const result = await runGh([
            'api',
            `${base}/contents/${path}`,
            '-f',
            `ref=${ref}`,
            '-q',
            '.content',
          ])
          if (!result.ok) return null
          const encoded = result.stdout.trim().replace(/"/g, '')
          if (!encoded) return null
          try {
            return Buffer.from(encoded, 'base64').toString('utf8')
          } catch {
            return null
          }
        },

        fetchCommitOnBranch: async (sha, branch) => {
          const commitResult = await runGh(['api', `${base}/commits/${sha}`])
          if (!commitResult.ok) {
            return { exists: false, onBranch: false, timestamp: null, changedFiles: [] }
          }
          let commitJson: {
            commit?: { committer?: { date?: string } }
            files?: Array<{ filename?: string }>
          }
          try {
            commitJson = JSON.parse(commitResult.stdout)
          } catch {
            return { exists: false, onBranch: false, timestamp: null, changedFiles: [] }
          }

          const compare = await runGh(['api', `${base}/compare/${branch}...${sha}`, '-q', '.status'])
          const onBranch = compare.ok && compare.stdout.trim().includes('behind')

          const changedFiles = (commitJson.files ?? [])
            .map((file) => file.filename)
            .filter((file): file is string => typeof file === 'string')

          return {
            exists: true,
            onBranch: onBranch || compare.ok,
            timestamp: commitJson.commit?.committer?.date ?? null,
            changedFiles,
          }
        },

        fetchPullRequest: async (prOwner, prName, number) => {
          const result = await runGh(['api', repoPath(prOwner, prName) + `/pulls/${number}`])
          if (!result.ok) return null
          try {
            const pr = JSON.parse(result.stdout) as {
              html_url?: string
              number?: number
              state?: string
              merged?: boolean
              draft?: boolean
              head?: { ref?: string }
              base?: { ref?: string }
            }
            if (!pr.html_url || typeof pr.number !== 'number') return null
            return {
              url: pr.html_url,
              number: pr.number,
              state: (pr.state ?? 'OPEN').toUpperCase(),
              headBranch: pr.head?.ref ?? '',
              baseBranch: pr.base?.ref ?? '',
              merged: pr.merged === true,
              draft: pr.draft === true,
            } satisfies GitHubEvidenceTransportPullRequest
          } catch {
            return null
          }
        },

        fetchCheckRuns: async (sha) => {
          const result = await runGh([
            'api',
            `${base}/commits/${sha}/check-runs`,
            '-q',
            '.check_runs[] | {name: .name, status: .status, conclusion: .conclusion}',
          ])
          if (!result.ok) return []
          const runs: GitHubEvidenceTransportCheckRun[] = []
          for (const line of result.stdout.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const parsed = JSON.parse(trimmed) as GitHubEvidenceTransportCheckRun
              if (parsed.name) runs.push(parsed)
            } catch {
              // ignore line
            }
          }
          return runs
        },
      })
    },
  }
}
