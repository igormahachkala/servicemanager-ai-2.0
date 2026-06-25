import type { ToolRequest, ToolExecutionProvider } from './toolRequest'
import type { ToolResponse } from './toolResponse'

export const TOOL_EXECUTION_STATUSES = [
  'created',
  'waiting_approval',
  'approved',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type ToolExecutionStatus = (typeof TOOL_EXECUTION_STATUSES)[number]

export type ToolExecution = {
  id: string
  request: ToolRequest
  status: ToolExecutionStatus
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  approvalDecisionAt: string | null
  cancelledAt: string | null
  response: ToolResponse | null
  error: string | null
}

export type ToolExecutionFilter = {
  employeeId: string | 'all'
  provider: ToolExecutionProvider | 'all'
  status: ToolExecutionStatus | 'all'
  approval: 'all' | 'required' | 'not_required'
}

export type ToolExecutionStats = {
  total: number
  created: number
  waitingApproval: number
  approved: number
  running: number
  completed: number
  failed: number
  cancelled: number
}

export function filterToolExecutions(
  executions: ToolExecution[],
  filter: ToolExecutionFilter,
): ToolExecution[] {
  return executions.filter((item) => {
    if (filter.employeeId !== 'all' && item.request.employeeId !== filter.employeeId) return false
    if (filter.provider !== 'all' && item.request.provider !== filter.provider) return false
    if (filter.status !== 'all' && item.status !== filter.status) return false
    if (filter.approval === 'required' && !item.request.approval.required) return false
    if (filter.approval === 'not_required' && item.request.approval.required) return false
    return true
  })
}

export function computeToolExecutionStats(executions: ToolExecution[]): ToolExecutionStats {
  return {
    total: executions.length,
    created: executions.filter((item) => item.status === 'created').length,
    waitingApproval: executions.filter((item) => item.status === 'waiting_approval').length,
    approved: executions.filter((item) => item.status === 'approved').length,
    running: executions.filter((item) => item.status === 'running').length,
    completed: executions.filter((item) => item.status === 'completed').length,
    failed: executions.filter((item) => item.status === 'failed').length,
    cancelled: executions.filter((item) => item.status === 'cancelled').length,
  }
}
