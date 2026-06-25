export type RunMetrics = {
  durationMs: number | null
  estimatedCost: number
  estimatedTokens: number
  memoryRecords: number
  knowledgeRecords: number
  toolCalls: number
  warnings: number
}

export function computeDurationMs(
  startedAt: string,
  finishedAt: string | null,
): number | null {
  if (!finishedAt) return null
  return Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
}

export function emptyRunMetrics(): RunMetrics {
  return {
    durationMs: null,
    estimatedCost: 0,
    estimatedTokens: 0,
    memoryRecords: 0,
    knowledgeRecords: 0,
    toolCalls: 0,
    warnings: 0,
  }
}
