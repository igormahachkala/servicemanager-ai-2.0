/**
 * Manual Cloud Agent result import — application service (AI-COMPANY-111).
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
import type {
  RecordToolExecutionResultInput,
  ToolExecutionRun,
  ToolExecutionRunStatus,
} from '../toolExecution/toolExecutionRunTypes'
import { buildManualCloudAgentEnvelopeFromImport } from './manualCloudAgentImportEnvelope'
import {
  createManualCloudAgentImportEvent,
} from './manualCloudAgentImportObservability'
import type {
  ManualCloudAgentImportEvent,
  ManualCloudAgentImportInput,
  ManualCloudAgentImportOutcome,
  ManualCloudAgentImportReasonCode,
} from './manualCloudAgentImportTypes'
import { validateManualCloudAgentImportInput } from './manualCloudAgentImportValidation'
import { unifiedEnvelopeToLegacyReviewEnvelope } from './unifiedToLegacyReviewEnvelope'

const BUILDER_EMPLOYEE_ID = EMPLOYEE_ROUTE_IDS.builder

const TERMINAL_STATUSES = new Set<ToolExecutionRunStatus>([
  'accepted',
  'rejected',
  'failed',
  'cancelled',
])

const IMPORTABLE_STATUSES = new Set<ToolExecutionRunStatus>([
  'approved',
  'queued',
  'running',
])

export type ManualCloudAgentImportDeps = {
  getRun: (id: string) => ToolExecutionRun | null
  upsertRun: (run: ToolExecutionRun) => ToolExecutionRun
  resolveRoute: (run: ToolExecutionRun) => import('./manualCloudAgentImportTypes').ResolvedToolExecutionRunRoute
  markQueued: (runId: string, message?: string | null) => ToolExecutionRun | null
  markRunning: (runId: string, message?: string | null) => ToolExecutionRun | null
  recordResult: (input: RecordToolExecutionResultInput) => ToolExecutionRun | null
  getReviewByRunId: (runId: string) => EmployeeToolReview | null
  createReview: (input: CreateEmployeeToolReviewInput) => EmployeeToolReview
  postReviewCard: (review: EmployeeToolReview) => void
  logEvent: (event: ManualCloudAgentImportEvent) => void
}

function reject(
  reasonCode: ManualCloudAgentImportReasonCode,
  message: string,
  events: ManualCloudAgentImportEvent[],
  existingResultRef: string | null = null,
): ManualCloudAgentImportOutcome {
  return { ok: false, reasonCode, message, existingResultRef, events }
}

function existingResultRef(run: ToolExecutionRun): string | null {
  return run.result?.receivedAt ?? null
}

function hasImportedResult(run: ToolExecutionRun): boolean {
  if (run.status === 'awaiting_employee_review' || run.status === 'accepted') return true
  if (run.status === 'result_received') return true
  const output = run.result?.output
  if (output && typeof output === 'object' && 'cursorResultEnvelopeV110' in output) {
    return true
  }
  return false
}

function ensureRunning(run: ToolExecutionRun, deps: ManualCloudAgentImportDeps): ToolExecutionRun | null {
  if (run.status === 'running') return run
  if (run.status === 'approved') {
    deps.markQueued(run.id, 'Manual Cloud Agent import — queued.')
  }
  const queued = deps.getRun(run.id)
  if (!queued) return null
  if (queued.status === 'queued') {
    deps.markRunning(run.id, 'Manual Cloud Agent import — running.')
  }
  return deps.getRun(run.id)
}

function persistTerminalImport(
  run: ToolExecutionRun,
  envelope: CursorResultEnvelope,
  status: ToolExecutionRunStatus,
  error: string | null,
  deps: ManualCloudAgentImportDeps,
): ToolExecutionRun {
  const now = new Date().toISOString()
  const output = mapEnvelopeToToolResultOutput(envelope, {
    executionRoute: 'MANUAL_CLOUD_AGENT',
    manualImport: {
      importedAt: now,
      finalStatus: envelope.executionStatus,
    },
  })

  return deps.upsertRun({
    ...run,
    status,
    error,
    failedAt: status === 'failed' ? now : run.failedAt,
    completedAt: status === 'cancelled' ? now : run.completedAt,
    result: {
      plannedOnly: false,
      output,
      deliveryMode: 'cursor_v1',
      cursorAutomationTaskId: null,
      registryInvokePlanId: null,
      receivedAt: now,
    },
    updatedAt: now,
    history: run.history,
  })
}

function bootstrapBuilderReview(
  envelope: CursorResultEnvelope,
  run: ToolExecutionRun,
  deps: ManualCloudAgentImportDeps,
): EmployeeToolReview {
  const legacyEnvelope = unifiedEnvelopeToLegacyReviewEnvelope(envelope, run)
  const evaluation = evaluateCursorResultForBuilderReview(legacyEnvelope, run)
  const review = deps.createReview({
    companyId: run.companyId,
    employeeId: run.employeeId,
    reviewerEmployeeId: BUILDER_EMPLOYEE_ID,
    toolExecutionRunId: run.id,
    workItemId: run.workItemId,
    delegationPlanId: run.delegationPlanId,
    envelope: legacyEnvelope,
    evaluation,
  })
  deps.postReviewCard(review)
  return review
}

export function importManualCloudAgentResult(
  rawInput: ManualCloudAgentImportInput,
  deps: ManualCloudAgentImportDeps,
): ManualCloudAgentImportOutcome {
  const events: ManualCloudAgentImportEvent[] = []

  const validatedInput = validateManualCloudAgentImportInput(rawInput)
  if (!validatedInput.ok) {
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      rawInput.toolExecutionRunId ?? 'unknown',
      validatedInput.reasonCode,
      rawInput.finalStatus ?? null,
    )
    events.push(event)
    deps.logEvent(event)
    return reject(validatedInput.reasonCode, validatedInput.message, events)
  }

  const input = validatedInput.input
  events.push(
    createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_started',
      input.toolExecutionRunId,
      'IMPORT_ACCEPTED',
      input.finalStatus,
    ),
  )

  const run = deps.getRun(input.toolExecutionRunId)
  if (!run) {
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      input.toolExecutionRunId,
      'TOOL_EXECUTION_RUN_NOT_FOUND',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject('TOOL_EXECUTION_RUN_NOT_FOUND', `ToolExecutionRun ${input.toolExecutionRunId} not found.`, events)
  }

  if (hasImportedResult(run)) {
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_duplicate',
      run.id,
      'RESULT_ALREADY_IMPORTED',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject(
      'RESULT_ALREADY_IMPORTED',
      'Result already imported for this ToolExecutionRun.',
      events,
      existingResultRef(run),
    )
  }

  if (TERMINAL_STATUSES.has(run.status)) {
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      run.id,
      'RUN_ALREADY_TERMINAL',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject(
      'RUN_ALREADY_TERMINAL',
      `ToolExecutionRun ${run.id} is terminal (status=${run.status}).`,
      events,
    )
  }

  if (!IMPORTABLE_STATUSES.has(run.status)) {
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      run.id,
      'RUN_ALREADY_TERMINAL',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject(
      'RUN_ALREADY_TERMINAL',
      `ToolExecutionRun ${run.id} is not importable (status=${run.status}).`,
      events,
    )
  }

  const route = deps.resolveRoute(run)
  if (route !== 'MANUAL_CLOUD_AGENT') {
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      run.id,
      'ROUTE_MISMATCH',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject(
      'ROUTE_MISMATCH',
      `ToolExecutionRun ${run.id} route is ${route ?? 'unknown'} — MANUAL_CLOUD_AGENT required.`,
      events,
    )
  }

  let envelope: CursorResultEnvelope
  try {
    envelope = buildManualCloudAgentEnvelopeFromImport(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Envelope normalization failed.'
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      run.id,
      'INVALID_STATUS_COMBINATION',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject('INVALID_STATUS_COMBINATION', message, events)
  }

  const envelopeValidation = validateCursorResultEnvelope(envelope)
  if (!envelopeValidation.ok) {
    const message = envelopeValidation.issues.map((issue) => issue.message).join('; ')
    const event = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_rejected',
      run.id,
      'INVALID_STATUS_COMBINATION',
      input.finalStatus,
    )
    events.push(event)
    deps.logEvent(event)
    return reject('INVALID_STATUS_COMBINATION', message, events)
  }

  if (input.finalStatus === 'SUCCEEDED') {
    const running = ensureRunning(run, deps)
    if (!running || running.status !== 'running') {
      return reject(
        'INVALID_STATUS_COMBINATION',
        'Could not transition ToolExecutionRun to running for successful import.',
        events,
      )
    }

    const recorded = deps.recordResult({
      runId: running.id,
      output: mapEnvelopeToToolResultOutput(envelope, {
        executionRoute: 'MANUAL_CLOUD_AGENT',
        manualImport: { importedAt: new Date().toISOString(), finalStatus: 'SUCCEEDED' },
      }),
      deliveryMode: 'cursor_v1',
    })

    if (!recorded) {
      return reject(
        'INVALID_STATUS_COMBINATION',
        'Could not record successful manual import on ToolExecutionRun.',
        events,
      )
    }

    let review = deps.getReviewByRunId(recorded.id)
    if (!review) {
      review = bootstrapBuilderReview(envelope, recorded, deps)
    }

    const acceptedEvent = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_import_accepted',
      recorded.id,
      'IMPORT_REQUIRES_REVIEW',
      input.finalStatus,
    )
    const reviewEvent = createManualCloudAgentImportEvent(
      'manual_cloud_agent_result_requires_review',
      recorded.id,
      'IMPORT_REQUIRES_REVIEW',
      input.finalStatus,
    )
    events.push(acceptedEvent, reviewEvent)
    deps.logEvent(acceptedEvent)
    deps.logEvent(reviewEvent)

    return {
      ok: true,
      reasonCode: 'IMPORT_REQUIRES_REVIEW',
      envelope,
      run: recorded,
      review,
      duplicate: false,
      events,
    }
  }

  const terminalStatus: ToolExecutionRunStatus =
    input.finalStatus === 'CANCELLED' ? 'cancelled' : 'failed'

  const errorSummary =
    input.errors.map((item) => item.message).join('; ') ||
    input.summary ||
    `Manual Cloud Agent import ${input.finalStatus}`

  const persisted = persistTerminalImport(
    run,
    envelope,
    terminalStatus,
    errorSummary,
    deps,
  )

  const acceptedEvent = createManualCloudAgentImportEvent(
    'manual_cloud_agent_result_import_accepted',
    persisted.id,
    'IMPORT_ACCEPTED',
    input.finalStatus,
  )
  events.push(acceptedEvent)
  deps.logEvent(acceptedEvent)

  return {
    ok: true,
    reasonCode: 'IMPORT_ACCEPTED',
    envelope,
    run: persisted,
    review: null,
    duplicate: false,
    events,
  }
}
