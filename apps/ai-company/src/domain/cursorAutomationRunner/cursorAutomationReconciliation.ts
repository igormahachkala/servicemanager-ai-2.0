/**
 * Cursor Automation — result reconciliation V1 (AI-COMPANY-113).
 */

import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import { mapEnvelopeToToolResultOutput } from '../cursorResultEnvelope/cursorResultEnvelopeAdapters'
import { validateCursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeValidation'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import { evaluateCursorResultForBuilderReview } from '../employeeToolReview/employeeToolReviewEvaluation'
import type {
  CreateEmployeeToolReviewInput,
  EmployeeToolReview,
} from '../employeeToolReview/employeeToolReviewTypes'
import { unifiedEnvelopeToLegacyReviewEnvelope } from '../manualCloudAgentImport/unifiedToLegacyReviewEnvelope'
import type {
  RecordToolExecutionResultInput,
  ToolExecutionRun,
} from '../toolExecution/toolExecutionRunTypes'
import { buildDiscoveredAutomationEnvelope } from './cursorAutomationDiscoveredEnvelope'
import { createCursorAutomationRunnerEvent } from './cursorAutomationRunnerObservability'
import {
  findSuccessfulDispatchAttempt,
  mergeRunOutputWithRunner,
  patchRunnerMetadata,
  readCursorAutomationRunnerMetadata,
} from './cursorAutomationRunnerMetadata'
import type {
  CursorAutomationRunnerEvent,
  CursorAutomationResultMarker,
  ReconcileCursorAutomationInput,
  ReconcileCursorAutomationOutcome,
} from './cursorAutomationRunnerTypes'
import {
  parseResultMarker,
  type ResultMarkerEvidence,
  validateResultMarker,
} from './cursorAutomationResultMarker'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000

export type ReconcileCursorAutomationDeps = {
  getRun: (id: string) => ToolExecutionRun | null
  upsertRun: (run: ToolExecutionRun) => ToolExecutionRun
  recordResult: (input: RecordToolExecutionResultInput) => ToolExecutionRun | null
  failRun: (runId: string, error: string) => ToolExecutionRun | null
  getReviewByRunId: (runId: string) => EmployeeToolReview | null
  createReview: (input: CreateEmployeeToolReviewInput) => EmployeeToolReview
  postReviewCard: (review: EmployeeToolReview) => void
  readResultMarker: (path: string) => Promise<unknown | null>
  resolveEvidence: (input: {
    repository: string
    branch: string
    commitSha: string
    pullRequestUrl: string | null
  }) => Promise<ResultMarkerEvidence>
  logEvent: (event: CursorAutomationRunnerEvent) => void
  now?: () => number
}

function readPendingEnvelope(run: ToolExecutionRun): CursorResultEnvelope | null {
  const output = run.result?.output
  if (!output || typeof output !== 'object') return null
  const raw = (output as Record<string, unknown>).cursorResultEnvelopeV110
  if (!raw || typeof raw !== 'object') return null
  return raw as CursorResultEnvelope
}

function bootstrapBuilderReview(
  envelope: CursorResultEnvelope,
  run: ToolExecutionRun,
  deps: ReconcileCursorAutomationDeps,
): EmployeeToolReview {
  const legacyEnvelope = unifiedEnvelopeToLegacyReviewEnvelope(envelope, run)
  const evaluation = evaluateCursorResultForBuilderReview(legacyEnvelope, run)
  const review = deps.createReview({
    companyId: run.companyId,
    employeeId: run.employeeId,
    reviewerEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    toolExecutionRunId: run.id,
    workItemId: run.workItemId,
    delegationPlanId: run.delegationPlanId,
    envelope: legacyEnvelope,
    evaluation,
  })
  deps.postReviewCard(review)
  return review
}

function applyTimedOut(
  run: ToolExecutionRun,
  metadata: NonNullable<ReturnType<typeof readCursorAutomationRunnerMetadata>>,
  reason: string,
  deps: ReconcileCursorAutomationDeps,
): ReconcileCursorAutomationOutcome {
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString()
  const correlation = findSuccessfulDispatchAttempt(metadata)?.backgroundComposerId ?? null

  const timedOutEnvelope: CursorResultEnvelope = {
    toolExecutionRunId: run.id,
    route: 'CURSOR_AUTOMATION_WEBHOOK',
    transportStatus: 'DISPATCHED',
    executionStatus: 'TIMED_OUT',
    reviewStatus: 'NOT_REQUIRED',
    summary: reason,
    branch: null,
    commitSha: null,
    pullRequestUrl: null,
    changedFiles: [],
    checks: [],
    artifacts: [],
    errors: [{ code: 'TIMED_OUT', message: reason, source: 'execution', terminal: true }],
    externalCorrelationId: correlation,
    startedAt: metadata.dispatchedAt,
    finishedAt: nowIso,
    metadata: {
      transport: 'automation_webhook',
      enqueueOnly: false,
      reconciliation: 'timeout_v1',
    },
  }

  const failed = deps.failRun(run.id, reason)
  const patched = patchRunnerMetadata(failed ?? run, {
    dispatchPhase: 'TIMED_OUT',
    timeoutReason: reason,
    reconciliationLastCheckedAt: nowIso,
  })

  const persisted = deps.upsertRun({
    ...patched,
    result: mergeRunOutputWithRunner(patched, readCursorAutomationRunnerMetadata(patched)!, {
      executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
      ...mapEnvelopeToToolResultOutput(timedOutEnvelope),
    }),
  })

  const event = createCursorAutomationRunnerEvent(
    'cursor_automation_result_timed_out',
    run.id,
    'TIMED_OUT',
    { reason },
  )
  deps.logEvent(event)

  return { ok: true, status: 'TIMED_OUT', run: persisted, envelope: timedOutEnvelope }
}

async function applyDiscoveredMarker(
  run: ToolExecutionRun,
  marker: CursorAutomationResultMarker,
  metadata: NonNullable<ReturnType<typeof readCursorAutomationRunnerMetadata>>,
  deps: ReconcileCursorAutomationDeps,
): Promise<ReconcileCursorAutomationOutcome> {
  const evidence = await deps.resolveEvidence({
    repository: metadata.repository,
    branch: marker.branch,
    commitSha: marker.commitSha,
    pullRequestUrl: marker.pullRequestUrl,
  })

  const validation = validateResultMarker({
    marker,
    expectedRunId: run.id,
    evidence,
  })

  if (!validation.ok) {
    const message = validation.issues.map((issue) => issue.message).join('; ')
    const event = createCursorAutomationRunnerEvent(
      'cursor_automation_dispatch_failed',
      run.id,
      'INVALID_RESULT_MARKER',
      { issues: validation.issues },
    )
    deps.logEvent(event)
    return { ok: false, code: 'INVALID_RESULT_MARKER', message, run }
  }

  const correlation = findSuccessfulDispatchAttempt(metadata)?.backgroundComposerId ?? null
  const envelope = buildDiscoveredAutomationEnvelope({
    marker,
    externalCorrelationId: correlation,
    metadata: { reconciliation: 'result_marker_v1' },
  })

  const envelopeValidation = validateCursorResultEnvelope(envelope)
  if (!envelopeValidation.ok) {
    const message = envelopeValidation.issues.map((issue) => issue.message).join('; ')
    return { ok: false, code: 'INVALID_ENVELOPE', message, run }
  }

  if (marker.status === 'FAILED') {
    const failed = deps.failRun(run.id, marker.summary)
    const patched = patchRunnerMetadata(failed ?? run, {
      dispatchPhase: 'REVIEW_REQUIRED',
      reconciliationLastCheckedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
    })
    const persisted = deps.upsertRun({
      ...patched,
      result: mergeRunOutputWithRunner(patched, readCursorAutomationRunnerMetadata(patched)!, {
        executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
        ...mapEnvelopeToToolResultOutput(envelope),
      }),
    })

    const event = createCursorAutomationRunnerEvent(
      'cursor_automation_result_discovered',
      run.id,
      'RESULT_FAILED',
      { status: marker.status },
    )
    deps.logEvent(event)

    return { ok: true, status: 'FAILED', run: persisted, envelope }
  }

  const recorded = deps.recordResult({
    runId: run.id,
    output: mapEnvelopeToToolResultOutput(envelope, {
      executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
      automationReconciliation: {
        discoveredAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
        source: 'result_marker_v1',
      },
    }),
    deliveryMode: 'cursor_v1',
  })

  if (!recorded) {
    return {
      ok: false,
      code: 'RECORD_FAILED',
      message: 'Could not record reconciled automation result.',
      run,
    }
  }

  let review = deps.getReviewByRunId(recorded.id)
  if (!review) {
    review = bootstrapBuilderReview(envelope, recorded, deps)
  }

  const patched = patchRunnerMetadata(recorded, {
    dispatchPhase: 'REVIEW_REQUIRED',
    reconciliationLastCheckedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
  })
  const persisted = deps.upsertRun(patched)

  const event = createCursorAutomationRunnerEvent(
    'cursor_automation_result_discovered',
    run.id,
    'RESULT_DISCOVERED',
    { status: marker.status, reviewId: review.id },
  )
  deps.logEvent(event)

  return { ok: true, status: 'DISCOVERED', run: persisted, envelope }
}

export async function reconcileCursorAutomationResult(
  input: ReconcileCursorAutomationInput,
  deps: ReconcileCursorAutomationDeps,
): Promise<ReconcileCursorAutomationOutcome> {
  const run = deps.getRun(input.runId)
  if (!run) {
    return { ok: false, code: 'RUN_NOT_FOUND', message: `Run ${input.runId} not found.`, run: null }
  }

  const metadata = readCursorAutomationRunnerMetadata(run)
  if (!metadata) {
    return {
      ok: false,
      code: 'RUNNER_METADATA_MISSING',
      message: 'Cursor Automation runner metadata missing.',
      run,
    }
  }

  if (run.status !== 'running' && run.status !== 'queued') {
    const envelope = readPendingEnvelope(run)
    if (envelope && envelope.executionStatus !== 'RESULT_PENDING') {
      return {
        ok: true,
        status: envelope.executionStatus === 'TIMED_OUT' ? 'TIMED_OUT' : 'DISCOVERED',
        run,
        envelope,
      }
    }
    return {
      ok: false,
      code: 'NOT_RECONCILABLE',
      message: `Run status ${run.status} is not reconcilable.`,
      run,
    }
  }

  const nowMs = deps.now?.() ?? Date.now()
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const lastChecked = metadata.reconciliationLastCheckedAt
    ? Date.parse(metadata.reconciliationLastCheckedAt)
    : 0

  if (lastChecked && nowMs - lastChecked < pollIntervalMs) {
    return { ok: true, status: 'RESULT_PENDING', run }
  }

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeoutAt = metadata.timeoutAt ? Date.parse(metadata.timeoutAt) : nowMs + timeoutMs
  if (nowMs >= timeoutAt) {
    return applyTimedOut(
      run,
      metadata,
      metadata.timeoutReason ?? 'Cursor Automation reconciliation timed out waiting for result evidence.',
      deps,
    )
  }

  const markerPath = metadata.resultMarkerPath
  const rawMarker = await deps.readResultMarker(markerPath)
  if (!rawMarker) {
    const pendingRun = patchRunnerMetadata(run, {
      dispatchPhase: 'RESULT_PENDING',
      reconciliationLastCheckedAt: new Date(nowMs).toISOString(),
      reconciliationPollCount: metadata.reconciliationPollCount + 1,
    })
    deps.upsertRun(pendingRun)
    return { ok: true, status: 'RESULT_PENDING', run: pendingRun }
  }

  const marker = parseResultMarker(rawMarker)
  if (!marker) {
    return {
      ok: false,
      code: 'INVALID_RESULT_MARKER',
      message: 'Result marker file is not parseable.',
      run,
    }
  }

  if (marker.toolExecutionRunId !== run.id) {
    return {
      ok: false,
      code: 'RUN_ID_MISMATCH',
      message: `Marker references ${marker.toolExecutionRunId}, expected ${run.id}.`,
      run,
    }
  }

  return applyDiscoveredMarker(run, marker, metadata, deps)
}
