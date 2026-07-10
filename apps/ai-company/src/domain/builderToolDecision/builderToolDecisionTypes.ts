/**
 * Builder Tool Decision — domain types (AI-COMPANY-113B).
 */

import type { ToolDispatcherToolId } from '../toolDispatcher/toolDispatcherTypes'

export const BUILDER_TOOL_DECISION_VERSION = 'v1' as const

export const BUILDER_TOOL_DECISION_OUTCOMES = [
  'local_model_analysis',
  'code_change_cursor',
  'no_tool',
] as const

export type BuilderToolDecisionOutcome = (typeof BUILDER_TOOL_DECISION_OUTCOMES)[number]

export const BUILDER_TOOL_RISK_LEVELS = ['low', 'medium', 'high'] as const

export type BuilderToolRiskLevel = (typeof BUILDER_TOOL_RISK_LEVELS)[number]

export type BuilderToolDecision = {
  id: string
  version: typeof BUILDER_TOOL_DECISION_VERSION
  employeeId: string
  workItemId: string
  workerLoopId: string
  decisionPlanId: string | null
  outcome: BuilderToolDecisionOutcome
  toolRequired: boolean
  recommendedToolId: ToolDispatcherToolId | null
  reason: string
  risk: BuilderToolRiskLevel
  fileScope: string[]
  expectedResult: string
  checks: string[]
  confidence: number
  createdAt: string
  updatedAt: string
}

export const BUILDER_TOOL_EXECUTION_RUN_STATUSES = [
  'awaiting_owner',
  'approved',
  'rejected',
  'ready_for_adapter',
  'queued',
  'result_received',
] as const

export type BuilderToolExecutionRunStatus = (typeof BUILDER_TOOL_EXECUTION_RUN_STATUSES)[number]

export type BuilderToolExecutionHistoryEntry = {
  id: string
  kind:
    | 'tool_requested'
    | 'tool_approved'
    | 'tool_rejected'
    | 'tool_bridge_queued'
    | 'tool_bridge_result'
  at: string
  note: string | null
}

/** @deprecated AI-COMPANY-113D — use ToolExecutionRun from domain/toolExecution */
export type BuilderToolExecutionRun = {
  id: string
  employeeId: string
  workItemId: string
  workerLoopId: string
  builderToolDecisionId: string
  toolDispatcherRequestId: string
  recommendedToolId: ToolDispatcherToolId
  taskTitle: string
  status: BuilderToolExecutionRunStatus
  history: BuilderToolExecutionHistoryEntry[]
  createdAt: string
  updatedAt: string
  ownerDecisionAt: string | null
}

export type EvaluateBuilderToolDecisionInput = {
  employeeId: string
  workItemId: string
  workerLoopId: string
  decisionPlanId: string | null
  taskText: string
  title: string | null
  structuredPayload: import('../employeeWorkQueue/workItemStructuredPayload').WorkItemStructuredPayload | null
  decisionPlan: import('../decisionPlan').DecisionPlan | null
  expectedOutput: string | null
}
