export const KNOWLEDGE_SOURCES = [
  'markdown',
  'pdf',
  'url',
  'local_file',
  'generated',
  'imported',
] as const

export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number]
