export const WORK_SUGGESTION_KINDS = [
  'next_task',
  'send_qa',
  'send_max',
  'send_codex',
  'create_follow_up',
  'complete_sprint_item',
] as const

export type WorkSuggestionKind = (typeof WORK_SUGGESTION_KINDS)[number]

export const WORK_SUGGESTION_STATUSES = ['pending_approval', 'executed', 'dismissed'] as const

export type WorkSuggestionStatus = (typeof WORK_SUGGESTION_STATUSES)[number]

export type WorkSuggestion = {
  id: string
  kind: WorkSuggestionKind
  title: string
  rationale: string
  priority: 'low' | 'medium' | 'high'
  status: WorkSuggestionStatus
  employeeId: string
  taskResultId: string
  runtimeRunId: string | null
  taskId: string | null
  projectId: string | null
  workspaceId: string | null
  payload: Record<string, string | null>
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
}

export type WorkSchedulerPlan = {
  id: string
  taskResultId: string
  runtimeRunId: string
  employeeId: string
  analysisSummary: string
  suggestions: WorkSuggestion[]
  createdAt: string
}

export type WorkSchedulerStats = {
  pending: number
  executed: number
  dismissed: number
  totalPlans: number
}
