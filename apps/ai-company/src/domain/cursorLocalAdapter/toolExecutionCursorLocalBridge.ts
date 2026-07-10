/**
 * ToolExecutionRun → CursorLocalAdapter integration point (AI-COMPANY-113C).
 * Prepare-only in V1 — submit NOT wired until confirmed non-API path exists.
 */

import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { prepareCursorLocalTask } from './cursorLocalAdapterPrepare'
import { submitCursorLocalTask } from './cursorLocalAdapterSubmit'
import type { CursorLocalSubmissionResult, CursorLocalTaskEnvelope } from './cursorLocalAdapterTypes'

/** Explicit gate — do not auto-submit from approveToolExecutionRun until 113D+. */
export const CURSOR_LOCAL_AUTO_SUBMIT_ENABLED = false

export type PlanCursorLocalExecutionOutcome = {
  envelope: CursorLocalTaskEnvelope
  submit: CursorLocalSubmissionResult | null
}

function buildPrepareInput(run: ToolExecutionRun) {
  return {
    title: run.title,
    instructions: run.instructions,
    expectedResult: run.expectedResult,
    checks: run.checks,
    fileScope: run.fileScope,
    toolExecutionRunId: run.id,
    workItemId: run.workItemId,
    employeeId: run.employeeId,
    companyId: run.companyId,
  }
}

export function planCursorLocalExecutionFromToolRun(run: ToolExecutionRun): PlanCursorLocalExecutionOutcome {
  const envelope = prepareCursorLocalTask(buildPrepareInput(run))

  if (!CURSOR_LOCAL_AUTO_SUBMIT_ENABLED) {
    return { envelope, submit: null }
  }

  return {
    envelope,
    submit: submitCursorLocalTask({ envelopeId: envelope.envelopeId }),
  }
}

/**
 * Hook for approved ToolExecutionRun — returns prepare outcome only in V1.
 * Callers must NOT treat null submit as success.
 */
export function bridgeApprovedToolExecutionToCursorLocal(
  run: ToolExecutionRun,
): PlanCursorLocalExecutionOutcome {
  if (run.status !== 'approved' && run.status !== 'queued') {
    const envelope = prepareCursorLocalTask(buildPrepareInput(run))
    return {
      envelope,
      submit: {
        status: 'unsupported',
        reason: `Tool execution run must be approved before Cursor local bridge (status: ${run.status}).`,
        envelopeId: envelope.envelopeId,
        openedUri: null,
        requiresManualAction: true,
      },
    }
  }

  return planCursorLocalExecutionFromToolRun(run)
}
