export type Competency = {
  employeeId: string
  domain: string
  score: number
  calculatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function parseCompetency(value: unknown): Competency | null {
  if (!isRecord(value)) return null
  if (
    typeof value.employeeId !== 'string' ||
    typeof value.domain !== 'string' ||
    typeof value.calculatedAt !== 'string'
  ) {
    return null
  }

  return {
    employeeId: value.employeeId,
    domain: value.domain,
    score: clampScore(typeof value.score === 'number' ? value.score : 0),
    calculatedAt: value.calculatedAt,
  }
}

export function createCompetency(
  employeeId: string,
  domain: string,
  score: number,
  calculatedAt: string,
): Competency {
  return {
    employeeId,
    domain,
    score: clampScore(score),
    calculatedAt,
  }
}
