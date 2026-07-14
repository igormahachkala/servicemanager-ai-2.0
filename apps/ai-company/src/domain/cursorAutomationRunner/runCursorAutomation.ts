/**
 * Cursor Automation Runner — runCursorAutomation() (AI-COMPANY-113).
 */

import { isAutomaticDispatchBlockedByCost } from '../cursorExecutionRoute/cursorCostGuard'
import { createPendingAutomationEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeFactories'
import { createTransportFailureEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeFactories'
import { mapEnvelopeToToolResultOutput } from '../cursorResultEnvelope/cursorResultEnvelopeAdapters'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { buildCursorAutomationInstruction } from './cursorAutomationInstruction'
import {
  buildBuilderAutomationPayload,
  buildBusinessIdempotencyKey,
  buildRetryIdempotencyKey,
  buildWebhookRequestBody,
} from './cursorAutomationPayload'
import { createCursorAutomationRunnerEvent } from './cursorAutomationRunnerObservability'
import {
  createAttemptId,
  findSuccessfulDispatchAttempt,
  hasBusinessEnqueueAttempt,
  mergeRunOutputWithRunner,
  nextAttemptNumber,
  patchRunnerMetadata,
  readCursorAutomationRunnerMetadata,
} from './cursorAutomationRunnerMetadata'
import type {
  CursorAutomationExecutionAttempt,
  CursorAutomationRunnerEvent,
  CursorAutomationRunnerReasonCode,
  CursorAutomationWebhookConfig,
  RunCursorAutomationInput,
  RunCursorAutomationOutcome,
} from './cursorAutomationRunnerTypes'
import { invokeCursorAutomationWebhook, type CursorAutomationFetch } from './cursorAutomationWebhookClient'
import { isCursorAutomationWebhookConfigured } from './cursorAutomationWebhookConfig'

export type RunCursorAutomationDeps = {
  upsertRun: (run: ToolExecutionRun) => ToolExecutionRun
  markQueued: (runId: string, message?: string | null) => ToolExecutionRun | null
  markRunning: (runId: string, message?: string | null) => ToolExecutionRun | null
  markFailed: (runId: string, error: string, message?: string | null) => ToolExecutionRun | null
  resolveWebhookConfig: () => CursorAutomationWebhookConfig
  fetchImpl?: CursorAutomationFetch
  logEvent: (event: CursorAutomationRunnerEvent) => void
  now?: () => string
}

function reject(
  code: CursorAutomationRunnerReasonCode,
  message: string,
  run: ToolExecutionRun | null,
  deps: RunCursorAutomationDeps,
  eventType: CursorAutomationRunnerEvent['type'],
  retryable?: boolean,
): Extract<RunCursorAutomationOutcome, { ok: false }> {
  if (run) {
    const event = createCursorAutomationRunnerEvent(eventType, run.id, code)
    deps.logEvent(event)
  }
  return { ok: false, code, message, run, retryable }
}

function appendHistory(
  run: ToolExecutionRun,
  status: ToolExecutionRun['status'],
  message: string,
): ToolExecutionRun['history'] {
  return [
    ...run.history,
    {
      id: `hist-${Date.now()}`,
      status,
      at: new Date().toISOString(),
      message,
    },
  ]
}

export async function runCursorAutomation(
  input: RunCursorAutomationInput,
  deps: RunCursorAutomationDeps,
): Promise<RunCursorAutomationOutcome> {
  const now = deps.now?.() ?? new Date().toISOString()
  const { run, routeDecision } = input

  if (routeDecision.selectedRoute !== 'CURSOR_AUTOMATION_WEBHOOK') {
    return reject(
      'ROUTE_MISMATCH',
      `Expected CURSOR_AUTOMATION_WEBHOOK, got ${routeDecision.selectedRoute ?? 'unknown'}.`,
      run,
      deps,
      'cursor_automation_dispatch_failed',
    )
  }

  if (!routeDecision.allowed && routeDecision.requiresOwnerApproval && !input.ownerApproved) {
    return reject(
      'OWNER_APPROVAL_REQUIRED',
      'Owner approval is required before Cursor Automation dispatch.',
      run,
      deps,
      'cursor_automation_dispatch_failed',
    )
  }

  if (!routeDecision.allowed && !input.ownerApproved) {
    return reject(
      'ROUTE_NOT_ALLOWED',
      routeDecision.explanation,
      run,
      deps,
      'cursor_automation_dispatch_failed',
    )
  }

  if (isAutomaticDispatchBlockedByCost(routeDecision.costClassification)) {
    const event = createCursorAutomationRunnerEvent(
      'cursor_automation_cost_blocked',
      run.id,
      'COST_BLOCKED',
      { costClassification: routeDecision.costClassification },
    )
    deps.logEvent(event)
    return {
      ok: false,
      code: 'COST_BLOCKED',
      message: `Cost Guard blocked dispatch: ${routeDecision.costClassification}.`,
      run,
    }
  }

  if (run.status !== 'approved' && run.status !== 'queued' && run.status !== 'running') {
    return reject(
      'RUN_NOT_APPROVED',
      `ToolExecutionRun must be approved before dispatch (status=${run.status}).`,
      run,
      deps,
      'cursor_automation_dispatch_failed',
    )
  }

  const webhookConfig = deps.resolveWebhookConfig()
  if (!isCursorAutomationWebhookConfigured(webhookConfig)) {
    return reject(
      'WEBHOOK_CONFIG_MISSING',
      'CURSOR_AUTOMATION_WEBHOOK_URL or CURSOR_AUTOMATION_WEBHOOK_API_KEY is not configured.',
      run,
      deps,
      'cursor_automation_dispatch_failed',
    )
  }

  let workingRun = run
  let metadata = readCursorAutomationRunnerMetadata(run)
  if (!metadata) {
    workingRun = patchRunnerMetadata(run, {
      repository: input.repository,
      baseBranch: input.baseBranch,
      environment: input.environment ?? 'dev',
      dispatchPhase: 'DISPATCHING',
      idempotencyKey: buildBusinessIdempotencyKey(run.id),
    })
    deps.upsertRun(workingRun)
    metadata = readCursorAutomationRunnerMetadata(workingRun)!
  }

  if (!input.isRetry && hasBusinessEnqueueAttempt(metadata)) {
    const event = createCursorAutomationRunnerEvent(
      'cursor_automation_duplicate_blocked',
      run.id,
      'DUPLICATE_DISPATCH_BLOCKED',
    )
    deps.logEvent(event)
    return {
      ok: false,
      code: 'DUPLICATE_DISPATCH_BLOCKED',
      message: 'Duplicate business enqueue blocked — existing dispatch attempt found.',
      run,
    }
  }

  const attemptNumber = nextAttemptNumber(metadata)
  const idempotencyKey = input.isRetry
    ? buildRetryIdempotencyKey(run.id, attemptNumber)
    : buildBusinessIdempotencyKey(run.id)

  const dispatchStartedEvent = createCursorAutomationRunnerEvent(
    'cursor_automation_dispatch_started',
    run.id,
    'DISPATCH_STARTED',
    { attemptNumber, idempotencyKey },
    webhookConfig.apiKey,
  )
  deps.logEvent(dispatchStartedEvent)

  let working = patchRunnerMetadata(workingRun, {
    ...metadata,
    dispatchPhase: 'DISPATCHING',
    idempotencyKey,
  })
  working = {
    ...working,
    status: working.status === 'approved' ? 'queued' : working.status,
    history: appendHistory(working, 'queued', 'Cursor Automation dispatch — DISPATCHING.'),
    updatedAt: now,
  }
  deps.upsertRun(working)
  if (working.status === 'queued') {
    deps.markQueued(run.id, 'Cursor Automation dispatch queued.')
  }

  const payload = buildBuilderAutomationPayload({
    run,
    repository: input.repository,
    baseBranch: input.baseBranch,
    environment: input.environment ?? 'dev',
    constraints: input.constraints,
    requiredChecks: input.requiredChecks,
    idempotencyKey,
  })

  const instruction = buildCursorAutomationInstruction(payload)
  const requestBody = {
    ...buildWebhookRequestBody({ ...payload, instruction }),
    instruction,
  }

  const response = await invokeCursorAutomationWebhook({
    config: webhookConfig,
    body: requestBody,
    fetchImpl: deps.fetchImpl,
  })

  const attempt: CursorAutomationExecutionAttempt = {
    id: createAttemptId(run.id, attemptNumber),
    idempotencyKey,
    attemptNumber,
    startedAt: now,
    finishedAt: new Date().toISOString(),
    httpStatus: response.httpStatus || null,
    backgroundComposerId: response.backgroundComposerId,
    transportStatus: response.success ? 'DISPATCHED' : 'TRANSPORT_FAILED',
    errorMessage: response.errorMessage,
  }

  const attempts = [...metadata.attempts, attempt]

  if (!response.success || !response.backgroundComposerId) {
    const code =
      response.httpStatus === 401
        ? 'TRANSPORT_UNAUTHORIZED'
        : response.httpStatus === 400
          ? 'TRANSPORT_BAD_REQUEST'
          : response.httpStatus >= 500 || response.retryable
            ? 'TRANSPORT_SERVER_ERROR'
            : response.httpStatus === 0
              ? 'TRANSPORT_NETWORK_ERROR'
              : 'INVALID_WEBHOOK_RESPONSE'

    const failureEnvelope = createTransportFailureEnvelope({
      toolExecutionRunId: run.id,
      route: 'CURSOR_AUTOMATION_WEBHOOK',
      errors: [
        {
          code,
          message: response.errorMessage ?? 'Cursor Automation webhook transport failed.',
          source: 'transport',
          terminal: true,
        },
      ],
      metadata: { attemptId: attempt.id, httpStatus: response.httpStatus },
    })

    const failedRun = deps.markFailed(
      run.id,
      response.errorMessage ?? 'Cursor Automation webhook transport failed.',
      'Cursor Automation transport failure.',
    )

    const patched = patchRunnerMetadata(failedRun ?? working, {
      dispatchPhase: 'TRANSPORT_FAILED',
      attempts,
    })
    const persisted = deps.upsertRun({
      ...patched,
      result: mergeRunOutputWithRunner(patched, readCursorAutomationRunnerMetadata(patched)!, {
        executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
        cursorResultEnvelopeV110: mapEnvelopeToToolResultOutput(failureEnvelope).cursorResultEnvelopeV110,
      }),
      history: appendHistory(patched, 'failed', response.errorMessage ?? 'Transport failed.'),
    })

    const failEvent = createCursorAutomationRunnerEvent(
      'cursor_automation_dispatch_failed',
      run.id,
      code,
      { httpStatus: response.httpStatus, attemptNumber },
      webhookConfig.apiKey,
    )
    deps.logEvent(failEvent)

    return {
      ok: false,
      code,
      message: response.errorMessage ?? 'Cursor Automation webhook transport failed.',
      run: persisted,
      retryable: response.retryable,
    }
  }

  const pendingEnvelope = createPendingAutomationEnvelope({
    toolExecutionRunId: run.id,
    backgroundComposerId: response.backgroundComposerId,
    startedAt: now,
    metadata: {
      idempotencyKey,
      attemptId: attempt.id,
      repository: input.repository,
      baseBranch: input.baseBranch,
    },
  })

  const queuedRun = deps.markQueued(run.id, 'Cursor Automation enqueued — awaiting result.') ?? working
  const runningRun =
    deps.markRunning(run.id, 'Cursor Automation DISPATCHED — RESULT_PENDING.') ?? queuedRun

  const dispatchedMetadata = readCursorAutomationRunnerMetadata(runningRun) ?? metadata
  const nextMetadata = {
    ...dispatchedMetadata,
    dispatchPhase: 'RESULT_PENDING' as const,
    dispatchedAt: now,
    attempts,
    reconciliationStartedAt: dispatchedMetadata.reconciliationStartedAt ?? now,
    timeoutAt:
      dispatchedMetadata.timeoutAt ??
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }

  const persisted = deps.upsertRun({
    ...runningRun,
    status: 'running',
    startedAt: runningRun.startedAt ?? now,
    result: mergeRunOutputWithRunner(runningRun, nextMetadata, {
      executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
      ...mapEnvelopeToToolResultOutput(pendingEnvelope, {
        executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
        cursorAutomationDispatch: {
          backgroundComposerId: response.backgroundComposerId,
          attemptId: attempt.id,
        },
      }),
    }),
    history: appendHistory(
      runningRun,
      'running',
      'Cursor Automation DISPATCHED — RESULT_PENDING (HTTP 200 is not execution success).',
    ),
    updatedAt: now,
  })

  const successEvent = createCursorAutomationRunnerEvent(
    'cursor_automation_dispatch_succeeded',
    run.id,
    'DISPATCH_SUCCEEDED',
    {
      backgroundComposerId: response.backgroundComposerId,
      attemptNumber,
    },
    webhookConfig.apiKey,
  )
  deps.logEvent(successEvent)

  const pendingEvent = createCursorAutomationRunnerEvent(
    'cursor_automation_result_pending',
    run.id,
    'RESULT_PENDING',
    { externalCorrelationId: response.backgroundComposerId },
    webhookConfig.apiKey,
  )
  deps.logEvent(pendingEvent)

  return {
    ok: true,
    run: persisted,
    envelope: pendingEnvelope,
    backgroundComposerId: response.backgroundComposerId,
    attempt,
  }
}

export function getDispatchedExternalCorrelationId(run: ToolExecutionRun): string | null {
  const metadata = readCursorAutomationRunnerMetadata(run)
  const attempt = metadata ? findSuccessfulDispatchAttempt(metadata) : null
  return attempt?.backgroundComposerId ?? null
}
