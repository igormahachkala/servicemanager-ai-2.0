/**
 * Tool Execution Run — lifecycle types (AI-COMPANY-113A).
 * Persisted external-tool usage by digital employees. Tools ≠ employees.
 */

export const TOOL_EXECUTION_RUN_VERSION = 'v1' as const

export const TOOL_EXECUTION_RUN_STORAGE_KEY = 'ai-company-tool-execution-runs'

export const TOOL_EXECUTION_RUN_SYNC_EVENT = 'ai-company-tool-execution-runs-sync'

export const TOOL_EXECUTION_RUN_STATUSES = [
  'draft',
  'awaiting_owner',
  'approved',
  'queued',
  'running',
  'result_received',
  'awaiting_employee_review',
  'accepted',
  'rework_requested',
  'rejected',
  'failed',
  'cancelled',
] as const

export type ToolExecutionRunStatus = (typeof TOOL_EXECUTION_RUN_STATUSES)[number]

export type ToolExecutionRunResult = {
  plannedOnly: boolean
  output: Record<string, unknown> | null
  deliveryMode: 'planned_v1' | 'cursor_v1' | null
  cursorAutomationTaskId: string | null
  registryInvokePlanId: string | null
  receivedAt: string | null
}

export type ToolExecutionRunHistoryEntry = {
  id: string
  status: ToolExecutionRunStatus
  at: string
  message: string | null
}

export type ToolExecutionRun = {
  id: string
  version: typeof TOOL_EXECUTION_RUN_VERSION
  companyId: string
  employeeId: string
  toolId: string
  toolRequestId: string
  workItemId: string
  delegationPlanId: string | null
  /** Builder Worker Loop link (113D). */
  workerLoopId: string | null
  /** Builder Tool Decision link — decision only, not a parallel run (113D). */
  builderToolDecisionId: string | null
  /** Preserved bter-* id after migration from BuilderToolExecutionRun (113D). */
  legacyBuilderRunId: string | null
  title: string
  instructions: string
  expectedResult: string
  fileScope: string[]
  checks: string[]
  status: ToolExecutionRunStatus
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  result: ToolExecutionRunResult | null
  error: string | null
  history: ToolExecutionRunHistoryEntry[]
}

export type CreateToolExecutionRunInput = {
  companyId: string
  employeeId: string
  toolId: string
  toolRequestId: string
  workItemId: string
  delegationPlanId?: string | null
  workerLoopId?: string | null
  builderToolDecisionId?: string | null
  legacyBuilderRunId?: string | null
  title: string
  instructions: string
  expectedResult?: string | null
  fileScope?: string[]
  checks?: string[]
  initialStatus?: Extract<ToolExecutionRunStatus, 'draft' | 'awaiting_owner'>
  /** Migration-only — preserve timestamps and history. */
  id?: string
  createdAt?: string
  updatedAt?: string
  approvedAt?: string | null
  history?: ToolExecutionRunHistoryEntry[]
}

export type ListToolExecutionRunsFilter = {
  companyId?: string
  employeeId?: string
  toolId?: string
  workItemId?: string
  toolRequestId?: string
  delegationPlanId?: string
  workerLoopId?: string
  builderToolDecisionId?: string
  legacyBuilderRunId?: string
  status?: ToolExecutionRunStatus | ToolExecutionRunStatus[]
}

export type RecordToolExecutionResultInput = {
  runId: string
  output: Record<string, unknown>
  plannedOnly?: boolean
  deliveryMode?: ToolExecutionRunResult['deliveryMode']
  cursorAutomationTaskId?: string | null
  registryInvokePlanId?: string | null
}
