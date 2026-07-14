/**
 * Manual Cursor Task Flow — UI state projection (AI-COMPANY-112).
 */

import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import { parseCursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeValidation'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { DelegationReviewRecord } from '../delegationReview/delegationReviewTypes'
import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { generateCursorTaskPackageText } from './manualCursorTaskPackage'
import {
  readManualCursorTaskFlowMetadata,
  readRouteDecisionFromRunOutput,
} from './manualCursorTaskFlowMetadata'
import type {
  ManualCursorRouteDecisionView,
  ManualCursorTaskFlowSnapshot,
  ManualCursorTaskFlowUiState,
} from './manualCursorTaskFlowTypes'

const UI_STATE_LABELS: Record<ManualCursorTaskFlowUiState, string> = {
  planned: 'Planned',
  awaiting_owner_approval: 'Awaiting Owner Approval',
  ready_for_cursor: 'Ready for Cursor',
  waiting_for_cursor_result: 'Waiting for Cursor Result',
  result_imported: 'Result Imported',
  awaiting_builder_review: 'Awaiting Builder Review',
  awaiting_max_review: 'Awaiting MAX Review',
  completed: 'Completed',
  failed: 'Failed',
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
): ManualCursorRouteDecisionView | null {
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
): ManualCursorTaskFlowUiState {
  if (run.status === 'cancelled') return 'cancelled'
  if (run.status === 'failed') return 'failed'

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
    return 'result_imported'
  }

  if (run.status === 'approved' || run.status === 'queued' || run.status === 'running') {
    const metadata = readManualCursorTaskFlowMetadata(run)
    if (metadata?.ownerApprovedAt) {
      return 'waiting_for_cursor_result'
    }
    return 'ready_for_cursor'
  }

  if (run.status === 'awaiting_owner') {
    return 'awaiting_owner_approval'
  }

  if (run.status === 'accepted' && !maxReview) {
    return 'awaiting_max_review'
  }

  return 'planned'
}

export function projectManualCursorTaskFlowSnapshot(input: {
  run: ToolExecutionRun
  builderReview?: EmployeeToolReview | null
  maxReview?: DelegationReviewRecord | null
  routeDecision?: ExecutionRouteDecision | null
}): ManualCursorTaskFlowSnapshot {
  const metadata = readManualCursorTaskFlowMetadata(input.run)
  const routeDecision =
    input.routeDecision ??
    readRouteDecisionFromRunOutput(input.run)
  const builderReview = input.builderReview ?? null
  const maxReview = input.maxReview ?? null
  const uiState = resolveUiState(input.run, builderReview, maxReview)
  const envelope = readEnvelopeFromRun(input.run)

  const canApprove = input.run.status === 'awaiting_owner'
  const canImport =
    Boolean(metadata?.ownerApprovedAt) &&
    (input.run.status === 'approved' ||
      input.run.status === 'queued' ||
      input.run.status === 'running') &&
    !envelope

  const canBuilderReview =
    builderReview?.status === 'awaiting_employee_review' && uiState === 'awaiting_builder_review'

  const canMaxReview = maxReview?.status === 'awaiting_review'

  const showFinalReport =
    uiState === 'completed' ||
    uiState === 'failed' ||
    uiState === 'cancelled' ||
    (uiState === 'awaiting_max_review' && maxReview !== null)

  const taskPackage =
    metadata && metadata.ownerApprovedAt
      ? generateCursorTaskPackageText(input.run, metadata)
      : null

  return {
    runId: input.run.id,
    workItemId: input.run.workItemId,
    delegationPlanId: input.run.delegationPlanId,
    uiState,
    uiStateLabel: UI_STATE_LABELS[uiState],
    routeDecision: toRouteDecisionView(routeDecision),
    metadata,
    taskPackage,
    canApprove,
    canImport,
    canBuilderReview,
    canMaxReview,
    showFinalReport,
    run: input.run,
    builderReview,
    maxReview,
    envelope,
  }
}

export function manualCursorTaskFlowUiStateLabel(state: ManualCursorTaskFlowUiState): string {
  return UI_STATE_LABELS[state]
}
