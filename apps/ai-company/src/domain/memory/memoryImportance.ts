export const MEMORY_IMPORTANCE_LEVELS = ['low', 'normal', 'high', 'critical'] as const

export type MemoryImportance = (typeof MEMORY_IMPORTANCE_LEVELS)[number]

export const IMPORTANCE_WEIGHT: Record<MemoryImportance, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
}

export const IMPORTANCE_COLORS: Record<MemoryImportance, string> = {
  low: 'Muted',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
}
