export type RoadmapHorizon = 'now' | 'next' | 'later'

export type RoadmapItem = {
  id: string
  title: string
  description: string
  horizon: RoadmapHorizon
  quarter: string | null
}

export type CreateRoadmapItemInput = {
  title: string
  description?: string
  horizon?: RoadmapHorizon
  quarter?: string | null
}

const ROADMAP_HORIZONS: RoadmapHorizon[] = ['now', 'next', 'later']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseHorizon(value: unknown): RoadmapHorizon {
  if (typeof value === 'string' && ROADMAP_HORIZONS.includes(value as RoadmapHorizon)) {
    return value as RoadmapHorizon
  }
  return 'next'
}

export function parseRoadmapItem(value: unknown): RoadmapItem | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null

  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    horizon: parseHorizon(value.horizon),
    quarter: typeof value.quarter === 'string' ? value.quarter : null,
  }
}

export function createRoadmapItem(input: CreateRoadmapItemInput): RoadmapItem {
  return {
    id: `roadmap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    horizon: input.horizon ?? 'next',
    quarter: input.quarter ?? null,
  }
}

export { ROADMAP_HORIZONS }
