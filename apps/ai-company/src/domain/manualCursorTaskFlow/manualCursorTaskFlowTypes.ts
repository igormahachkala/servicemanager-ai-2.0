/**
 * Manual Cursor Task Flow — types (AI-COMPANY-112).
 */

import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { DelegationReviewRecord } from '../delegationReview/delegationReviewTypes'
import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes'
import type { ManualCloudAgentImportInput } from '../manualCloudAgentImport/manualCloudAgentImportTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

export const MANUAL_CURSOR_TASK_FLOW_VERSION = 'v1' as const

export const MANUAL_CURSOR_TASK_FLOW_ENVIRONMENTS = ['dev'] as const

export type ManualCursorTaskFlowEnvironment = (typeof MANUAL_CURSOR_TASK_FLOW_ENVIRONMENTS)[number]

export const MANUAL_CURSOR_TASK_FLOW_UI_STATES = [
  'planned',
  'awaiting_owner_approval',
  'ready_for_cursor',
  'waiting_for_cursor_result',
  'result_imported',
  'awaiting_builder_review',
  'awaiting_max_review',
  'completed',
  'failed',
  'cancelled',
] as const

export type ManualCursorTaskFlowUiState = (typeof MANUAL_CURSOR_TASK_FLOW_UI_STATES)[number]

export type ManualCursorTaskFlowMetadata = {
  version: typeof MANUAL_CURSOR_TASK_FLOW_VERSION
  repository: string
  baseBranch: string
  requiresRepositoryWrite: boolean
  requiresCommitOrPullRequest: boolean
  requiresReliableCompletion: boolean
  environment: ManualCursorTaskFlowEnvironment
  assignedEmployeeId: string
  ownerApprovedAt: string | null
  taskPackageGeneratedAt: string | null
  resultImportedAt: string | null
  createdAt: string
}

export type CreateManualCursorOwnerTaskInput = {
  title: string
  instruction: string
  expectedResult: string
  repository: string
  baseBranch: string
  requiresRepositoryWrite: boolean
  requiresCommitOrPullRequest: boolean
  requiresReliableCompletion: boolean
  environment: ManualCursorTaskFlowEnvironment
  assignedEmployeeId: string
  fileScope?: string[]
  checks?: string[]
}

export type ManualCursorRouteDecisionView = {
  selectedRoute: ExecutionRouteDecision['selectedRoute']
  allowed: boolean
  requiresOwnerApproval: boolean
  costClassification: ExecutionRouteDecision['costClassification']
  reasonCode: ExecutionRouteDecision['reasonCode']
  explanation: string
}

export type ManualCursorTaskFlowSnapshot = {
  runId: string
  workItemId: string
  delegationPlanId: string | null
  uiState: ManualCursorTaskFlowUiState
  uiStateLabel: string
  routeDecision: ManualCursorRouteDecisionView | null
  metadata: ManualCursorTaskFlowMetadata | null
  taskPackage: string | null
  canApprove: boolean
  canImport: boolean
  canBuilderReview: boolean
  canMaxReview: boolean
  showFinalReport: boolean
  run: ToolExecutionRun
  builderReview: EmployeeToolReview | null
  maxReview: DelegationReviewRecord | null
  envelope: CursorResultEnvelope | null
}

export type CreateManualCursorOwnerTaskOutcome =
  | {
      ok: true
      run: ToolExecutionRun
      workItemId: string
      delegationPlanId: string
      routeDecision: ManualCursorRouteDecisionView
      snapshot: ManualCursorTaskFlowSnapshot
    }
  | {
      ok: false
      code:
        | 'VALIDATION_FAILED'
        | 'PRODUCTION_BLOCKED'
        | 'INVALID_EMPLOYEE'
        | 'ROUTE_NOT_MANUAL'
        | 'DISPATCH_FAILED'
      message: string
    }

export type ApproveManualCursorOwnerExecutionOutcome =
  | { ok: true; run: ToolExecutionRun; taskPackage: string; snapshot: ManualCursorTaskFlowSnapshot }
  | {
      ok: false
      code: 'RUN_NOT_FOUND' | 'NOT_AWAITING_OWNER' | 'ROUTE_MISMATCH' | 'APPROVAL_FAILED'
      message: string
    }

export type SubmitManualCursorResultImportInput = ManualCloudAgentImportInput

export type ManualCursorFinalReport = {
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
  reviewStatus: string | null
  summary: string | null
  errors: string[]
  warnings: string[]
  nextRecommendedAction: string
  completed: boolean
}
