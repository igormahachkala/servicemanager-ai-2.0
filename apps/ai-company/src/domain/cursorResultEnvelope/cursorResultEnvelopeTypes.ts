/**
 * Unified Result Envelope — domain contract (AI-COMPANY-110).
 * Separates transport, execution, review, repository artifacts, and pending state.
 *
 * The envelope is route-neutral: `ExecutionResultEnvelope` carries the result of
 * any execution route, and `CursorResultEnvelope` is its Cursor Path C narrowing.
 * Repository fields stay optional throughout — a local analysis run reports a
 * summary and no branch, commit or pull request, and that is a complete result,
 * not a degraded one.
 */

import type {
  CursorExecutionRouteId,
  ExecutionRouteId,
} from '../executionRoute/executionRouteTypes'

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

/** Unified normalized result for every execution route — Cursor and non-Cursor. */
export type ExecutionResultEnvelope = {
  toolExecutionRunId: string
  route: ExecutionRouteId
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

/**
 * Cursor Path C narrowing of the envelope.
 *
 * `Omit` + re-declare, deliberately not an intersection: `{ route: ExecutionRouteId }
 * & { route: CursorExecutionRouteId }` types the property as the intersection of
 * both unions, which happens to read as `CursorExecutionRouteId` today but
 * collapses to `never` the moment the two sets stop overlapping — silently, at
 * every construction site. `Omit` states the narrowing outright.
 */
export type CursorResultEnvelope = Omit<ExecutionResultEnvelope, 'route'> & {
  route: CursorExecutionRouteId
}

export type CursorResultEnvelopeValidationIssue = {
  code: string
  message: string
  path?: string
}

export type ExecutionResultEnvelopeValidationResult<
  T extends ExecutionResultEnvelope = ExecutionResultEnvelope,
> = { ok: true; envelope: T } | { ok: false; issues: CursorResultEnvelopeValidationIssue[] }

export type CursorResultEnvelopeValidationResult =
  ExecutionResultEnvelopeValidationResult<CursorResultEnvelope>
