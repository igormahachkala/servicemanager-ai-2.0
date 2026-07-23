/**
 * Unified Cursor Result Envelope — pure factories and normalizers (AI-COMPANY-110).
 */

import type { CursorLocalResultPayload } from '../cursorLocalBridge/cursorLocalBridgeTypes'
import type { CursorResultEnvelope as LegacyCursorResultEnvelope } from '../cursorResult/cursorResultEnvelopeTypes'
import type { ExecutionRouteId } from '../executionRoute/executionRouteTypes'
import {
  type CursorCheckResult,
  type CursorExecutionError,
  type CursorExecutionStatus,
  type CursorRepositoryArtifact,
  type CursorResultEnvelope,
  type CursorReviewStatus,
  type ExecutionResultEnvelope,
} from './cursorResultEnvelopeTypes'
import {
  assertValidCursorResultEnvelope,
  assertValidExecutionResultEnvelope,
} from './cursorResultEnvelopeValidation'

/**
 * Generic over the route literal, so a Cursor route yields something assignable
 * to `CursorResultEnvelope` and a non-Cursor route does not silently pass as one.
 */
function baseEnvelope<R extends ExecutionRouteId>(
  partial: { toolExecutionRunId: string; route: R } & Partial<
    Omit<ExecutionResultEnvelope, 'toolExecutionRunId' | 'route'>
  >,
): Omit<ExecutionResultEnvelope, 'route'> & { route: R } {
  return {
    toolExecutionRunId: partial.toolExecutionRunId,
    route: partial.route,
    transportStatus: partial.transportStatus ?? 'NOT_DISPATCHED',
    executionStatus: partial.executionStatus ?? 'RESULT_PENDING',
    reviewStatus: partial.reviewStatus ?? 'NOT_REQUIRED',
    summary: partial.summary ?? null,
    branch: partial.branch ?? null,
    commitSha: partial.commitSha ?? null,
    pullRequestUrl: partial.pullRequestUrl ?? null,
    changedFiles: partial.changedFiles ?? [],
    checks: partial.checks ?? [],
    artifacts: partial.artifacts ?? [],
    errors: partial.errors ?? [],
    externalCorrelationId: partial.externalCorrelationId ?? null,
    startedAt: partial.startedAt ?? null,
    finishedAt: partial.finishedAt ?? null,
    metadata: partial.metadata ?? {},
  }
}

function normalizeChecksFromStrings(checks: string[]): CursorCheckResult[] {
  return checks.map((name) => ({
    name,
    status: 'unknown' as const,
    outputSummary: null,
  }))
}

function normalizeChecksFromStructured(
  checks: Array<{ name: string; status: string; outputSummary?: string | null }>,
): CursorCheckResult[] {
  return checks.map((check) => ({
    name: check.name,
    status:
      check.status === 'passed' ||
      check.status === 'failed' ||
      check.status === 'skipped' ||
      check.status === 'error'
        ? check.status
        : 'unknown',
    outputSummary: check.outputSummary ?? null,
  }))
}

function buildRepositoryArtifacts(input: {
  branch?: string | null
  commitSha?: string | null
  pullRequestUrl?: string | null
  changedFiles?: string[]
}): CursorRepositoryArtifact[] {
  const artifacts: CursorRepositoryArtifact[] = []
  if (input.branch) {
    artifacts.push({ kind: 'branch', label: 'branch', value: input.branch, url: null })
  }
  if (input.commitSha) {
    artifacts.push({ kind: 'commit', label: 'commit', value: input.commitSha, url: null })
  }
  if (input.pullRequestUrl) {
    artifacts.push({
      kind: 'pull_request',
      label: 'pull_request',
      value: input.pullRequestUrl,
      url: input.pullRequestUrl,
    })
  }
  for (const file of input.changedFiles ?? []) {
    artifacts.push({ kind: 'file', label: 'changed_file', value: file, url: null })
  }
  return artifacts
}

/** HTTP 200 webhook enqueue — DISPATCHED + RESULT_PENDING only. */
export function createPendingAutomationEnvelope(input: {
  toolExecutionRunId: string
  /** Stored only as externalCorrelationId — never as a separate field. */
  backgroundComposerId?: string | null
  externalCorrelationId?: string | null
  startedAt?: string | null
  metadata?: Record<string, unknown>
}): CursorResultEnvelope {
  const correlation =
    input.externalCorrelationId?.trim() ||
    input.backgroundComposerId?.trim() ||
    null

  const envelope = baseEnvelope({
    toolExecutionRunId: input.toolExecutionRunId,
    route: 'CURSOR_AUTOMATION_WEBHOOK',
    transportStatus: 'DISPATCHED',
    executionStatus: 'RESULT_PENDING',
    reviewStatus: 'NOT_REQUIRED',
    externalCorrelationId: correlation,
    startedAt: input.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    metadata: {
      ...input.metadata,
      transport: 'automation_webhook',
      enqueueOnly: true,
    },
  })

  return assertValidCursorResultEnvelope(envelope)
}

export function createTransportFailureEnvelope(input: {
  toolExecutionRunId: string
  route: CursorResultEnvelope['route']
  errors: CursorExecutionError[]
  startedAt?: string | null
  finishedAt?: string | null
  metadata?: Record<string, unknown>
}): CursorResultEnvelope {
  const finishedAt = input.finishedAt ?? new Date().toISOString()
  const envelope = baseEnvelope({
    toolExecutionRunId: input.toolExecutionRunId,
    route: input.route,
    transportStatus: 'TRANSPORT_FAILED',
    executionStatus: 'FAILED',
    reviewStatus: 'NOT_REQUIRED',
    errors: input.errors,
    startedAt: input.startedAt ?? finishedAt,
    finishedAt,
    metadata: input.metadata ?? {},
  })

  return assertValidCursorResultEnvelope(envelope)
}

export function normalizeLocalBridgeResult(input: {
  toolExecutionRunId: string
  result: CursorLocalResultPayload
}): CursorResultEnvelope {
  const { result } = input
  const failed = result.status === 'failed'
  const succeeded = result.status === 'completed'
  const executionStatus = failed ? 'FAILED' : succeeded ? 'SUCCEEDED' : 'RESULT_PENDING'

  const errors: CursorExecutionError[] = result.errors.map((message) => ({
    code: 'LOCAL_BRIDGE_ERROR',
    message,
    source: 'execution' as const,
    terminal: failed,
  }))

  const envelope = baseEnvelope({
    toolExecutionRunId: input.toolExecutionRunId,
    route: 'LOCAL_CURSOR_BRIDGE',
    transportStatus: 'DISPATCHED',
    executionStatus,
    reviewStatus: succeeded ? 'PENDING' : 'NOT_REQUIRED',
    summary: result.summary || null,
    branch: null,
    commitSha: null,
    pullRequestUrl: result.pullRequest,
    changedFiles: result.changedFiles,
    checks: normalizeChecksFromStrings(result.checks),
    artifacts: buildRepositoryArtifacts({
      pullRequestUrl: result.pullRequest,
      changedFiles: result.changedFiles,
    }),
    errors,
    startedAt: result.completedAt,
    finishedAt: succeeded || failed ? result.completedAt : null,
    metadata: {
      transport: 'local_cursor_bridge',
      bridgeStatus: result.status,
      warnings: result.warnings,
      commitMessage: result.commit,
    },
  })

  if (succeeded || failed) {
    return assertValidCursorResultEnvelope(envelope)
  }
  return envelope
}

export type ManualCloudAgentFinalStatus = 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'

export type ManualCloudAgentResultInput = {
  toolExecutionRunId: string
  summary: string
  branch?: string | null
  commitSha?: string | null
  pullRequestUrl?: string | null
  changedFiles: string[]
  checks?: Array<{ name: string; status: string; outputSummary?: string | null }>
  /** Legacy status — used when finalStatus is omitted. */
  status?: 'completed' | 'failed' | 'partial'
  finalStatus?: ManualCloudAgentFinalStatus
  startedAt?: string | null
  finishedAt?: string | null
  externalCorrelationId?: string | null
  errors?: CursorExecutionError[]
  artifacts?: CursorRepositoryArtifact[]
  metadata?: Record<string, unknown>
}

function resolveManualExecutionStatus(input: ManualCloudAgentResultInput): CursorExecutionStatus {
  if (input.finalStatus === 'SUCCEEDED') return 'SUCCEEDED'
  if (input.finalStatus === 'FAILED') return 'FAILED'
  if (input.finalStatus === 'CANCELLED') return 'CANCELLED'
  if (input.finalStatus === 'TIMED_OUT') return 'TIMED_OUT'
  if (input.status === 'failed') return 'FAILED'
  if (input.status === 'completed' || input.status === undefined) return 'SUCCEEDED'
  return 'RESULT_PENDING'
}

function resolveManualReviewStatus(
  executionStatus: CursorExecutionStatus,
): CursorReviewStatus {
  return executionStatus === 'SUCCEEDED' ? 'PENDING' : 'NOT_REQUIRED'
}

export function normalizeManualCloudAgentResult(
  input: ManualCloudAgentResultInput,
): CursorResultEnvelope {
  const executionStatus = resolveManualExecutionStatus(input)
  const succeeded = executionStatus === 'SUCCEEDED'
  const failed =
    executionStatus === 'FAILED' ||
    executionStatus === 'CANCELLED' ||
    executionStatus === 'TIMED_OUT'
  const finishedAt =
    input.finishedAt ?? (succeeded || failed ? new Date().toISOString() : null)
  const branch = input.branch?.trim() || null
  const commitSha = input.commitSha?.trim() || null

  const envelope = baseEnvelope({
    toolExecutionRunId: input.toolExecutionRunId,
    route: 'MANUAL_CLOUD_AGENT',
    transportStatus: 'DISPATCHED',
    executionStatus,
    reviewStatus: resolveManualReviewStatus(executionStatus),
    summary: input.summary,
    branch,
    commitSha,
    pullRequestUrl: input.pullRequestUrl ?? null,
    changedFiles: input.changedFiles,
    checks: normalizeChecksFromStructured(input.checks ?? []),
    artifacts:
      input.artifacts ??
      buildRepositoryArtifacts({
        branch,
        commitSha,
        pullRequestUrl: input.pullRequestUrl,
        changedFiles: input.changedFiles,
      }),
    errors: input.errors ?? [],
    externalCorrelationId: input.externalCorrelationId ?? null,
    startedAt: input.startedAt ?? finishedAt,
    finishedAt,
    metadata: {
      transport: 'manual_cloud_agent',
      importStatus: input.status ?? input.finalStatus ?? 'completed',
      ...input.metadata,
    },
  })

  if (succeeded || failed) {
    return assertValidCursorResultEnvelope(envelope)
  }
  return envelope
}

export type ApplyReviewInput = {
  decision: Extract<CursorReviewStatus, 'PENDING' | 'APPROVED' | 'REJECTED'>
  reviewer: 'builder' | 'max'
  notes?: string | null
  reviewedAt?: string
}

function applyReview(envelope: CursorResultEnvelope, input: ApplyReviewInput): CursorResultEnvelope {
  const reviewedAt = input.reviewedAt ?? new Date().toISOString()
  return {
    ...envelope,
    reviewStatus: input.decision,
    metadata: {
      ...envelope.metadata,
      review: {
        ...(isRecord(envelope.metadata.review) ? envelope.metadata.review : {}),
        [input.reviewer]: {
          decision: input.decision,
          notes: input.notes ?? null,
          reviewedAt,
        },
      },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Builder review — does not mutate executionStatus. */
export function applyBuilderReview(
  envelope: CursorResultEnvelope,
  input: Omit<ApplyReviewInput, 'reviewer'>,
): CursorResultEnvelope {
  return applyReview(envelope, { ...input, reviewer: 'builder' })
}

/** MAX review — does not mutate executionStatus. */
export function applyMaxReview(
  envelope: CursorResultEnvelope,
  input: Omit<ApplyReviewInput, 'reviewer'>,
): CursorResultEnvelope {
  return applyReview(envelope, { ...input, reviewer: 'max' })
}

/** Adapter: legacy 113F outbox envelope → unified contract (integration gap documented). */
export function normalizeLegacyOutboxEnvelope(
  legacy: LegacyCursorResultEnvelope,
): CursorResultEnvelope {
  const failed = legacy.status === 'failed'
  const succeeded = legacy.status === 'completed'
  const executionStatus = failed ? 'FAILED' : succeeded ? 'SUCCEEDED' : 'RESULT_PENDING'

  const errors: CursorExecutionError[] = legacy.errors.map((message) => ({
    code: 'LEGACY_ENVELOPE_ERROR',
    message,
    source: 'execution',
    terminal: failed,
  }))

  const envelope = baseEnvelope({
    toolExecutionRunId: legacy.toolExecutionRunId,
    route: 'LOCAL_CURSOR_BRIDGE',
    transportStatus: 'DISPATCHED',
    executionStatus,
    reviewStatus: succeeded ? 'PENDING' : 'NOT_REQUIRED',
    summary: legacy.summary,
    branch: legacy.commit?.branch ?? null,
    commitSha: legacy.commit?.sha ?? null,
    pullRequestUrl: legacy.pullRequest?.url ?? null,
    changedFiles: legacy.changedFiles,
    checks: legacy.checks.map((check) => ({
      name: check.name,
      status: check.status,
      outputSummary: check.outputSummary,
    })),
    artifacts: buildRepositoryArtifacts({
      branch: legacy.commit?.branch ?? null,
      commitSha: legacy.commit?.sha ?? null,
      pullRequestUrl: legacy.pullRequest?.url ?? null,
      changedFiles: legacy.changedFiles,
    }),
    errors,
    startedAt: legacy.completedAt,
    finishedAt: succeeded || failed ? legacy.completedAt : null,
    metadata: {
      transport: 'local_cursor_bridge',
      legacyEnvelopeVersion: legacy.version,
      warnings: legacy.warnings,
      assumptions: legacy.assumptions,
      unfinishedItems: legacy.unfinishedItems,
    },
  })

  if (succeeded || failed) {
    return assertValidCursorResultEnvelope(envelope)
  }
  return envelope
}

/**
 * Result of a local model analysis run (route LOCAL_OLLAMA_ANALYSIS).
 *
 * Returns the neutral `ExecutionResultEnvelope`, not the Cursor narrowing: an
 * analysis produces a written finding, never a branch, commit or pull request,
 * so `changedFiles` and `artifacts` are empty by construction rather than by
 * omission. The summary is the execution evidence — validation accepts it as
 * such, and rejects the envelope outright when it is blank.
 *
 * `metadata.enqueueOnly` is stripped: it means "the webhook accepted the job,
 * the work has not happened yet", which is never true here — a local call has
 * already finished by the time this returns.
 */
export function createAnalysisResultEnvelope(input: {
  toolExecutionRunId: string
  summary: string
  startedAt?: string | null
  finishedAt?: string | null
  checks?: CursorCheckResult[]
  metadata?: Record<string, unknown>
}): ExecutionResultEnvelope {
  const finishedAt = input.finishedAt ?? new Date().toISOString()
  const { enqueueOnly: _enqueueOnly, ...metadata } = input.metadata ?? {}
  void _enqueueOnly

  const envelope = baseEnvelope({
    toolExecutionRunId: input.toolExecutionRunId,
    route: 'LOCAL_OLLAMA_ANALYSIS',
    transportStatus: 'DISPATCHED',
    executionStatus: 'SUCCEEDED',
    reviewStatus: 'PENDING',
    summary: input.summary.trim() || null,
    changedFiles: [],
    artifacts: [],
    checks: input.checks ?? [],
    errors: [],
    startedAt: input.startedAt ?? finishedAt,
    finishedAt,
    metadata,
  })

  return assertValidExecutionResultEnvelope(envelope)
}
