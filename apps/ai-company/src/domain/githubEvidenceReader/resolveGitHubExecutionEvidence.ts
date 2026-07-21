/**
 * GitHub Evidence Reader — resolveGitHubExecutionEvidence() (AI-COMPANY-114).
 */

import type { CursorExecutionError } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import { formatGitHubRepositoryRef, isRepositoryAllowlisted, parseGitHubRepositoryRef } from './githubEvidenceRepository'
import { resolveGitHubEvidenceReaderConfig } from './githubEvidenceReaderConfig'
import { createGitHubEvidenceReaderEvent } from './githubEvidenceReaderObservability'
import type {
  GitHubEvidenceReaderEvent,
  GitHubEvidenceTransport,
  GitHubEvidenceTransportSnapshot,
  GitHubExecutionEvidenceResult,
  ResolveGitHubExecutionEvidenceInput,
} from './githubEvidenceReaderTypes'
import { verifyGitHubEvidence } from './githubEvidenceVerification'

export type ResolveGitHubExecutionEvidenceDeps = {
  transport: GitHubEvidenceTransport
  logEvent?: (event: GitHubEvidenceReaderEvent) => void
  now?: () => string
  config?: ReturnType<typeof resolveGitHubEvidenceReaderConfig>
}

function toExecutionErrors(errors: Array<{ code: string; message: string }>): CursorExecutionError[] {
  return errors.map((error) => ({
    code: error.code,
    message: error.message,
    source: 'execution' as const,
    terminal: true,
  }))
}

function mapStatus(
  valid: boolean,
  markerStatus: 'SUCCEEDED' | 'FAILED' | null,
  reasonCode: string,
  hasMarker: boolean,
): GitHubExecutionEvidenceResult['status'] {
  if (!hasMarker) {
    if (
      reasonCode === 'GITHUB_AUTH_UNAVAILABLE' ||
      reasonCode === 'GITHUB_TRANSPORT_ERROR' ||
      reasonCode === 'GITHUB_RATE_LIMITED'
    ) {
      return 'PENDING'
    }
    return 'NOT_FOUND'
  }
  if (!valid) return 'INVALID'
  if (markerStatus === 'FAILED') return 'FAILED'
  if (markerStatus === 'SUCCEEDED') return 'FOUND'
  return 'PENDING'
}

export async function resolveGitHubExecutionEvidence(
  input: ResolveGitHubExecutionEvidenceInput,
  deps: ResolveGitHubExecutionEvidenceDeps,
): Promise<GitHubExecutionEvidenceResult> {
  const checkedAt = deps.now?.() ?? new Date().toISOString()
  const config = deps.config ?? resolveGitHubEvidenceReaderConfig()
  const log = deps.logEvent ?? (() => {})

  log(
    createGitHubEvidenceReaderEvent(
      'github_evidence_check_started',
      input.toolExecutionRunId,
      'MARKER_NOT_FOUND',
      { repository: input.repository },
    ),
  )

  const parsedRepo = parseGitHubRepositoryRef(input.repository)
  if (!parsedRepo.ok) {
    return {
      status: 'INVALID',
      marker: null,
      branch: null,
      commitSha: null,
      pullRequestUrl: null,
      changedFiles: [],
      checks: [],
      reportedChecks: [],
      verifiedChecks: [],
      errors: [{ code: 'REPOSITORY_INVALID', message: parsedRepo.message, source: 'execution', terminal: true }],
      evidence: [],
      reasonCode: 'REPOSITORY_INVALID',
      checkedAt,
    }
  }

  if (!isRepositoryAllowlisted(parsedRepo.repository, config.repositoryAllowlist)) {
    return {
      status: 'INVALID',
      marker: null,
      branch: null,
      commitSha: null,
      pullRequestUrl: null,
      changedFiles: [],
      checks: [],
      reportedChecks: [],
      verifiedChecks: [],
      errors: [
        {
          code: 'REPOSITORY_NOT_ALLOWED',
          message: `Repository ${formatGitHubRepositoryRef(parsedRepo.repository)} is not allowlisted.`,
          source: 'execution',
          terminal: true,
        },
      ],
      evidence: [],
      reasonCode: 'REPOSITORY_NOT_ALLOWED',
      checkedAt,
    }
  }

  const expectedBranch = input.expectedBranch?.trim() || null

  let snapshot: GitHubEvidenceTransportSnapshot
  try {
    snapshot = await deps.transport.fetchSnapshot({
      repository: parsedRepo.repository,
      branchPrefix: input.branchPrefix || config.branchPrefix,
      resultMarkerPath: input.resultMarkerPath,
      maxBranches: config.maxBranches,
      dispatchedAt: input.dispatchedAt,
      expectedBranch,
      expectedCommitSha: null,
      pullRequestUrl: null,
    })
  } catch (error) {
    const errorCode = (error as { code?: number }).code
    const errorMessage = error instanceof Error ? error.message : ''
    const reasonCode =
      errorCode === 404 || errorMessage === 'repo_not_found'
        ? 'GITHUB_REPO_NOT_FOUND'
        : errorCode === 403 || errorMessage === 'access_denied'
          ? 'GITHUB_ACCESS_DENIED'
          : errorCode === 429 || errorMessage === 'rate_limited'
            ? 'GITHUB_RATE_LIMITED'
            : 'GITHUB_TRANSPORT_ERROR'
    const message =
      reasonCode === 'GITHUB_REPO_NOT_FOUND'
        ? 'GitHub repository not found.'
        : reasonCode === 'GITHUB_ACCESS_DENIED'
          ? 'GitHub access denied for evidence reader.'
          : reasonCode === 'GITHUB_RATE_LIMITED'
            ? 'GitHub API rate limit reached.'
            : error instanceof Error
              ? error.message
              : 'GitHub transport failed.'
    log(
      createGitHubEvidenceReaderEvent(
        'github_evidence_transport_failed',
        input.toolExecutionRunId,
        reasonCode,
        { message },
      ),
    )
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

  if (snapshot.accessDenied) {
    log(
      createGitHubEvidenceReaderEvent(
        'github_evidence_auth_failed',
        input.toolExecutionRunId,
        'GITHUB_ACCESS_DENIED',
      ),
    )
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
      errors: [
        {
          code: 'GITHUB_ACCESS_DENIED',
          message: 'GitHub access denied for evidence reader.',
          source: 'transport',
          terminal: false,
        },
      ],
      evidence: [],
      reasonCode: 'GITHUB_ACCESS_DENIED',
      checkedAt,
    }
  }

  if (!snapshot.authAvailable) {
    log(
      createGitHubEvidenceReaderEvent(
        'github_evidence_auth_failed',
        input.toolExecutionRunId,
        'GITHUB_AUTH_UNAVAILABLE',
      ),
    )
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
      errors: [
        {
          code: 'GITHUB_AUTH_UNAVAILABLE',
          message: 'GitHub auth is unavailable — run gh auth login or configure server token.',
          source: 'transport',
          terminal: false,
        },
      ],
      evidence: [],
      reasonCode: 'GITHUB_AUTH_UNAVAILABLE',
      checkedAt,
    }
  }

  if (snapshot.rateLimited) {
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
      errors: [
        {
          code: 'GITHUB_RATE_LIMITED',
          message: 'GitHub API rate limit reached.',
          source: 'transport',
          terminal: false,
        },
      ],
      evidence: [],
      reasonCode: 'GITHUB_RATE_LIMITED',
      checkedAt,
    }
  }

  if (!snapshot.markerContent) {
    log(
      createGitHubEvidenceReaderEvent(
        'github_evidence_marker_not_found',
        input.toolExecutionRunId,
        'MARKER_NOT_FOUND',
      ),
    )
    return {
      status: 'NOT_FOUND',
      marker: null,
      branch: null,
      commitSha: null,
      pullRequestUrl: null,
      changedFiles: [],
      checks: [],
      reportedChecks: [],
      verifiedChecks: [],
      errors: [],
      evidence: [],
      reasonCode: 'MARKER_NOT_FOUND',
      checkedAt,
    }
  }

  log(
    createGitHubEvidenceReaderEvent(
      'github_evidence_marker_found',
      input.toolExecutionRunId,
      'MARKER_FOUND',
      { branch: snapshot.markerBranch },
    ),
  )

  const verification = verifyGitHubEvidence({
    toolExecutionRunId: input.toolExecutionRunId,
    repository: parsedRepo.repository,
    baseBranch: input.baseBranch,
    branchPrefix: input.branchPrefix || config.branchPrefix,
    resultMarkerPath: input.resultMarkerPath,
    dispatchedAt: input.dispatchedAt,
    requiresPullRequest: input.requiresPullRequest === true,
    markerContent: snapshot.markerContent,
    markerBranch: snapshot.markerBranch,
    snapshot,
    clockSkewMs: config.clockSkewMs,
  })

  const status = mapStatus(
    verification.valid,
    verification.marker?.status ?? null,
    verification.reasonCode,
    Boolean(snapshot.markerContent),
  )

  if (verification.valid) {
    log(
      createGitHubEvidenceReaderEvent(
        'github_evidence_verified',
        input.toolExecutionRunId,
        'EVIDENCE_VERIFIED',
        { branch: verification.marker?.branch },
      ),
    )
  } else if (status === 'INVALID') {
    log(
      createGitHubEvidenceReaderEvent(
        'github_evidence_invalid',
        input.toolExecutionRunId,
        verification.reasonCode,
        { errors: verification.errors },
      ),
    )
  }

  log(
    createGitHubEvidenceReaderEvent(
      'github_evidence_reconciliation_completed',
      input.toolExecutionRunId,
      verification.reasonCode,
      { status },
    ),
  )

  return {
    status,
    marker: verification.marker,
    branch: verification.marker?.branch ?? snapshot.markerBranch,
    commitSha: verification.marker?.commitSha ?? null,
    pullRequestUrl: verification.marker?.pullRequestUrl ?? null,
    changedFiles: verification.changedFiles,
    checks: verification.reportedChecks,
    reportedChecks: verification.reportedChecks,
    verifiedChecks: verification.verifiedChecks,
    errors: toExecutionErrors(verification.errors),
    evidence: verification.evidence,
    reasonCode: verification.reasonCode,
    checkedAt,
  }
}
