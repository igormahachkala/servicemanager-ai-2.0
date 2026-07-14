/**
 * Cursor Automation Runner — default storage deps (AI-COMPANY-113 + 114).
 */

import { createEmployeeToolReview, getEmployeeToolReviewByRunId } from '../employeeToolReview/employeeToolReviewStorage'
import { resolveGitHubExecutionEvidenceViaBridge } from '../githubEvidenceReader/githubEvidenceReaderClient'
import {
  failToolExecutionRun,
  getToolExecutionRun,
  markToolExecutionQueued,
  markToolExecutionRunning,
  recordToolExecutionResult,
  upsertToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage'
import { reconcileCursorAutomationResult, type ReconcileCursorAutomationDeps } from './cursorAutomationReconciliation'
import type { ReconcileCursorAutomationInput, RunCursorAutomationInput } from './cursorAutomationRunnerTypes'
import { formatCursorAutomationRunnerEvent } from './cursorAutomationRunnerObservability'
import { resolveCursorAutomationWebhookConfig } from './cursorAutomationWebhookConfig'
import { runCursorAutomation, type RunCursorAutomationDeps } from './runCursorAutomation'

function noopPostReviewCard(): void {
  // UI layer may subscribe to review sync events.
}

export function createDefaultRunCursorAutomationDeps(
  partial?: Partial<RunCursorAutomationDeps>,
): RunCursorAutomationDeps {
  return {
    upsertRun: upsertToolExecutionRun,
    markQueued: markToolExecutionQueued,
    markRunning: markToolExecutionRunning,
    markFailed: failToolExecutionRun,
    resolveWebhookConfig: resolveCursorAutomationWebhookConfig,
    logEvent: (event) => {
      if (typeof console !== 'undefined') {
        console.info(formatCursorAutomationRunnerEvent(event))
      }
    },
    ...partial,
  }
}

export function createDefaultReconcileDeps(
  partial?: Partial<ReconcileCursorAutomationDeps>,
): ReconcileCursorAutomationDeps {
  return {
    getRun: getToolExecutionRun,
    upsertRun: upsertToolExecutionRun,
    recordResult: recordToolExecutionResult,
    failRun: failToolExecutionRun,
    getReviewByRunId: getEmployeeToolReviewByRunId,
    createReview: createEmployeeToolReview,
    postReviewCard: noopPostReviewCard,
    resolveGitHubEvidence: resolveGitHubExecutionEvidenceViaBridge,
    logEvent: (event) => {
      if (typeof console !== 'undefined') {
        console.info(formatCursorAutomationRunnerEvent(event))
      }
    },
    ...partial,
  }
}

export async function runCursorAutomationWithDefaults(
  input: RunCursorAutomationInput,
  partial?: Partial<RunCursorAutomationDeps>,
) {
  return runCursorAutomation(input, createDefaultRunCursorAutomationDeps(partial))
}

export async function reconcileCursorAutomationWithDefaults(
  input: ReconcileCursorAutomationInput,
  partial?: Partial<ReconcileCursorAutomationDeps>,
) {
  return reconcileCursorAutomationResult(input, createDefaultReconcileDeps(partial))
}
