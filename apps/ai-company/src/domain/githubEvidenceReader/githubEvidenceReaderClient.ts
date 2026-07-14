/**
 * GitHub Evidence Reader — browser client via trusted local bridge (AI-COMPANY-114).
 */

import { resolveGitHubEvidenceBridgeBaseUrl } from './githubEvidenceReaderConfig'
import { redactGitHubSecret } from './githubEvidenceSecretRedaction'
import type {
  GitHubExecutionEvidenceResult,
  ResolveGitHubExecutionEvidenceInput,
} from './githubEvidenceReaderTypes'

export async function probeGitHubEvidenceBridge(): Promise<boolean> {
  try {
    const response = await fetch(`${resolveGitHubEvidenceBridgeBaseUrl()}/v1/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function resolveGitHubExecutionEvidenceViaBridge(
  input: ResolveGitHubExecutionEvidenceInput,
): Promise<GitHubExecutionEvidenceResult> {
  const checkedAt = new Date().toISOString()
  try {
    const response = await fetch(`${resolveGitHubEvidenceBridgeBaseUrl()}/v1/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      let message = `GitHub evidence bridge failed (${response.status}).`
      try {
        const body = (await response.json()) as { error?: string }
        if (body.error) message = redactGitHubSecret(body.error)
      } catch {
        // ignore
      }

      if (response.status === 401 || response.status === 403) {
        return pendingResult('GITHUB_ACCESS_DENIED', message, checkedAt)
      }
      if (response.status === 429) {
        return pendingResult('GITHUB_RATE_LIMITED', message, checkedAt)
      }
      if (response.status === 503) {
        return pendingResult('GITHUB_AUTH_UNAVAILABLE', message, checkedAt)
      }
      return pendingResult('GITHUB_TRANSPORT_ERROR', message, checkedAt)
    }

    const body = (await response.json()) as GitHubExecutionEvidenceResult
    return body
  } catch (error) {
    const message = redactGitHubSecret(error instanceof Error ? error.message : 'Bridge offline.')
    return pendingResult(
      'GITHUB_TRANSPORT_ERROR',
      `${message} — run npm --prefix apps/ai-company run github:evidence`,
      checkedAt,
    )
  }
}

function pendingResult(
  reasonCode: GitHubExecutionEvidenceResult['reasonCode'],
  message: string,
  checkedAt: string,
): GitHubExecutionEvidenceResult {
  return {
    status: 'PENDING',
    marker: null,
    branch: null,
    commitSha: null,
    pullRequestUrl: null,
    changedFiles: [],
    checks: [],
    reportedChecks: [],
    verifiedChecks: [],
    errors: [{ code: reasonCode, message, source: 'transport', terminal: false }],
    evidence: [],
    reasonCode,
    checkedAt,
  }
}
