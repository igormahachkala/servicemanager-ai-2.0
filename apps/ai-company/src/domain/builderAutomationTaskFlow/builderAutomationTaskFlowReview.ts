/**
 * Builder Automation Task Flow — review actions (AI-COMPANY-113).
 */

import {
  acceptBuilderCursorToolReview,
  rejectBuilderCursorToolReview,
} from '../employeeToolReview/employeeToolReviewEngine'
import { getEmployeeToolReviewByRunId } from '../employeeToolReview/employeeToolReviewStorage'
import { acceptDelegationReview, listDelegationReviews } from '../delegationReview'
import { getToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import { loadBuilderAutomationTaskFlowSnapshot } from './builderAutomationTaskFlowReconcile'
import type { BuilderAutomationTaskFlowSnapshot } from './builderAutomationTaskFlowTypes'

export type BuilderAutomationReviewActionOutcome =
  | { ok: true; snapshot: BuilderAutomationTaskFlowSnapshot }
  | { ok: false; code: string; message: string }

export function acceptBuilderReviewForAutomationFlow(
  runId: string,
): BuilderAutomationReviewActionOutcome {
  const snapshot = loadBuilderAutomationTaskFlowSnapshot(runId)
  if (!snapshot) {
    return { ok: false, code: 'RUN_NOT_FOUND', message: 'Flow snapshot not found.' }
  }

  if (snapshot.uiState !== 'awaiting_builder_review') {
    return {
      ok: false,
      code: 'BUILDER_REVIEW_NOT_READY',
      message: 'Builder review starts only after result evidence is discovered.',
    }
  }

  const review = getEmployeeToolReviewByRunId(runId)
  if (!review) {
    return { ok: false, code: 'REVIEW_NOT_FOUND', message: 'Builder review not found for this run.' }
  }

  const outcome = acceptBuilderCursorToolReview(review.id)
  if (!outcome.ok) {
    return { ok: false, code: outcome.code, message: outcome.message }
  }

  const refreshed = loadBuilderAutomationTaskFlowSnapshot(runId)
  if (!refreshed) {
    return { ok: false, code: 'RUN_NOT_FOUND', message: 'Could not reload flow snapshot.' }
  }

  return { ok: true, snapshot: refreshed }
}

export function rejectBuilderReviewForAutomationFlow(
  runId: string,
  reason: string,
): BuilderAutomationReviewActionOutcome {
  const review = getEmployeeToolReviewByRunId(runId)
  if (!review) {
    return { ok: false, code: 'REVIEW_NOT_FOUND', message: 'Builder review not found for this run.' }
  }

  const outcome = rejectBuilderCursorToolReview(review.id, reason)
  if (!outcome.ok) {
    return { ok: false, code: outcome.code, message: outcome.message }
  }

  const snapshot = loadBuilderAutomationTaskFlowSnapshot(runId)
  if (!snapshot) {
    return { ok: false, code: 'RUN_NOT_FOUND', message: 'Could not reload flow snapshot.' }
  }

  return { ok: true, snapshot }
}

export function acceptMaxReviewForAutomationFlow(
  runId: string,
): BuilderAutomationReviewActionOutcome {
  const run = getToolExecutionRun(runId)
  if (!run?.delegationPlanId) {
    return { ok: false, code: 'DELEGATION_MISSING', message: 'Delegation plan not linked to run.' }
  }

  const builderReview = getEmployeeToolReviewByRunId(runId)
  if (!builderReview || builderReview.status !== 'sent_to_max') {
    return {
      ok: false,
      code: 'BUILDER_REVIEW_INCOMPLETE',
      message: 'MAX review is unavailable before Builder review handoff.',
    }
  }

  const maxReview = listDelegationReviews().find(
    (item) => item.delegationPlanId === run.delegationPlanId && item.status === 'awaiting_review',
  )
  if (!maxReview) {
    return { ok: false, code: 'MAX_REVIEW_NOT_FOUND', message: 'MAX delegation review not found.' }
  }

  const outcome = acceptDelegationReview(maxReview.id)
  if (!outcome.ok) {
    return { ok: false, code: outcome.code, message: outcome.message }
  }

  const snapshot = loadBuilderAutomationTaskFlowSnapshot(runId)
  if (!snapshot) {
    return { ok: false, code: 'RUN_NOT_FOUND', message: 'Could not reload flow snapshot.' }
  }

  return { ok: true, snapshot }
}
