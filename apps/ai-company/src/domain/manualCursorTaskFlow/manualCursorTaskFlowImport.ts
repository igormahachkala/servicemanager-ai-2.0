/**
 * Manual Cursor Task Flow — result import boundary (AI-COMPANY-112).
 */

import { importManualCloudAgentResultWithDefaults } from '../manualCloudAgentImport/manualCloudAgentImportDefaultDeps'
import { getEmployeeToolReviewByRunId } from '../employeeToolReview/employeeToolReviewStorage'
import { getToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import { listDelegationReviews } from '../delegationReview/delegationReviewStorage'
import { projectManualCursorTaskFlowSnapshot } from './manualCursorTaskFlowState'
import type { SubmitManualCursorResultImportInput } from './manualCursorTaskFlowTypes'

export type SubmitManualCursorResultImportOutcome =
  | {
      ok: true
      snapshot: ReturnType<typeof projectManualCursorTaskFlowSnapshot>
      importReasonCode: string
    }
  | {
      ok: false
      reasonCode: string
      message: string
      existingResultRef: string | null
    }

export function submitManualCursorResultImport(
  importInput: SubmitManualCursorResultImportInput,
): SubmitManualCursorResultImportOutcome {
  const outcome = importManualCloudAgentResultWithDefaults(importInput)

  if (!outcome.ok) {
    return {
      ok: false,
      reasonCode: outcome.reasonCode,
      message: outcome.message,
      existingResultRef: outcome.existingResultRef,
    }
  }

  const builderReview =
    outcome.review ?? getEmployeeToolReviewByRunId(outcome.run.id)
  const maxReview =
    outcome.run.delegationPlanId
      ? listDelegationReviews().find(
          (item) =>
            item.delegationPlanId === outcome.run.delegationPlanId &&
            item.status !== 'failed',
        ) ?? null
      : null

  return {
    ok: true,
    snapshot: projectManualCursorTaskFlowSnapshot({
      run: outcome.run,
      builderReview,
      maxReview,
    }),
    importReasonCode: outcome.reasonCode,
  }
}

export function loadManualCursorTaskFlowSnapshot(runId: string) {
  const run = getToolExecutionRun(runId)
  if (!run) return null

  const builderReview = getEmployeeToolReviewByRunId(runId)
  const maxReview =
    run.delegationPlanId
      ? listDelegationReviews().find(
          (item) => item.delegationPlanId === run.delegationPlanId,
        ) ?? null
      : null

  return projectManualCursorTaskFlowSnapshot({
    run,
    builderReview,
    maxReview,
  })
}
