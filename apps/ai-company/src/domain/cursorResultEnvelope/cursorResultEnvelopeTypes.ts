/**
 * Unified Cursor Result Envelope — domain contract (AI-COMPANY-110).
 * Separates transport, execution, review, repository artifacts, and pending state.
 */

import type { ExecutionRoute } from '../cursorExecutionRoute/cursorExecutionRouteTypes'

export const CURSOR_EXECUTION_STATUSES = [
  'RESULT_PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
] as const

export type CursorExecutionStatus = (typeof CURSOR_EXECUTION_STATUSES)[number]

export const CURSOR_TRANSPORT_STATUSES = [
  'NOT_DISPATCHED',
  'DISPATCHED',
  'TRANSPORT_FAILED',
] as const

export type CursorTransportStatus = (typeof CURSOR_TRANSPORT_STATUSES)[number]

export const CURSOR_REVIEW_STATUSES = [
  'NOT_REQUIRED',
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const

export type CursorReviewStatus = (typeof CURSOR_REVIEW_STATUSES)[number]

export const CURSOR_CHECK_RESULT_STATUSES = [
  'passed',
  'failed',
  'skipped',
  'error',
  'unknown',
] as const

export type CursorCheckResultStatus = (typeof CURSOR_CHECK_RESULT_STATUSES)[number]

export type CursorCheckResult = {
  name: string
  status: CursorCheckResultStatus
  outputSummary: string | null
}

export const CURSOR_REPOSITORY_ARTIFACT_KINDS = [
  'branch',
  'commit',
  'pull_request',
  'file',
  'other',
] as const

export type CursorRepositoryArtifactKind = (typeof CURSOR_REPOSITORY_ARTIFACT_KINDS)[number]

export type CursorRepositoryArtifact = {
  kind: CursorRepositoryArtifactKind
  label: string
  value: string
  url: string | null
}

export type CursorExecutionErrorSource = 'transport' | 'execution' | 'validation' | 'unknown'

export type CursorExecutionError = {
  code: string
  message: string
  source: CursorExecutionErrorSource
  terminal: boolean
}

/** Unified normalized result for all Path C routes. */
export type CursorResultEnvelope = {
  toolExecutionRunId: string
  route: ExecutionRoute
  transportStatus: CursorTransportStatus
  executionStatus: CursorExecutionStatus
  reviewStatus: CursorReviewStatus
  summary: string | null
  branch: string | null
  commitSha: string | null
  pullRequestUrl: string | null
  changedFiles: string[]
  checks: CursorCheckResult[]
  artifacts: CursorRepositoryArtifact[]
  errors: CursorExecutionError[]
  externalCorrelationId: string | null
  startedAt: string | null
  finishedAt: string | null
  metadata: Record<string, unknown>
}

export type CursorResultEnvelopeValidationIssue = {
  code: string
  message: string
  path?: string
}

export type CursorResultEnvelopeValidationResult =
  | { ok: true; envelope: CursorResultEnvelope }
  | { ok: false; issues: CursorResultEnvelopeValidationIssue[] }
