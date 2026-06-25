export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired',
] as const

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export const APPROVAL_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export type ApprovalPriority = (typeof APPROVAL_PRIORITIES)[number]

export const APPROVAL_ACTION_TYPES = [
  'github_push',
  'production_deploy',
  'database_migration',
  'filesystem_delete',
  'money_transfer',
  'permission_change',
  'tool_connection',
  'workspace_assignment',
  'generic',
] as const

export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number]

export type Approval = {
  id: string
  title: string
  description: string
  employeeId: string
  workspaceId: string | null
  actionType: ApprovalActionType
  status: ApprovalStatus
  priority: ApprovalPriority
  policyRule: string
  createdAt: string
  updatedAt: string
}
