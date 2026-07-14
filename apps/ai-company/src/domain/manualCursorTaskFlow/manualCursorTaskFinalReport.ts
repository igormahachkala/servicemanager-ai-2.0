/**
 * Manual Cursor Task Flow — final Owner report (AI-COMPANY-112).
 */

import type { ManualCursorTaskFlowSnapshot } from './manualCursorTaskFlowTypes'
import type { ManualCursorFinalReport } from './manualCursorTaskFlowTypes'

export function buildManualCursorFinalReport(
  snapshot: ManualCursorTaskFlowSnapshot,
): ManualCursorFinalReport {
  const envelope = snapshot.envelope
  const builderStatus = snapshot.builderReview?.status ?? null
  const maxStatus = snapshot.maxReview?.status ?? null

  const completed =
    snapshot.uiState === 'completed' &&
    maxStatus === 'accepted' &&
    snapshot.run.status === 'accepted'

  const builderReviewDecision =
    builderStatus === 'accepted'
      ? 'accepted'
      : builderStatus === 'rejected'
        ? 'rejected'
        : builderStatus === 'awaiting_employee_review'
          ? 'pending'
          : null

  const maxReviewDecision =
    maxStatus === 'accepted'
      ? 'accepted'
      : maxStatus === 'rework_requested'
        ? 'rework_requested'
        : maxStatus === 'awaiting_review'
          ? 'pending'
          : null

  const errors = envelope?.errors.map((item) => item.message) ?? []
  if (snapshot.run.error) errors.push(snapshot.run.error)

  const warnings: string[] = []
  if (envelope?.executionStatus === 'SUCCEEDED' && builderReviewDecision === 'rejected') {
    warnings.push('Execution succeeded but Builder review rejected — not a business success.')
  }
  if (!completed) {
    warnings.push('Task is not fully completed — review gates may still be open.')
  }

  let nextRecommendedAction = 'Monitor task status.'
  if (snapshot.uiState === 'awaiting_owner_approval') {
    nextRecommendedAction = 'Approve MANUAL_CLOUD_AGENT execution and copy the Cursor task package.'
  } else if (snapshot.uiState === 'waiting_for_cursor_result') {
    nextRecommendedAction = 'Run Cursor Cloud Agent and import branch/commit/PR result.'
  } else if (snapshot.uiState === 'awaiting_builder_review') {
    nextRecommendedAction = 'Complete Builder review in Builder chat.'
  } else if (snapshot.uiState === 'awaiting_max_review') {
    nextRecommendedAction = 'Complete MAX review in MAX chat.'
  } else if (completed) {
    nextRecommendedAction = 'No action required — task completed after MAX review.'
  } else if (snapshot.uiState === 'failed') {
    nextRecommendedAction = 'Inspect failure details and create a follow-up task if needed.'
  }

  return {
    taskTitle: snapshot.run.title,
    employeeLabel: 'Builder',
    executionRoute: snapshot.routeDecision?.selectedRoute ?? 'MANUAL_CLOUD_AGENT',
    branch: envelope?.branch ?? null,
    commitSha: envelope?.commitSha ?? null,
    pullRequestUrl: envelope?.pullRequestUrl ?? null,
    changedFiles: envelope?.changedFiles ?? [],
    checks:
      envelope?.checks.map((check) => ({
        name: check.name,
        status: check.status,
        details: check.outputSummary ?? undefined,
      })) ?? [],
    builderReviewDecision,
    maxReviewDecision,
    executionStatus: envelope?.executionStatus ?? null,
    reviewStatus: envelope?.reviewStatus ?? null,
    summary: envelope?.summary ?? snapshot.run.expectedResult ?? null,
    errors,
    warnings,
    nextRecommendedAction,
    completed,
  }
}
