import type { EventSeverity } from '../events/event'

export type EmployeeTimelineKind =
  | 'runtime_completed'
  | 'task_approved'
  | 'knowledge_learned'
  | 'memory_evolved'
  | 'handoff_created'
  | 'qa_passed'
  | 'owner_approval'
  | 'production_approved'

export type EmployeeTimelinePeriod = 'today' | 'week' | 'all'

export type EmployeeTimelineEntry = {
  id: string
  kind: EmployeeTimelineKind
  createdAt: string
  projectLabel: string | null
  projectId: string | null
  description: string
  severity: EventSeverity | null
  href: string | null
  sourceType: string
  sourceId: string
}

export type EmployeeTimelineSummary = {
  total: number
  runtimeCompleted: number
  tasksApproved: number
  knowledgeLearned: number
  memoryEvolved: number
}
