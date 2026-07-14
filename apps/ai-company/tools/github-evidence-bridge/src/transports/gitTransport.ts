/**
 * GitHub Evidence Bridge — git transport for local DEV repo (AI-COMPANY-114).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitHubEvidenceBridgeConfig } from '../config.ts'
import { buildTransportSnapshot } from '../snapshotBuilder.ts'
import type {
  GitHubEvidenceTransport,
  GitHubEvidenceTransportBranch,
  GitHubEvidenceTransportRequest,
} from '../../../../src/domain/githubEvidenceReader/githubEvidenceReaderTypes.ts'

const execFileAsync = promisify(execFile)

async function runGit(
  cwd: string,
  args: string[],
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    })
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString() }
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer }
    return {
      ok: false,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    }
  }
}

async function resolveRemoteRepository(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ['remote', 'get-url', 'origin'])
  if (!result.ok) return null
  const url = result.stdout.trim()
  const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`
  const httpsMatch = url.match(/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i)
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`
  return null
}

export function createGitTransport(config: GitHubEvidenceBridgeConfig): GitHubEvidenceTransport {
  return {
    fetchSnapshot: async (request: GitHubEvidenceTransportRequest) => {
      const cwd = config.repositoryRoot
      const remoteRepo = await resolveRemoteRepository(cwd)
      const requested = `${request.repository.owner}/${request.repository.name}`

      if (!remoteRepo || remoteRepo.toLowerCase() !== requested.toLowerCase()) {
        return buildTransportSnapshot(request, {
          authAvailable: false,
          accessDenied: false,
          rateLimited: false,
          transportError: 'local_repo_mismatch',
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

      return buildTransportSnapshot(request, {
        authAvailable: true,
        accessDenied: false,
        rateLimited: false,
        transportError: null,

        listBranches: async () => {
          const local = await runGit(cwd, ['branch', '--format=%(refname:short)|%(committerdate:iso-strict)'])
          const remote = await runGit(cwd, [
            'branch',
            '-r',
            '--format=%(refname:short)|%(committerdate:iso-strict)',
          ])
          const branches: GitHubEvidenceTransportBranch[] = []
          const lines = [...local.stdout.split('\n'), ...remote.stdout.split('\n')]
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const [rawName, updatedAt] = trimmed.split('|')
            const name = rawName.replace(/^origin\//, '')
            if (!name.startsWith(request.branchPrefix)) continue
            branches.push({ name, updatedAt: updatedAt ?? null })
          }
          return branches
        },

        fetchFileAtRef: async (ref, path) => {
          const result = await runGit(cwd, ['show', `${ref}:${path}`])
          if (!result.ok) {
            const remoteResult = await runGit(cwd, ['show', `origin/${ref}:${path}`])
            if (!remoteResult.ok) return null
            return remoteResult.stdout
          }
          return result.stdout
        },

        fetchCommitOnBranch: async (sha, branch) => {
          const cat = await runGit(cwd, ['cat-file', '-t', sha])
          if (!cat.ok || !cat.stdout.trim().startsWith('commit')) {
            return { exists: false, onBranch: false, timestamp: null, changedFiles: [] }
          }

          const mergeBase = await runGit(cwd, ['merge-base', '--is-ancestor', sha, branch])
          const onBranch = mergeBase.ok

          const show = await runGit(cwd, ['show', '--no-patch', '--format=%cI', sha])
          const timestamp = show.ok ? show.stdout.trim() || null : null

          const diff = await runGit(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
          const changedFiles = diff.ok
            ? diff.stdout
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            : []

          return { exists: true, onBranch, timestamp, changedFiles }
        },

        fetchPullRequest: async () => null,

        fetchCheckRuns: async () => [],
      })
    },
  }
}
