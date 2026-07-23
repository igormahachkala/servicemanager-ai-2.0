/**
 * Unified Cursor Result Envelope — runtime validation (AI-COMPANY-110).
 */

import {
  EXECUTION_ROUTE_IDS,
  isCursorExecutionRoute,
} from '../executionRoute/executionRouteTypes'
import {
  CURSOR_CHECK_RESULT_STATUSES,
  CURSOR_EXECUTION_STATUSES,
  CURSOR_REPOSITORY_ARTIFACT_KINDS,
  CURSOR_REVIEW_STATUSES,
  CURSOR_TRANSPORT_STATUSES,
  type CursorCheckResult,
  type CursorExecutionError,
  type CursorRepositoryArtifact,
  type CursorResultEnvelope,
  type CursorResultEnvelopeValidationIssue,
  type ExecutionResultEnvelope,
  type ExecutionResultEnvelopeValidationResult,
} from './cursorResultEnvelopeTypes'

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
}

function isValidPullRequestUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return /\/pull\/\d+|\/merge_requests\/\d+|\/pulls\/\d+/.test(url.pathname)
  } catch {
    return false
  }
}

function hasExecutionEvidence(envelope: ExecutionResultEnvelope): boolean {
  return (
    (envelope.summary?.trim().length ?? 0) > 0 ||
    envelope.changedFiles.length > 0 ||
    envelope.commitSha !== null ||
    envelope.branch !== null ||
    envelope.pullRequestUrl !== null
  )
}

function hasTerminalExecutionError(envelope: ExecutionResultEnvelope): boolean {
  return envelope.errors.some(
    (error) => error.terminal && (error.source === 'execution' || error.source === 'transport'),
  )
}

function parseCheck(value: unknown): CursorCheckResult | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== 'string' || !value.name.trim()) return null
  const status =
    typeof value.status === 'string' &&
    (CURSOR_CHECK_RESULT_STATUSES as readonly string[]).includes(value.status)
      ? (value.status as CursorCheckResult['status'])
      : null
  if (!status) return null
  return {
    name: value.name.trim(),
    status,
    outputSummary:
      typeof value.outputSummary === 'string' ? value.outputSummary.trim() || null : null,
  }
}

function parseArtifact(value: unknown): CursorRepositoryArtifact | null {
  if (!isRecord(value)) return null
  const kind =
    typeof value.kind === 'string' &&
    (CURSOR_REPOSITORY_ARTIFACT_KINDS as readonly string[]).includes(value.kind)
      ? (value.kind as CursorRepositoryArtifact['kind'])
      : null
  if (!kind || typeof value.label !== 'string' || typeof value.value !== 'string') return null
  return {
    kind,
    label: value.label.trim(),
    value: value.value.trim(),
    url: typeof value.url === 'string' ? value.url.trim() || null : null,
  }
}

function parseError(value: unknown): CursorExecutionError | null {
  if (!isRecord(value)) return null
  if (typeof value.code !== 'string' || typeof value.message !== 'string') return null
  const source =
    value.source === 'transport' ||
    value.source === 'execution' ||
    value.source === 'validation' ||
    value.source === 'unknown'
      ? value.source
      : 'unknown'
  return {
    code: value.code.trim(),
    message: value.message.trim(),
    source,
    terminal: value.terminal === true,
  }
}

export function parseExecutionResultEnvelope(raw: unknown): ExecutionResultEnvelope | null {
  if (!isRecord(raw)) return null
  if (typeof raw.toolExecutionRunId !== 'string' || !raw.toolExecutionRunId.trim()) return null
  if (
    typeof raw.route !== 'string' ||
    !(EXECUTION_ROUTE_IDS as readonly string[]).includes(raw.route)
  ) {
    return null
  }

  const transportStatus =
    typeof raw.transportStatus === 'string' &&
    (CURSOR_TRANSPORT_STATUSES as readonly string[]).includes(raw.transportStatus)
      ? raw.transportStatus
      : null
  const executionStatus =
    typeof raw.executionStatus === 'string' &&
    (CURSOR_EXECUTION_STATUSES as readonly string[]).includes(raw.executionStatus)
      ? raw.executionStatus
      : null
  const reviewStatus =
    typeof raw.reviewStatus === 'string' &&
    (CURSOR_REVIEW_STATUSES as readonly string[]).includes(raw.reviewStatus)
      ? raw.reviewStatus
      : null

  if (!transportStatus || !executionStatus || !reviewStatus) return null

  const checks = Array.isArray(raw.checks)
    ? raw.checks.map(parseCheck).filter((item): item is CursorCheckResult => item !== null)
    : []
  const artifacts = Array.isArray(raw.artifacts)
    ? raw.artifacts.map(parseArtifact).filter((item): item is CursorRepositoryArtifact => item !== null)
    : []
  const errors = Array.isArray(raw.errors)
    ? raw.errors.map(parseError).filter((item): item is CursorExecutionError => item !== null)
    : []
  const changedFiles = Array.isArray(raw.changedFiles)
    ? raw.changedFiles.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
    : []

  return {
    toolExecutionRunId: raw.toolExecutionRunId.trim(),
    route: raw.route as ExecutionResultEnvelope['route'],
    transportStatus: transportStatus as ExecutionResultEnvelope['transportStatus'],
    executionStatus: executionStatus as ExecutionResultEnvelope['executionStatus'],
    reviewStatus: reviewStatus as ExecutionResultEnvelope['reviewStatus'],
    summary: typeof raw.summary === 'string' ? raw.summary.trim() || null : null,
    branch: typeof raw.branch === 'string' ? raw.branch.trim() || null : null,
    commitSha: typeof raw.commitSha === 'string' ? raw.commitSha.trim() || null : null,
    pullRequestUrl:
      typeof raw.pullRequestUrl === 'string' ? raw.pullRequestUrl.trim() || null : null,
    changedFiles,
    checks,
    artifacts,
    errors,
    externalCorrelationId:
      typeof raw.externalCorrelationId === 'string'
        ? raw.externalCorrelationId.trim() || null
        : null,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt.trim() || null : null,
    finishedAt: typeof raw.finishedAt === 'string' ? raw.finishedAt.trim() || null : null,
    metadata: isRecord(raw.metadata) ? { ...raw.metadata } : {},
  }
}

/**
 * Narrowing wrapper: parse, then keep only Cursor Path C routes.
 * Existing Cursor call sites keep their exact type; a non-Cursor envelope is
 * rejected here rather than leaking into code that expects a branch or a commit.
 */
export function parseCursorResultEnvelope(raw: unknown): CursorResultEnvelope | null {
  const envelope = parseExecutionResultEnvelope(raw)
  if (!envelope) return null
  const route = envelope.route
  if (!isCursorExecutionRoute(route)) return null
  return { ...envelope, route }
}

export function validateExecutionResultEnvelope<T extends ExecutionResultEnvelope>(
  envelope: T,
): ExecutionResultEnvelopeValidationResult<T> {
  const issues: CursorResultEnvelopeValidationIssue[] = []

  if (envelope.transportStatus === 'TRANSPORT_FAILED' && envelope.executionStatus === 'SUCCEEDED') {
    issues.push({
      code: 'transport_execution_conflict',
      message: 'TRANSPORT_FAILED cannot coexist with executionStatus SUCCEEDED.',
    })
  }

  if (envelope.transportStatus === 'TRANSPORT_FAILED' && envelope.executionStatus !== 'FAILED') {
    issues.push({
      code: 'transport_failed_invariant',
      message: 'TRANSPORT_FAILED requires executionStatus FAILED.',
    })
  }

  if (
    envelope.route === 'CURSOR_AUTOMATION_WEBHOOK' &&
    envelope.transportStatus === 'DISPATCHED' &&
    envelope.executionStatus === 'SUCCEEDED' &&
    envelope.metadata.enqueueOnly === true
  ) {
    issues.push({
      code: 'webhook_enqueue_not_success',
      message: 'Automation webhook enqueue cannot be execution SUCCEEDED (enqueueOnly).',
    })
  }

  if (envelope.executionStatus === 'SUCCEEDED') {
    if (!envelope.finishedAt) {
      issues.push({
        code: 'succeeded_missing_finished_at',
        message: 'SUCCEEDED requires finishedAt.',
        path: 'finishedAt',
      })
    } else if (!isIsoTimestamp(envelope.finishedAt)) {
      issues.push({
        code: 'invalid_timestamp',
        message: 'finishedAt must be a valid ISO timestamp.',
        path: 'finishedAt',
      })
    }

    if (!hasExecutionEvidence(envelope)) {
      issues.push({
        code: 'succeeded_missing_evidence',
        message: 'SUCCEEDED requires execution evidence (summary, files, branch, commit, or PR).',
      })
    }

    if (hasTerminalExecutionError(envelope)) {
      issues.push({
        code: 'succeeded_with_terminal_error',
        message: 'SUCCEEDED cannot include terminal execution/transport errors.',
        path: 'errors',
      })
    }

    if (envelope.transportStatus === 'NOT_DISPATCHED') {
      issues.push({
        code: 'succeeded_without_dispatch',
        message: 'SUCCEEDED requires transportStatus DISPATCHED.',
        path: 'transportStatus',
      })
    }
  }

  if (envelope.commitSha && !COMMIT_SHA_PATTERN.test(envelope.commitSha)) {
    issues.push({
      code: 'invalid_commit_sha',
      message: 'commitSha must be 7–40 hexadecimal characters.',
      path: 'commitSha',
    })
  }

  if (envelope.pullRequestUrl && !isValidPullRequestUrl(envelope.pullRequestUrl)) {
    issues.push({
      code: 'invalid_pr_url',
      message: 'pullRequestUrl must be a valid HTTP(S) pull/merge request URL.',
      path: 'pullRequestUrl',
    })
  }

  if (envelope.startedAt && !isIsoTimestamp(envelope.startedAt)) {
    issues.push({
      code: 'invalid_timestamp',
      message: 'startedAt must be a valid ISO timestamp.',
      path: 'startedAt',
    })
  }

  if (
    envelope.finishedAt &&
    envelope.startedAt &&
    Date.parse(envelope.finishedAt) < Date.parse(envelope.startedAt)
  ) {
    issues.push({
      code: 'timestamp_order',
      message: 'finishedAt cannot be before startedAt.',
    })
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return { ok: true, envelope }
}

export function assertValidExecutionResultEnvelope<T extends ExecutionResultEnvelope>(
  envelope: T,
): T {
  const result = validateExecutionResultEnvelope(envelope)
  if (!result.ok) {
    const summary = result.issues.map((item) => item.message).join('; ')
    throw new Error(`Invalid CursorResultEnvelope: ${summary}`)
  }
  return result.envelope
}

/**
 * Cursor-facing names. Generic, so passing a `CursorResultEnvelope` still returns
 * a `CursorResultEnvelope` — the reason the 22 existing call sites need no edits.
 */
export const validateCursorResultEnvelope = validateExecutionResultEnvelope
export const assertValidCursorResultEnvelope = assertValidExecutionResultEnvelope
