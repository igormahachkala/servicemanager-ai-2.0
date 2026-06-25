export type MilestoneStatus = 'planned' | 'in_progress' | 'done' | 'blocked'

export type Milestone = {
  id: string
  title: string
  description: string
  status: MilestoneStatus
  dueDate: string | null
  progress: number
}

export type CreateMilestoneInput = {
  title: string
  description?: string
  status?: MilestoneStatus
  dueDate?: string | null
  progress?: number
}

const MILESTONE_STATUSES: MilestoneStatus[] = ['planned', 'in_progress', 'done', 'blocked']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function parseMilestoneStatus(value: unknown): MilestoneStatus {
  if (typeof value === 'string' && MILESTONE_STATUSES.includes(value as MilestoneStatus)) {
    return value as MilestoneStatus
  }
  return 'planned'
}

export function parseMilestone(value: unknown): Milestone | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null

  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    status: parseMilestoneStatus(value.status),
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : null,
    progress: clampProgress(typeof value.progress === 'number' ? value.progress : 0),
  }
}

export function createMilestone(input: CreateMilestoneInput): Milestone {
  return {
    id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    status: input.status ?? 'planned',
    dueDate: input.dueDate ?? null,
    progress: clampProgress(input.progress ?? 0),
  }
}

export { MILESTONE_STATUSES }
