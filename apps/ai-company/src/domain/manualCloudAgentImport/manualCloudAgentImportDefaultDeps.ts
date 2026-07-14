/**
 * Manual Cloud Agent import — browser/localStorage default deps (AI-COMPANY-111).
 * Kept separate from the core use case so Node tests avoid storage import cycles.
 */

import {
  createEmployeeToolReview,
  getEmployeeToolReviewByRunId,
} from '../employeeToolReview/employeeToolReviewStorage'
import {
  getToolExecutionRun,
  markToolExecutionQueued,
  markToolExecutionRunning,
  recordToolExecutionResult,
  upsertToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage'
import {
  importManualCloudAgentResult,
  type ManualCloudAgentImportDeps,
} from './importManualCloudAgentResult'
import {
  formatManualCloudAgentImportEvent,
} from './manualCloudAgentImportObservability'
import type {
  ManualCloudAgentImportInput,
  ManualCloudAgentImportOutcome,
} from './manualCloudAgentImportTypes'
import { resolveToolExecutionRunExecutionRoute } from './toolExecutionRunExecutionRoute'

export function createManualCloudAgentImportDefaultDeps(): ManualCloudAgentImportDeps {
  return {
    getRun: getToolExecutionRun,
    upsertRun: upsertToolExecutionRun,
    resolveRoute: resolveToolExecutionRunExecutionRoute,
    markQueued: markToolExecutionQueued,
    markRunning: markToolExecutionRunning,
    recordResult: recordToolExecutionResult,
    getReviewByRunId: getEmployeeToolReviewByRunId,
    createReview: createEmployeeToolReview,
    postReviewCard: () => {
      // V1: UI posts review card in browser via employeeToolReviewEngine.
    },
    logEvent: (event) => {
      if (typeof console !== 'undefined') {
        console.info(formatManualCloudAgentImportEvent(event))
      }
    },
  }
}

export function importManualCloudAgentResultWithDefaults(
  rawInput: ManualCloudAgentImportInput,
  partialDeps: Partial<ManualCloudAgentImportDeps> = {},
): ManualCloudAgentImportOutcome {
  return importManualCloudAgentResult(rawInput, {
    ...createManualCloudAgentImportDefaultDeps(),
    ...partialDeps,
  })
}
