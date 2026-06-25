export type LearningPath = {
  plannedSkills: string[]
  completedSkills: string[]
  recommendedSkills: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function parseLearningPath(value: unknown): LearningPath {
  if (!isRecord(value)) {
    return { plannedSkills: [], completedSkills: [], recommendedSkills: [] }
  }

  return {
    plannedSkills: parseStringList(value.plannedSkills),
    completedSkills: parseStringList(value.completedSkills),
    recommendedSkills: parseStringList(value.recommendedSkills),
  }
}

export function createEmptyLearningPath(): LearningPath {
  return {
    plannedSkills: [],
    completedSkills: [],
    recommendedSkills: [],
  }
}
