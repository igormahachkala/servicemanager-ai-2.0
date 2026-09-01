/**
 * Owner-facing meta for a builder ToolExecutionRun awaiting approval.
 *
 * Split out of `mobileOwnerDecisionsSnapshot` when the run stopped being
 * cursor-only: the two branches below do not fit inside a `for` body that
 * already builds nine other decision kinds.
 *
 * Display labels arrive as an argument rather than living here, so this module
 * holds no UI text at all — the i18n ratchet (`i18nGuard.test.ts`) forbids new
 * hardcoded strings outside `src/i18n`, and routing them through one object
 * makes the eventual move into the bundles a single edit.
 */

import {
  formatBuilderToolDecisionConfidenceLabel,
  getBuilderToolDecisionById,
} from '../builderToolDecision'
import { mobileEmployeeProfilePath } from '../mobileEmployee'
import {
  requiresBuilderToolDecision,
  resolveToolExecutionToolLabel,
} from '../toolExecution/builderToolVisibility'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

export type MobileOwnerDecisionBuilderToolMeta = {
  toolLabel: string
  taskTitle: string
  reason: string
  fileScope: string[]
  checks: string[]
  expectedResult: string
  risk: string
  confidenceLabel: string
  workItemId: string
  workerLoopId: string
  builderProfileHref: string
  workItemHref: string
}

export type MobileOwnerDecisionBuilderToolLabels = {
  riskHigh: string
  riskMedium: string
  riskLow: string
  /** Risk line for a decision-free tool: read-only, no repository writes. */
  localAnalysisRisk: string
  /** Fallback contract when the request named no expected result. */
  analysisExpectedResult: string
  /** Stands in for a confidence nobody computed. */
  unknownConfidence: string
}

export type MobileOwnerDecisionBuilderToolItem = {
  reason: string
  riskLabel: string
  builderTool: MobileOwnerDecisionBuilderToolMeta
}

function gradedRiskLabel(risk: string, labels: MobileOwnerDecisionBuilderToolLabels): string {
  if (risk === 'high') return labels.riskHigh
  if (risk === 'medium') return labels.riskMedium
  return labels.riskLow
}

/**
 * Cursor keeps its contract exactly: the meta lives in the run's
 * BuilderToolDecision, and a run pointing at a decision that no longer resolves
 * stays out of the list — a half-written record is not an approval item. That
 * also keeps a cursor run created without a decision hidden, which is what
 * `manualCursorTaskFlowCreate` and `builderAutomationTaskFlowCreate` produce
 * today.
 *
 * A run whose tool needs no decision builds the same shape out of the run
 * itself, so nothing is invented: the dispatcher already stored title,
 * instructions, fileScope and checks there. A decision-free tool that is not
 * registered as such still returns `null`, which is why the caller needs no
 * pre-filter.
 */
export function resolveMobileOwnerDecisionBuilderToolItem(
  run: ToolExecutionRun,
  labels: MobileOwnerDecisionBuilderToolLabels,
): MobileOwnerDecisionBuilderToolItem | null {
  const shared = {
    taskTitle: run.title,
    workItemId: run.workItemId,
    workerLoopId: run.workerLoopId ?? '',
    builderProfileHref: mobileEmployeeProfilePath(run.employeeId),
    workItemHref: `/mobile/tasks?highlight=${encodeURIComponent(run.workItemId)}`,
  }

  if (requiresBuilderToolDecision(run.toolId)) {
    if (!run.builderToolDecisionId) return null
    const decision = getBuilderToolDecisionById(run.builderToolDecisionId)
    if (!decision) return null

    return {
      reason: decision.reason,
      riskLabel: gradedRiskLabel(decision.risk, labels),
      builderTool: {
        ...shared,
        toolLabel: 'Cursor',
        reason: decision.reason,
        fileScope: decision.fileScope,
        checks: decision.checks,
        expectedResult: decision.expectedResult,
        risk: decision.risk,
        confidenceLabel: formatBuilderToolDecisionConfidenceLabel(decision.confidence),
      },
    }
  }

  // No decision, so there is no graded risk and no confidence to quote. `low`
  // is the capability's own claim — local analysis is read-only and writes
  // nothing to the repository.
  return {
    reason: run.instructions,
    riskLabel: labels.localAnalysisRisk,
    builderTool: {
      ...shared,
      toolLabel: resolveToolExecutionToolLabel(run.toolId) ?? run.toolId,
      reason: run.instructions,
      fileScope: run.fileScope,
      checks: run.checks,
      expectedResult: run.expectedResult || labels.analysisExpectedResult,
      risk: 'low',
      confidenceLabel: labels.unknownConfidence,
    },
  }
}
