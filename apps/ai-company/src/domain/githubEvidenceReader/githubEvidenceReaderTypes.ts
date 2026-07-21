/**
 * GitHub Evidence Reader — types (AI-COMPANY-114).
 */

import type { CursorAutomationResultMarker } from '../cursorAutomationRunner/cursorAutomationRunnerTypes'
import type { CursorCheckResult, CursorExecutionError } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'

export const GITHUB_EVIDENCE_STATUSES = [
  'NOT_FOUND',
  'PENDING',
  'FOUND',
  'INVALID',
  'FAILED',
] as const

export type GitHubEvidenceStatus = (typeof GITHUB_EVIDENCE_STATUSES)[number]

export const GITHUB_EVIDENCE_REASON_CODES = [
  'MARKER_NOT_FOUND',
  'MARKER_FOUND',
  'MARKER_INVALID',
  'RUN_ID_MISMATCH',
  'BRANCH_NOT_FOUND',
  'COMMIT_NOT_FOUND',
  'COMMIT_BRANCH_MISMATCH',
  'PR_NOT_FOUND',
  'PR_REPOSITORY_MISMATCH',
  'PR_BRANCH_MISMATCH',
  'CHANGED_FILES_MISMATCH',
  'EVIDENCE_INCOMPLETE',
  'EVIDENCE_VERIFIED',
  'GITHUB_AUTH_UNAVAILABLE',
  'GITHUB_ACCESS_DENIED',
  'GITHUB_RATE_LIMITED',
  'GITHUB_TRANSPORT_ERROR',
  'GITHUB_REPO_NOT_FOUND',
  'REPOSITORY_NOT_ALLOWED',
  'REPOSITORY_INVALID',
  'PROTECTED_BRANCH_REJECTED',
  'BRANCH_PREFIX_MISMATCH',
  'INVALID_COMMIT_SHA',
  'COMMIT_BEFORE_DISPATCH',
  'MERGED_PR_REJECTED',
] as const

export type GitHubEvidenceReasonCode = (typeof GITHUB_EVIDENCE_REASON_CODES)[number]

export type GitHubRepositoryRef = {
  owner: string
  name: string
}

export type GitHubEvidenceItemType =
  | 'BRANCH'
  | 'COMMIT'
  | 'PULL_REQUEST'
  | 'MARKER'
  | 'CHECK'

export type GitHubEvidenceItem = {
  type: GitHubEvidenceItemType
  reference: string
  verified: boolean
  details: Record<string, unknown>
}

export type ResolveGitHubExecutionEvidenceInput = {
  toolExecutionRunId: string
  repository: GitHubRepositoryRef | string
  baseBranch: string
  branchPrefix: string
  resultMarkerPath: string
  externalCorrelationId: string | null
  dispatchedAt: string
  requiresPullRequest?: boolean
  expectedBranch?: string | null
}

export type GitHubExecutionEvidenceResult = {
  status: GitHubEvidenceStatus
  marker: CursorAutomationResultMarker | null
  branch: string | null
  commitSha: string | null
  pullRequestUrl: string | null
  changedFiles: string[]
  checks: CursorCheckResult[]
  reportedChecks: CursorCheckResult[]
  verifiedChecks: CursorCheckResult[]
  errors: CursorExecutionError[]
  evidence: GitHubEvidenceItem[]
  reasonCode: GitHubEvidenceReasonCode
  checkedAt: string
}

export type GitHubEvidenceTransportBranch = {
  name: string
  updatedAt: string | null
}

export type GitHubEvidenceTransportPullRequest = {
  url: string
  number: number
  state: string
  headBranch: string
  baseBranch: string
  merged: boolean
  draft: boolean
}

export type GitHubEvidenceTransportCheckRun = {
  name: string
  status: string
  conclusion: string | null
}

export type GitHubEvidenceTransportSnapshot = {
  authAvailable: boolean
  accessDenied: boolean
  rateLimited: boolean
  transportError: string | null
  branches: GitHubEvidenceTransportBranch[]
  markerBranch: string | null
  markerContent: string | null
  commitExists: boolean
  commitOnBranch: boolean
  commitTimestamp: string | null
  commitChangedFiles: string[]
  pullRequest: GitHubEvidenceTransportPullRequest | null
  checkRuns: GitHubEvidenceTransportCheckRun[]
}

export type GitHubEvidenceReaderConfig = {
  mode: 'gh_cli' | 'git' | 'github_api'
  repositoryAllowlist: string[]
  maxBranches: number
  branchPrefix: string
  clockSkewMs: number
}

export type GitHubEvidenceTransportRequest = {
  repository: GitHubRepositoryRef
  branchPrefix: string
  resultMarkerPath: string
  maxBranches: number
  dispatchedAt: string
  expectedBranch: string | null
  expectedCommitSha: string | null
  pullRequestUrl: string | null
}

export type GitHubEvidenceTransport = {
  fetchSnapshot: (request: GitHubEvidenceTransportRequest) => Promise<GitHubEvidenceTransportSnapshot>
}

export type GitHubEvidenceReaderEventType =
  | 'github_evidence_check_started'
  | 'github_evidence_marker_not_found'
  | 'github_evidence_marker_found'
  | 'github_evidence_verified'
  | 'github_evidence_invalid'
  | 'github_evidence_auth_failed'
  | 'github_evidence_transport_failed'
  | 'github_evidence_reconciliation_completed'

export type GitHubEvidenceReaderEvent = {
  type: GitHubEvidenceReaderEventType
  at: string
  toolExecutionRunId: string
  reasonCode: GitHubEvidenceReasonCode | string
  metadata?: Record<string, unknown>
}
