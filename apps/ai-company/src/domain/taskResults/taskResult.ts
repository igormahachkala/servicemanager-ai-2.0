export const TASK_RESULT_STATUSES = [
  'draft',
  'ready_for_review',
  'approved',
  'changes_requested',
  'rejected',
  'archived',
] as const

export type TaskResultStatus = (typeof TASK_RESULT_STATUSES)[number]

export const TASK_RESULT_REVIEW_ACTIONS = [
  'submit_for_review',
  'approve',
  'request_changes',
  'reject',
  'create_follow_up',
  'send_to_qa',
  'send_to_codex',
  'archive',
] as const

export type TaskResultReviewActionKind = (typeof TASK_RESULT_REVIEW_ACTIONS)[number]

export type TaskResultArtifact = {
  label: string
  value: string
}

export type TaskResultReviewEntry = {
  id: string
  kind: TaskResultReviewActionKind
  actorId: string
  actorType: 'owner' | 'employee'
  comment: string | null
  createdAt: string
  metadata?: Record<string, string | null>
}

export type TaskResult = {
  id: string
  title: string
  summary: string
  employeeId: string
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
  runtimeRunId: string | null
  reportId: string | null
  approvalId: string | null
  handoffId: string | null
  followUpTaskId: string | null
  status: TaskResultStatus
  outputPreview: string | null
  findings: string[]
  artifacts: TaskResultArtifact[]
  ownerComment: string | null
  reviewHistory: TaskResultReviewEntry[]
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
}

export type TaskResultFilter = {
  status: TaskResultStatus | 'all'
  employeeId: string | 'all'
  workspaceId: string | 'all'
  projectId: string | 'all'
}

export type TaskResultStats = {
  total: number
  draft: number
  readyForReview: number
  approved: number
  changesRequested: number
  rejected: number
  archived: number
}
