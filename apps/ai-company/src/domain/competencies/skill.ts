export type Skill = {
  id: string
  name: string
  category: string
  level: number
  verified: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(5, Math.max(1, Math.round(value)))
}

export function parseSkill(value: unknown): Skill | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.category !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    category: value.category,
    level: clampLevel(typeof value.level === 'number' ? value.level : 1),
    verified: value.verified === true,
  }
}

export function createSkill(input: Omit<Skill, 'id'> & { id?: string }): Skill {
  return {
    id: input.id ?? `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    category: input.category.trim(),
    level: clampLevel(input.level),
    verified: input.verified,
  }
}
