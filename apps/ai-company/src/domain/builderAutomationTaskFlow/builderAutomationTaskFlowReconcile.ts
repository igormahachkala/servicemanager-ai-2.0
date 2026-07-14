/**
 * Builder Automation Task Flow — reconciliation tick (AI-COMPANY-113).
 */

import { getEmployeeToolReviewByRunId } from '../employeeToolReview/employeeToolReviewStorage'
import { listDelegationReviews } from '../delegationReview/delegationReviewStorage'
import { getToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import { reconcileCursorAutomationWithDefaults } from '../cursorAutomationRunner/cursorAutomationRunnerDefaultDeps'
import type { ReconcileCursorAutomationDeps } from '../cursorAutomationRunner/cursorAutomationReconciliation'
import {
  mergeRunOutput,
  patchBuilderAutomationTaskFlowMetadata,
  readBuilderAutomationTaskFlowMetadata,
} from './builderAutomationTaskFlowMetadata'
import { projectBuilderAutomationTaskFlowSnapshot } from './builderAutomationTaskFlowState'
import type { BuilderAutomationTaskFlowSnapshot } from './builderAutomationTaskFlowTypes'
import { upsertToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'

export type TickBuilderAutomationReconciliationOutcome =
  | { ok: true; snapshot: BuilderAutomationTaskFlowSnapshot; status: string }
  | { ok: false; code: string; message: string }

export async function tickBuilderAutomationReconciliation(
  runId: string,
  partialDeps?: Partial<ReconcileCursorAutomationDeps>,
): Promise<TickBuilderAutomationReconciliationOutcome> {
  const outcome = await reconcileCursorAutomationWithDefaults(
    { runId, pollIntervalMs: 0 },
    partialDeps,
  )

  if (!outcome.ok) {
    return { ok: false, code: outcome.code, message: outcome.message }
  }

  const run = outcome.run
  const metadata = readBuilderAutomationTaskFlowMetadata(run)
  if (
    metadata &&
    (outcome.status === 'DISCOVERED' || outcome.status === 'FAILED' || outcome.status === 'TIMED_OUT')
  ) {
    upsertToolExecutionRun({
      ...run,
      result: mergeRunOutput(
        run,
        patchBuilderAutomationTaskFlowMetadata(
          {
            ...metadata,
            resultDiscoveredAt: new Date().toISOString(),
          },
          run.result?.output ?? {},
        ),
        false,
      ),
    })
  }

  const refreshed = getToolExecutionRun(runId) ?? run
  const builderReview = getEmployeeToolReviewByRunId(runId)
  const maxReview =
    refreshed.delegationPlanId
      ? listDelegationReviews().find(
          (item) => item.delegationPlanId === refreshed.delegationPlanId,
        ) ?? null
      : null

  return {
    ok: true,
    snapshot: projectBuilderAutomationTaskFlowSnapshot({
      run: refreshed,
      builderReview,
      maxReview,
    }),
    status: outcome.status,
  }
}

export function loadBuilderAutomationTaskFlowSnapshot(runId: string) {
  const run = getToolExecutionRun(runId)
  if (!run) return null

  const builderReview = getEmployeeToolReviewByRunId(runId)
  const maxReview =
    run.delegationPlanId
      ? listDelegationReviews().find((item) => item.delegationPlanId === run.delegationPlanId) ??
        null
      : null

  return projectBuilderAutomationTaskFlowSnapshot({
    run,
    builderReview,
    maxReview,
  })
}
