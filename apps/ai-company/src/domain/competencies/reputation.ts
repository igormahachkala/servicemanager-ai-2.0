export type Reputation = {
  accuracy: number
  successfulTasks: number
  reportsQuality: number
  reviews: number
  trustScore: number
  productionApprovals: number
  calculatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampMetric(value: number, max = 100): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, Math.round(value)))
}

export function parseReputation(value: unknown): Reputation | null {
  if (!isRecord(value)) return null
  if (typeof value.calculatedAt !== 'string') return null

  return {
    accuracy: clampMetric(typeof value.accuracy === 'number' ? value.accuracy : 0),
    successfulTasks: Math.max(0, Math.round(typeof value.successfulTasks === 'number' ? value.successfulTasks : 0)),
    reportsQuality: clampMetric(typeof value.reportsQuality === 'number' ? value.reportsQuality : 0),
    reviews: Math.max(0, Math.round(typeof value.reviews === 'number' ? value.reviews : 0)),
    trustScore: clampMetric(typeof value.trustScore === 'number' ? value.trustScore : 0),
    productionApprovals: Math.max(
      0,
      Math.round(typeof value.productionApprovals === 'number' ? value.productionApprovals : 0),
    ),
    calculatedAt: value.calculatedAt,
  }
}

export function createEmptyReputation(calculatedAt: string): Reputation {
  return {
    accuracy: 0,
    successfulTasks: 0,
    reportsQuality: 0,
    reviews: 0,
    trustScore: 0,
    productionApprovals: 0,
    calculatedAt,
  }
}
