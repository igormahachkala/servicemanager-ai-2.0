/**
 * Builder Automation Task Flow — UI state projection (AI-COMPANY-113).
 */

import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import { parseCursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeValidation'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { DelegationReviewRecord } from '../delegationReview/delegationReviewTypes'
import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes'
import { getDispatchedExternalCorrelationId } from '../cursorAutomationRunner/runCursorAutomation'
import { readCursorAutomationRunnerMetadata } from '../cursorAutomationRunner/cursorAutomationRunnerMetadata'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  readBuilderAutomationTaskFlowMetadata,
  readRouteDecisionFromRunOutput,
} from './builderAutomationTaskFlowMetadata'
import type {
  BuilderAutomationRouteDecisionView,
  BuilderAutomationTaskFlowSnapshot,
  BuilderAutomationTaskFlowUiState,
} from './builderAutomationTaskFlowTypes'

const UI_STATE_LABELS: Record<BuilderAutomationTaskFlowUiState, string> = {
  planned: 'Planned',
  awaiting_owner_approval: 'Awaiting Owner Approval',
  dispatching: 'Dispatching',
  dispatched: 'Dispatched',
  waiting_for_cursor_result: 'Waiting for Cursor result',
  result_discovered: 'Result discovered',
  awaiting_builder_review: 'Awaiting Builder Review',
  awaiting_max_review: 'Awaiting MAX Review',
  completed: 'Completed',
  failed: 'Failed',
  timed_out: 'Timed out',
  cancelled: 'Cancelled',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readEnvelopeFromRun(run: ToolExecutionRun): CursorResultEnvelope | null {
  const output = run.result?.output
  if (!isRecord(output)) return null
  const raw = output.cursorResultEnvelopeV110
  if (!isRecord(raw)) return null
  return parseCursorResultEnvelope(raw)
}

export function toRouteDecisionView(
  decision: ExecutionRouteDecision | null,
): BuilderAutomationRouteDecisionView | null {
  if (!decision) return null
  return {
    selectedRoute: decision.selectedRoute,
    allowed: decision.allowed,
    requiresOwnerApproval: decision.requiresOwnerApproval,
    costClassification: decision.costClassification,
    reasonCode: decision.reasonCode,
    explanation: decision.explanation,
  }
}

function resolveUiState(
  run: ToolExecutionRun,
  builderReview: EmployeeToolReview | null,
  maxReview: DelegationReviewRecord | null,
  envelope: CursorResultEnvelope | null,
): BuilderAutomationTaskFlowUiState {
  if (run.status === 'cancelled') return 'cancelled'
  if (run.status === 'failed') return 'failed'

  if (envelope?.executionStatus === 'TIMED_OUT') return 'timed_out'

  if (maxReview?.status === 'accepted' && run.status === 'accepted') {
    return 'completed'
  }

  if (
    builderReview &&
    (builderReview.status === 'sent_to_max' || builderReview.status === 'accepted') &&
    maxReview &&
    (maxReview.status === 'awaiting_review' || maxReview.status === 'awaiting_result')
  ) {
    return 'awaiting_max_review'
  }

  if (run.status === 'awaiting_employee_review') {
    return 'awaiting_builder_review'
  }

  if (run.status === 'result_received') {
    return 'result_discovered'
  }

  const runnerMeta = readCursorAutomationRunnerMetadata(run)
  if (runnerMeta?.dispatchPhase === 'DISPATCHING') return 'dispatching'
  if (runnerMeta?.dispatchPhase === 'DISPATCHED' || runnerMeta?.dispatchPhase === 'RESULT_PENDING') {
    if (envelope?.executionStatus === 'RESULT_PENDING') return 'waiting_for_cursor_result'
    return 'dispatched'
  }
  if (runnerMeta?.dispatchPhase === 'REVIEW_REQUIRED') return 'result_discovered'

  if (run.status === 'running' || run.status === 'queued') {
    return 'waiting_for_cursor_result'
  }

  if (run.status === 'approved') {
    const metadata = readBuilderAutomationTaskFlowMetadata(run)
    if (metadata?.ownerApprovedAt) return 'dispatching'
    return 'awaiting_owner_approval'
  }

  if (run.status === 'awaiting_owner') {
    return 'awaiting_owner_approval'
  }

  if (run.status === 'accepted' && !maxReview) {
    return 'awaiting_max_review'
  }

  return 'planned'
}

export function projectBuilderAutomationTaskFlowSnapshot(input: {
  run: ToolExecutionRun
  builderReview?: EmployeeToolReview | null
  maxReview?: DelegationReviewRecord | null
  routeDecision?: ExecutionRouteDecision | null
}): BuilderAutomationTaskFlowSnapshot {
  const metadata = readBuilderAutomationTaskFlowMetadata(input.run)
  const routeDecision = input.routeDecision ?? readRouteDecisionFromRunOutput(input.run)
  const builderReview = input.builderReview ?? null
  const maxReview = input.maxReview ?? null
  const envelope = readEnvelopeFromRun(input.run)
  const uiState = resolveUiState(input.run, builderReview, maxReview, envelope)

  const canApproveAndDispatch = input.run.status === 'awaiting_owner'
  const canBuilderReview =
    builderReview?.status === 'awaiting_employee_review' && uiState === 'awaiting_builder_review'
  const canMaxReview = maxReview?.status === 'awaiting_review'

  const showFinalReport =
    uiState === 'completed' ||
    uiState === 'failed' ||
    uiState === 'timed_out' ||
    uiState === 'cancelled' ||
    (uiState === 'awaiting_max_review' && maxReview !== null)

  return {
    runId: input.run.id,
    workItemId: input.run.workItemId,
    delegationPlanId: input.run.delegationPlanId,
    uiState,
    uiStateLabel: UI_STATE_LABELS[uiState],
    routeDecision: toRouteDecisionView(routeDecision),
    metadata,
    canApproveAndDispatch,
    canBuilderReview,
    canMaxReview,
    showFinalReport,
    externalCorrelationId: getDispatchedExternalCorrelationId(input.run),
    run: input.run,
    builderReview,
    maxReview,
    envelope,
  }
}

export function builderAutomationTaskFlowUiStateLabel(
  state: BuilderAutomationTaskFlowUiState,
): string {
  return UI_STATE_LABELS[state]
}
