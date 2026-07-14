/**
 * Builder Automation Task Flow — types (AI-COMPANY-113).
 */

import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { DelegationReviewRecord } from '../delegationReview/delegationReviewTypes'
import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

export const BUILDER_AUTOMATION_TASK_FLOW_VERSION = 'v1' as const

export const BUILDER_AUTOMATION_TASK_FLOW_UI_STATES = [
  'planned',
  'awaiting_owner_approval',
  'dispatching',
  'dispatched',
  'waiting_for_cursor_result',
  'result_discovered',
  'awaiting_builder_review',
  'awaiting_max_review',
  'completed',
  'failed',
  'timed_out',
  'cancelled',
] as const

export type BuilderAutomationTaskFlowUiState =
  (typeof BUILDER_AUTOMATION_TASK_FLOW_UI_STATES)[number]

export type BuilderAutomationTaskFlowMetadata = {
  version: typeof BUILDER_AUTOMATION_TASK_FLOW_VERSION
  repository: string
  baseBranch: string
  requiresRepositoryWrite: boolean
  requiresCommitOrPullRequest: boolean
  environment: 'dev'
  assignedEmployeeId: string
  ownerApprovedAt: string | null
  dispatchedAt: string | null
  resultDiscoveredAt: string | null
  createdAt: string
}

export type CreateBuilderAutomationOwnerTaskInput = {
  title: string
  instruction: string
  expectedResult: string
  repository: string
  baseBranch: string
  requiresRepositoryWrite?: boolean
  requiresCommitOrPullRequest?: boolean
  environment?: 'dev'
  assignedEmployeeId?: string
  fileScope?: string[]
  checks?: string[]
  constraints?: string[]
}

export type BuilderAutomationRouteDecisionView = {
  selectedRoute: ExecutionRouteDecision['selectedRoute']
  allowed: boolean
  requiresOwnerApproval: boolean
  costClassification: ExecutionRouteDecision['costClassification']
  reasonCode: ExecutionRouteDecision['reasonCode']
  explanation: string
}

export type BuilderAutomationTaskFlowSnapshot = {
  runId: string
  workItemId: string
  delegationPlanId: string | null
  uiState: BuilderAutomationTaskFlowUiState
  uiStateLabel: string
  routeDecision: BuilderAutomationRouteDecisionView | null
  metadata: BuilderAutomationTaskFlowMetadata | null
  canApproveAndDispatch: boolean
  canBuilderReview: boolean
  canMaxReview: boolean
  showFinalReport: boolean
  externalCorrelationId: string | null
  run: ToolExecutionRun
  builderReview: EmployeeToolReview | null
  maxReview: DelegationReviewRecord | null
  envelope: CursorResultEnvelope | null
}

export type CreateBuilderAutomationOwnerTaskOutcome =
  | {
      ok: true
      run: ToolExecutionRun
      workItemId: string
      delegationPlanId: string
      routeDecision: BuilderAutomationRouteDecisionView
      snapshot: BuilderAutomationTaskFlowSnapshot
    }
  | { ok: false; code: string; message: string }

export type ApproveAndDispatchBuilderAutomationOutcome =
  | {
      ok: true
      run: ToolExecutionRun
      snapshot: BuilderAutomationTaskFlowSnapshot
      backgroundComposerId: string
    }
  | { ok: false; code: string; message: string }

export type BuilderAutomationFinalReport = {
  taskTitle: string
  employeeLabel: string
  executionRoute: string
  branch: string | null
  commitSha: string | null
  pullRequestUrl: string | null
  changedFiles: string[]
  checks: Array<{ name: string; status: string; details?: string }>
  builderReviewDecision: string | null
  maxReviewDecision: string | null
  executionStatus: string | null
  transportStatus: string | null
  externalCorrelationId: string | null
  completed: boolean
  warnings: string[]
  errors: string[]
  nextRecommendedAction: string
}
