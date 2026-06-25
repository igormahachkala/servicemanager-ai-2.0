export type LearningRecommendationKind =
  | 'project'
  | 'knowledge'
  | 'report'
  | 'runtime'
  | 'certification'
  | 'study'

export type LearningRecommendationPriority = 'low' | 'medium' | 'high'

export const LEARNING_RECOMMENDATION_KINDS: readonly LearningRecommendationKind[] = [
  'project',
  'knowledge',
  'report',
  'runtime',
  'certification',
  'study',
]

export type LearningRecommendation = {
  id: string
  employeeId: string
  skillName: string
  kind: LearningRecommendationKind
  title: string
  summary: string
  priority: LearningRecommendationPriority
  href?: string
  dismissed: boolean
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseKind(value: unknown): LearningRecommendationKind {
  if (
    value === 'project' ||
    value === 'knowledge' ||
    value === 'report' ||
    value === 'runtime' ||
    value === 'certification' ||
    value === 'study'
  ) {
    return value
  }
  return 'study'
}

function parsePriority(value: unknown): LearningRecommendationPriority {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

export function parseLearningRecommendation(value: unknown): LearningRecommendation | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.skillName !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    employeeId: value.employeeId,
    skillName: value.skillName,
    kind: parseKind(value.kind),
    title: value.title,
    summary: value.summary,
    priority: parsePriority(value.priority),
    href: typeof value.href === 'string' ? value.href : undefined,
    dismissed: value.dismissed === true,
    createdAt: value.createdAt,
  }
}

export function createLearningRecommendation(
  input: Omit<LearningRecommendation, 'id' | 'createdAt' | 'dismissed'> & {
    id?: string
    createdAt?: string
    dismissed?: boolean
  },
): LearningRecommendation {
  return {
    id: input.id ?? `lr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: input.employeeId,
    skillName: input.skillName.trim(),
    kind: input.kind,
    title: input.title.trim(),
    summary: input.summary.trim(),
    priority: input.priority,
    href: input.href,
    dismissed: input.dismissed ?? false,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}
