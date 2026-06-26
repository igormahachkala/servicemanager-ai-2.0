import type { HandoffTarget } from './handoffTarget'
import type { HandoffPackage } from './handoffPackage'

export const HANDOFF_STATUSES = [
  'draft',
  'ready',
  'sent',
  'in_progress',
  'returned',
  'accepted',
  'rejected',
  'cancelled',
] as const

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number]

export const HANDOFF_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const

export type HandoffPriority = (typeof HANDOFF_PRIORITIES)[number]

export type HandoffChecklistItem = {
  id: string
  label: string
  done: boolean
}

export type HandoffContext = {
  summary: string
  projectName: string
  workspaceName: string
  taskTitle: string | null
  employeeCodename: string
  relatedPaths: string[]
  notes: string
}

export type HandoffResult = {
  summary: string
  deliveredAt: string
  responseFormat: string
  artifacts: Array<{ label: string; value: string }>
  blockers: string[]
  notes: string
}

export type Handoff = {
  id: string
  title: string
  description: string
  projectId: string
  workspaceId: string
  taskId: string | null
  employeeId: string
  target: HandoffTarget
  status: HandoffStatus
  priority: HandoffPriority
  context: HandoffContext
  instructions: string
  expectedResult: string
  constraints: string[]
  checklist: HandoffChecklistItem[]
  package: HandoffPackage | null
  result: HandoffResult | null
  approvalId: string | null
  reportId: string | null
  templateId: string | null
  createdAt: string
  updatedAt: string
}

export type HandoffFilter = {
  projectId: string | 'all'
  workspaceId: string | 'all'
  employeeId: string | 'all'
  target: HandoffTarget | 'all'
  status: HandoffStatus | 'all'
}

export type HandoffStats = {
  total: number
  draft: number
  ready: number
  sent: number
  inProgress: number
  returned: number
  accepted: number
  rejected: number
  cancelled: number
}

export function filterHandoffs(handoffs: Handoff[], filter: HandoffFilter): Handoff[] {
  return handoffs.filter((item) => {
    if (filter.projectId !== 'all' && item.projectId !== filter.projectId) return false
    if (filter.workspaceId !== 'all' && item.workspaceId !== filter.workspaceId) return false
    if (filter.employeeId !== 'all' && item.employeeId !== filter.employeeId) return false
    if (filter.target !== 'all' && item.target !== filter.target) return false
    if (filter.status !== 'all' && item.status !== filter.status) return false
    return true
  })
}

export function computeHandoffStats(handoffs: Handoff[]): HandoffStats {
  return {
    total: handoffs.length,
    draft: handoffs.filter((item) => item.status === 'draft').length,
    ready: handoffs.filter((item) => item.status === 'ready').length,
    sent: handoffs.filter((item) => item.status === 'sent').length,
    inProgress: handoffs.filter((item) => item.status === 'in_progress').length,
    returned: handoffs.filter((item) => item.status === 'returned').length,
    accepted: handoffs.filter((item) => item.status === 'accepted').length,
    rejected: handoffs.filter((item) => item.status === 'rejected').length,
    cancelled: handoffs.filter((item) => item.status === 'cancelled').length,
  }
}

export function isHandoffTerminal(status: HandoffStatus): boolean {
  return status === 'accepted' || status === 'rejected' || status === 'cancelled'
}
