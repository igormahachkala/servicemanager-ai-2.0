export const MEMORY_TYPES = [
  'conversation',
  'decision',
  'knowledge',
  'experience',
  'report',
  'document',
  'relationship',
  'task',
  'workspace',
] as const

export type MemoryType = (typeof MEMORY_TYPES)[number]

export const MEMORY_TYPE_META: Record<MemoryType, { icon: string; order: number }> = {
  conversation: { icon: '💬', order: 1 },
  decision: { icon: '⚖', order: 2 },
  knowledge: { icon: '📚', order: 3 },
  experience: { icon: '✦', order: 4 },
  report: { icon: '📋', order: 5 },
  document: { icon: '📄', order: 6 },
  relationship: { icon: '🔗', order: 7 },
  task: { icon: '▤', order: 8 },
  workspace: { icon: '◧', order: 9 },
}
