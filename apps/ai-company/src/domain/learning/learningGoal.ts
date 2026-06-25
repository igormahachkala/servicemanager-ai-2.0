export type LearningGoalStatus = 'active' | 'completed' | 'paused'

export const LEARNING_GOAL_STATUSES: readonly LearningGoalStatus[] = ['active', 'completed', 'paused']

export type LearningGoal = {
  id: string
  employeeId: string
  skillName: string
  currentPercent: number
  targetPercent: number
  status: LearningGoalStatus
  dueDate?: string
  createdAt: string
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): LearningGoalStatus {
  if (value === 'active' || value === 'completed' || value === 'paused') return value
  return 'active'
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function parseLearningGoal(value: unknown): LearningGoal | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.skillName !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    employeeId: value.employeeId,
    skillName: value.skillName,
    currentPercent: clampPercent(typeof value.currentPercent === 'number' ? value.currentPercent : 0),
    targetPercent: clampPercent(typeof value.targetPercent === 'number' ? value.targetPercent : 100),
    status: parseStatus(value.status),
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function createLearningGoal(
  input: Omit<LearningGoal, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: string
    updatedAt?: string
  },
): LearningGoal {
  const now = input.createdAt ?? new Date().toISOString()
  return {
    id: input.id ?? `lg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: input.employeeId,
    skillName: input.skillName.trim(),
    currentPercent: clampPercent(input.currentPercent),
    targetPercent: clampPercent(input.targetPercent),
    status: input.status,
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
  }
}

export function goalProgressPercent(goal: LearningGoal): number {
  if (goal.currentPercent >= goal.targetPercent) return 100
  if (goal.targetPercent <= 0) return 0
  return clampPercent(Math.round((goal.currentPercent / goal.targetPercent) * 100))
}
