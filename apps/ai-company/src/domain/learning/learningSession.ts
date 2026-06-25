export type LearningSessionType = 'study' | 'practice' | 'review' | 'certification' | 'runtime'

export type LearningSessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped'

export const LEARNING_SESSION_TYPES: readonly LearningSessionType[] = [
  'study',
  'practice',
  'review',
  'certification',
  'runtime',
]

export const LEARNING_SESSION_STATUSES: readonly LearningSessionStatus[] = [
  'planned',
  'in_progress',
  'completed',
  'skipped',
]

export type LearningSession = {
  id: string
  employeeId: string
  skillName: string
  type: LearningSessionType
  title: string
  description: string
  status: LearningSessionStatus
  progressPercent: number
  experienceGain: number
  relatedProjectId?: string
  relatedReportId?: string
  relatedKnowledgeId?: string
  relatedRunId?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseType(value: unknown): LearningSessionType {
  if (
    value === 'study' ||
    value === 'practice' ||
    value === 'review' ||
    value === 'certification' ||
    value === 'runtime'
  ) {
    return value
  }
  return 'study'
}

function parseStatus(value: unknown): LearningSessionStatus {
  if (
    value === 'planned' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'skipped'
  ) {
    return value
  }
  return 'planned'
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function parseLearningSession(value: unknown): LearningSession | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.skillName !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    employeeId: value.employeeId,
    skillName: value.skillName,
    type: parseType(value.type),
    title: value.title,
    description: value.description,
    status: parseStatus(value.status),
    progressPercent: clampPercent(typeof value.progressPercent === 'number' ? value.progressPercent : 0),
    experienceGain: clampPercent(typeof value.experienceGain === 'number' ? value.experienceGain : 2),
    relatedProjectId: typeof value.relatedProjectId === 'string' ? value.relatedProjectId : undefined,
    relatedReportId: typeof value.relatedReportId === 'string' ? value.relatedReportId : undefined,
    relatedKnowledgeId: typeof value.relatedKnowledgeId === 'string' ? value.relatedKnowledgeId : undefined,
    relatedRunId: typeof value.relatedRunId === 'string' ? value.relatedRunId : undefined,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : undefined,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
    createdAt: value.createdAt,
  }
}

export function createLearningSession(
  input: Omit<LearningSession, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): LearningSession {
  return {
    id: input.id ?? `ls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: input.employeeId,
    skillName: input.skillName.trim(),
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    status: input.status,
    progressPercent: clampPercent(input.progressPercent),
    experienceGain: clampPercent(input.experienceGain),
    relatedProjectId: input.relatedProjectId,
    relatedReportId: input.relatedReportId,
    relatedKnowledgeId: input.relatedKnowledgeId,
    relatedRunId: input.relatedRunId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}
