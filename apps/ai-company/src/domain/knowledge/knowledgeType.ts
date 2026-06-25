export const KNOWLEDGE_TYPES = [
  'documentation',
  'adr',
  'wiki',
  'standard',
  'instruction',
  'architecture',
  'decision',
  'best_practice',
  'api',
  'prompt_pack',
  'runbook',
  'manual',
] as const

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]
