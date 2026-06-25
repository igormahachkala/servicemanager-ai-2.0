export type ExperienceEventType =
  | 'task'
  | 'report'
  | 'workspace'
  | 'training'
  | 'review'
  | 'certification'

export type ExperienceImpact = 'low' | 'medium' | 'high'

export type ExperienceEvent = {
  id: string
  type: ExperienceEventType
  workspaceId?: string
  taskId?: string
  reportId?: string
  description: string
  impact: ExperienceImpact
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseType(value: unknown): ExperienceEventType {
  if (
    value === 'task' ||
    value === 'report' ||
    value === 'workspace' ||
    value === 'training' ||
    value === 'review' ||
    value === 'certification'
  ) {
    return value
  }
  return 'task'
}

function parseImpact(value: unknown): ExperienceImpact {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

export function parseExperienceEvent(value: unknown): ExperienceEvent | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.description !== 'string' || typeof value.createdAt !== 'string') {
    return null
  }

  return {
    id: value.id,
    type: parseType(value.type),
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : undefined,
    taskId: typeof value.taskId === 'string' ? value.taskId : undefined,
    reportId: typeof value.reportId === 'string' ? value.reportId : undefined,
    description: value.description,
    impact: parseImpact(value.impact),
    createdAt: value.createdAt,
  }
}

export function createExperienceEvent(
  input: Omit<ExperienceEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): ExperienceEvent {
  return {
    id: input.id ?? `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: input.type,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    reportId: input.reportId,
    description: input.description.trim(),
    impact: input.impact,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

export const IMPACT_WEIGHT: Record<ExperienceImpact, number> = {
  low: 1,
  medium: 2,
  high: 3,
}
