/**
 * Builder Automation Task Flow — final Owner report (AI-COMPANY-113).
 */

import type {
  BuilderAutomationFinalReport,
  BuilderAutomationTaskFlowSnapshot,
} from './builderAutomationTaskFlowTypes'

export function buildBuilderAutomationFinalReport(
  snapshot: BuilderAutomationTaskFlowSnapshot,
): BuilderAutomationFinalReport {
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
  if (!completed) {
    warnings.push('Task is not fully completed — review gates may still be open.')
  }

  let nextRecommendedAction = 'Monitor autonomous Builder execution status.'
  if (snapshot.uiState === 'awaiting_owner_approval') {
    nextRecommendedAction = 'Approve and launch via Cursor Automations — no manual Cursor steps required.'
  } else if (
    snapshot.uiState === 'dispatching' ||
    snapshot.uiState === 'dispatched' ||
    snapshot.uiState === 'waiting_for_cursor_result'
  ) {
    nextRecommendedAction = 'Wait — Builder tracks Cursor Automation result automatically.'
  } else if (snapshot.uiState === 'awaiting_builder_review') {
    nextRecommendedAction = 'Complete Builder review in Builder chat.'
  } else if (snapshot.uiState === 'awaiting_max_review') {
    nextRecommendedAction = 'Complete MAX review in MAX chat.'
  } else if (completed) {
    nextRecommendedAction = 'No action required — autonomous flow completed after MAX review.'
  } else if (snapshot.uiState === 'failed' || snapshot.uiState === 'timed_out') {
    nextRecommendedAction = 'Inspect failure details and create a follow-up task if needed.'
  }

  return {
    taskTitle: snapshot.run.title,
    employeeLabel: 'Builder',
    executionRoute: snapshot.routeDecision?.selectedRoute ?? 'CURSOR_AUTOMATION_WEBHOOK',
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
    transportStatus: envelope?.transportStatus ?? null,
    externalCorrelationId: snapshot.externalCorrelationId,
    completed,
    warnings,
    errors,
    nextRecommendedAction,
  }
}
