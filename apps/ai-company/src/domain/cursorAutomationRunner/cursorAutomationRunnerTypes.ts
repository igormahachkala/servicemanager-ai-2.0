/**
 * Cursor Automation Runner — types (AI-COMPANY-113).
 */

import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

export const CURSOR_AUTOMATION_RUNNER_VERSION = 'v1' as const

export const CURSOR_AUTOMATION_DISPATCH_PHASES = [
  'DISPATCHING',
  'DISPATCHED',
  'RESULT_PENDING',
  'RECONCILING',
  'REVIEW_REQUIRED',
  'TRANSPORT_FAILED',
  'TIMED_OUT',
] as const

export type CursorAutomationDispatchPhase = (typeof CURSOR_AUTOMATION_DISPATCH_PHASES)[number]

export type CursorAutomationWebhookConfig = {
  url: string | null
  apiKey: string | null
  configKeys: {
    url: string
    apiKey: string
  }
}

export type CursorAutomationWebhookResponse = {
  httpStatus: number
  success: boolean
  backgroundComposerId: string | null
  errorMessage: string | null
  rawBody: string | null
  retryable: boolean
}

export type CursorAutomationExecutionAttempt = {
  id: string
  idempotencyKey: string
  attemptNumber: number
  startedAt: string
  finishedAt: string | null
  httpStatus: number | null
  backgroundComposerId: string | null
  transportStatus: 'DISPATCHING' | 'DISPATCHED' | 'TRANSPORT_FAILED' | 'INVALID_RESPONSE'
  errorMessage: string | null
}

export type CursorAutomationRunnerMetadata = {
  version: typeof CURSOR_AUTOMATION_RUNNER_VERSION
  repository: string
  baseBranch: string
  environment: 'dev'
  idempotencyKey: string
  dispatchPhase: CursorAutomationDispatchPhase
  ownerApprovedAt: string | null
  dispatchedAt: string | null
  reconciliationStartedAt: string | null
  reconciliationLastCheckedAt: string | null
  reconciliationPollCount: number
  resultMarkerPath: string
  branchPrefix: string
  attempts: CursorAutomationExecutionAttempt[]
  timeoutAt: string | null
  timeoutReason: string | null
}

export type BuilderAutomationPayload = {
  toolExecutionRunId: string
  taskId: string
  employeeId: string
  title: string
  instruction: string
  repository: string
  baseBranch: string
  expectedResult: string
  constraints: string[]
  requiredChecks: string[]
  idempotencyKey: string
  environment: 'dev'
  callbackHints: {
    resultMarkerPath: string
    branchPrefix: string
  }
}

export type CursorAutomationResultMarker = {
  toolExecutionRunId: string
  status: 'SUCCEEDED' | 'FAILED'
  summary: string
  branch: string
  commitSha: string
  pullRequestUrl: string | null
  changedFiles: string[]
  checks: Array<{ name: string; status: string; outputSummary?: string | null }>
  errors: Array<{ code: string; message: string }>
  finishedAt: string
}

export type RunCursorAutomationInput = {
  run: ToolExecutionRun
  routeDecision: ExecutionRouteDecision
  ownerApproved: boolean
  repository: string
  baseBranch: string
  environment?: 'dev'
  constraints?: string[]
  requiredChecks?: string[]
  /** Retry creates a new attempt when true. */
  isRetry?: boolean
}

export type RunCursorAutomationOutcome =
  | {
      ok: true
      run: ToolExecutionRun
      envelope: CursorResultEnvelope
      backgroundComposerId: string
      attempt: CursorAutomationExecutionAttempt
    }
  | {
      ok: false
      code: CursorAutomationRunnerReasonCode
      message: string
      run: ToolExecutionRun | null
      retryable?: boolean
    }

export const CURSOR_AUTOMATION_RUNNER_REASON_CODES = [
  'RUN_NOT_APPROVED',
  'OWNER_APPROVAL_REQUIRED',
  'ROUTE_MISMATCH',
  'ROUTE_NOT_ALLOWED',
  'COST_BLOCKED',
  'WEBHOOK_CONFIG_MISSING',
  'DUPLICATE_DISPATCH_BLOCKED',
  'TRANSPORT_UNAUTHORIZED',
  'TRANSPORT_BAD_REQUEST',
  'TRANSPORT_SERVER_ERROR',
  'TRANSPORT_NETWORK_ERROR',
  'INVALID_WEBHOOK_RESPONSE',
  'RUN_NOT_FOUND',
] as const

export type CursorAutomationRunnerReasonCode = (typeof CURSOR_AUTOMATION_RUNNER_REASON_CODES)[number]

export type CursorAutomationRunnerEventType =
  | 'cursor_automation_dispatch_started'
  | 'cursor_automation_dispatch_succeeded'
  | 'cursor_automation_dispatch_failed'
  | 'cursor_automation_result_pending'
  | 'cursor_automation_result_discovered'
  | 'cursor_automation_result_timed_out'
  | 'cursor_automation_duplicate_blocked'
  | 'cursor_automation_cost_blocked'

export type CursorAutomationRunnerEvent = {
  type: CursorAutomationRunnerEventType
  at: string
  toolExecutionRunId: string
  reasonCode: CursorAutomationRunnerReasonCode | string
  metadata?: Record<string, unknown>
}

export type ReconcileCursorAutomationInput = {
  runId: string
  now?: string
  pollIntervalMs?: number
  timeoutMs?: number
}

export type ReconcileCursorAutomationOutcome =
  | { ok: true; status: 'RESULT_PENDING'; run: ToolExecutionRun }
  | {
      ok: true
      status: 'DISCOVERED' | 'TIMED_OUT' | 'FAILED'
      run: ToolExecutionRun
      envelope: CursorResultEnvelope
    }
  | { ok: false; code: string; message: string; run: ToolExecutionRun | null }
